// Pure permission rules for editing another user's personal fields (no React, testable in node).
export type Tier = 'owner' | 'admin' | 'volunteer';
export const PROTECTED_FIELDS = ['firstName', 'middleNames', 'lastName', 'contact', 'email'] as const;

/** Only the owner, or the user themselves, may change names/contact/password. */
export function canEditPersonal(actor: { id: string; role: Tier } | null | undefined, targetId: string): boolean {
  return !!actor && (actor.role === 'owner' || actor.id === targetId);
}

/** Returns the protected field names that would change. Admin edits of others must leave these untouched. */
const norm = (k: string, v: any) => { const s = String(v ?? '').trim(); return k === 'email' ? s.toLowerCase() : s; };
/** Owner edits anyone; everyone edits self; admins edit non-owner members of their departments (or unassigned volunteers). */
export function canEditMemberRule(actor: { id: string; role: Tier; adminOf?: string[] } | null | undefined,
  target: { id: string; role: Tier; departmentIds: string[] }): boolean {
  if (!actor) return false;
  if (actor.role === 'owner' || actor.id === target.id) return true;
  if (actor.role !== 'admin' || target.role === 'owner') return false;
  const mine = actor.adminOf ?? [];
  return target.departmentIds.some(d => mine.includes(d)) || (target.role === 'volunteer' && target.departmentIds.length === 0);
}

/** Signed in: user setting or default only. Device last-used value is for the sign-in screen only. */
export const pickPref = <T,>(signedIn: boolean, userVal: T | undefined, deviceVal: T | null | undefined, dflt: T): T =>
  signedIn ? (userVal ?? dflt) : (deviceVal ?? dflt);

export function changedProtected(before: Record<string, any>, p: Record<string, any>): string[] {
  return PROTECTED_FIELDS.filter(k => p[k] !== undefined && norm(k, p[k]) !== norm(k, before[k]));
}

/** Drafts: a missing status means published (legacy data untouched). */
export const isDraft = (s: { status?: string } | undefined) => s?.status === 'draft';
/** Owner/admins see drafts; everyone else never receives draft services or their assignments. */
export function visibleServiceData<D extends { services: { id: string; status?: string }[]; assignments: { serviceId: string }[] }>(actor: { role: Tier } | null | undefined, d: D): D {
  if (actor && (actor.role === 'owner' || actor.role === 'admin')) return d;
  const drafts = new Set(d.services.filter(isDraft).map(s => s.id));
  if (!drafts.size) return d;
  return { ...d, services: d.services.filter(s => !drafts.has(s.id)), assignments: d.assignments.filter(a => !drafts.has(a.serviceId)) };
}
