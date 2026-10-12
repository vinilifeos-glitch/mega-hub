import { en } from './en';
import { pt } from './pt';

export type Lang = 'pt' | 'en';
export const DEFAULT_LANG: Lang = 'pt'; // church is Portuguese-speaking

/** Same shape as en.ts but with plain string / string[] leaves (so pt can have different text). */
type Widen<T> = T extends string ? string : T extends readonly string[] ? readonly string[] : { [K in keyof T]: Widen<T[K]> };
export type Dict = Widen<typeof en>;

/** Dotted paths to string leaves, e.g. 'services.newService'. */
type Leaves<T, P extends string = ''> = { [K in keyof T & string]: T[K] extends string ? `${P}${K}` : T[K] extends readonly string[] ? never : Leaves<T[K], `${P}${K}.`> }[keyof T & string];
export type TKey = Leaves<Dict>;
export type TParams = Record<string, string | number>;

export const dictionaries: Record<Lang, Dict> = { en, pt };

const lookup = (dict: Dict, key: string): unknown => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], dict);
const interpolate = (s: string, p?: TParams) => (p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? String(p[k]) : m)) : s);

/** Translate a key; falls back to English, then to the key itself. */
export function translate(lang: Lang, key: TKey, params?: TParams): string {
  const v = lookup(dictionaries[lang], key) ?? lookup(en, key);
  return typeof v === 'string' ? interpolate(v, params) : key;
}

/** Display name for a department. Stored ids are unchanged; unknown ids fall back to the stored name. */
export function deptLabel(deptId: string, lang: Lang, fallback?: string): string {
  return (dictionaries[lang].departments as Record<string, string>)[deptId] ?? fallback ?? deptId;
}

/** Display name for a role (stored role strings are unchanged). Unknown roles are shown as stored. */
export function roleLabel(deptId: string, role: string, lang: Lang): string {
  return (dictionaries[lang].roles as Record<string, Record<string, string>>)[deptId]?.[role] ?? role;
}

export const tierLabel = (tier: 'owner' | 'admin' | 'volunteer', lang: Lang) => dictionaries[lang].tiers[tier];
export const monthName = (m: number, lang: Lang) => dictionaries[lang].calendar.months[m];
export const weekdayShort = (d: number, lang: Lang) => dictionaries[lang].calendar.weekdaysShort[d]; // 0 = Sunday

/** e.g. "Dom, 18 out" / "Sun 18 Oct" for an ISO date. */
export function formatDateShort(iso: string, lang: Lang): string {
  const d = new Date(iso + 'T00:00:00'); const c = dictionaries[lang].calendar;
  return lang === 'pt' ? `${c.weekdaysShort[d.getDay()]}, ${d.getDate()} ${c.monthsShort[d.getMonth()]}` : `${c.weekdaysShort[d.getDay()]} ${d.getDate()} ${c.monthsShort[d.getMonth()]}`;
}
