import { Unavailability, User } from '../types';

export const NOTE_MAX = 200;
/** Accepts the legacy string form and the current object form; returns sorted, de-duplicated entries (later duplicates keep the first note found). */
export function normalizeUnavailable(list: unknown): Unavailability[] {
  if (!Array.isArray(list)) return [];
  const byDate = new Map<string, Unavailability>();
  for (const x of list) {
    const e = typeof x === 'string' ? { date: x } : x && typeof x === 'object' && typeof (x as any).date === 'string' ? (x as Unavailability) : null;
    if (!e) continue;
    const prev = byDate.get(e.date);
    const note = (e.note ?? '').trim() || prev?.note;
    byDate.set(e.date, note ? { date: e.date, note } : { date: e.date });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export const awayOn = (u: Pick<User, 'unavailable'> | undefined, iso: string | null | undefined) =>
  !!iso && !!u && (u.unavailable ?? []).some(e => e.date === iso);
export const noteOn = (u: Pick<User, 'unavailable'> | undefined, iso: string) => u?.unavailable?.find(e => e.date === iso)?.note;
/** Notes are private: visible only to the owner, any admin, and the person themselves. */
export const canSeeNotes = (viewer: Pick<User, 'id' | 'role'> | null | undefined, target: Pick<User, 'id'>) =>
  !!viewer && (viewer.role === 'owner' || viewer.role === 'admin' || viewer.id === target.id);
export function getUnavailableFor(viewer: Pick<User, 'id' | 'role'> | null | undefined, user: Pick<User, 'id' | 'unavailable'>): Unavailability[] {
  const list = user.unavailable ?? [];
  return canSeeNotes(viewer, user) ? list : list.map(e => ({ date: e.date }));
}
