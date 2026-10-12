import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppData, Theme } from '../types';
import { normalizeUnavailable } from './unavailability';
import { mockData } from './mockData';

/** Upgrade data saved by older app versions in place (keeps accounts & passwords). */
export function migrate(d0: AppData): AppData {
  // songs v2: artist -> composer (value kept, additive & idempotent)
  const d: AppData = d0.songs?.some(s => s.artist !== undefined) ? { ...d0, songs: d0.songs.map(s => s.artist === undefined ? s : (({ artist, ...r }) => ({ ...r, composer: r.composer ?? artist }))(s)) } : d0;
  const seedPos = (id: string) => mockData.departments.find(x => x.id === id)?.positions;
  const departments = d.departments.map(x => ({ ...x, positions: seedPos(x.id) ?? x.positions }));
  const valid = (dep: string, r: string) => !!departments.find(x => x.id === dep)?.positions.includes(r);
  const users = d.users.map(u0 => {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(u0.dob ?? '');
    const u = {
      ...u0,
      ...(iso ? { dob: `${iso[3]}/${iso[2]}/${iso[1]}` } : {}),
      ...(u0.positions ? { positions: Object.fromEntries(Object.entries(u0.positions).map(([k, v]) => [k, v.filter(r => valid(k, r))])) } : {}),
    };
    if ((u.role as string) === 'leader') {
      const led = d.departments.filter(x => x.leaderId === u.id).map(x => x.id);
      u.role = 'admin'; u.adminOf = [...new Set([...led, ...u.departmentIds])];
    }
    if (!u.unavailable) {
      u.unavailable = [...new Set(d.availability.filter(a => a.userId === u.id && !a.available)
        .map(a => d.services.find(s => s.id === a.serviceId)?.date).filter((x): x is string => !!x))].sort().map(date => ({ date }));
    } else {
      // additive, idempotent: legacy string[] -> {date, note?}[]; object entries pass through unchanged
      u.unavailable = normalizeUnavailable(u.unavailable);
    }
    if (u.firstName !== undefined && u.positions) return u;
    const seed = mockData.users.find(s => s.id === u.id);
    const parts = u.name.split(' ');
    return {
      ...u,
      firstName: seed?.firstName ?? parts[0], middleNames: seed?.middleNames ?? parts.slice(1).join(' '),
      lastName: seed?.lastName ?? '', dob: '', positions: {},
    };
  });
  const assignments = d.assignments.filter(a => departments.find(x => x.id === a.departmentId)?.positions.includes(a.position));
  // v1 sample services (no slots) are replaced by owner-created services
  const services = d.services.filter(s => Array.isArray((s as any).slots));
  const keep = new Set(services.map(s => s.id));
  const asg = assignments.filter(a => keep.has(a.serviceId) && typeof a.index === 'number');
  return { ...d, users, services, departments: departments.map(x => ({ ...x, leaderId: null })), assignments: asg };
}

/**
 * Data access boundary. v2 persists on-device (AsyncStorage; localStorage on web).
 * To share data across devices later (e.g. Supabase), implement this interface
 * against the backend and swap the export below. Screens never touch storage directly.
 */
export interface Repository {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
  getSession(): Promise<string | null>;
  setSession(userId: string | null): Promise<void>;
  /** Last language used on this device, so the sign-in screen matches before anyone signs in. */
  getDeviceLanguage(): Promise<'pt' | 'en' | null>;
  setDeviceLanguage(lang: 'pt' | 'en'): Promise<void>;
  getDeviceTheme(): Promise<Theme | null>;
  setDeviceTheme(theme: Theme): Promise<void>;
}

const DATA_KEY = 'megahub:data:v4';
/** Raw JSON this tab last loaded/saved; used to detect writes from other tabs/windows (web). */
let lastRaw: string | null = null;
const ls = (): Storage | null => { try { return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null; } catch { return null; } };
/**
 * Web only: if another tab/window (e.g. a stale Safari tab or home-screen app) wrote newer data since this tab last
 * loaded/saved, return that data (migrated) so we never overwrite it with a stale in-memory copy. Otherwise null.
 */
export function newerFromOtherTab(): AppData | null {
  const st = ls(); if (!st) return null;
  try { const raw = st.getItem(DATA_KEY); if (!raw || raw === lastRaw) return null; const d = migrate(JSON.parse(raw) as AppData); lastRaw = raw; return d; } catch { return null; }
}
export const DATA_STORAGE_KEY = DATA_KEY;
const SESSION_KEY = 'megahub:session:v4';
const LANG_KEY = 'megahub:lang';
const THEME_KEY = 'megahub:theme';

class DeviceRepository implements Repository {
  async load() {
    try {
      const raw = await AsyncStorage.getItem(DATA_KEY);
      if (raw) { const d = migrate(JSON.parse(raw) as AppData); lastRaw = raw; return d; }
    } catch {}
    const seed: AppData = JSON.parse(JSON.stringify(mockData));
    await this.save(seed);
    return seed;
  }
  async save(data: AppData) { const raw = JSON.stringify(data); lastRaw = raw; const st = ls(); if (st) { try { st.setItem(DATA_KEY, raw); return; } catch {} } await AsyncStorage.setItem(DATA_KEY, raw); }
  async getSession() { return AsyncStorage.getItem(SESSION_KEY); }
  async setSession(id: string | null) {
    if (id) await AsyncStorage.setItem(SESSION_KEY, id); else await AsyncStorage.removeItem(SESSION_KEY);
  }
  async getDeviceLanguage() { const v = await AsyncStorage.getItem(LANG_KEY); return v === 'pt' || v === 'en' ? v : null; }
  async setDeviceLanguage(lang: 'pt' | 'en') { await AsyncStorage.setItem(LANG_KEY, lang); }
  async getDeviceTheme() { const v = await AsyncStorage.getItem(THEME_KEY); return v === 'light' || v === 'dark' ? v : null; }
  async setDeviceTheme(theme: Theme) { await AsyncStorage.setItem(THEME_KEY, theme); }
}

export const repository: Repository = new DeviceRepository();
