// Shared import logic (used by scripts/supabase-import.mjs and the PGlite test). No secrets here.
import ts from 'typescript'; import fs from 'fs'; import crypto from 'crypto';

export async function loadMapping() {
  const src = fs.readFileSync(new URL('../src/data/supabaseMapping.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  return import('data:text/javascript,' + encodeURIComponent(js));
}
/** Readable temp password (no 0/O/1/l), 10 chars. */
export const tempPassword = () => { const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'; return Array.from(crypto.randomBytes(10), b => a[b % a.length]).join(''); };
/** Accepts the app's Export data file ({format, data, files:{lessons}}) or raw AppData. Lessons ride along as data.__lessons. */
export function readExport(path) {
  const j = JSON.parse(fs.readFileSync(path, 'utf8'));
  const data = j.data ?? j;
  if (!Array.isArray(data.users) || !Array.isArray(data.services)) throw new Error('Not a Mega Hub export');
  return { ...data, __lessons: Array.isArray(j.files?.lessons) ? j.files.lessons : [] };
}
/** Stable uuid for a legacy id (idempotent re-runs). */
export const legacyUuid = s => { const h = crypto.createHash('sha1').update('megahub:' + s).digest('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; };
const safeName = n => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120) || 'file';
/** Lesson rows + file bytes from the export (data URLs). Skips anything the DB would reject, with a reason. */
export function lessonRows(lessons, idMap) {
  const ok = [], skipped = [];
  for (const l of lessons ?? []) {
    const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(l.dataUrl ?? '');
    if (!m) { skipped.push([l.title, 'no file data']); continue; }
    const bytes = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]));
    if (bytes.length > 5242880) { skipped.push([l.title, 'over 5 MB']); continue; }
    const id = legacyUuid(l.id), mime = l.mime || m[1] || 'application/octet-stream', dep = l.deptId || 'd-kids';
    const path = `${dep}/${id}/${safeName(l.name || 'file')}`;
    ok.push({ row: { id, department_id: dep, title: String(l.title || l.name || 'Lesson').trim().slice(0, 120), file_name: l.name || 'file', mime, size_bytes: bytes.length, storage_path: path,
      created_by: idMap.get(l.by) ?? null, created_at: l.createdAt || new Date().toISOString() }, bytes, path, mime });
  }
  return { ok, skipped };
}

/**
 * Idempotent import. db adapter:
 *   findLegacy(legacyId) -> uuid|null, createAuthUser(username, password) -> uuid,
 *   upsert(table, rows, keyCols), count(table) -> n, uploadFile(bucket, path, bytes, mime) (upsert)
 * Returns { idMap, created: [{username, password}], counts }.
 */
export async function runImport(data, db, { dryRun = false, log = console.log } = {}) {
  const M = await loadMapping();
  const idMap = new Map(); const created = [];
  for (const u of data.users) {
    let id = db ? await db.findLegacy(u.id) : null;
    if (!id) {
      const password = tempPassword();
      id = dryRun ? `dry-${u.id}` : await db.createAuthUser(u.username, password);
      created.push({ username: u.username, password, tier: u.role });
    }
    idMap.set(u.id, id);
  }
  // everyone signs in with a temp password first and then picks their own
  const { __lessons, ...plain } = data;
  const imported = { ...plain, users: data.users.map(u => ({ ...u, mustChangePassword: true })) };
  const rows = M.toRows(imported, id => idMap.get(id) ?? id);
  rows.profiles = rows.profiles.map(p => ({ ...p, legacy_id: data.users.find(u => idMap.get(u.id) === p.id)?.id ?? null }));
  const counts = {};
  for (const t of M.ORDER) {
    counts[t] = rows[t].length;
    if (!dryRun && rows[t].length) await db.upsert(t, rows[t], M.KEYS[t]);
  }
  // Kids lessons: upload bytes to Storage bucket 'lessons', then the metadata row (both idempotent)
  const L = lessonRows(data.__lessons, idMap); counts.lessons = L.ok.length; counts.lesson_files_skipped = L.skipped.length;
  for (const [t, why] of L.skipped) log(`lesson skipped: ${t} (${why})`);
  if (!dryRun) for (const x of L.ok) { await db.uploadFile('lessons', x.path, x.bytes, x.mime); await db.upsert('lessons', [x.row], ['id']); }
  log('import rows:', JSON.stringify(counts));
  if (!dryRun && L.ok.length && (await db.count('lessons')) < L.ok.length) throw new Error('verify failed: lessons');
  if (!dryRun) for (const t of M.ORDER) { const n = await db.count(t); if (n < counts[t]) throw new Error(`verify failed: ${t} has ${n} < ${counts[t]}`); }
  return { idMap, created, counts, rows };
}
