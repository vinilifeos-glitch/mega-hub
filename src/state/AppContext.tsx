import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppData, Department, Role, User } from '../types';
import { repository } from '../data/repository';
import { hashPassword, newSalt } from '../data/auth';

export interface AccountInput { name: string; username: string; role: Role; departmentIds: string[]; tempPassword?: string; }

export interface ProfileInput { contact: string; firstName: string; middleNames: string; lastName: string; dob: string; departmentIds: string[]; positions: Record<string, string[]>; }
export function validDob(s: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s); if (!m) return false;
  const [d, mo, y] = [+m[1], +m[2], +m[3]]; const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d && dt <= new Date() && y >= 1900;
}
export const formatDobInput = (raw: string) => {
  const g = raw.replace(/\D/g, '').slice(0, 8);
  return [g.slice(0, 2), g.slice(2, 4), g.slice(4)].filter(Boolean).join('/');
};
export const validContact = (c: string) => c === '' || /^\+?[0-9 ()-]{6,20}$/.test(c);
export const fullName = (f: { firstName: string; middleNames: string; lastName: string }) =>
  [f.firstName, f.middleNames, f.lastName].map(x => x.trim()).filter(Boolean).join(' ');

interface Ctx {
  saveProfile: (id: string, p: ProfileInput) => string | null;
  saveMyContact: (contact: string) => string | null;
  holdsRole: (userId: string, departmentId: string, position: string) => boolean;
  ready: boolean;
  data: AppData;
  currentUser: User | null;
  signIn: (username: string, password: string) => Promise<string | null>;
  signOut: () => void;
  changePassword: (oldPw: string, newPw: string) => Promise<string | null>;
  isAvailable: (userId: string, serviceId: string) => boolean | undefined;
  setAvailability: (userId: string, serviceId: string, available: boolean) => void;
  addUnavailable: (isoDate: string) => void;
  removeUnavailable: (isoDate: string) => void;
  saveMyProfile: (p: { firstName: string; middleNames: string; lastName: string; dob: string; contact: string }) => string | null;
  ownerUpdateAccount: (id: string, a: { username: string; role: Role; active: boolean; newPassword: string }) => Promise<string | null>;
  assign: (serviceId: string, departmentId: string, position: string, userId: string) => void;
  unassign: (assignmentId: string) => void;
  canManage: (departmentId: string) => boolean;
  managedDepartments: Department[];
  canManageAccounts: boolean;
  canEditAccount: (target: User) => boolean;
  allowedRoles: Role[];
  saveAccount: (id: string | null, input: AccountInput) => Promise<string | null>;
  resetPassword: (id: string, tempPassword: string) => Promise<string | null>;
  setActive: (id: string, active: boolean) => string | null;
}

