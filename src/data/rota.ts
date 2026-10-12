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
