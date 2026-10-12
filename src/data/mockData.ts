import { AppData, Service } from '../types';

function upcomingSundays(n: number): Service[] {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  const out: Service[] = [];
  for (let i = 0; i < n; i++) {
    const iso = d.toISOString().slice(0, 10);
    out.push({ id: `sun-${iso}`, date: iso, title: 'Sunday Service', time: '10:30' });
    if (i === 1) {
      const fri = new Date(d); fri.setDate(fri.getDate() + 5);
      out.push({ id: `evt-youth`, date: fri.toISOString().slice(0, 10), title: 'Youth Night', time: '19:00' });
    }
    d.setDate(d.getDate() + 7);
  }
  return out;
}

const SERVICES = upcomingSundays(4);

export const mockData: AppData = {
  users: [
    { id: 'u-admin', name: 'You (Admin)', role: 'admin', departmentIds: [] },
    { id: 'u-grace', name: 'Grace Okafor', role: 'leader', departmentIds: ['d-music'] },
    { id: 'u-ruth', name: 'Ruth Adeyemi', role: 'leader', departmentIds: ['d-kids'] },
    { id: 'u-daniel', name: 'Daniel Mensah', role: 'leader', departmentIds: ['d-obreiros'] },
    { id: 'u-sam', name: 'Samuel Boateng', role: 'volunteer', departmentIds: ['d-music', 'd-obreiros'] },
    { id: 'u-esther', name: 'Esther Johnson', role: 'volunteer', departmentIds: ['d-music'] },
    { id: 'u-joel', name: 'Joel Asante', role: 'volunteer', departmentIds: ['d-music'] },
    { id: 'u-mary', name: 'Mary Owusu', role: 'volunteer', departmentIds: ['d-kids'] },
    { id: 'u-hannah', name: 'Hannah Clarke', role: 'volunteer', departmentIds: ['d-kids'] },
    { id: 'u-peter', name: 'Peter Eze', role: 'volunteer', departmentIds: ['d-obreiros'] },
  ],
  departments: [
    { id: 'd-music', name: 'Music', emoji: '🎵', color: '#7C3AED', leaderId: 'u-grace', positions: ['Lead Vocal', 'Backing Vocal', 'Keys'] },
    { id: 'd-kids', name: 'Kids', emoji: '🧸', color: '#10B981', leaderId: 'u-ruth', positions: ['Teacher', 'Helper'] },
    { id: 'd-obreiros', name: 'Obreiros', emoji: '🤝', color: '#F59E0B', leaderId: 'u-daniel', positions: ['Front Door', 'Altar', 'Offering'] },
  ],
  services: SERVICES,
  // a little seeded demo data so screens aren't empty
  availability: [
    { userId: 'u-sam', serviceId: SERVICES[0].id, available: true },
    { userId: 'u-esther', serviceId: SERVICES[0].id, available: true },
    { userId: 'u-joel', serviceId: SERVICES[0].id, available: false },
    { userId: 'u-mary', serviceId: SERVICES[0].id, available: true },
    { userId: 'u-peter', serviceId: SERVICES[0].id, available: true },
  ],
  assignments: [
    { id: `${SERVICES[0].id}:d-music:Backing Vocal`, serviceId: SERVICES[0].id, departmentId: 'd-music', position: 'Backing Vocal', userId: 'u-esther' },
    { id: `${SERVICES[0].id}:d-kids:Teacher`, serviceId: SERVICES[0].id, departmentId: 'd-kids', position: 'Teacher', userId: 'u-mary' },
  ],
};
