// Import + round-trip test on real Postgres (PGlite): live-shaped export -> schema -> back to AppData, nothing lost.
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs'; import path from 'path'; import assert from 'assert'; import crypto from 'crypto';
import { legacyUuid, readExport, runImport, loadMapping } from '../../scripts/supabase-import-core.mjs';
const dir = path.dirname(new URL(import.meta.url).pathname);
const db = new PGlite();
await db.exec(`create role authenticated nologin; create role anon nologin; create schema auth;
  create table auth.users (id uuid primary key, email text unique);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
await db.exec(`
  -- Supabase Storage stand-in (schema subset used by migrations)
  create schema storage; create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid default auth.uid(), unique (bucket_id, name));
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema storage to authenticated; grant select, insert, update, delete on storage.objects to authenticated; grant select on storage.buckets to authenticated;
  grant execute on function storage.foldername(text) to authenticated;`);
for (const f of fs.readdirSync(path.join(dir, '../migrations')).sort()) await db.exec(fs.readFileSync(path.join(dir, '../migrations', f), 'utf8'));
const data = readExport(path.join(dir, 'fixtures/live-shaped.json'));
const uploaded = [];
const pdf = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4 test').toString('base64');
data.__lessons = [
  { id: 'ls-a', deptId: 'd-kids', title: 'Arca de Noé', name: 'Lição 1.pdf', mime: 'application/pdf', size: 13, dataUrl: pdf, createdAt: '2026-10-13T10:00:00Z', by: data.users[0].id },
  { id: 'ls-b', deptId: 'd-kids', title: 'Broken', name: 'x.pdf', mime: 'application/pdf', size: 1, createdAt: '2026-10-13T10:00:00Z', by: 'nobody' }];
data.services[0].lessons = ['ls-a', 'ls-missing'];
const adapter = {
  findLegacy: async l => (await db.query('select id from profiles where legacy_id=$1', [l])).rows[0]?.id ?? null,
  createAuthUser: async (u, _pw) => { const id = crypto.randomUUID(); await db.query('insert into auth.users values ($1,$2)', [id, u.toLowerCase() + '@megahub.local']); return id; },
  upsert: async (t, rows, keys) => {
    for (const r of rows) {
      const cols = Object.keys(r); const vals = cols.map(c => r[c]);
      const upd = cols.filter(c => !keys.includes(c));
      await db.query(`insert into ${t} (${cols.join(',')}) values (${cols.map((_, i) => '$' + (i + 1)).join(',')})
        on conflict (${keys.join(',')}) do ${upd.length ? 'update set ' + upd.map(c => `${c}=excluded.${c}`).join(',') : 'nothing'}`, vals);
    }
  },
  uploadFile: async (bucket, p, bytes, mime) => { await db.query(`insert into storage.objects (bucket_id, name) values ($1,$2) on conflict (bucket_id, name) do nothing`, [bucket, p]); uploaded.push([p, bytes.length, mime]); },
  count: async t => Number((await db.query(`select count(*)::int n from ${t}`)).rows[0].n),
};
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('PASS', m); };
const r1 = await runImport(data, adapter, { log: () => {} });
ok(r1.created.length === data.users.length, 'one auth account + temp password per user');
ok(r1.created.every(c => c.password.length >= 10), 'temp passwords >= 10 chars');
ok(Number((await db.query('select count(*)::int n from lessons')).rows[0].n) === 1 && r1.counts.lesson_files_skipped === 1, 'lessons: file uploaded + row created; file-less lesson skipped');
{ const l = (await db.query('select * from lessons')).rows[0]; ok(l.title === 'Arca de Noé' && l.file_name === 'Lição 1.pdf' && /^d-kids\/[0-9a-f-]{36}\/Licao_1\.pdf$/.test(l.storage_path) && l.size_bytes === 13 && l.created_by === r1.idMap.get(data.users[0].id) && uploaded[0][0] === l.storage_path && uploaded[0][2] === 'application/pdf', 'lessons: metadata + storage path + owner mapped'); }
ok(data.users.every(u => !r1.created.some(c => c.username === u.username && (c.password.length < 6))), 'no temp password below Supabase 6-char minimum (current 4-char passwords are replaced)');
{ const r = (await db.query('select * from service_lessons order by position')).rows; const L = (await db.query('select id from lessons')).rows[0].id;
  ok(r.length === 2 && r[0].lesson_id === L && r[0].service_id === data.services[0].id && r[1].position === 1, 'service lessons imported in order, mapped to the imported lesson uuid (missing one kept)'); }
const r2 = await runImport(data, adapter, { log: () => {} });
ok(r2.created.length === 0, 're-running import is idempotent (no duplicate accounts)');
ok(Number((await db.query('select count(*)::int n from lessons')).rows[0].n) === 1, 're-run: no duplicate lessons');
ok(Number((await db.query('select count(*)::int n from profiles')).rows[0].n) === data.users.length, 'no duplicate profiles');
// round trip
const M = await loadMapping();
const T = M.ORDER; const rows = {};
for (const t of T) rows[t] = (await db.query(`select * from ${t}`)).rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? v.toISOString().slice(0, 10) : v])));
const back = M.fromRows(rows);
const inv = new Map([...r1.idMap].map(([a, b]) => [b, a]));
const norm = d => ({
  users: d.users.map(u => ({ id: inv.get(u.id) ?? u.id, username: u.username, role: u.role, active: u.active, firstName: u.firstName, middleNames: u.middleNames, lastName: u.lastName,
    dob: u.dob, contact: u.contact || '', email: u.email || '', language: u.language ?? null, theme: u.theme ?? null,
    deps: [...u.departmentIds].sort(), pos: JSON.stringify(Object.fromEntries(Object.entries(u.positions ?? {}).filter(([k]) => u.departmentIds.includes(k)).map(([k, v]) => [k, [...v].sort()]).sort())),
    adminOf: u.role === 'admin' ? [...(u.adminOf ?? [])].sort() : [], unavailable: JSON.stringify((u.unavailable ?? []).map(x => ({ date: x.date, note: x.note || null })).sort((a, b) => a.date.localeCompare(b.date))) })).sort((a, b) => a.id.localeCompare(b.id)),
  services: d.services.map(({ lessons, ...s }) => ({ ...s, ...(lessons ? { lessons } : {}), slots: [...s.slots].sort((a, b) => (a.departmentId + a.position).localeCompare(b.departmentId + b.position)) })),
  assignments: d.assignments.map(a => ({ ...a, userId: inv.get(a.userId) ?? a.userId })).sort((a, b) => a.id.localeCompare(b.id)),
  departments: d.departments.map(x => ({ ...x, leaderId: null })),
});
// app migrate() adds the Assembly role to Music on load; the DB migration does the same
const withAsm = d => ({ ...d, departments: d.departments.map(x => x.id === "d-music" && !x.positions.includes("Assembly") ? { ...x, positions: [...x.positions, "Assembly"] } : x) });
const A = norm(withAsm({ ...data, services: data.services.map(sv => sv.lessons ? { ...sv, lessons: sv.lessons.map(legacyUuid) } : sv) })), B = norm(back);
for (const k of Object.keys(A)) { if (JSON.stringify(A[k]) !== JSON.stringify(B[k])) { for (let i = 0; i < A[k].length; i++) if (JSON.stringify(A[k][i]) !== JSON.stringify(B[k][i])) { console.log('DIFF', k, JSON.stringify(A[k][i]), '\n    ', JSON.stringify(B[k][i])); break; } } ok(JSON.stringify(A[k]) === JSON.stringify(B[k]), `round trip: ${k} identical`); }
ok(back.users.every(u => u.mustChangePassword), 'all imported users must change password on first sign-in');
// diff writer: unchanged data -> no writes; one change -> one upsert
const snap = M.toRows(back);
ok(M.diffRows(snap, M.toRows(back)).length === 0, 'adapter save(): unchanged data produces no writes');
const changed = JSON.parse(JSON.stringify(back)); changed.users[0].theme = 'dark';
const df = M.diffRows(snap, M.toRows(changed)); ok(df.length === 1 && df[0].table === 'profiles' && df[0].upsert.length === 1, 'adapter save(): one change -> one row update');
console.log(`${n} passed`);
