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
export function teamFor(d: AppData, serviceId: string): { departmentId: string; members: { assignmentId: string; userId: string; name: string; position: string }[] }[] {
  const as = d.assignments.filter(a => a.serviceId === serviceId);
  return d.departments.map(dep => ({
    departmentId: dep.id,
    members: as.filter(a => a.departmentId === dep.id).sort((a, b) => a.position.localeCompare(b.position) || a.index - b.index)
      .map(a => ({ assignmentId: a.id, userId: a.userId, position: a.position, name: d.users.find(u => u.id === a.userId)?.name ?? '?' })),
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
