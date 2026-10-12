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
    const to = (typeof e.to === 'string' && e.to > e.date ? e.to : undefined) ?? prev?.to;
    byDate.set(e.date, { date: e.date, ...(to ? { to } : {}), ...(note ? { note } : {}) });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export const rangeEnd = (e: Unavailability) => (e.to && e.to > e.date ? e.to : e.date);
export const covers = (e: Unavailability, iso: string) => iso >= e.date && iso <= rangeEnd(e);
/** True if any of the user's unavailable days/ranges covers `iso`. */
export const isUnavailableOn = (u: Pick<User, 'unavailable'> | undefined, iso: string | null | undefined) =>
  !!iso && !!u && (u.unavailable ?? []).some(e => covers(e, iso));
export const awayOn = isUnavailableOn;
export const noteOn = (u: Pick<User, 'unavailable'> | undefined, iso: string) => u?.unavailable?.find(e => covers(e, iso))?.note;
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
/** '20/10/2026', '20/10–27/10/2026', or '28/12/2026–03/01/2027'. */
export function formatRange(e: Unavailability): string {
  const end = rangeEnd(e); const full = (iso: string) => `${ddmm(iso)}/${iso.slice(0, 4)}`;
  if (end === e.date) return full(e.date);
  return e.date.slice(0, 4) === end.slice(0, 4) ? `${ddmm(e.date)}–${full(end)}` : `${full(e.date)}–${full(end)}`;
}
/** Validate a new range: returns an error key or null. `today` ISO. */
export function rangeError(from: string | null, to: string | null | undefined, today: string): 'dateInvalid' | 'datePast' | 'rangeOrder' | 'rangeTooLong' | null {
  if (!from) return 'dateInvalid'; if (from < today) return 'datePast';
  if (to === null) return 'dateInvalid';
  if (to && to < from) return 'rangeOrder';
  if (to && (Date.parse(to) - Date.parse(from)) / 864e5 > 366) return 'rangeTooLong';
  return null;
}
/** Notes are private: visible only to the owner, any admin, and the person themselves. */
export const canSeeNotes = (viewer: Pick<User, 'id' | 'role'> | null | undefined, target: Pick<User, 'id'>) =>
  !!viewer && (viewer.role === 'owner' || viewer.role === 'admin' || viewer.id === target.id);
export function getUnavailableFor(viewer: Pick<User, 'id' | 'role'> | null | undefined, user: Pick<User, 'id' | 'unavailable'>): Unavailability[] {
  const list = user.unavailable ?? [];
  return canSeeNotes(viewer, user) ? list : list.map(e => (e.to ? { date: e.date, to: e.to } : { date: e.date }));
}
