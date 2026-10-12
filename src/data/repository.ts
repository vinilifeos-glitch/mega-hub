import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppData } from '../types';
import { mockData } from './mockData';

/** Upgrade data saved by older app versions in place (keeps accounts & passwords). */
export function migrate(d: AppData): AppData {
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
  return { ...d, users, departments, assignments };
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
}

const DATA_KEY = 'megahub:data:v4';
const SESSION_KEY = 'megahub:session:v4';

class DeviceRepository implements Repository {
  async load() {
    try {
      const raw = await AsyncStorage.getItem(DATA_KEY);
      if (raw) return migrate(JSON.parse(raw) as AppData);
    } catch {}
    const seed: AppData = JSON.parse(JSON.stringify(mockData));
    await this.save(seed);
    return seed;
  }
  async save(data: AppData) { await AsyncStorage.setItem(DATA_KEY, JSON.stringify(data)); }
  async getSession() { return AsyncStorage.getItem(SESSION_KEY); }
  async setSession(id: string | null) {
    if (id) await AsyncStorage.setItem(SESSION_KEY, id); else await AsyncStorage.removeItem(SESSION_KEY);
  }
}

export const repository: Repository = new DeviceRepository();