const AppContext = createContext<Ctx | null>(null);
const norm = (u: string) => u.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [d, sid] = await Promise.all([repository.load(), repository.getSession()]);
      setSessionId(sid); setData(d);
    })();
  }, []);

  const update = (fn: (d: AppData) => AppData) =>
    setData(prev => { if (!prev) return prev; const next = fn(prev); repository.save(next); return next; });

  const setSession = (id: string | null) => { setSessionId(id); repository.setSession(id); };

  const value = useMemo<Ctx>(() => {
    const d = data ?? { users: [], departments: [], services: [], availability: [], assignments: [] };
    const found = d.users.find(u => u.id === sessionId && u.active);
    const currentUser = found ?? null;
    const role = currentUser?.role;
    const isTop = role === 'owner' || role === 'admin';
    const isOwner = role === 'owner';
    const canManage = (depId: string) => !!currentUser && (isTop ||
      (role === 'leader' && d.departments.find(x => x.id === depId)?.leaderId === currentUser.id));
    const canEditAccount = (_t: User) => isOwner;
    const allowedRoles: Role[] = isOwner ? ['owner', 'admin', 'leader', 'volunteer'] : [];
    const usernameTaken = (username: string, exceptId: string | null) =>
      d.users.some(u => norm(u.username) === norm(username) && u.id !== exceptId);

    return {
      ready: !!data, data: d, currentUser, canManage,
      managedDepartments: d.departments.filter(x => canManage(x.id)),
      canManageAccounts: isOwner, canEditAccount, allowedRoles,
      signIn: async (username, password) => {
        const u = d.users.find(x => norm(x.username) === norm(username));
        if (!u || (await hashPassword(u.salt, password)) !== u.passwordHash) return 'Wrong username or password.';
        if (!u.active) return 'This account has been deactivated. Ask an admin.';
        setSession(u.id); return null;
      },
      signOut: () => setSession(null),
      changePassword: async (oldPw, newPw) => {
        if (!currentUser) return 'Not signed in.';
        if ((await hashPassword(currentUser.salt, oldPw)) !== currentUser.passwordHash) return 'Current password is incorrect.';
        if (newPw.length < 4) return 'New password must be at least 4 characters.';
        if (newPw === oldPw) return 'Choose a different password from the temporary one.';
        const salt = newSalt(); const passwordHash = await hashPassword(salt, newPw);
        update(x => ({ ...x, users: x.users.map(u => u.id === currentUser.id ? { ...u, salt, passwordHash, mustChangePassword: false } : u) }));
        return null;
      },
      saveAccount: async (id, input) => {
        if (!isOwner) return 'Only the owner can manage accounts.';
        const name = input.name.trim(), username = input.username.trim();
        if (!name || !username) return 'Full name and username are required.';
        if (!/^[A-Za-z0-9._-]{2,30}$/.test(username)) return 'Username: 2–30 letters, numbers, . _ -';
        if (usernameTaken(username, id)) return 'That username is already taken.';
        const keepsOwner = role === 'owner' && id === currentUser?.id && input.role === 'owner';
        if (!keepsOwner && !allowedRoles.includes(input.role)) return 'You are not allowed to give that role.';
        const existing = id ? d.users.find(u => u.id === id) : undefined;
        if (existing && !canEditAccount(existing)) return 'You are not allowed to edit this account.';
        const departmentIds = input.departmentIds;
        if (!existing) {
          const pw = input.tempPassword ?? '';
          if (pw.length < 4) return 'Temporary password must be at least 4 characters.';
          const salt = newSalt(); const passwordHash = await hashPassword(salt, pw);
          const parts = name.split(' ');
          const user: User = { id: `u-${Date.now().toString(36)}`, name, firstName: parts[0], middleNames: parts.slice(1, -1).join(' '), lastName: parts.length > 1 ? parts[parts.length - 1] : '', dob: '', positions: {}, username, role: input.role, departmentIds, salt, passwordHash, mustChangePassword: true, active: true };
          update(x => ({ ...x, users: [...x.users, user], departments: x.departments.map(dep => user.role === 'leader' && departmentIds.includes(dep.id) ? { ...dep, leaderId: user.id } : dep) }));
        } else {
          update(x => ({
            ...x,
            users: x.users.map(u => u.id === id ? { ...u, ...(name !== u.name ? { firstName: name.split(' ')[0], middleNames: name.split(' ').slice(1, -1).join(' '), lastName: name.split(' ').length > 1 ? name.split(' ').slice(-1)[0] : '' } : {}), name, username, role: input.role, departmentIds, positions: Object.fromEntries(departmentIds.map(dp => [dp, u.positions?.[dp] ?? []])) } : u),
            // leaving a department / no longer leader: clean up
            departments: x.departments.map(dep =>
              input.role === 'leader' && departmentIds.includes(dep.id) ? { ...dep, leaderId: id }
              : dep.leaderId === id ? { ...dep, leaderId: null } : dep),
            assignments: x.assignments.filter(a => a.userId !== id || departmentIds.includes(a.departmentId)),
          }));
        }
        return null;
      },
      resetPassword: async (id, pw) => {
        const t = d.users.find(u => u.id === id);
        if (!t || !canEditAccount(t)) return 'Not allowed.';
        if (pw.length < 4) return 'Temporary password must be at least 4 characters.';
        const salt = newSalt(); const passwordHash = await hashPassword(salt, pw);
        update(x => ({ ...x, users: x.users.map(u => u.id === id ? { ...u, salt, passwordHash, mustChangePassword: true } : u) }));
        return null;
      },
      setActive: (id, active) => {
        const t = d.users.find(u => u.id === id);
        if (!t || !canEditAccount(t)) return 'Not allowed.';
        if (t.id === currentUser?.id) return "You can't deactivate yourself.";
        if (t.role === 'owner') return "The owner account can't be deactivated.";
        update(x => ({ ...x, users: x.users.map(u => u.id === id ? { ...u, active } : u) }));
        return null;
      },
      holdsRole: (uid, depId, pos) => !!d.users.find(u => u.id === uid)?.positions?.[depId]?.includes(pos),
      saveProfile: (id, p) => {
        if (role !== 'owner') return 'Only the owner can edit profiles.';
        if (!p.firstName.trim()) return 'First name is required.';
        if (!validContact(p.contact.trim())) return 'Contact number looks invalid.';
        if (p.dob && !validDob(p.dob)) return 'Date of birth must be a real date as DD/MM/YYYY.';
        const departmentIds = p.departmentIds;
        const positions: Record<string, string[]> = {};
        departmentIds.forEach(dep => { positions[dep] = p.positions[dep] ?? []; });
        update(x => ({
          ...x,
          users: x.users.map(u => u.id === id ? { ...u, firstName: p.firstName.trim(), middleNames: p.middleNames.trim(), lastName: p.lastName.trim(), name: fullName(p), dob: p.dob, contact: p.contact.trim(), departmentIds, positions } : u),
          departments: x.departments.map(dep => dep.leaderId === id && !departmentIds.includes(dep.id) ? { ...dep, leaderId: null }
            : x.users.find(u => u.id === id)?.role === 'leader' && departmentIds.includes(dep.id) && !dep.leaderId ? { ...dep, leaderId: id } : dep),
          assignments: x.assignments.filter(a => a.userId !== id || (positions[a.departmentId] ?? []).includes(a.position)),
        }));
        return null;
      },
      saveMyProfile: p => {
        if (!currentUser) return 'Not signed in.';
        if (!p.firstName.trim()) return 'First name is required.';
        if (p.dob && !validDob(p.dob)) return 'Date of birth must be a real date as DD/MM/YYYY.';
        if (!validContact(p.contact.trim())) return 'Contact number looks invalid.';
        const v = { firstName: p.firstName.trim(), middleNames: p.middleNames.trim(), lastName: p.lastName.trim(), dob: p.dob, contact: p.contact.trim() };
        update(x => ({ ...x, users: x.users.map(u => u.id === currentUser.id ? { ...u, ...v, name: fullName(v) } : u) }));
        return null;
      },
      ownerUpdateAccount: async (id, a) => {
        if (!isOwner) return 'Only the owner can manage accounts.';
        const t0 = d.users.find(u => u.id === id); if (!t0) return 'Account not found.';
        const username = a.username.trim();
        if (!/^[A-Za-z0-9._-]{2,30}$/.test(username)) return 'Username: 2–30 letters, numbers, . _ -';
        if (usernameTaken(username, id)) return 'That username is already taken.';
        if (id === currentUser!.id && (a.role !== 'owner' || !a.active)) return "You can't remove your own owner access or deactivate yourself.";
        if (a.newPassword && a.newPassword.length < 4) return 'Password must be at least 4 characters.';
        let pw = {};
        if (a.newPassword) { const salt = newSalt(); pw = { salt, passwordHash: await hashPassword(salt, a.newPassword), mustChangePassword: false }; }
        update(x => ({
          ...x,
          users: x.users.map(u => u.id === id ? { ...u, username, role: a.role, active: a.active, ...pw } : u),
          departments: x.departments.map(dep => dep.leaderId === id && a.role !== 'leader' ? { ...dep, leaderId: null } : dep),
        }));
        return null;
      },
      addUnavailable: iso => currentUser && update(x => ({
        ...x,
        users: x.users.map(u => u.id === currentUser.id ? { ...u, unavailable: [...new Set([...(u.unavailable ?? []), iso])].sort() } : u),
        assignments: x.assignments.filter(a => !(a.userId === currentUser.id && x.services.find(s => s.id === a.serviceId)?.date === iso)),
      })),
      removeUnavailable: iso => currentUser && update(x => ({
        ...x, users: x.users.map(u => u.id === currentUser.id ? { ...u, unavailable: (u.unavailable ?? []).filter(v => v !== iso) } : u),
      })),
      saveMyContact: contact => {
        if (!currentUser) return 'Not signed in.';
        if (!validContact(contact.trim())) return 'Contact number looks invalid.';
        update(x => ({ ...x, users: x.users.map(u => u.id === currentUser.id ? { ...u, contact: contact.trim() } : u) }));
        return null;
      },
      isAvailable: (u, s) => {
        const date = d.services.find(x => x.id === s)?.date;
        return !(d.users.find(x => x.id === u)?.unavailable ?? []).includes(date ?? '');
      },
      setAvailability: (userId, serviceId, available) => update(x => ({
        ...x,
        availability: [...x.availability.filter(a => !(a.userId === userId && a.serviceId === serviceId)), { userId, serviceId, available }],
        assignments: available ? x.assignments : x.assignments.filter(a => !(a.userId === userId && a.serviceId === serviceId)),
      })),
      assign: (serviceId, departmentId, position, userId) => {
        if (!canManage(departmentId)) return;
        update(x => ({
          ...x,
          assignments: [...x.assignments.filter(a => !(a.serviceId === serviceId && a.departmentId === departmentId && a.position === position)),
            { id: `${serviceId}:${departmentId}:${position}`, serviceId, departmentId, position, userId }],
        }));
      },
      unassign: id => update(x => ({ ...x, assignments: x.assignments.filter(a => a.id !== id) })),
    };
  }, [data, sessionId]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const c = useContext(AppContext);
  if (!c) throw new Error('useApp outside AppProvider');
  return c;
}

/** For screens rendered only when signed in. */
export function useMe() {
  const c = useApp();
  if (!c.currentUser) throw new Error('not signed in');
  return { ...c, currentUser: c.currentUser };
}
