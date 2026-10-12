// Pure mapping between the app's AppData and Supabase table rows (no network; unit-testable).
import { AppData, Assignment, User } from '../types';

export type Rows = {
  profiles: { id: string; username: string; tier: string; active: boolean; must_change_password: boolean; language: string | null; theme: string | null }[];
  profile_private: { user_id: string; first_name: string; middle_names: string; last_name: string; dob: string | null; contact: string | null; email: string | null }[];
  user_departments: { user_id: string; department_id: string }[];
  user_positions: { user_id: string; department_id: string; role: string }[];
  admin_of: { user_id: string; department_id: string }[];
  unavailability: { user_id: string; date: string; note: string | null }[];
  services: { id: string; title: string; location: string; date: string; start_time: string; end_time: string; status?: 'draft' | 'published' }[];
  service_slots: { service_id: string; department_id: string; role: string; count: number }[];
  assignments: { service_id: string; department_id: string; role: string; idx: number; user_id: string }[];
  departments: { id: string; name: string; emoji: string; color: string; sort: number }[];
  department_roles: { department_id: string; role: string; sort: number }[];
};

/** Primary/unique key columns per table (used for upsert onConflict and diffing). */
export const KEYS: Record<keyof Rows, string[]> = {
  profiles: ['id'], profile_private: ['user_id'], user_departments: ['user_id', 'department_id'],
  user_positions: ['user_id', 'department_id', 'role'], admin_of: ['user_id', 'department_id'],
  unavailability: ['user_id', 'date'], services: ['id'], service_slots: ['service_id', 'department_id', 'role'],
  assignments: ['service_id', 'department_id', 'role', 'idx'], departments: ['id'], department_roles: ['department_id', 'role'],
};
/** Write order (parents first); deletes run in reverse. */
export const ORDER: (keyof Rows)[] = ['departments', 'department_roles', 'profiles', 'profile_private', 'user_departments', 'user_positions',
  'admin_of', 'unavailability', 'services', 'service_slots', 'assignments'];

