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

export const MUSIC_DEPT = 'd-music';
/** Owner, or an admin of Music, may edit setlists. */
export const canEditSetlistRule = (actor: { role: Tier; adminOf?: string[] } | null | undefined) =>
  !!actor && (actor.role === 'owner' || (actor.role === 'admin' && (actor.adminOf ?? []).includes(MUSIC_DEPT)));
/** Owner, admins, Music members, or anyone assigned on that service may see its setlist. */
/** STRICT scoping: owner sees all; admins/volunteers see a department only if they administer it or are a member. */
export const canViewDeptRule = (actor: { role: Tier; adminOf?: string[]; departmentIds?: string[] } | null | undefined, deptId: string) =>
  !!actor && (actor.role === 'owner' || (actor.role === 'admin' && (actor.adminOf ?? []).includes(deptId)) || (actor.departmentIds ?? []).includes(deptId));
/** Setlists/chords: owner, Music admins, Music members (assigned non-Music people no longer see them). */
export const canSeeSetlistRule = (actor: { id: string; role: Tier; adminOf?: string[]; departmentIds?: string[] } | null | undefined, _serviceId?: string, _assignments?: { serviceId: string; userId: string }[]) =>
  canViewDeptRule(actor, MUSIC_DEPT);
/** Strip setlists the actor may not see (applied after draft filtering). */
export function visibleSetlists<D extends { services: { id: string; setlist?: unknown }[]; assignments: { serviceId: string; userId: string }[] }>(actor: Parameters<typeof canSeeSetlistRule>[0], d: D): D {
  if (!d.services.some(s => s.setlist && !canSeeSetlistRule(actor, s.id, d.assignments))) return d;
  return { ...d, services: d.services.map(s => s.setlist && !canSeeSetlistRule(actor, s.id, d.assignments) ? (({ setlist, ...r }) => r)(s) as typeof s : s) };
}

/** Owner, or an admin of that department, may edit its page (About, Resources). */
export const canEditDeptRule = (actor: { role: Tier; adminOf?: string[] } | null | undefined, deptId: string) =>
  !!actor && (actor.role === 'owner' || (actor.role === 'admin' && (actor.adminOf ?? []).includes(deptId)));
/** Song library: staff + Music members see all; others only songs used in setlists they can see. */
export function visibleSongs<D extends { songs?: { id: string; deptId?: string }[] }>(actor: { role: Tier; adminOf?: string[]; departmentIds?: string[] } | null | undefined, d: D): D {
  if (!d.songs) return d;
  if (d.songs.every(x => canViewDeptRule(actor, x.deptId ?? MUSIC_DEPT))) return d;
  return { ...d, songs: d.songs.filter(x => canViewDeptRule(actor, x.deptId ?? MUSIC_DEPT)) };
}
/** Strip department page content (description/resources) the actor may not view. */
export function visibleDeptPages<D extends { departments: { id: string; description?: string; resources?: unknown[] }[] }>(actor: Parameters<typeof canViewDeptRule>[0], d: D): D {
  if (!d.departments.some(x => (x.description !== undefined || x.resources !== undefined) && !canViewDeptRule(actor, x.id))) return d;
  return { ...d, departments: d.departments.map(x => canViewDeptRule(actor, x.id) ? x : (({ description, resources, ...r }) => r)(x) as typeof x) };
}
/** http(s) URL with a host; returns normalised string or null. */
export function cleanUrl(v: string): string | null {
  let u = (v ?? '').trim(); if (!u) return null; if (!/^[a-z]+:\/\//i.test(u)) u = 'https://' + u;
  try { const p = new URL(u); return (p.protocol === 'http:' || p.protocol === 'https:') && /\./.test(p.hostname) ? p.toString() : null; } catch { return null; }
}

/** Live mode: owner, Music admins, or Music members assigned on that service. */
export const canLiveRule = (actor: { id: string; role: Tier; adminOf?: string[]; departmentIds?: string[] } | null | undefined, serviceId: string, assignments: { serviceId: string; userId: string }[]) =>
  !!actor && (canEditSetlistRule(actor) || ((actor.departmentIds ?? []).includes(MUSIC_DEPT) && assignments.some(a => a.serviceId === serviceId && a.userId === actor.id)));
