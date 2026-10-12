# Mega Hub → Supabase switch-over plan

Status: **ready, not active.** The live app still stores data on each device. Nothing here runs until the
steps below are done. Local mode stays the default: with no env vars set, the app behaves exactly as today.

## What's in the `supabase` branch

| Piece | File |
|---|---|
| Schema, RLS, triggers, seed departments/roles | `supabase/migrations/20261012000000_init.sql` |
| RLS tests per role (41 checks, real Postgres via PGlite) | `supabase/tests/rls.test.mjs` |
| Import + round-trip test (11 checks) | `supabase/tests/import.test.mjs` |
| App ⇄ table mapping + diff writer | `src/data/supabaseMapping.ts` |
| Repository adapter (same `Repository` interface) | `src/data/supabaseRepository.ts` |
| Backend switch | `src/data/repository.ts` (`EXPO_PUBLIC_BACKEND=supabase`) |
| Owner-only account admin (create, reset password) | `supabase/functions/admin-users/index.ts` |
| One-time import tool | `scripts/supabase-import.mjs` (+ `supabase-import-core.mjs`) |
| Owner "Export data" button (only with `EXPO_PUBLIC_ENABLE_EXPORT=1`) | `app/(tabs)/accounts.tsx` |

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
2. **New project**: name `mega-hub`, choose a strong database password (keep it to yourself), region **South America (São Paulo)** or the closest one → Create.
3. **Authentication → Sign In / Providers → Email**: keep Email **enabled**, turn **Confirm email OFF**. Under Authentication settings, turn **Allow new users to sign up OFF**.
4. **Project Settings → API**: send me (privately, not in group chat) the **Project URL** and the **anon public** key. The `service_role` key is needed only for the one-time import: either paste it yourself when I run the import, or add me to the project (**Settings → Team → Invite**) so I can read it there. Never post it in chat.
5. In the **live app** (current version, on the device you use): Accounts → **Export data** (I'll publish a build with this button for that day only). Send me the downloaded `megahub-export-YYYY-MM-DD.json` privately.

### Me (Tom)
1. `npx supabase login` → `npx supabase link --project-ref <ref>` → `npx supabase db push` (applies the migration).
2. `npx supabase functions deploy admin-users` (Supabase provides the service key to the function automatically).
3. Rehearse the import: `node scripts/supabase-import.mjs export.json --dry-run`. It shows the row counts and writes nothing.
4. Real import: `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/supabase-import.mjs export.json`.
   - The import is idempotent (safe to re-run) and verifies row counts.
   - It writes `megahub-temp-passwords.csv` (chmod 600).
5. Hand the CSV to Marcos privately, then delete it. He gives each person their temp password; on first sign-in everyone must set their own.
6. Build with `EXPO_PUBLIC_BACKEND=supabase EXPO_PUBLIC_SUPABASE_URL=… EXPO_PUBLIC_SUPABASE_ANON_KEY=…` (the anon key is public by design; RLS protects data), test on a preview URL with real accounts per role, then deploy.
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
- Known gap: `departments.description` is a column on the publicly-readable `departments` table; if it must be private, move it to a `department_pages` table with `views_dept` RLS before switch-over.
