import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppData, Department, Resource, Role, Service, SetlistItem, Song, Theme, Unavailability, User } from '../types';
import { NOTE_MAX, awayOn, getUnavailableFor } from '../data/unavailability';
import { repository } from '../data/repository';
import { hashPassword, newSalt } from '../data/auth';
import { canEditMemberRule, canEditPersonal, changedProtected, pickPref, visibleServiceData, visibleSetlists, canEditSetlistRule, canEditDeptRule, visibleSongs, cleanUrl } from './permissions';
import { DEFAULT_LANG, Lang, TKey, TParams, deptLabel, formatDateShort, roleLabel, tierLabel, translate } from '../i18n';

export interface AccountInput { name: string; username: string; role: Role; departmentIds: string[]; tempPassword?: string;
  firstName?: string; middleNames?: string; lastName?: string; dob?: string; contact?: string; email?: string; positions?: Record<string, string[]>; adminOf?: string[]; mustChange?: boolean; }

export interface ProfileInput { contact: string; email?: string; firstName: string; middleNames: string; lastName: string; dob: string; departmentIds: string[]; positions: Record<string, string[]>; }
export function validDob(s: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s); if (!m) return false;
  const [d, mo, y] = [+m[1], +m[2], +m[3]]; const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d && dt <= new Date() && y >= 1900;
}
export const formatDobInput = (raw: string) => {
  const g = raw.replace(/\D/g, '').slice(0, 8);
  return [g.slice(0, 2), g.slice(2, 4), g.slice(4)].filter(Boolean).join('/');
};
export const normEmail = (e?: string) => (e ?? '').trim().toLowerCase();
export const validEmail = (e?: string) => { const v = normEmail(e); return v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); };
export const validContact = (c: string) => c === '' || /^\+?[0-9 ()-]{6,20}$/.test(c);
export const fullName = (f: { firstName: string; middleNames: string; lastName: string }) =>
  [f.firstName, f.middleNames, f.lastName].map(x => x.trim()).filter(Boolean).join(' ');

interface Ctx {
  /** Current UI language: signed-in user's choice, else last used on this device, else 'pt'. */
  language: Lang;
  setLanguage: (lang: Lang) => void;
  /** Device-level language for the sign-in screen; works signed out, never touches user data. */
  setDeviceLanguage: (lang: Lang) => void;
  /** Current UI theme: signed-in user's choice, else last used on this device, else 'light'. */
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** Unavailable days for `userId` as the current user may see them (notes stripped unless owner/admin/self). */
  getUnavailableFor: (userId: string) => Unavailability[];
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
  addUnavailable: (isoDate: string, userId?: string, note?: string) => void;
  removeUnavailable: (isoDate: string, userId?: string) => void;
  canEditMember: (target: User) => boolean;
  myAdminDeps: string[];
  adminSaveMember: (id: string, p: { firstName: string; middleNames: string; lastName: string; dob: string; contact: string; email?: string; departments: Record<string, string[] | null> }) => string | null;
  saveMyProfile: (p: { firstName: string; middleNames: string; lastName: string; dob: string; contact: string; email?: string }) => string | null;
  ownerUpdateAccount: (id: string, a: { username: string; role: Role; active: boolean; newPassword: string; adminOf: string[] }) => Promise<string | null>;
  assign: (serviceId: string, departmentId: string, position: string, index: number, userId: string) => string | null;
  whyBlocked: (serviceId: string, userId: string) => string | null;
  saveService: (id: string | null, s: Omit<Service, 'id'>, picks?: { departmentId: string; position: string; index: number; userId: string }[]) => string | null;
  deleteService: (id: string) => void;
  publishService: (id: string) => void;
  canEditDept: (deptId: string) => boolean;
  setDeptAbout: (deptId: string, description: string) => string | null;
  addResource: (deptId: string, r: { title: string; url: string }) => string | null;
  updateResource: (deptId: string, id: string, r: { title: string; url: string }) => string | null;
  removeResource: (deptId: string, id: string) => void;
  moveResource: (deptId: string, id: string, dir: 'up' | 'down') => void;
  canEditSongs: boolean;
  addLibSong: (s: Omit<Song, 'id' | 'deptId'>) => string | { error: string };
  updateLibSong: (id: string, s: Partial<Omit<Song, 'id' | 'deptId'>>) => string | null;
  removeLibSong: (id: string) => void;
  canEditSetlist: (service?: Service) => boolean;
  addSong: (serviceId: string, song: { title: string; key?: string; notes?: string; songId?: string | null }) => string | null;
  updateSong: (serviceId: string, id: string, patch: Partial<Omit<SetlistItem, 'id'>>) => string | null;
  removeSong: (serviceId: string, id: string) => void;
  moveSong: (serviceId: string, id: string, dir: 'up' | 'down') => void;
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
  const [deviceTheme, setDeviceThemeState] = useState<Theme | null>(null);

