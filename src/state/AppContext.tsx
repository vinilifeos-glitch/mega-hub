import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppData, Department, User } from '../types';
import { repository } from '../data/repository';
import { mockData } from '../data/mockData';

interface Ctx {
  data: AppData;
  currentUser: User;
  setCurrentUserId: (id: string) => void;
  isAvailable: (userId: string, serviceId: string) => boolean | undefined;
  setAvailability: (userId: string, serviceId: string, available: boolean) => void;
  assign: (serviceId: string, departmentId: string, position: string, userId: string) => void;
  unassign: (assignmentId: string) => void;
  canManage: (departmentId: string) => boolean;
  managedDepartments: Department[];
}

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(mockData);
  const [currentUserId, setCurrentUserId] = useState('u-admin');
  useEffect(() => { repository.load().then(setData); }, []);

  const update = (fn: (d: AppData) => AppData) =>
    setData(prev => { const next = fn(prev); repository.save(next); return next; });

  const currentUser = data.users.find(u => u.id === currentUserId) ?? data.users[0];

  const value = useMemo<Ctx>(() => {
    const canManage = (depId: string) =>
      currentUser.role === 'admin' ||
      (currentUser.role === 'leader' && data.departments.find(d => d.id === depId)?.leaderId === currentUser.id);
    return {
      data, currentUser, setCurrentUserId, canManage,
      managedDepartments: data.departments.filter(d => canManage(d.id)),
      isAvailable: (u, s) => data.availability.find(a => a.userId === u && a.serviceId === s)?.available,
      setAvailability: (userId, serviceId, available) => update(d => ({
        ...d,
        availability: [...d.availability.filter(a => !(a.userId === userId && a.serviceId === serviceId)), { userId, serviceId, available }],
        // if they become unavailable, drop their assignments for that service
        assignments: available ? d.assignments : d.assignments.filter(a => !(a.userId === userId && a.serviceId === serviceId)),
      })),
      assign: (serviceId, departmentId, position, userId) => {
        if (!canManage(departmentId)) return;
        update(d => ({
          ...d,
          assignments: [...d.assignments.filter(a => !(a.serviceId === serviceId && a.departmentId === departmentId && a.position === position)),
            { id: `${serviceId}:${departmentId}:${position}`, serviceId, departmentId, position, userId }],
        }));
      },
      unassign: id => update(d => ({ ...d, assignments: d.assignments.filter(a => a.id !== id) })),
    };
  }, [data, currentUser]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const c = useContext(AppContext);
  if (!c) throw new Error('useApp outside AppProvider');
  return c;
}
