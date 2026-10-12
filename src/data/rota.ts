import type { AppData, Assignment } from '../types';
/** Upcoming published assignments for a user, sorted by date/start. */
export function myAssignments(d: AppData, userId: string, today: string): Assignment[] {
  const sv = (id: string) => d.services.find(s => s.id === id);
  return d.assignments
    .filter(a => a.userId === userId)
    .filter(a => { const s = sv(a.serviceId); return !!s && s.status !== 'draft' && s.date >= today && d.departments.some(x => x.id === a.departmentId); })
    .sort((a, b) => { const x = sv(a.serviceId)!, y = sv(b.serviceId)!; return (x.date + x.start).localeCompare(y.date + y.start) || a.departmentId.localeCompare(b.departmentId) || a.position.localeCompare(b.position); });
}
/** Team serving a service, grouped by department (departments order), each sorted by position/index. */
export function teamFor(d: AppData, serviceId: string): { departmentId: string; members: { assignmentId: string; userId: string; name: string; username: string; position: string }[] }[] {
  const as = d.assignments.filter(a => a.serviceId === serviceId);
  return d.departments.map(dep => ({
    departmentId: dep.id,
    members: as.filter(a => a.departmentId === dep.id).sort((a, b) => a.position.localeCompare(b.position) || a.index - b.index)
      .map(a => ({ assignmentId: a.id, userId: a.userId, position: a.position, name: d.users.find(u => u.id === a.userId)?.name ?? '?', username: d.users.find(u => u.id === a.userId)?.username ?? '?' })),
  })).filter(g => g.members.length > 0);
}

export type AssignMode = 'double' | 'swap';
/**
 * Apply an assignment to a slot. If the user already serves elsewhere in this service:
 *  - no mode -> 'busy' error; 'double' -> keep both;
 *  - 'swap' -> user moves from their other slot into this one; that other slot is cleared (left unfilled).
 *    Any previous occupant of this slot is simply replaced (unassigned), never moved.
 * Returns the new assignments list or an error code.
 */
export function planAssign(as: Assignment[], target: Omit<Assignment, 'id'>, mode: AssignMode | undefined): { assignments: Assignment[] } | { error: 'busy' | 'noSwapSource' } {
  const id = `${target.serviceId}:${target.departmentId}:${target.position}:${target.index}`;
  const prev = as.find(a => a.id === id);
  if (prev?.userId === target.userId) return { assignments: as };
  const others = as.filter(a => a.serviceId === target.serviceId && a.userId === target.userId && a.id !== id);
  const rest = as.filter(a => a.id !== id);
  const mine: Assignment = { id, ...target };
  if (!others.length) return { assignments: [...rest, mine] };
  if (!mode) return { error: 'busy' };
  if (mode === 'double') return { assignments: [...rest, mine] };
  const from = others[0];
  const out = rest.filter(a => a.id !== from.id);
  return { assignments: [...out, mine] };
}
/** Picker status for a person on a service. */
export function pickStatus(as: Assignment[], serviceId: string, userId: string, slotId: string, away: boolean): 'free' | 'busy' | 'away' {
  if (away) return 'away';
  return as.some(a => a.serviceId === serviceId && a.userId === userId && a.id !== slotId) ? 'busy' : 'free';
}

/** Roles a person may hold on top of their one main role in a service (matched by role id, not label). */
export const EXEMPT_ROLES = new Set(['d-music:Desk', 'd-music:Assembly']);
export const isExempt = (dep: string, role: string) => EXEMPT_ROLES.has(`${dep}:${role}`);
type Slotish = { id: string; departmentId: string; position: string; userId: string };
/**
 * One-role rule within a service: a person may hold at most ONE non-exempt role (plus Desk and/or Assembly),
 * and never two slots of the same role. Returns the entry `userId` already holds that conflicts with
 * putting them into (dep, role), ignoring the slot `selfId`; null when allowed.
 */
export function roleConflict(list: Slotish[], userId: string, dep: string, role: string, selfId?: string): Slotish | null {
  for (const o of list) {
    if (o.userId !== userId || o.id === selfId) continue;
    if (o.departmentId === dep && o.position === role) return o;
    if (!isExempt(dep, role) && !isExempt(o.departmentId, o.position)) return o;
  }
  return null;
}
/** For each assignment that conflicts with another in the same service, the other one (legacy data warning). */
export function conflictsIn(list: Slotish[]): Record<string, Slotish> {
  const out: Record<string, Slotish> = {};
  for (const a of list) { const c = roleConflict(list, a.userId, a.departmentId, a.position, a.id); if (c) out[a.id] = c; }
  return out;
}
/** New conflicts only: a conflicting pair is tolerated when both entries already existed unchanged (legacy). */
export function newConflict(next: Slotish[], prev: Slotish[]): [Slotish, Slotish] | null {
  const had = (x: Slotish) => prev.some(p => p.id === x.id && p.userId === x.userId);
  for (const a of next) for (const b of next) {
    if (a.id >= b.id || a.userId !== b.userId) continue;
    if (!roleConflict([b], a.userId, a.departmentId, a.position, a.id)) continue;
    if (!(had(a) && had(b))) return [a, b];
  }
  return null;
}
