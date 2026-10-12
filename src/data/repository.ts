import { AppData } from '../types';
import { mockData } from './mockData';

/**
 * Data access boundary. v1 uses in-memory mock data.
 * To add Supabase later: implement this interface with supabase-js
 * (tables: users, departments, services, availability, assignments)
 * and swap the export below. Screens never touch storage directly.
 */
export interface Repository {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
}

class LocalRepository implements Repository {
  private data: AppData = JSON.parse(JSON.stringify(mockData));
  async load() { return this.data; }
  async save(data: AppData) { this.data = data; }
}

export const repository: Repository = new LocalRepository();
