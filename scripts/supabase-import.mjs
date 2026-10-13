#!/usr/bin/env node
// One-time import of the owner's exported JSON into Supabase.
// Usage:  SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/supabase-import.mjs megahub-export.json [--dry-run]
// The service-role key bypasses RLS: run this only on a trusted machine, never commit or ship it.
// Writes temp passwords to ./megahub-temp-passwords.csv (chmod 600) to hand out privately; delete it afterwards.
import fs from 'fs'; import { createClient } from '@supabase/supabase-js';
import { readExport, runImport } from './supabase-import-core.mjs';

const [file, ...flags] = process.argv.slice(2); const dryRun = flags.includes('--dry-run');
if (!file) { console.error('usage: node scripts/supabase-import.mjs <export.json> [--dry-run]'); process.exit(2); }
const data = readExport(file);
const authEmail = u => `${u.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}@megahub.local`;
let db = null;
if (!dryRun) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(2); }
  // Node < 22 has no global WebSocket (supabase-js needs one even though this script never uses realtime)
  const transport = globalThis.WebSocket ?? (await import('ws').catch(() => null))?.default;
  if (!transport) { console.error('Use Node 22+ (or npm i ws)'); process.exit(2); }
  const sb = createClient(url, key, { auth: { persistSession: false }, realtime: { transport } });
  const ok = r => { if (r.error) throw r.error; return r.data; };
  db = {
    findLegacy: async legacy => ok(await sb.from('profiles').select('id').eq('legacy_id', legacy).maybeSingle())?.id ?? null,
    createAuthUser: async (username, password) => {
      const r = await sb.auth.admin.createUser({ email: authEmail(username), password, email_confirm: true });
      if (r.error) throw new Error(`${username}: ${r.error.message}`); return r.data.user.id;
    },
    upsert: async (table, rows, keys) => { for (let i = 0; i < rows.length; i += 500) ok(await sb.from(table).upsert(rows.slice(i, i + 500), { onConflict: keys.join(',') })); },
    uploadFile: async (bucket, path, bytes, mime) => ok(await sb.storage.from(bucket).upload(path, bytes, { contentType: mime, upsert: true })),
    count: async table => (await sb.from(table).select('*', { count: 'exact', head: true })).count ?? 0,
  };
}
const res = await runImport(data, db, { dryRun });
console.log(`users: ${data.users.length}, new auth accounts: ${res.created.length}${dryRun ? ' (dry run, nothing written)' : ''}`);
if (!dryRun && res.created.length) {
  const out = 'megahub-temp-passwords.csv';
  fs.writeFileSync(out, 'username,tier,temp_password\n' + res.created.map(c => `${c.username},${c.tier},${c.password}`).join('\n') + '\n', { mode: 0o600 });
  console.log(`temp passwords written to ${out} (share privately, then delete)`);
}
