// Supabase-backed Repository. Selected only when EXPO_PUBLIC_BACKEND=supabase (local device mode stays default).
// Uses only the public anon key; every read/write is checked by row-level security on the server.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppData, Theme } from '../types';
import type { Repository } from './repository';
import { diffRows, fromRows, KEYS, ORDER, Rows, toRows } from './supabaseMapping';

/** Username-only sign-in: each account gets a synthetic, never-emailed Auth address. */
export const authEmail = (username: string) =>
  `${username.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}@megahub.local`;

const TABLES = ORDER;
const LANG_KEY = 'megahub:lang', THEME_KEY = 'megahub:theme';

export interface AuthOps {
  signIn(username: string, password: string): Promise<{ userId?: string; error?: 'wrong' | 'network' }>;
  signOut(): Promise<void>;
  changePassword(username: string, oldPw: string, newPw: string): Promise<'ok' | 'wrong' | 'error'>;
  /** Owner-only, via the admin-users edge function (service role stays on the server). */
  createAccount(input: Record<string, unknown>): Promise<{ id?: string; error?: string }>;
  resetPassword(userId: string, tempPassword: string): Promise<{ error?: string }>;
  setUsername(userId: string, username: string): Promise<{ error?: string }>;
  setActive(userId: string, active: boolean): Promise<{ error?: string }>;
}

export class SupabaseRepository implements Repository {
  sb: SupabaseClient; snapshot: Rows | null = null;
  constructor(url: string, anonKey: string) {
    this.sb = createClient(url, anonKey, { auth: { storage: AsyncStorage as any, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  }
  async load(): Promise<AppData> {
    const { data: s } = await this.sb.auth.getSession();
    const empty: AppData = { users: [], departments: [], services: [], availability: [], assignments: [] };
    if (!s.session) { this.snapshot = null; return empty; }      // RLS: nothing readable before sign-in
    const res = await Promise.all(TABLES.map(t => this.sb.from(t).select('*')));
    const rows = Object.fromEntries(TABLES.map((t, i) => {
      if (res[i].error) throw res[i].error;
      return [t, res[i].data ?? []];
    })) as Rows;
    // Snapshot in the same normalized shape save() produces (DB returns e.g. '16:00:00', timestamps, extra columns);
    // otherwise unchanged rows look changed and get re-upserted (RLS then rejects admins' saves).
    const data = fromRows(rows);
    this.snapshot = toRows(data);
    return data;
  }
  /** Writes only what changed since the last load/save. RLS rejects anything the signed-in user may not change. */
  async save(data: AppData): Promise<void> {
    if (!this.snapshot) return;
    const next = toRows(data);
    for (const { table, upsert, remove } of diffRows(this.snapshot, next)) {
      if (table === 'profiles' || table === 'profile_private') {
        // created/deleted by the edge function only; here just the columns that actually changed.
        // must_change_password is never written from here (edge function sets it, change-password clears it):
        // a stale copy in someone else's app (e.g. the owner editing a name) must not re-force a password change.
        const k = KEYS[table][0];
        const prev = new Map(((this.snapshot as any)[table] as any[]).map(r => [r[k], r]));
        for (const row of upsert) {
          const old = prev.get((row as any)[k]) ?? {};
          const patch = Object.fromEntries(Object.entries(row as any).filter(([c, v]) => c !== k && c !== 'must_change_password' && JSON.stringify(v) !== JSON.stringify(old[c])));
          if (!Object.keys(patch).length) continue;
          const { error } = await this.sb.from(table).update(patch).eq(k, (row as any)[k]);
          if (error) throw error;
        }
        continue;
      }
      if (table === 'services') {
        // existing services: plain UPDATE (admins may only change assembly_note; upsert would need INSERT rights)
        const known = new Set(this.snapshot.services.map(s => s.id));
        for (const row of upsert.filter((r: any) => known.has(r.id))) { const { error } = await this.sb.from('services').update(row).eq('id', (row as any).id); if (error) throw error; }
        const fresh = upsert.filter((r: any) => !known.has(r.id));
        if (fresh.length) { const { error } = await this.sb.from('services').upsert(fresh, { onConflict: 'id' }); if (error) throw error; }
      } else if (upsert.length) { const { error } = await this.sb.from(table).upsert(upsert, { onConflict: KEYS[table].join(',') }); if (error) throw error; }
      for (const row of remove) {
        let q: any = this.sb.from(table).delete();
        for (const k of KEYS[table]) q = q.eq(k, (row as any)[k]);
        const { error } = await q; if (error) throw error;
      }
    }
    this.snapshot = next;
  }
  async getSession() { const { data } = await this.sb.auth.getSession(); return data.session?.user.id ?? null; }
  async setSession(id: string | null) { if (!id) await this.sb.auth.signOut(); }   // sign-in goes through auth.signIn
  async getDeviceLanguage() { const v = await AsyncStorage.getItem(LANG_KEY); return v === 'pt' || v === 'en' ? v : null; }
  async setDeviceLanguage(lang: 'pt' | 'en') { await AsyncStorage.setItem(LANG_KEY, lang); }
  async getDeviceTheme() { const v = await AsyncStorage.getItem(THEME_KEY); return v === 'light' || v === 'dark' ? v : null; }
  async setDeviceTheme(theme: Theme) { await AsyncStorage.setItem(THEME_KEY, theme); }

  auth: AuthOps = {
    signIn: async (username, password) => {
      const { data, error } = await this.sb.auth.signInWithPassword({ email: authEmail(username), password });
      if (error) return { error: error.status === 400 ? 'wrong' : 'network' };
      return { userId: data.user.id };
    },
    signOut: async () => { await this.sb.auth.signOut(); this.snapshot = null; },
    changePassword: async (username, oldPw, newPw) => {
      // re-verify the current password, then update (Supabase Auth hashes it server-side)
      const check = await this.sb.auth.signInWithPassword({ email: authEmail(username), password: oldPw });
      if (check.error) return 'wrong';
      const { error } = await this.sb.auth.updateUser({ password: newPw });
      if (error) return 'error';
      await this.sb.from('profiles').update({ must_change_password: false }).eq('id', check.data.user.id);
      return 'ok';
    },
    createAccount: async input => {
      const { data, error } = await this.sb.functions.invoke('admin-users', { body: { action: 'create', ...input } });
      return error ? { error: String((data as any)?.error ?? error.message) } : { id: (data as any).id };
    },
    setUsername: async (userId, username) => {
      const { data, error } = await this.sb.functions.invoke('admin-users', { body: { action: 'set-username', userId, username } });
      return error ? { error: String((data as any)?.error ?? error.message) } : {};
    },
    setActive: async (userId, active) => {
      const { data, error } = await this.sb.functions.invoke('admin-users', { body: { action: 'set-active', userId, active } });
      return error ? { error: String((data as any)?.error ?? error.message) } : {};
    },
    resetPassword: async (userId, tempPassword) => {
      const { data, error } = await this.sb.functions.invoke('admin-users', { body: { action: 'reset-password', userId, tempPassword } });
      return error ? { error: String((data as any)?.error ?? error.message) } : {};
    },
  };
}
