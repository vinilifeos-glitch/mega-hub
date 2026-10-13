/**
 * Kids lessons. Local mode: data URLs in megahub:files:v1 (this device only, not synced).
 * Supabase mode: metadata in public.lessons, bytes in the private Storage bucket 'lessons' at '<dept>/<lesson id>/<file>' (RLS-checked).
 */
import { useEffect, useState } from 'react';
import { canEditLessonsRule } from '../state/permissions';
import { repository } from './repository';
/** Supabase client when the app runs in supabase mode, else null. */
const sb = (): any => (repository as any).sb ?? null;
export const LESSONS_REMOTE = !!(repository as any).sb;
export const FILES_KEY = 'megahub:files:v1';
export const MAX_FILE = 5 * 1024 * 1024;
export const ACCEPT = '.pdf,image/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp';
const OK_MIME = /^(application\/pdf|image\/[a-z0-9.+-]+|application\/msword|application\/vnd\.ms-(excel|powerpoint)|application\/vnd\.openxmlformats-officedocument\.[a-z.]+|application\/vnd\.oasis\.opendocument\.[a-z.]+)$/i;
const OK_EXT = /\.(pdf|png|jpe?g|gif|webp|heic|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp)$/i;
export const fileTypeOk = (name: string, mime: string) => OK_MIME.test(mime) || OK_EXT.test(name);
export type Lesson = { id: string; deptId: string; title: string; name: string; mime: string; size: number; dataUrl?: string; storagePath?: string; createdAt: string; by: string };
type Store = { lessons: Lesson[] };
const ls = () => (typeof localStorage !== 'undefined' ? localStorage : null);
export function readFiles(): Store { try { const r = ls()?.getItem(FILES_KEY); const p = r ? JSON.parse(r) : null; return { lessons: Array.isArray(p?.lessons) ? p.lessons : [] }; } catch { return { lessons: [] }; } }
const subs = new Set<() => void>();
/** Throws 'quota' when the browser storage is full. */
export function writeFiles(fn: (s: Store) => Store) {
  const next = fn(readFiles());
  try { ls()?.setItem(FILES_KEY, JSON.stringify(next)); } catch { throw new Error('quota'); }
  subs.forEach(f => f());
}
let remote: Lesson[] = []; let remoteErr = false;
const rowToLesson = (r: any): Lesson => ({ id: r.id, deptId: r.department_id, title: r.title, name: r.file_name, mime: r.mime, size: r.size_bytes, storagePath: r.storage_path, createdAt: r.created_at, by: r.created_by ?? '' });
export async function refreshLessons() {
  const { data, error } = await sb().from('lessons').select('*'); remoteErr = !!error; if (!error) remote = (data ?? []).map(rowToLesson); subs.forEach(f => f());
}
export function useLessons(deptId: string): Lesson[] {
  const [, set] = useState(0);
  useEffect(() => { const f = () => set(x => x + 1); subs.add(f); const on = (e: StorageEvent) => { if (e.key === FILES_KEY) f(); };
    if (LESSONS_REMOTE) refreshLessons().catch(() => {});
    if (typeof window !== 'undefined') window.addEventListener('storage', on); return () => { subs.delete(f); if (typeof window !== 'undefined') window.removeEventListener('storage', on); }; }, []);
  return (LESSONS_REMOTE ? remote : readFiles().lessons).filter(l => l.deptId === deptId).sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
}
/** The Kids lesson catalog services can pick from. */
export const lessonCatalog = (): Lesson[] => readFiles().lessons;
export const fmtSize = (n: number) => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
async function blobOf(l: Lesson): Promise<Blob> {
  if (l.dataUrl) return toBlob(l);
  const { data, error } = await sb().storage.from('lessons').download(l.storagePath); if (error || !data) throw error ?? new Error('download');
  return data.type ? data : new Blob([data], { type: l.mime });
}
/** Open in a new tab (blob URL; browsers block top-level data: URLs). The tab is opened first so popup blockers allow it. */
export async function openLesson(l: Lesson) {
  const w = window.open('', '_blank');
  try { const u = URL.createObjectURL(await blobOf(l)); if (w) { try { w.opener = null; } catch {} w.location.href = u; } else await downloadLesson(l); setTimeout(() => URL.revokeObjectURL(u), 60000); }
  catch { w?.close(); }
}
export async function downloadLesson(l: Lesson) {
  const u = URL.createObjectURL(await blobOf(l)); const a = document.createElement('a'); a.href = u; a.download = l.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000);
}
function toBlob(l: Lesson) { const [h, b64] = l.dataUrl!.split(','); const bin = atob(b64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return new Blob([arr], { type: (h.match(/data:([^;]+)/) ?? [])[1] || l.mime || 'application/octet-stream' }); }
type Actor = Parameters<typeof canEditLessonsRule>[0] & { id: string };
export type LessonErr = 'scope' | 'title' | 'type' | 'size' | 'quota' | null;
const guard = (fn: () => void): LessonErr => { try { fn(); return null; } catch { return 'quota'; } };
const uuid = () => (globalThis.crypto as any)?.randomUUID?.() ?? 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
const safeName = (n: string) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120) || 'file';
export async function addLesson(actor: Actor, deptId: string, title: string, f: { name: string; mime: string; size: number; dataUrl: string }): Promise<LessonErr> {
  if (!canEditLessonsRule(actor)) return 'scope';
  if (!title.trim()) return 'title';
  if (!fileTypeOk(f.name, f.mime)) return 'type';
  if (f.size > MAX_FILE) return 'size';
  if (LESSONS_REMOTE) {
    const id = uuid(); const path = `${deptId}/${id}/${safeName(f.name)}`;
    const up = await sb().storage.from('lessons').upload(path, toBlob({ dataUrl: f.dataUrl, mime: f.mime } as Lesson), { contentType: f.mime || undefined, upsert: false });
    if (up.error) return /size|large|413/i.test(up.error.message ?? '') ? 'size' : /mime|type/i.test(up.error.message ?? '') ? 'type' : 'scope';
    const ins = await sb().from('lessons').insert({ id, department_id: deptId, title: title.trim().slice(0, 120), file_name: f.name, mime: f.mime, size_bytes: f.size, storage_path: path });
    if (ins.error) { await sb().storage.from('lessons').remove([path]); return 'scope'; }
    await refreshLessons(); return null;
  }
  const l: Lesson = { id: `ls-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, deptId, title: title.trim().slice(0, 120), name: f.name, mime: f.mime, size: f.size, dataUrl: f.dataUrl, createdAt: new Date().toISOString(), by: actor!.id };
  return guard(() => writeFiles(s => ({ ...s, lessons: [...s.lessons, l] })));
}
export async function renameLesson(actor: Actor, id: string, title: string): Promise<LessonErr> {
  if (!canEditLessonsRule(actor)) return 'scope'; if (!title.trim()) return 'title';
  if (LESSONS_REMOTE) { const r = await sb().from('lessons').update({ title: title.trim().slice(0, 120) }).eq('id', id).select('id'); await refreshLessons(); return r.error || !r.data?.length ? 'scope' : null; }
  return guard(() => writeFiles(s => ({ ...s, lessons: s.lessons.map(l => l.id === id ? { ...l, title: title.trim().slice(0, 120) } : l) })));
}
export async function deleteLesson(actor: Actor, id: string): Promise<LessonErr> {
  if (!canEditLessonsRule(actor)) return 'scope';
  if (LESSONS_REMOTE) { const l = remote.find(x => x.id === id); const r = await sb().from('lessons').delete().eq('id', id).select('id'); if (r.error || !r.data?.length) return 'scope';
    if (l?.storagePath) await sb().storage.from('lessons').remove([l.storagePath]); await refreshLessons(); return null; }
  return guard(() => writeFiles(s => ({ ...s, lessons: s.lessons.filter(l => l.id !== id) })));
}
