/**
 * Owner-only full export for the Supabase move: everything in megahub:data:v4 plus Kids lesson files (megahub:files:v1).
 * Password hashes/salts are left out: the import gives everyone a temp password (current 4-char ones are below Supabase's 6 minimum).
 */
import { DATA_STORAGE_KEY } from './repository';
import { FILES_KEY, readFiles } from './files';

export const exportFileName = (d = new Date()) => `megahub-export-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
export function buildExport(actor: { role: string } | null | undefined, fallback: unknown) {
  if (actor?.role !== 'owner') throw new Error('owner only');
  let data: any = fallback;
  try { const raw = localStorage.getItem(DATA_STORAGE_KEY); if (raw) data = JSON.parse(raw); } catch {}
  data = { ...data, users: (data?.users ?? []).map(({ salt, passwordHash, ...u }: any) => u) };
  return { format: 'megahub-export', version: 1, exportedAt: new Date().toISOString(), keys: { data: DATA_STORAGE_KEY, files: FILES_KEY }, data, files: { lessons: readFiles().lessons } };
}
/** Web download; returns the file name. */
export function downloadExport(actor: { role: string } | null | undefined, fallback: unknown): string {
  const json = JSON.stringify(buildExport(actor, fallback));
  const name = exportFileName(); const u = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000);
  return name;
}
