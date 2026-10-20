export type Role = 'owner' | 'admin' | 'volunteer';
/** One unavailable day. `note` is private (owner, admins, and the person only). Maps 1:1 to a Supabase row (user_id, date, note). */
export interface Unavailability { date: string /* ISO YYYY-MM-DD, range start */; /** optional range end (ISO, inclusive); missing = single day */ to?: string; note?: string; }
export type Theme = 'light' | 'dark';
export interface User {
  id: string; username: string; name: string; role: Role; departmentIds: string[];
  firstName: string; middleNames: string; lastName: string; dob: string; // DD/MM/YYYY or ''
  adminOf?: string[]; // departments this admin administers (set by owner)
  unavailable?: Unavailability[]; // days the person can't serve (legacy data stored plain ISO strings; migrated on load)
  contact?: string;
  /** Optional, stored lowercase-trimmed. Private: own Profile + owner Accounts only. */
  email?: string;
  language?: 'pt' | 'en'; // app language for this user; unset = device's last, else 'pt'
  theme?: Theme; // UI theme for this user; unset = device's last, else 'light'
  positions: Record<string, string[]>; // departmentId -> roles held
  salt: string; passwordHash: string; mustChangePassword: boolean; active: boolean;
}
export interface Department { id: string; name: string; emoji: string; color: string; leaderId: string | null; positions: string[];
  /** About text (optional). */ description?: string;
  /** Ordered links. kind 'file' + fileRef reserved for uploads after Supabase (not built). */ resources?: Resource[]; }
export interface Resource { id: string; title: string; url: string; kind?: 'link' | 'file'; fileRef?: string | null; }
/** Department song library (Music). Referenced by SetlistItem.songId. */
export interface Song { id: string; deptId: string; title: string;
  composer?: string; /** legacy (pre-v2), migrated to composer on load */ artist?: string;
  /** 'C', 'F#', 'Am', 'Bbm' — chords in `sections` are written in this key */ key?: string;
  link?: string; timeSignature?: string; bpm?: number;
  /** legacy plain-text sheet (kept readable) */ chords?: string;
  sections?: SongSection[]; }
/** One chord-sheet section. bars[i] = chord(s) for bar i; '' = hold/repeat previous. */
export interface SongSection { id: string; name: string; cue?: string; bars: string[]; notes?: string; }
export interface Slot { departmentId: string; position: string; count: number; }
export interface Service { id: string; title: string; location: string; date: string /* ISO YYYY-MM-DD */; start: string; end: string; slots: Slot[]; /** missing = published */ status?: 'draft' | 'published';
  /** Ordered (array index = position). Missing = empty. */ setlist?: SetlistItem[];
  /** Kids lessons for this service: ordered ids from the Kids lesson catalog (megahub:files:v1 / Supabase lessons). Missing = none. */ lessons?: string[];
  /** Free-text assembly instructions; edited by admin-level+ (owner/admins). Missing = empty. */ assemblyNote?: string; }
/** songId reserved for the phase-2 song library (null/absent = free-text song). */
export interface SetlistItem { id: string; title: string; key?: string; notes?: string; songId?: string | null; }
export interface Availability { userId: string; serviceId: string; available: boolean; }
export interface Assignment { id: string; serviceId: string; departmentId: string; position: string; index: number; userId: string; }
export interface AppData { users: User[]; departments: Department[]; services: Service[]; availability: Availability[]; assignments: Assignment[]; songs?: Song[]; settings?: { lastLocation?: string }; }