const ddmmToIso = (v: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v ?? ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
const isoToDdmm = (v: string | null) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v ?? ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
const hhmm = (v: string) => (v ?? '').slice(0, 5);
const blank = (v?: string) => (v && v.trim() ? v.trim() : null);

/** AppData -> rows. `idMap` remaps user ids (legacy 'u-ana' -> auth uuid) during import. */
export function toRows(d: AppData, idMap: (id: string) => string = x => x): Rows {
  const r: Rows = { profiles: [], profile_private: [], user_departments: [], user_positions: [], admin_of: [], unavailability: [],
    services: [], service_slots: [], assignments: [], departments: [], department_roles: [] };
  d.departments.forEach((x, i) => {
    r.departments.push({ id: x.id, name: x.name, emoji: x.emoji, color: x.color, sort: i });
    x.positions.forEach((p, j) => r.department_roles.push({ department_id: x.id, role: p, sort: j }));
  });
  for (const u of d.users) {
    const id = idMap(u.id);
    r.profiles.push({ id, username: u.username, tier: u.role, active: u.active, must_change_password: u.mustChangePassword, language: u.language ?? null, theme: u.theme ?? null });
    r.profile_private.push({ user_id: id, first_name: u.firstName ?? '', middle_names: u.middleNames ?? '', last_name: u.lastName ?? '',
      dob: ddmmToIso(u.dob), contact: blank(u.contact), email: blank(u.email)?.toLowerCase() ?? null });
    for (const dep of u.departmentIds) {
      r.user_departments.push({ user_id: id, department_id: dep });
      for (const role of u.positions?.[dep] ?? []) r.user_positions.push({ user_id: id, department_id: dep, role });
    }
    if (u.role === 'admin') for (const dep of u.adminOf ?? []) r.admin_of.push({ user_id: id, department_id: dep });
    for (const x of u.unavailable ?? []) r.unavailability.push({ user_id: id, date: x.date, note: blank(x.note) });
  }
  for (const s of d.services) {
    r.services.push({ id: s.id, title: s.title, location: s.location ?? '', date: s.date, start_time: s.start, end_time: s.end, status: s.status ?? 'published' });
    for (const sl of s.slots) r.service_slots.push({ service_id: s.id, department_id: sl.departmentId, role: sl.position, count: sl.count });
  }
  for (const a of d.assignments) r.assignments.push({ service_id: a.serviceId, department_id: a.departmentId, role: a.position, idx: a.index, user_id: idMap(a.userId) });
  return r;
}

/** Rows -> AppData (passwords live in Supabase Auth: salt/hash are blank here). */
export function fromRows(r: Rows): AppData {
  const priv = new Map(r.profile_private.map(p => [p.user_id, p]));
  const users: User[] = r.profiles.map(p => {
    const v = priv.get(p.id);
    const departmentIds = r.user_departments.filter(x => x.user_id === p.id).map(x => x.department_id);
    const positions = Object.fromEntries(departmentIds.map(dep => [dep, r.user_positions.filter(x => x.user_id === p.id && x.department_id === dep).map(x => x.role)]));
    const first = v?.first_name ?? '', mid = v?.middle_names ?? '', last = v?.last_name ?? '';
    return {
      id: p.id, username: p.username, role: p.tier as User['role'], active: p.active, mustChangePassword: p.must_change_password,
      name: [first, mid, last].filter(Boolean).join(' ') || p.username, firstName: first || (v ? '' : p.username), middleNames: mid, lastName: last,
      dob: isoToDdmm(v?.dob ?? null), contact: v?.contact ?? '', ...(v?.email ? { email: v.email } : {}),
      ...(p.language ? { language: p.language as 'pt' | 'en' } : {}), ...(p.theme ? { theme: p.theme as 'light' | 'dark' } : {}),
      departmentIds, positions, adminOf: r.admin_of.filter(x => x.user_id === p.id).map(x => x.department_id),
      unavailable: r.unavailability.filter(x => x.user_id === p.id).map(x => ({ date: x.date.slice(0, 10), ...(x.note ? { note: x.note } : {}) })).sort((a, b) => a.date.localeCompare(b.date)),
      salt: '', passwordHash: '',
    };
  });
  const departments = [...r.departments].sort((a, b) => a.sort - b.sort).map(x => ({ id: x.id, name: x.name, emoji: x.emoji, color: x.color, leaderId: null,
    positions: r.department_roles.filter(p => p.department_id === x.id).sort((a, b) => a.sort - b.sort).map(p => p.role) }));
  const services = r.services.map(s => ({ id: s.id, title: s.title, location: s.location, date: s.date.slice(0, 10), start: hhmm(s.start_time), end: hhmm(s.end_time), ...(s.status === 'draft' ? { status: 'draft' as const } : {}),
    slots: r.service_slots.filter(x => x.service_id === s.id).map(x => ({ departmentId: x.department_id, position: x.role, count: x.count })) }));
  const assignments: Assignment[] = r.assignments.map(a => ({ id: `${a.service_id}:${a.department_id}:${a.role}:${a.idx}`, serviceId: a.service_id, departmentId: a.department_id, position: a.role, index: a.idx, userId: a.user_id }));
  return { users, departments, services, availability: [], assignments };
}

const keyOf = (t: keyof Rows, row: any) => KEYS[t].map(k => String(row[k])).join('\u0001');
/** Row-level diff between two snapshots: what to upsert and what to delete, per table. */
export function diffRows(before: Rows, after: Rows) {
  const out: { table: keyof Rows; upsert: any[]; remove: any[] }[] = [];
  for (const t of ORDER) {
    const b = new Map((before[t] as any[]).map(x => [keyOf(t, x), x])), a = new Map((after[t] as any[]).map(x => [keyOf(t, x), x]));
    const upsert = [...a].filter(([k, v]) => JSON.stringify(b.get(k)) !== JSON.stringify(v)).map(([, v]) => v);
    const remove = [...b].filter(([k]) => !a.has(k)).map(([, v]) => v);
    if (upsert.length || remove.length) out.push({ table: t, upsert, remove });
  }
  return out;
}
