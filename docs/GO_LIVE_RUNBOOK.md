# Mega Hub: Supabase go-live runbook

Region: **London (eu-west-2)**. Rehearsed end to end on a local Supabase stack (CLI 2.120 + Docker), 2026-10-13.
Production stays on device storage until step 7. Rollback is always available (see the end).

## What's needed from Marcos
1. **A Supabase account and a project:** name `mega-hub`, region **West EU (London) – eu-west-2**, free plan, a strong DB password (he keeps it).
2. **A personal access token**, sent through the secure form so it lands in `SUPABASE_ACCESS_TOKEN`. It is used only by the CLI.
3. **Authentication settings:**
   - Under Sign In / Providers → Email: keep Email ON and turn **Confirm email OFF**.
   - Turn **Allow new users to sign up OFF**.
4. **The export file:** on go-live day, in the live app, go to Profile → Admin → **Export data**. Send `megahub-export-YYYY-MM-DD.json` privately. It contains personal data and lesson files.
5. **Agree a freeze window** (about 1 hour), from the export until the switch. No edits in the old app during that time.

## Steps (me)
```bash
cd mega-hub-perms                       # branch: supabase
export SUPABASE_ACCESS_TOKEN=…          # from the secure form (never commit)
npx supabase link --project-ref <ref>   # region is fixed at project creation: eu-west-2
npx supabase db push                    # applies all migrations (incl. lessons table + 'lessons' bucket)
npx supabase functions deploy admin-users
# keys: Project Settings → API (URL, anon; service_role only for the import, kept in the shell)
node scripts/supabase-import.mjs megahub-export-….json --dry-run
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=… node scripts/supabase-import.mjs megahub-export-….json
```
- **Use Node 22+.** On older Node the script loads `ws` itself.
- **The import:**
  - It is idempotent and verifies row counts.
  - It uploads each Kids lesson file to Storage `lessons/d-kids/<id>/<file>` and creates its `lessons` row. Lessons with no file data or over 5 MB are skipped and listed.
- **Passwords:**
  - Everyone gets a new 10-character temp password, written to `megahub-temp-passwords.csv` (chmod 600). Supabase's minimum is 6, so the current 4-character passwords can't be kept.
  - Send the CSV to Marcos privately, then **delete it**. Everyone must set their own password at first sign-in.

6. **Preview build:**
   - Build with `EXPO_PUBLIC_BACKEND=supabase EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon>` and `npx expo export --platform web --clear`.
   - Smoke test one owner, one admin and one volunteer: sign in, forced change, services, assign, setlist, songs, lessons, availability.
7. **Switch:** merge `supabase` into `main` with those env vars set in `deploy.sh`, deploy `--clear`, check Pages serves the new entry hash, then sign in as the owner.
8. **After the switch:**
   - Delete the CSV.
   - Weekly backup: `npx supabase db dump --linked > backup.sql` (the free plan has no daily backups).
   - If the project pauses after 7 idle days, Marcos clicks Restore.

## Rollback
- Redeploy the previous `main` build. Devices still hold their old `megahub:data:v4` and `megahub:files:v1`, because Supabase mode doesn't delete them.
- Supabase data stays in place for a retry.

## Rehearsal results (local)
- **Database:** all 12 migrations applied with `supabase start` and `db reset`. RLS 126/126 and import 15/15 (PGlite).
- **Import of a live-shaped export:** 19 users / 19 temp passwords (10 chars), plus a lesson file in Storage. It verifies counts and a re-run creates nothing.
- **Playwright, iPhone 13 and Pixel 7:** owner, Music admin, Kids admin and volunteer each signed in with a temp password, were forced to change it, and signed in again. They then covered:
  - services and setlists (library songs);
  - assign and reassign;
  - songs;
  - lessons: upload, rename, delete, 5 MB limit, view and download;
  - availability;
  - read-only limits.
- **`admin-users`:** 14/14. Owner only; create; reset-password; set-username (sign-in email follows); set-active (Auth ban); the owner can't be deactivated; 4-character passwords refused.
- **Fixed during the rehearsal:**
  1. The Supabase adapter treated unchanged rows as changed (DB `16:00:00` vs app `16:00`). It re-upserted them, which made admins' saves fail under RLS and blocked the owner's later saves.
  2. Username changes and deactivation weren't reaching Auth. Fixed with new `set-username` and `set-active` actions.
  3. The import failed on Node 20 (no WebSocket).
- **Local Docker on this box** needed `bridge-nf-call-iptables=0` and `iptables-legacy -P FORWARD ACCEPT`. That's a box quirk, not needed in production.
