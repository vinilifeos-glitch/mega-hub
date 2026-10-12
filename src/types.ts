export type Role = 'admin' | 'leader' | 'volunteer';
export interface User { id: string; name: string; role: Role; departmentIds: string[]; }
export interface Department { id: string; name: string; emoji: string; color: string; leaderId: string | null; positions: string[]; }
export interface Service { id: string; date: string; title: string; time: string; }
export interface Availability { userId: string; serviceId: string; available: boolean; }
export interface Assignment { id: string; serviceId: string; departmentId: string; position: string; userId: string; }
export interface AppData { users: User[]; departments: Department[]; services: Service[]; availability: Availability[]; assignments: Assignment[]; }
