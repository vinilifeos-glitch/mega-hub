/**
 * Local file store for Kids lessons (until Supabase Storage). Separate key so megahub:data:v4 stays small.
 * Files live ONLY on this device/browser: not synced to other phones.
 */
import { useEffect, useState } from 'react';
import { canEditLessonsRule } from '../state/permissions';
export const FILES_KEY = 'megahub:files:v1';
export const MAX_FILE = 5 * 1024 * 1024;
export const ACCEPT = '.pdf,image/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp';
const OK_MIME = /^(application\/pdf|image\/[a-z0-9.+-]+|application\/msword|application\/vnd\.ms-(excel|powerpoint)|application\/vnd\.openxmlformats-officedocument\.[a-z.]+|application\/vnd\.oasis\.opendocument\.[a-z.]+)$/i;
const OK_EXT = /\.(pdf|png|jpe?g|gif|webp|heic|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp)$/i;
export const fileTypeOk = (name: string, mime: string) => OK_MIME.test(mime) || OK_EXT.test(name);
export type Lesson = { id: string; deptId: string; title: string; name: string; mime: string; size: number; dataUrl: string; createdAt: string; by: string };
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
export function useLessons(deptId: string): Lesson[] {
  const [, set] = useState(0);
  useEffect(() => { const f = () => set(x => x + 1); subs.add(f); const on = (e: StorageEvent) => { if (e.key === FILES_KEY) f(); };
    if (typeof window !== 'undefined') window.addEventListener('storage', on); return () => { subs.delete(f); if (typeof window !== 'undefined') window.removeEventListener('storage', on); }; }, []);
  return readFiles().lessons.filter(l => l.deptId === deptId).sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
}
/** The Kids lesson catalog services can pick from. */
export const lessonCatalog = (): Lesson[] => readFiles().lessons;
export const fmtSize = (n: number) => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
/** Open in a new tab (blob URL; browsers block top-level data: URLs). */
export function openLesson(l: Lesson) {
  const u = URL.createObjectURL(toBlob(l)); const w = window.open(u, '_blank'); if (w) { try { w.opener = null; } catch {} } else downloadLesson(l); // popup blocked: fall back to download
  setTimeout(() => URL.revokeObjectURL(u), 60000);
}
export function downloadLesson(l: Lesson) {
  const u = URL.createObjectURL(toBlob(l)); const a = document.createElement('a'); a.href = u; a.download = l.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000);
}
function toBlob(l: Lesson) { const [h, b64] = l.dataUrl.split(','); const bin = atob(b64); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return new Blob([arr], { type: (h.match(/data:([^;]+)/) ?? [])[1] || l.mime || 'application/octet-stream' }); }

type Actor = Parameters<typeof canEditLessonsRule>[0] & { id: string };
export type LessonErr = 'scope' | 'title' | 'type' | 'size' | 'quota' | null;
const guard = (fn: () => void): LessonErr => { try { fn(); return null; } catch (e: any) { return e?.message === 'quota' ? 'quota' : 'quota'; } };
export function addLesson(actor: Actor, deptId: string, title: string, f: { name: string; mime: string; size: number; dataUrl: string }): LessonErr {
  if (!canEditLessonsRule(actor)) return 'scope';
  if (!title.trim()) return 'title';
  if (!fileTypeOk(f.name, f.mime)) return 'type';
  if (f.size > MAX_FILE) return 'size';
  const l: Lesson = { id: `ls-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, deptId, title: title.trim().slice(0, 120), name: f.name, mime: f.mime, size: f.size, dataUrl: f.dataUrl, createdAt: new Date().toISOString(), by: actor!.id };
  return guard(() => writeFiles(s => ({ ...s, lessons: [...s.lessons, l] })));
}
export function renameLesson(actor: Actor, id: string, title: string): LessonErr {
  if (!canEditLessonsRule(actor)) return 'scope'; if (!title.trim()) return 'title';
  return guard(() => writeFiles(s => ({ ...s, lessons: s.lessons.map(l => l.id === id ? { ...l, title: title.trim().slice(0, 120) } : l) })));
}
export function deleteLesson(actor: Actor, id: string): LessonErr {
  if (!canEditLessonsRule(actor)) return 'scope';
  return guard(() => writeFiles(s => ({ ...s, lessons: s.lessons.filter(l => l.id !== id) })));
}
