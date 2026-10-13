# Mega Hub → Supabase switch-over plan

Status: **ready, not active.** The live app still stores data on each device. Nothing here runs until the
steps below are done. Local mode stays the default: with no env vars set, the app behaves exactly as today.

## What's in the `supabase` branch

| Piece | File |
|---|---|
| Schema, RLS, triggers, seed departments/roles | `supabase/migrations/20261012000000_init.sql` |
| RLS tests per role (126 checks, real Postgres via PGlite) | `supabase/tests/rls.test.mjs` |
| Import + round-trip test (15 checks, incl. lesson files) | `supabase/tests/import.test.mjs` |
| App ⇄ table mapping + diff writer | `src/data/supabaseMapping.ts` |
| Repository adapter (same `Repository` interface) | `src/data/supabaseRepository.ts` |
| Backend switch | `src/data/repository.ts` (`EXPO_PUBLIC_BACKEND=supabase`) |
| Owner-only account admin (create, reset password, set-username, set-active/ban) | `supabase/functions/admin-users/index.ts` |
| One-time import tool | `scripts/supabase-import.mjs` (+ `supabase-import-core.mjs`) |
| Owner "Export data" button (live on main: Profile → Admin; data:v4 + lesson files) | `src/data/export.ts`, `app/(tabs)/profile.tsx` |
| Kids lessons: local data URLs / Supabase `lessons` table + Storage bucket | `src/data/files.ts`, migration `20261012110000_lessons.sql` |
| Local Supabase config (rehearsal) | `supabase/config.toml` |
| Go-live runbook | `docs/GO_LIVE_RUNBOOK.md` |

Run tests: `npm run test:supabase` (no account or Docker needed).

## Data model (short)
- `profiles` (directory: id, username, tier, active, language, theme). Every signed-in user can read it, so shared views show **@username only**.
- `profile_private` (names, dob, contact, email). Readable by **self, owner, admins** only.
- `departments`, `department_roles`, `user_departments`, `user_positions`, `admin_of`.
- `unavailability (user_id, date, note)`. Readable with notes by self, owner and admins. Everyone else can only use `unavailable_days` (no notes).
- `services`, `service_slots`, `assignments`, `settings`.

## Rules enforced by the database (same as the app today)
- **Volunteer:** edits own profile (names, dob, contact, email, language, theme) and own unavailability. Can't change own tier, username, departments, roles or assignments.
- **Admin:**
  - Manages departments, roles and assignments only for departments they administer, and only for non-owner members of those departments (or unassigned volunteers).
  - Can't change other people's names, contact, email or password, or edit the owner. Can change a member's dob (as in the app).
  - Assignments require the person to hold the role and not be unavailable that day.
