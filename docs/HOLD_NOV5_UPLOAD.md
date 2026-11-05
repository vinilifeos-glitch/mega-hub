# Hold Nov 5 updates — upload checklist

Do these **in order** when Marcos says upload. Do not merge/deploy before the migration.

## What this branch adds
1. **Live sync** — Supabase Realtime on assignments/services/slots/setlist/lessons/rota_acks + reload on focus + Refresh buttons.
2. **My Rota acknowledge** — yellow pending → Acknowledge → Confirm (green) or I'm not available → confirm (admins see status).
3. **OS phone notifications every 4h until ack** — Web Push + service worker (`web/sw.js`). Free path: browser/PWA push (no App Store). Background every-4h via edge function + GitHub Actions cron.
4. **Admin tab** + **Services renamed to Events** (view-only for everyone). Create/edit events and accounts live under Admin.

WhatsApp/email notify: **not built** (scrapped).

## OS push — honest limits (free tier)
| Platform | Works? |
|----------|--------|
| Android Chrome / installed PWA | Yes — Web Push OS banners |
| iPhone Safari | Only after **Add to Home Screen** (iOS 16.4+); then allow notifications |
| Closed app, every 4h | Needs VAPID keys + `notify-rota` edge function + GitHub Actions cron (all free) |
| App Store / Play Store native build | **Not required** for this path; Expo native push would need EAS/store builds later |

No paid third-party push vendor was added.

## Upload steps
1. Apply migration `supabase/migrations/20261105120000_rota_acks_push.sql` on hosted project (Management API / SQL editor).
2. Generate VAPID keys: `node scripts/generate-vapid.mjs` (needs `npm i web-push` once). Put **public** in `deploy.sh` as `EXPO_PUBLIC_VAPID_PUBLIC_KEY=...`. Put **private** + `VAPID_SUBJECT=mailto:...` + `NOTIFY_CRON_SECRET=...` as edge function secrets. Never commit the private key.
3. Deploy edge function `notify-rota`.
4. Confirm Realtime publication includes the tables (migration tries to add them).
5. Fast-forward merge `hold-nov5-updates` → `main` (no force-push).
6. Run `./deploy.sh` (copies `web/sw.js` into `dist`).
7. Sync `supabase` branch if you keep it.
8. Optional: set GitHub repo secrets `NOTIFY_FUNCTION_URL` + `NOTIFY_CRON_SECRET` so `.github/workflows/notify-rota.yml` can call the function every 4h.

## Not applied yet
Live hosted DB was **not** mutated while building on hold.
