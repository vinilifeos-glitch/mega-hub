export type Role = 'owner' | 'admin' | 'volunteer';
export interface User {
  id: string; username: string; name: string; role: Role; departmentIds: string[];
  firstName: string; middleNames: string; lastName: string; dob: string; // DD/MM/YYYY or ''
  adminOf?: string[]; // departments this admin administers (set by owner)
  unavailable?: string[]; // ISO YYYY-MM-DD dates the person can't serve
  contact?: string; // optional phone number, not used for sign-in
  positions: Record<string, string[]>; // departmentId -> roles held
  salt: string; passwordHash: string; mustChangePassword: boolean; active: boolean;
}
export interface Department { id: string; name: string; emoji: string; color: string; leaderId: string | null; positions: string[]; }
export interface Slot { departmentId: string; position: string; count: number; }
export interface Service { id: string; title: string; location: string; date: string /* ISO YYYY-MM-DD */; start: string; end: string; slots: Slot[]; }
export interface Availability { userId: string; serviceId: string; available: boolean; }
export interface Assignment { id: string; serviceId: string; departmentId: string; position: string; index: number; userId: string; }
export interface AppData { users: User[]; departments: Department[]; services: Service[]; availability: Availability[]; assignments: Assignment[]; settings?: { lastLocation?: string }; }