- **Owner:** unrestricted (can't demote themself). Services and slots are owner-only.
- **Triggers:** marking yourself unavailable removes your assignments that day, and removing a role removes the matching assignments.

## Sign-in (username + password only)
- Each account gets a synthetic Auth email: `username@megahub.local` (lowercased, accents removed). It's never shown and never emailed; people type only username and password.
- Requires **Confirm email = OFF** and **email signups disabled for the public** (accounts are created only by the owner through the `admin-users` function).
- Password changes in Profile still need the current password: it's re-checked with Auth, then updated.
- **Owner-only resets** go through the `admin-users` edge function, which uses the service-role key held by Supabase (never in the app). The person must choose a new password at next sign-in.
- Supabase's minimum password length is 6, so the current 4-character passwords (e.g. `2026`) can't be carried over. Everyone gets a temp password instead (see import).

## Switch-over steps

### Marcos (about 10 minutes, free plan)
1. Go to https://supabase.com → **Start your project** → sign up (GitHub or email).
2. **New project**: name `mega-hub`, choose a strong database password (keep it to yourself), region **West EU (London) – eu-west-2** (Marcos is in the UK) → Create.
3. **Authentication → Sign In / Providers → Email**: keep Email **enabled**, turn **Confirm email OFF**. Under Authentication settings, turn **Allow new users to sign up OFF**.
4. **Project Settings → API**: send me (privately, not in group chat) the **Project URL** and the **anon public** key. The `service_role` key is needed only for the one-time import: either paste it yourself when I run the import, or add me to the project (**Settings → Team → Invite**) so I can read it there. Never post it in chat.
5. Create a **personal access token** (Account → Access Tokens) and submit it via the secure form (`SUPABASE_ACCESS_TOKEN`).
6. In the **live app** (on the device that has the lessons): Profile → Admin → **Export data**. Send me `megahub-export-YYYY-MM-DD.json` privately (it includes Kids lesson files).

### Me (Tom)
1. With `SUPABASE_ACCESS_TOKEN` set: `npx supabase link --project-ref <ref>` → `npx supabase db push` (applies the migration).
2. `npx supabase functions deploy admin-users` (Supabase provides the service key to the function automatically).
3. Rehearse the import: `node scripts/supabase-import.mjs export.json --dry-run`. It shows the row counts and writes nothing.
4. Real import: `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/supabase-import.mjs export.json`.
   - The import is idempotent (safe to re-run) and verifies row counts.
   - It writes `megahub-temp-passwords.csv` (chmod 600).
5. Hand the CSV to Marcos privately, then delete it. He gives each person their temp password; on first sign-in everyone must set their own.
6. Full step list: `docs/GO_LIVE_RUNBOOK.md`. Build with `EXPO_PUBLIC_BACKEND=supabase EXPO_PUBLIC_SUPABASE_URL=… EXPO_PUBLIC_SUPABASE_ANON_KEY=…` (the anon key is public by design; RLS protects data), test on a preview URL with real accounts per role, then deploy.
7. Freeze window: from export until switch-over (about 1 hour), nobody edits in the old app, so no edits are lost.

## Risks
- **Edits made after the export** won't be imported. Mitigation: freeze window, or re-export and re-run the import (idempotent upsert).
- **Temp passwords** must be shared privately; leaked CSV = account takeover until changed. Delete it after use.
- **Free plan pauses** after about 7 days of no activity. Weekly Sunday use is normally enough; if paused, Marcos clicks Restore. Daily backups need the Pro plan, so do a weekly manual export (`supabase db dump`) as backup.
- **Offline:** Supabase mode needs internet. The app shows the last loaded data, but saves fail. If the server rejects a write, the app reloads the server's version.
- **Concurrent edits:** last write wins per row (the diff writer only sends rows that changed, so conflicts are small).
- **Lost owner password:** recovery is via the Supabase dashboard (Authentication → Users → reset), only by Marcos.

## Rollback
- The local-mode build is untouched. To roll back, redeploy the previous `main` build (`./deploy.sh` from main), and the app uses on-device data again. Each device still has its pre-switch local data, because Supabase mode uses different storage and never deletes the old `megahub:data:v4`.
- Supabase data stays in the project for a later retry. A full reset is possible with `npx supabase db reset --linked` (destructive; only if starting over).

## Service drafts (migration 20261012010000_service_drafts.sql)
- `services.status text not null default 'published'` (`draft|published`); existing rows become published.
- RLS: volunteers can't select draft services, their slots or their assignments (`service_visible()`); owner/admins can. Only the owner can publish (services write policy is owner-only).
- Adapter: `status` mapped both ways; app `status` missing = published, so a published service comes back without the field (same meaning).

## Service setlist (migration 20261012020000_setlist.sql)
- `setlist_items(id, service_id → services on delete cascade, position, title, key, notes, song_id nullable)`; app order = array index ↔ `position`.
- RLS: read = service visible (drafts rule) AND (owner/admin OR Music member OR assigned on that service). Write = owner or Music admin (`administers('d-music')`).
- Adapter maps `Service.setlist` ↔ rows; empty/missing setlist = no rows. `song_id` reserved for phase 2 — see docs/SONG_LIBRARY_PLAN.md.

## Department pages + song library (migration 20261012030000_dept_pages_songs.sql)
- `departments.description`; owner or that department's admins may change it (trigger keeps name/emoji/colour/sort owner-only).
- `department_resources(id, department_id, position, title, url, kind 'link'|'file' default 'link', file_ref nullable)`. Only links are built; `kind='file'` + `file_ref` (Storage path) reserved for uploads after the switch-over. Read: staff + department members. Write: owner + that department's admins.
- `songs(id, department_id default 'd-music', title, artist, key, chords, link)`; `setlist_items.song_id` now FK → songs on delete set null. Read: staff, Music members, or anyone who can see a setlist using the song. Write: owner + Music admins.
- Adapter maps `Department.description/resources` and `AppData.songs` both ways.

## Songs v2 + Live mode (migration 20261012040000_songs_v2.sql)
- `songs.artist` renamed to `composer`; new `time_signature`, `bpm` (1–400), `sections jsonb` (array of `{id, name, cue?, bars[], notes?}`; chords written in `songs.key`, transposed client-side). `key` must look like `C`, `F#`, `Bbm`. Legacy `chords` text kept.
- `can_live(service_id)`: owner / Music admin, or Music member assigned on that (visible) service. No new table — Live mode reads setlist_items + songs under existing RLS.
- Adapter maps composer (legacy `artist` accepted), timeSignature, bpm, sections.

## Unavailability ranges + STRICT admin scoping (migration 20261012050000_ranges_strict.sql)
- `unavailability.date_to` (nullable, `>= date`); `unavailable_on(user, date)` covers ranges; `can_fill` and the clear-assignments trigger (insert or date change) use it. `unavailable_days` view adds `date_to` (still no notes). Note RLS unchanged.
- STRICT: `views_dept(dep)` = owner, that dept's admins, or its members. `department_resources` and `songs` read via `views_dept`; `can_see_setlist` = visible service AND `views_dept('d-music')` — assigned non-Music people no longer read setlists/songs. Assignments/services stay readable as before.
- (Resolved in 20261012060000) department descriptions now live in `department_pages`.

## Private descriptions + double book / swap (migration 20261012060000_dept_pages_swap.sql)
- `department_pages(department_id pk, description)`: data copied from `departments.description`, column dropped. Read `views_dept`, write `administers`. Adapter maps `Department.description` <-> `department_pages`.
- Double booking: no per-user uniqueness on `assignments`; `can_fill` checks role/active/unavailability only, so it's already allowed.
- `assign_swap(service, dep, role, idx, user)` (security invoker, so RLS applies to every write): moves the user into the target and clears their other slot in that service (left unfilled); any previous occupant of the target is replaced, never traded. It raises (and changes nothing) when the caller can't change the other slot's department.

## Assembly role + default location (migration 20261012070000_assembly_location.sql)
- Music role `Assembly` (app labels: en Assembly / pt Montagem) appended to `department_roles`. Additive: no existing services, assignments or profiles are touched.
- `department_roles.default_count` holds the default slots for new services: Assembly 3; Backing Vocals and Kids Assistant 2; others 1. The adapter writes it from `DEFAULT_SLOT_COUNTS`.
- `services.location` defaults to '1 Main St, Farcet, Peterborough PE7 3AN' for new rows. Existing locations are unchanged.
- Merged main (delete/confirm fix, multi-tab sync). Multi-tab rebase is disabled in Supabase mode, where the server is the source of truth.

## One-role rule (migration 20261012080000_one_role.sql)
- Trigger `one_role_guard (dropped in 20261012090000: replaced by same_role_guard, double booking allowed)` on `assignments` (insert/update): within a service a person may hold at most one non-exempt role; Desk and Assembly (`is_exempt_role`, by role id) are exempt; never two slots of the same role. It raises `role conflict` (check_violation).
- Only new writes are checked. Unchanged rows and the service-role import (`auth.uid()` null) bypass it, so legacy conflicts are kept as-is. The app shows them as a warning.
- Adapter/app: the same rule runs in `src/data/rota.ts` (`roleConflict` / `newConflict`), used by AppContext before any write.

## Kids lessons (migration 20261012110000_lessons.sql)
- `lessons(id uuid, department_id = 'd-kids', title 1–120, file_name, mime (PDF/images/Office), size_bytes ≤ 5 MB, storage_path '<dept>/<id>/<file>', created_by, created_at)`; trigger allows only title changes.
- Private Storage bucket `lessons` (5 MB, mime allow-list). `storage.objects` policies use the first path segment: read `views_dept`, write/delete `administers` (Kids only).
- App: in Supabase mode `src/data/files.ts` lists from `lessons`, uploads to Storage, renames/deletes row + file, opens/downloads via Storage; no device-only note. Device mode unchanged (`megahub:files:v1`).
- Import: lesson files from the export (`files.lessons`, data URLs) are uploaded to Storage with stable ids (re-run safe).

## Accounts in Supabase mode
- `admin-users` actions: `create`, `reset-password`, `set-username` (keeps the synthetic Auth email in step), `set-active` (Auth ban/unban; owner can't be deactivated). Owner-only, service key stays on the server.
- Owner edits in Accounts route username/active/password through the function; tier/admin-of go through RLS.