  useEffect(() => {
    (async () => {
      const [d, sid, dl, dt] = await Promise.all([repository.load(), repository.getSession(), repository.getDeviceLanguage(), repository.getDeviceTheme()]);
      setSessionId(sid); setDeviceLang(dl); setDeviceThemeState(dt); setData(d);
    })();
  }, []);

  const update = (fn: (d: AppData) => AppData) =>
    setData(prev => { if (!prev) return prev; const next = fn(prev); repository.save(next); return next; });

  const setSession = (id: string | null) => { setSessionId(id); repository.setSession(id); };

  const value = useMemo<Ctx>(() => {
    const x0 = () => raw;
    const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    function swap<T extends { id: string }>(l: T[], id: string, dir: 'up' | 'down'): T[] { const i = l.findIndex(x => x.id === id); const j = dir === 'up' ? i - 1 : i + 1; if (i < 0 || j < 0 || j >= l.length) return l; const n = [...l]; [n[i], n[j]] = [n[j], n[i]]; return n; }
    const editRes = (dep: string, fn: (l: Resource[]) => Resource[]) => update(x => ({ ...x, departments: x.departments.map(z => z.id === dep ? { ...z, resources: fn(z.resources ?? []) } : z) }));
    const cleanLib = (so: Partial<Omit<Song, 'id' | 'deptId'>>) => {
      const o: { title?: string; artist?: string; key?: string; chords?: string; link?: string | null } = {};
      if (so.title !== undefined) o.title = so.title.trim().slice(0, 120);
      if (so.artist?.trim()) o.artist = so.artist.trim().slice(0, 120);
      if (so.key?.trim()) o.key = so.key.trim().slice(0, 8);
      if (so.chords?.trim()) o.chords = so.chords.replace(/\s+$/, '').slice(0, 20000);
      if (so.link?.trim()) o.link = cleanUrl(so.link);
      return o;
    };
    const editSetlist = (sid: string, fn: (l: SetlistItem[]) => SetlistItem[]) =>
      update(x => ({ ...x, services: x.services.map(s => s.id === sid ? { ...s, setlist: fn(s.setlist ?? []) } : s) }));
    const cleanSong = (p: { key?: string; notes?: string; songId?: string | null }) => {
      const o: Partial<SetlistItem> = {}; const k = p.key?.trim().slice(0, 8); const n = p.notes?.trim().slice(0, 200);
      if (k) o.key = k; if (n) o.notes = n; if (p.songId) o.songId = p.songId; return o;
    };
    const raw: AppData = data ?? { users: [], departments: [], services: [], availability: [], assignments: [] };
    const found = raw.users.find(u => u.id === sessionId && u.active);
    // Privacy: screens only ever receive notes they may see (owner, any admin, or the person themself).
    // Drafts: volunteers / signed-out never receive draft services or their assignments.
    const d: AppData = visibleSongs(found, visibleSetlists(found, visibleServiceData(found, { ...raw, users: raw.users.map(u => ({ ...u, unavailable: getUnavailableFor(found, u) })) })));
    const currentUser = found ?? null;
    const role = currentUser?.role;
    const language: Lang = pickPref<Lang>(!!currentUser, currentUser?.language, deviceLang, DEFAULT_LANG);
    const theme: Theme = pickPref<Theme>(!!currentUser, currentUser?.theme, deviceTheme, 'light');
    const t = (key: TKey, params?: TParams) => translate(language, key, params);
    const isOwner = role === 'owner';
    const myAdminDeps = isOwner ? d.departments.map(x => x.id) : role === 'admin' ? (currentUser?.adminOf ?? []) : [];
    const canEditMember = (t: User) => canEditMemberRule(currentUser, t);
    const canManage = (depId: string) => !!currentUser && (isOwner ||
      (role === 'admin' && (currentUser.adminOf ?? []).includes(depId)));
    const canEditAccount = (_t: User) => isOwner;
    const allowedRoles: Role[] = isOwner ? ['owner', 'admin', 'volunteer'] : [];
    const usernameTaken = (username: string, exceptId: string | null) =>
      d.users.some(u => norm(u.username) === norm(username) && u.id !== exceptId);

    return {
      ready: !!data, data: d, currentUser, canManage, language, t, theme,
      setTheme: th => {
        setDeviceThemeState(th); repository.setDeviceTheme(th);
        if (currentUser) update(x => ({ ...x, users: x.users.map(u => u.id === currentUser.id ? { ...u, theme: th } : u) }));
      },
      getUnavailableFor: uid => d.users.find(u => u.id === uid)?.unavailable ?? [],
      deptName: id => deptLabel(id, language, d.departments.find(x => x.id === id)?.name),
      roleName: (dep, r) => roleLabel(dep, r, language),
      tierName: tr => tierLabel(tr, language),
      fmtDate: iso => formatDateShort(iso, language),
      ownerName: d.users.find(u => u.role === 'owner' && u.active)?.firstName ?? translate(language, 'tiers.owner'),
      setDeviceLanguage: lang => { setDeviceLang(lang); repository.setDeviceLanguage(lang); },
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
      signOut: () => { setDeviceLang(language); repository.setDeviceLanguage(language); setDeviceThemeState(theme); repository.setDeviceTheme(theme); setSession(null); },
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
          if (!validEmail(input.email)) return t('errors.emailInvalid');
          const positions = Object.fromEntries(departmentIds.map(dp => [dp, input.positions?.[dp] ?? []]));
          const user: User = {
            id: `u-${Date.now().toString(36)}`, name,
            firstName: input.firstName?.trim() ?? parts[0], middleNames: input.middleNames?.trim() ?? parts.slice(1, -1).join(' '),
            lastName: input.lastName?.trim() ?? (parts.length > 1 ? parts[parts.length - 1] : ''),
            dob: input.dob ?? '', contact: input.contact?.trim() ?? '', ...(normEmail(input.email) ? { email: normEmail(input.email) } : {}), positions, adminOf: input.role === 'admin' ? (input.adminOf ?? []) : [],
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
        if (!tgt || !canEditAccount(tgt) || !canEditPersonal(currentUser, id)) return t('errors.notAllowed');
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
        if (!validEmail(p.email)) return t('errors.emailInvalid');
        if (p.dob && !validDob(p.dob)) return t('errors.dobInvalid');
        const departmentIds = p.departmentIds;
        const positions: Record<string, string[]> = {};
        departmentIds.forEach(dep => { positions[dep] = p.positions[dep] ?? []; });
        update(x => ({
          ...x,
          users: x.users.map(u => u.id === id ? { ...u, firstName: p.firstName.trim(), middleNames: p.middleNames.trim(), lastName: p.lastName.trim(), name: fullName(p), dob: p.dob, contact: p.contact.trim(), ...(p.email !== undefined ? { email: normEmail(p.email) } : {}), departmentIds, positions } : u),
          assignments: x.assignments.filter(a => a.userId !== id || (positions[a.departmentId] ?? []).includes(a.position)),
        }));
        return null;
      },
      saveMyProfile: p => {
        if (!currentUser) return t('errors.notSignedIn');
        if (!p.firstName.trim()) return t('errors.firstNameRequired');
        if (p.dob && !validDob(p.dob)) return t('errors.dobInvalid');
        if (!validContact(p.contact.trim())) return t('errors.contactInvalid');
        if (!validEmail(p.email)) return t('errors.emailInvalid');
        const v = { firstName: p.firstName.trim(), middleNames: p.middleNames.trim(), lastName: p.lastName.trim(), dob: p.dob, contact: p.contact.trim(), ...(p.email !== undefined ? { email: normEmail(p.email) } : {}) };
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
      addUnavailable: (iso, userId, note) => {
        const n = (note ?? '').trim().slice(0, NOTE_MAX);
        const uid = userId ?? currentUser?.id; const t0 = d.users.find(u => u.id === uid);
        if (!t0 || !canEditMember(t0)) return;
        update(x => ({
          ...x,
          users: x.users.map(u => u.id === uid ? { ...u, unavailable: [...(u.unavailable ?? []).filter(e => e.date !== iso), n ? { date: iso, note: n } : { date: iso }].sort((a, b) => a.date.localeCompare(b.date)) } : u),
          assignments: x.assignments.filter(a => !(a.userId === uid && x.services.find(s => s.id === a.serviceId)?.date === iso)),
        }));
      },
      removeUnavailable: (iso, userId) => {
        const uid = userId ?? currentUser?.id; const t0 = d.users.find(u => u.id === uid);
        if (!t0 || !canEditMember(t0)) return;
        update(x => ({ ...x, users: x.users.map(u => u.id === uid ? { ...u, unavailable: (u.unavailable ?? []).filter(e => e.date !== iso) } : u) }));
      },
      adminSaveMember: (id, p) => {
        const t0 = d.users.find(u => u.id === id);
        if (!t0 || !canEditMember(t0)) return t('errors.memberScope');
        if (!canEditPersonal(currentUser, id) && changedProtected(t0, p).length) return t('errors.personalOwnerOnly');
        if (!p.firstName.trim()) return t('errors.firstNameRequired');
        if (p.dob && !validDob(p.dob)) return t('errors.dobInvalid');
        if (!validContact(p.contact.trim())) return t('errors.contactInvalid');
        if (!validEmail(p.email)) return t('errors.emailInvalid');
        const v = { firstName: p.firstName.trim(), middleNames: p.middleNames.trim(), lastName: p.lastName.trim(), dob: p.dob, contact: p.contact.trim(), ...(p.email !== undefined ? { email: normEmail(p.email) } : {}) };
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
        return !awayOn(d.users.find(x => x.id === u), date);
      },
      setAvailability: (userId, serviceId, available) => update(x => ({
        ...x,
        availability: [...x.availability.filter(a => !(a.userId === userId && a.serviceId === serviceId)), { userId, serviceId, available }],
        assignments: available ? x.assignments : x.assignments.filter(a => !(a.userId === userId && a.serviceId === serviceId)),
      })),
      whyBlocked: (serviceId, userId) => {
        const sv = d.services.find(x => x.id === serviceId); const u = d.users.find(x => x.id === userId);
        if (!sv || !u) return 'Not found';
        if (awayOn(u, sv.date)) return 'unavailable';
        if (d.assignments.some(a => a.serviceId === serviceId && a.userId === userId)) return 'busy';
        return null;
      },
      assign: (serviceId, departmentId, position, index, userId) => {
        if (!canManage(departmentId)) return t('errors.slotScope');
        const sv = d.services.find(x => x.id === serviceId); const u = d.users.find(x => x.id === userId);
        if (!sv || !u || !u.active) return t('errors.notFound');
        if (!(u.positions?.[departmentId] ?? []).includes(position)) return t('errors.doesntHoldRole', { name: u.firstName, role: position });
        if (awayOn(u, sv.date)) return t('errors.unavailableThatDay', { name: u.firstName });
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
        const clean: Omit<Service, 'id'> = { ...sv, title: sv.title.trim(), location: sv.location.trim(), slots };
        const prevSv = id ? x0().services.find(s => s.id === id) : undefined;
        if (prevSv && prevSv.status !== 'draft') { if (prevSv.status) clean.status = prevSv.status; else delete clean.status; } // published stays published
        else if (clean.status !== 'draft') clean.status = 'published';
        const sid = id ?? `svc-${Date.now().toString(36)}`;
        update(x => ({
          ...x,
          services: id ? x.services.map(s => s.id === id ? { ...s, ...clean, id } : s) : [...x.services, { id: sid, ...clean }],
          // drop assignments for removed / shrunk slots, or people now unavailable on a moved date
          assignments: picks ? [
            ...x.assignments.filter(a => a.serviceId !== sid),
            ...picks.filter((pk, i, arr) => {
              const sl = slots.find(z => z.departmentId === pk.departmentId && z.position === pk.position);
              const u = x.users.find(z => z.id === pk.userId);
              return !!sl && pk.index < sl.count && !!u?.active && (u.positions?.[pk.departmentId] ?? []).includes(pk.position)
                && !awayOn(u, clean.date) && arr.findIndex(o => o.userId === pk.userId) === i;
            }).map(pk => ({ ...pk, serviceId: sid, id: `${sid}:${pk.departmentId}:${pk.position}:${pk.index}` })),
          ] : x.assignments.filter(a => {
            if (a.serviceId !== sid) return true;
            const sl = slots.find(z => z.departmentId === a.departmentId && z.position === a.position);
            const u = x.users.find(z => z.id === a.userId);
            return !!sl && a.index < sl.count && !awayOn(u, clean.date);
          }),
          settings: { ...x.settings, lastLocation: clean.location || x.settings?.lastLocation },
        }));
        return null;
      },
      canEditSetlist: _sv => canEditSetlistRule(currentUser),
      addSong: (sid, song) => {
        if (!canEditSetlistRule(currentUser)) return t('errors.setlistScope');
        const title = song.title.trim(); if (!title) return t('errors.songTitle');
        const item: SetlistItem = { id: `so-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, title, ...cleanSong(song) };
        editSetlist(sid, l => [...l, item]); return null;
      },
      updateSong: (sid, id, patch) => {
        if (!canEditSetlistRule(currentUser)) return t('errors.setlistScope');
        if (patch.title !== undefined && !patch.title.trim()) return t('errors.songTitle');
        editSetlist(sid, l => l.map(x => x.id === id ? (({ key, notes, ...r }) => ({ ...r, ...(patch.title !== undefined ? { title: patch.title.trim() } : {}), ...cleanSong({ key, notes, songId: x.songId, ...patch }) }))(x) : x)); return null;
      },
      removeSong: (sid, id) => { if (canEditSetlistRule(currentUser)) editSetlist(sid, l => l.filter(x => x.id !== id)); },
      moveSong: (sid, id, dir) => { if (canEditSetlistRule(currentUser)) editSetlist(sid, l => { const i = l.findIndex(x => x.id === id); const j = dir === 'up' ? i - 1 : i + 1; if (i < 0 || j < 0 || j >= l.length) return l; const n = [...l]; [n[i], n[j]] = [n[j], n[i]]; return n; }); },
      canEditDept: dep => canEditDeptRule(currentUser, dep),
      setDeptAbout: (dep, text) => { if (!canEditDeptRule(currentUser, dep)) return t('errors.deptScope'); const v = text.trim().slice(0, 1000);
        update(x => ({ ...x, departments: x.departments.map(z => z.id === dep ? (v ? { ...z, description: v } : (({ description, ...r }) => r)(z)) : z) })); return null; },
      addResource: (dep, r) => { if (!canEditDeptRule(currentUser, dep)) return t('errors.deptScope'); const title = r.title.trim(); const url = cleanUrl(r.url);
        if (!title) return t('errors.resTitle'); if (!url) return t('errors.urlInvalid');
        const item: Resource = { id: `rs-${uid()}`, title: title.slice(0, 120), url, kind: 'link' };
        editRes(dep, l => [...l, item]); return null; },
      updateResource: (dep, id, r) => { if (!canEditDeptRule(currentUser, dep)) return t('errors.deptScope'); const title = r.title.trim(); const url = cleanUrl(r.url);
        if (!title) return t('errors.resTitle'); if (!url) return t('errors.urlInvalid');
        editRes(dep, l => l.map(z => z.id === id ? { ...z, title: title.slice(0, 120), url } : z)); return null; },
      removeResource: (dep, id) => { if (canEditDeptRule(currentUser, dep)) editRes(dep, l => l.filter(z => z.id !== id)); },
      moveResource: (dep, id, dir) => { if (canEditDeptRule(currentUser, dep)) editRes(dep, l => swap(l, id, dir)); },
      canEditSongs: canEditSetlistRule(currentUser),
      addLibSong: so => { if (!canEditSetlistRule(currentUser)) return { error: t('errors.setlistScope') }; const c = cleanLib(so); if (!c.title) return { error: t('errors.songTitle') };
        if (c.link === null) return { error: t('errors.urlInvalid') };
        const id = `sg-${uid()}`; update(x => ({ ...x, songs: [...(x.songs ?? []), { id, deptId: 'd-music', ...c, title: c.title! } as Song] })); return id; },
      updateLibSong: (id, so) => { if (!canEditSetlistRule(currentUser)) return t('errors.setlistScope'); const c = cleanLib(so); if (so.title !== undefined && !c.title) return t('errors.songTitle');
        if (c.link === null) return t('errors.urlInvalid');
        update(x => ({ ...x, songs: (x.songs ?? []).map(z => { if (z.id !== id) return z; const n: any = { ...z, ...c }; for (const k of ['artist', 'key', 'chords', 'link']) if (k in so && !c[k as keyof typeof c]) delete n[k]; return n; }) })); return null; },
      removeLibSong: id => { if (canEditSetlistRule(currentUser)) update(x => ({ ...x, songs: (x.songs ?? []).filter(z => z.id !== id),
        services: x.services.map(s => s.setlist?.some(i => i.songId === id) ? { ...s, setlist: s.setlist.map(i => i.songId === id ? (({ songId, ...r }) => r)(i) : i) } : s) })); },
      publishService: id => isOwner && update(x => ({ ...x, services: x.services.map(s => s.id === id ? { ...s, status: 'published' } : s) })),
      deleteService: id => isOwner && update(x => ({ ...x, services: x.services.filter(s => s.id !== id), assignments: x.assignments.filter(a => a.serviceId !== id) })),
      unassign: id => { const a0 = d.assignments.find(a => a.id === id); if (!a0 || !canManage(a0.departmentId)) return; update(x => ({ ...x, assignments: x.assignments.filter(a => a.id !== id) })); },
    };
  }, [data, sessionId, deviceLang, deviceTheme]);

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
