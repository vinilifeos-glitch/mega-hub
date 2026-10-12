// Shared import logic (used by scripts/supabase-import.mjs and the PGlite test). No secrets here.
import ts from 'typescript'; import fs from 'fs'; import crypto from 'crypto';

export async function loadMapping() {
  const src = fs.readFileSync(new URL('../src/data/supabaseMapping.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  return import('data:text/javascript,' + encodeURIComponent(js));
}
/** Readable temp password (no 0/O/1/l), 10 chars. */
export const tempPassword = () => { const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'; return Array.from(crypto.randomBytes(10), b => a[b % a.length]).join(''); };
export function readExport(path) {
  const j = JSON.parse(fs.readFileSync(path, 'utf8'));
  const data = j.data ?? j;   // accepts {format, exportedAt, data} or raw AppData
  if (!Array.isArray(data.users) || !Array.isArray(data.services)) throw new Error('Not a Mega Hub export');
  return data;
}

/**
 * Idempotent import. db adapter:
 *   findLegacy(legacyId) -> uuid|null, createAuthUser(username, password) -> uuid,
 *   upsert(table, rows, keyCols), count(table) -> n
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
  const imported = { ...data, users: data.users.map(u => ({ ...u, mustChangePassword: true })) };
  const rows = M.toRows(imported, id => idMap.get(id) ?? id);
  rows.profiles = rows.profiles.map(p => ({ ...p, legacy_id: data.users.find(u => idMap.get(u.id) === p.id)?.id ?? null }));
  const counts = {};
  for (const t of M.ORDER) {
    counts[t] = rows[t].length;
    if (!dryRun && rows[t].length) await db.upsert(t, rows[t], M.KEYS[t]);
  }
  log('import rows:', JSON.stringify(counts));
  if (!dryRun) for (const t of M.ORDER) { const n = await db.count(t); if (n < counts[t]) throw new Error(`verify failed: ${t} has ${n} < ${counts[t]}`); }
  return { idMap, created, counts, rows };
}
