import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppData, Department, Role, Service, User } from '../types';
import { repository } from '../data/repository';
import { hashPassword, newSalt } from '../data/auth';
import { DEFAULT_LANG, Lang, TKey, TParams, deptLabel, formatDateShort, roleLabel, tierLabel, translate } from '../i18n';

export interface AccountInput { name: string; username: string; role: Role; departmentIds: string[]; tempPassword?: string;
  firstName?: string; middleNames?: string; lastName?: string; dob?: string; contact?: string; positions?: Record<string, string[]>; adminOf?: string[]; mustChange?: boolean; }

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
  /** Current UI language: signed-in user's choice, else last used on this device, else 'pt'. */
  language: Lang;
  setLanguage: (lang: Lang) => void;
  t: (key: TKey, params?: TParams) => string;
  /** Display helpers in the current language (stored ids/role names are unchanged). */
  deptName: (deptId: string) => string;
  roleName: (deptId: string, role: string) => string;
  tierName: (tier: Role) => string;
  fmtDate: (iso: string) => string;
  /** First name of the (first active) owner, for messages like "ask {owner}". */
  ownerName: string;
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
  addUnavailable: (isoDate: string, userId?: string) => void;
  removeUnavailable: (isoDate: string, userId?: string) => void;
  canEditMember: (target: User) => boolean;
  myAdminDeps: string[];
  adminSaveMember: (id: string, p: { firstName: string; middleNames: string; lastName: string; dob: string; contact: string; departments: Record<string, string[] | null> }) => string | null;
  saveMyProfile: (p: { firstName: string; middleNames: string; lastName: string; dob: string; contact: string }) => string | null;
  ownerUpdateAccount: (id: string, a: { username: string; role: Role; active: boolean; newPassword: string; adminOf: string[] }) => Promise<string | null>;
  assign: (serviceId: string, departmentId: string, position: string, index: number, userId: string) => string | null;
  whyBlocked: (serviceId: string, userId: string) => string | null;
  saveService: (id: string | null, s: Omit<Service, 'id'>, picks?: { departmentId: string; position: string; index: number; userId: string }[]) => string | null;
  deleteService: (id: string) => void;
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
  const [deviceLang, setDeviceLang] = useState<Lang | null>(null);

  useEffect(() => {
    (async () => {
      const [d, sid, dl] = await Promise.all([repository.load(), repository.getSession(), repository.getDeviceLanguage()]);
      setSessionId(sid); setDeviceLang(dl); setData(d);
    })();
  }, []);

  const update = (fn: (d: AppData) => AppData) =>
    setData(prev => { if (!prev) return prev; const next = fn(prev); repository.save(next); return next; });

  const setSession = (id: string | null) => { setSessionId(id); repository.setSession(id); };

  const value = useMemo<Ctx>(() => {
    const d: AppData = data ?? { users: [], departments: [], services: [], availability: [], assignments: [] };
    const found = d.users.find(u => u.id === sessionId && u.active);
    const currentUser = found ?? null;
    const role = currentUser?.role;
    const language: Lang = currentUser?.language ?? deviceLang ?? DEFAULT_LANG;
    const t = (key: TKey, params?: TParams) => translate(language, key, params);
    const isOwner = role === 'owner';
    const myAdminDeps = isOwner ? d.departments.map(x => x.id) : role === 'admin' ? (currentUser?.adminOf ?? []) : [];
    const canEditMember = (t: User) => !!currentUser && (isOwner || t.id === currentUser.id ||
      (role === 'admin' && t.role !== 'owner' && (t.departmentIds.some(dep => myAdminDeps.includes(dep)) || (t.role === 'volunteer' && t.departmentIds.length === 0))));
    const canManage = (depId: string) => !!currentUser && (isOwner ||
      (role === 'admin' && (currentUser.adminOf ?? []).includes(depId)));
    const canEditAccount = (_t: User) => isOwner;
    const allowedRoles: Role[] = isOwner ? ['owner', 'admin', 'volunteer'] : [];
    const usernameTaken = (username: string, exceptId: string | null) =>
      d.users.some(u => norm(u.username) === norm(username) && u.id !== exceptId);

    return {
      ready: !!data, data: d, currentUser, canManage, language, t,
      deptName: id => deptLabel(id, language, d.departments.find(x => x.id === id)?.name),
      roleName: (dep, r) => roleLabel(dep, r, language),
      tierName: tr => tierLabel(tr, language),
      fmtDate: iso => formatDateShort(iso, language),
      ownerName: d.users.find(u => u.role === 'owner' && u.active)?.firstName ?? translate(language, 'tiers.owner'),
      setLanguage: lang => {
        setDeviceLang(lang); repository.setDeviceLanguage(lang);
        if (currentUser) update(x => ({ ...x, users: x.users.map(u => u.id === currentUser.id ? { ...u, language: lang } : u) }));
      },
      managedDepartments: d.departments.filter(x => canManage(x.id)),
      canManageAccounts: isOwner, canEditAccount, allowedRoles,
      signIn: async (username, password) => {
        const u = d.users.find(x => norm(x.username) === norm(username));
        if (!u || (await hashPassword(u.salt, password)) !== u.passwordHash) return t('errors.wrongCredentials');
        if (!u.active) return t('errors.deactivated');
        setSession(u.id); return null;
      },
      // keep the language this person was using for the sign-in screen (device's last language)
      signOut: () => { setDeviceLang(language); repository.setDeviceLanguage(language); setSession(null); },
      changePassword: async (oldPw, newPw) => {
        if (!currentUser) return t('errors.notSignedIn');
        if ((await hashPassword(currentUser.salt, oldPw)) !== currentUser.passwordHash) return t('errors.currentPasswordWrong');
        if (newPw.length < 4) return t('errors.passwordTooShort');
        if (newPw === oldPw) return t('errors.samePassword');
        const salt = newSalt(); const passwordHash = await hashPassword(salt, newPw);
        update(x => ({ ...x, users: x.users.map(u => u.id === currentUser.id ? { ...u, salt, passwordHash, mustChangePassword: false } : u) }));
        return null;
      },
      saveAccount: async (id, input) => {
        if (!isOwner) return t('errors.ownerOnlyAccounts');
        const name = input.name.trim(), username = input.username.trim();
        if (!(input.firstName ?? name).trim() || !username) return t('errors.firstNameUsernameRequired');
        if (!/^[A-Za-z0-9._-]{2,30}$/.test(username)) return t('errors.usernameFormat');
        if (usernameTaken(username, id)) return t('errors.usernameTaken');
        const keepsOwner = role === 'owner' && id === currentUser?.id && input.role === 'owner';
        if (!keepsOwner && !allowedRoles.includes(input.role)) return t('errors.roleNotAllowed');
        const existing = id ? d.users.find(u => u.id === id) : undefined;
        if (existing && !canEditAccount(existing)) return t('errors.editNotAllowed');
        const departmentIds = input.departmentIds;
        if (!existing) {
          const pw = input.tempPassword ?? '';
          if (pw.length < 4) return t('errors.passwordTooShort');
          const salt = newSalt(); const passwordHash = await hashPassword(salt, pw);
          const parts = name.split(' ');
          if (input.dob && !validDob(input.dob)) return t('errors.dobInvalid');
          if (input.contact && !validContact(input.contact.trim())) return t('errors.contactInvalid');
          const positions = Object.fromEntries(departmentIds.map(dp => [dp, input.positions?.[dp] ?? []]));
          const user: User = {
            id: `u-${Date.now().toString(36)}`, name,
            firstName: input.firstName?.trim() ?? parts[0], middleNames: input.middleNames?.trim() ?? parts.slice(1, -1).join(' '),
            lastName: input.lastName?.trim() ?? (parts.length > 1 ? parts[parts.length - 1] : ''),
            dob: input.dob ?? '', contact: input.contact?.trim() ?? '', positions, adminOf: input.role === 'admin' ? (input.adminOf ?? []) : [],
            username, role: input.role, departmentIds, salt, passwordHash, mustChangePassword: input.mustChange ?? true, active: true, unavailable: [],
          };
          update(x => ({ ...x, users: [...x.users, user] }));
        } else {
          update(x => ({
            ...x,
            users: x.users.map(u => u.id === id ? { ...u, ...(name !== u.name ? { firstName: name.split(' ')[0], middleNames: name.split(' ').slice(1, -1).join(' '), lastName: name.split(' ').length > 1 ? name.split(' ').slice(-1)[0] : '' } : {}), name, username, role: input.role, departmentIds, positions: Object.fromEntries(departmentIds.map(dp => [dp, u.positions?.[dp] ?? []])) } : u),
            // leaving a department / no longer leader: clean up
            assignments: x.assignments.filter(a => a.userId !== id || departmentIds.includes(a.departmentId)),
          }));
        }
        return null;
      },
      resetPassword: async (id, pw) => {
        const tgt = d.users.find(u => u.id === id);
        if (!tgt || !canEditAccount(tgt)) return t('errors.notAllowed');
        if (pw.length < 4) return t('errors.passwordTooShort');
        const salt = newSalt(); const passwordHash = await hashPassword(salt, pw);
        update(x => ({ ...x, users: x.users.map(u => u.id === id ? { ...u, salt, passwordHash, mustChangePassword: true } : u) }));
        return null;
      },
      setActive: (id, active) => {
        const tgt = d.users.find(u => u.id === id);
        if (!tgt || !canEditAccount(tgt)) return t('errors.notAllowed');
        if (tgt.id === currentUser?.id) return t('errors.selfDeactivate');
        if (tgt.role === 'owner') return t('errors.ownerDeactivate');
        update(x => ({ ...x, users: x.users.map(u => u.id === id ? { ...u, active } : u) }));
        return null;
      },
      holdsRole: (uid, depId, pos) => !!d.users.find(u => u.id === uid)?.positions?.[depId]?.includes(pos),
      saveProfile: (id, p) => {
        if (role !== 'owner') return t('errors.ownerOnlyProfiles');
        if (!p.firstName.trim()) return t('errors.firstNameRequired');
        if (!validContact(p.contact.trim())) return t('errors.contactInvalid');
        if (p.dob && !validDob(p.dob)) return t('errors.dobInvalid');
        const departmentIds = p.departmentIds;
        const positions: Record<string, string[]> = {};
        departmentIds.forEach(dep => { positions[dep] = p.positions[dep] ?? []; });
        update(x => ({
          ...x,
          users: x.users.map(u => u.id === id ? { ...u, firstName: p.firstName.trim(), middleNames: p.middleNames.trim(), lastName: p.lastName.trim(), name: fullName(p), dob: p.dob, contact: p.contact.trim(), departmentIds, positions } : u),
          assignments: x.assignments.filter(a => a.userId !== id || (positions[a.departmentId] ?? []).includes(a.position)),
        }));
        return null;
      },
      saveMyProfile: p => {
        if (!currentUser) return t('errors.notSignedIn');
        if (!p.firstName.trim()) return t('errors.firstNameRequired');
        if (p.dob && !validDob(p.dob)) return t('errors.dobInvalid');
        if (!validContact(p.contact.trim())) return t('errors.contactInvalid');
        const v = { firstName: p.firstName.trim(), middleNames: p.middleNames.trim(), lastName: p.lastName.trim(), dob: p.dob, contact: p.contact.trim() };
        update(x => ({ ...x, users: x.users.map(u => u.id === currentUser.id ? { ...u, ...v, name: fullName(v) } : u) }));
        return null;
      },
      ownerUpdateAccount: async (id, a) => {
        if (!isOwner) return t('errors.ownerOnlyAccounts');
        const t0 = d.users.find(u => u.id === id); if (!t0) return t('errors.accountNotFound');
        const username = a.username.trim();
        if (!/^[A-Za-z0-9._-]{2,30}$/.test(username)) return t('errors.usernameFormat');
        if (usernameTaken(username, id)) return t('errors.usernameTaken');
        if (id === currentUser!.id && (a.role !== 'owner' || !a.active)) return t('errors.selfOwnerLock');
        if (a.newPassword && a.newPassword.length < 4) return t('errors.passwordTooShort');
        let pw = {};
        if (a.newPassword) { const salt = newSalt(); pw = { salt, passwordHash: await hashPassword(salt, a.newPassword), mustChangePassword: false }; }
        update(x => ({
          ...x,
          users: x.users.map(u => u.id === id ? { ...u, username, role: a.role, active: a.active, adminOf: a.role === 'admin' ? a.adminOf : [], ...pw } : u),
        }));
        return null;
      },
      canEditMember, myAdminDeps,
      addUnavailable: (iso, userId) => {
        const uid = userId ?? currentUser?.id; const t0 = d.users.find(u => u.id === uid);
        if (!t0 || !canEditMember(t0)) return;
        update(x => ({
          ...x,
          users: x.users.map(u => u.id === uid ? { ...u, unavailable: [...new Set([...(u.unavailable ?? []), iso])].sort() } : u),
          assignments: x.assignments.filter(a => !(a.userId === uid && x.services.find(s => s.id === a.serviceId)?.date === iso)),
        }));
      },
      removeUnavailable: (iso, userId) => {
        const uid = userId ?? currentUser?.id; const t0 = d.users.find(u => u.id === uid);
        if (!t0 || !canEditMember(t0)) return;
        update(x => ({ ...x, users: x.users.map(u => u.id === uid ? { ...u, unavailable: (u.unavailable ?? []).filter(v => v !== iso) } : u) }));
      },
      adminSaveMember: (id, p) => {
        const t0 = d.users.find(u => u.id === id);
        if (!t0 || !canEditMember(t0)) return t('errors.memberScope');
        if (!p.firstName.trim()) return t('errors.firstNameRequired');
        if (p.dob && !validDob(p.dob)) return t('errors.dobInvalid');
        if (!validContact(p.contact.trim())) return t('errors.contactInvalid');
        const v = { firstName: p.firstName.trim(), middleNames: p.middleNames.trim(), lastName: p.lastName.trim(), dob: p.dob, contact: p.contact.trim() };
        let departmentIds = [...t0.departmentIds]; const positions = { ...(t0.positions ?? {}) };
        for (const [dep, roles] of Object.entries(p.departments)) {
          if (!canManage(dep)) continue; // admins only touch their own departments
          if (roles === null) { departmentIds = departmentIds.filter(x => x !== dep); delete positions[dep]; }
          else { if (!departmentIds.includes(dep)) departmentIds.push(dep); positions[dep] = roles; }
        }
        update(x => ({
          ...x,
          users: x.users.map(u => u.id === id ? { ...u, ...v, name: fullName(v), departmentIds, positions } : u),
          assignments: x.assignments.filter(a => a.userId !== id || (positions[a.departmentId] ?? []).includes(a.position)),
        }));
        return null;
      },
      saveMyContact: contact => {
        if (!currentUser) return t('errors.notSignedIn');
        if (!validContact(contact.trim())) return t('errors.contactInvalid');
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
      whyBlocked: (serviceId, userId) => {
        const sv = d.services.find(x => x.id === serviceId); const u = d.users.find(x => x.id === userId);
        if (!sv || !u) return 'Not found';
        if ((u.unavailable ?? []).includes(sv.date)) return 'unavailable';
        if (d.assignments.some(a => a.serviceId === serviceId && a.userId === userId)) return 'busy';
        return null;
      },
      assign: (serviceId, departmentId, position, index, userId) => {
        if (!canManage(departmentId)) return t('errors.slotScope');
        const sv = d.services.find(x => x.id === serviceId); const u = d.users.find(x => x.id === userId);
        if (!sv || !u || !u.active) return t('errors.notFound');
        if (!(u.positions?.[departmentId] ?? []).includes(position)) return t('errors.doesntHoldRole', { name: u.firstName, role: position });
        if ((u.unavailable ?? []).includes(sv.date)) return t('errors.unavailableThatDay', { name: u.firstName });
        if (d.assignments.some(a => a.serviceId === serviceId && a.userId === userId)) return t('errors.alreadyServing', { name: u.firstName });
        const id = `${serviceId}:${departmentId}:${position}:${index}`;
        update(x => ({ ...x, assignments: [...x.assignments.filter(a => a.id !== id), { id, serviceId, departmentId, position, index, userId }] }));
        return null;
      },
      saveService: (id, sv, picks) => {
        if (!isOwner) return t('errors.ownerOnlyServices');
        if (!sv.title.trim()) return t('errors.nameRequired');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(sv.date)) return t('errors.dateInvalid');
        const hm = /^([01]\d|2[0-3]):[0-5]\d$/;
        if (!hm.test(sv.start) || !hm.test(sv.end)) return t('errors.timeFormat');
        if (sv.end <= sv.start) return t('errors.endAfterStart');
        const slots = sv.slots.filter(sl => sl.count > 0);
        const clean = { ...sv, title: sv.title.trim(), location: sv.location.trim(), slots };
        const sid = id ?? `svc-${Date.now().toString(36)}`;
        update(x => ({
          ...x,
          services: id ? x.services.map(s => s.id === id ? { id, ...clean } : s) : [...x.services, { id: sid, ...clean }],
          // drop assignments for removed / shrunk slots, or people now unavailable on a moved date
          assignments: picks ? [
            ...x.assignments.filter(a => a.serviceId !== sid),
            ...picks.filter((pk, i, arr) => {
              const sl = slots.find(z => z.departmentId === pk.departmentId && z.position === pk.position);
              const u = x.users.find(z => z.id === pk.userId);
              return !!sl && pk.index < sl.count && !!u?.active && (u.positions?.[pk.departmentId] ?? []).includes(pk.position)
                && !(u.unavailable ?? []).includes(clean.date) && arr.findIndex(o => o.userId === pk.userId) === i;
            }).map(pk => ({ ...pk, serviceId: sid, id: `${sid}:${pk.departmentId}:${pk.position}:${pk.index}` })),
          ] : x.assignments.filter(a => {
            if (a.serviceId !== sid) return true;
            const sl = slots.find(z => z.departmentId === a.departmentId && z.position === a.position);
            const u = x.users.find(z => z.id === a.userId);
            return !!sl && a.index < sl.count && !(u?.unavailable ?? []).includes(clean.date);
          }),
          settings: { ...x.settings, lastLocation: clean.location || x.settings?.lastLocation },
        }));
        return null;
      },
      deleteService: id => isOwner && update(x => ({ ...x, services: x.services.filter(s => s.id !== id), assignments: x.assignments.filter(a => a.serviceId !== id) })),
      unassign: id => { const a0 = d.assignments.find(a => a.id === id); if (!a0 || !canManage(a0.departmentId)) return; update(x => ({ ...x, assignments: x.assignments.filter(a => a.id !== id) })); },
    };
  }, [data, sessionId, deviceLang]);

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
