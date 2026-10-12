/** Pure chord/key helpers (no React). Chords are stored as written in the song's key; transposition shifts by semitones. */
const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const BASE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const ROOTS = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const KEY_ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export function noteIndex(n: string): number | null {
  const m = /^([A-Ga-g])([#b♯♭]*)$/.exec(n.trim()); if (!m) return null;
  let i = BASE[m[1].toUpperCase()]; for (const c of m[2]) i += c === '#' || c === '♯' ? 1 : -1;
  return ((i % 12) + 12) % 12;
}
export interface Key { root: string; minor?: boolean }
/** 'C', 'Am', 'F#m', 'Bb', {root,minor} -> Key; null if unparseable. */
export function parseKey(k: string | Key | undefined | null): Key | null {
  if (!k) return null; if (typeof k !== 'string') return noteIndex(k.root) === null ? null : k;
  const m = /^\s*([A-Ga-g][#b]?)\s*(m|min|minor|-)?\s*$/i.exec(k.replace(/ major$/i, ''));
  if (!m || noteIndex(m[1]) === null) return null;
  return { root: m[1][0].toUpperCase() + m[1].slice(1), ...(m[2] ? { minor: true } : {}) };
}
export const keyLabel = (k: Key | null) => (k ? `${k.root}${k.minor ? 'm' : ''}` : '');
// Major keys written with flats: F Bb Eb Ab Db Gb; minor: Dm Gm Cm Fm Bbm Ebm
const FLAT_MAJOR = new Set([5, 10, 3, 8, 1, 6]); const FLAT_MINOR = new Set([2, 7, 0, 5, 10, 3]);
export function prefersFlats(k: Key | null): boolean {
  if (!k) return false; const i = noteIndex(k.root)!;
  if (k.root.includes('b')) return true; if (k.root.includes('#')) return false;
  return k.minor ? FLAT_MINOR.has(i) : FLAT_MAJOR.has(i);
}
const spell = (i: number, flats: boolean) => (flats ? FLAT : SHARP)[((i % 12) + 12) % 12];

/** Transpose one chord symbol (C, F#m7, Bbmaj7, Gsus2, D/F#, N.C., %) by semitones. Unknown tokens pass through. */
export function transposeChord(ch: string, semis: number, flats: boolean): string {
  const t = ch.trim(); if (!t || semis % 12 === 0) return t;
  const m = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/.exec(t); if (!m) return t;
  const r = noteIndex(m[1]); if (r === null) return t;
  const b = m[3] ? noteIndex(m[3]) : null;
  return spell(r + semis, flats) + m[2] + (m[3] && b !== null ? '/' + spell(b + semis, flats) : '');
}
export function semitonesBetween(from: Key | null, to: Key | null): number {
  if (!from || !to) return 0; return ((noteIndex(to.root)! - noteIndex(from.root)! + 12) % 12);
}
/** Transpose a whole bar (may hold several chords, e.g. "C G/B"). */
export const transposeBar = (bar: string, semis: number, flats: boolean) => bar.split(/(\s+)/).map(x => (x.trim() ? transposeChord(x, semis, flats) : x)).join('');
/** '| FM7 | | CM7 | |' -> ['FM7','','CM7',''] ; 'C G Am F' (no pipes) -> one chord per bar. */
export function parseBars(text: string): string[] {
  const s = text.trim(); if (!s) return [];
  if (!s.includes('|')) return s.split(/\s+/);
  const parts = s.split('|'); if (parts[0].trim() === '') parts.shift(); if (parts.length && parts[parts.length - 1].trim() === '') parts.pop();
  return parts.map(p => p.trim().replace(/\s+/g, ' '));
}
export const barsToText = (bars: string[]) => (bars.length ? `| ${bars.map(b => b || ' ').join(' | ')} |`.replace(/\|  \|/g, '|   |') : '');
/** Legacy plain-text chords -> sections if trivial: lines like "Verse:" headers followed by chord-only lines. */
export function convertLegacy(text: string): { name: string; bars: string[] }[] | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean); const out: { name: string; bars: string[] }[] = [];
  const chordTok = /^([A-G][#b]?[^/\s]*(\/[A-G][#b]?)?|\|)$/;
  for (const l of lines) {
    const h = /^\[?([^\]:|]{1,30})\]?:?$/.exec(l);
    if (l.split(/\s+/).every(x => chordTok.test(x))) { if (!out.length) out.push({ name: 'Intro', bars: [] }); out[out.length - 1].bars.push(...parseBars(l)); }
    else if (h && /:$|^\[/.test(l)) out.push({ name: h[1].trim(), bars: [] });
    else return null; // lyrics or anything non-trivial
  }
  return out.length && out.some(x => x.bars.length) ? out : null;
}
