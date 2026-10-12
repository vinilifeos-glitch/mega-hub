import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppData } from '../types';
import { mockData } from './mockData';

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

const DATA_KEY = 'megahub:data:v3';
const SESSION_KEY = 'megahub:session:v3';

class DeviceRepository implements Repository {
  async load() {
    try {
      const raw = await AsyncStorage.getItem(DATA_KEY);
      if (raw) return JSON.parse(raw) as AppData;
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
