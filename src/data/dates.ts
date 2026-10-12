export const toIso = (ddmmyyyy: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(ddmmyyyy); if (!m) return null;
  const [d, mo, y] = [+m[1], +m[2], +m[3]]; const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
};
export const todayIso = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
export const isoToDdmm = (iso: string) => iso.split('-').reverse().join('/');
export const upcomingSundayIso = () => {
  const t = new Date(); t.setDate(t.getDate() + ((7 - t.getDay()) % 7));
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};
export const formatTimeInput = (raw: string) => { const g = raw.replace(/\D/g, '').slice(0, 4); return g.length > 2 ? `${g.slice(0, 2)}:${g.slice(2)}` : g; };
