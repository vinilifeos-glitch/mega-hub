export type Role = 'owner' | 'admin' | 'volunteer';
/** One unavailable day. `note` is private (owner, admins, and the person only). Maps 1:1 to a Supabase row (user_id, date, note). */
export interface Unavailability { date: string /* ISO YYYY-MM-DD */; note?: string; }
export type Theme = 'light' | 'dark';
export interface User {
  id: string; username: string; name: string; role: Role; departmentIds: string[];
  firstName: string; middleNames: string; lastName: string; dob: string; // DD/MM/YYYY or ''
  adminOf?: string[]; // departments this admin administers (set by owner)
  unavailable?: Unavailability[]; // days the person can't serve (legacy data stored plain ISO strings; migrated on load)
  contact?: string;
  language?: 'pt' | 'en'; // app language for this user; unset = device's last, else 'pt'
  theme?: Theme; // UI theme for this user; unset = device's last, else 'light'
  positions: Record<string, string[]>; // departmentId -> roles held
  salt: string; passwordHash: string; mustChangePassword: boolean; active: boolean;
}
export interface Department { id: string; name: string; emoji: string; color: string; leaderId: string | null; positions: string[]; }
export interface Slot { departmentId: string; position: string; count: number; }
export interface Service { id: string; title: string; location: string; date: string /* ISO YYYY-MM-DD */; start: string; end: string; slots: Slot[]; }
export interface Availability { userId: string; serviceId: string; available: boolean; }
export interface Assignment { id: string; serviceId: string; departmentId: string; position: string; index: number; userId: string; }
export interface AppData { users: User[]; departments: Department[]; services: Service[]; availability: Availability[]; assignments: Assignment[]; settings?: { lastLocation?: string }; }
