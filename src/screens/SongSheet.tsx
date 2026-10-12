import { Platform, Text, View } from 'react-native';
import { Chip, useColors, useStyles } from '../components/ui';
import { KEY_ROOTS, keyLabel, parseKey, prefersFlats, semitonesBetween, transposeBar } from '../data/music';
import { Song } from '../types';

export const MONO = Platform.select({ web: 'ui-monospace, Menlo, Consolas, monospace', ios: 'Menlo', default: 'monospace' });
export type SheetPalette = { text: string; muted: string; chord: string; border: string; card: string };

/** Chord sheet: named sections with bars, transposed from the song key to `toKey`. Legacy text shown as-is. */
export function SongSheet({ song, toKey, size = 18, pal, perRow = 4 }: { song: Song; toKey?: string | null; size?: number; pal?: SheetPalette; perRow?: number }) {
  const c = useColors(); const s = useStyles();
  const P: SheetPalette = pal ?? { text: c.text, muted: c.muted, chord: c.primary, border: c.border, card: c.card };
  const from = parseKey(song.key); const to = parseKey(toKey ?? song.key) ?? from;
  const semis = semitonesBetween(from, to); const flats = prefersFlats(to);
  const secs = song.sections ?? [];
  if (!secs.length) return song.chords ? (
    <View testID="song-legacy">{song.chords.split('\n').map((l, i) => <Text key={i} style={{ fontFamily: MONO, fontSize: size, lineHeight: size * 1.4, color: P.text }}>{l || ' '}</Text>)}</View>
  ) : null;
  return (
    <View testID="song-sheet">
      {secs.map(sec => {
        const rows: string[][] = []; for (let i = 0; i < sec.bars.length; i += perRow) rows.push(sec.bars.slice(i, i + perRow));
        return (
          <View key={sec.id} testID={`section-${sec.id}`} style={{ marginBottom: size }}>
            <Text style={{ color: P.text, fontWeight: '800', fontSize: size * 0.85 }}>{sec.name}{sec.cue ? <Text style={{ fontWeight: '400', fontStyle: 'italic', color: P.muted }}>  {sec.cue}</Text> : null}</Text>
            {rows.map((r, ri) => (
              <View key={ri} style={{ flexDirection: 'row', marginTop: 4 }}>
                {Array.from({ length: perRow }, (_, j) => { const b = r[j]; const idx = ri * perRow + j; return (
                  <View key={j} testID={b !== undefined ? `bar-${sec.id}-${idx}` : undefined} style={{ flex: 1, borderLeftWidth: 1, borderColor: P.border, paddingVertical: size * 0.3, paddingHorizontal: 4, minHeight: size * 1.8, justifyContent: 'center', borderRightWidth: j === perRow - 1 && b !== undefined ? 1 : 0 }}>
                    <Text style={{ fontFamily: MONO, fontSize: size, fontWeight: '700', color: P.chord }}>{b ? transposeBar(b, semis, flats) : b === '' ? ' ' : ''}</Text>
                  </View>); })}
              </View>
            ))}
            {sec.notes ? <Text style={[s.small, { color: P.muted, marginTop: 4 }]}>{sec.notes}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

/** Key chooser: root chips + Major/Minor. value like 'C' / 'Am'. */
export function KeyPicker({ value, onChange, prefix, majorLabel, minorLabel, allowClear }: { value: string; onChange: (k: string) => void; prefix: string; majorLabel: string; minorLabel: string; allowClear?: boolean }) {
  const s = useStyles(); const k = parseKey(value);
  const set = (root: string, minor: boolean) => onChange(keyLabel({ root, minor }));
  return (
    <View>
      <View style={[s.row, { marginVertical: 4 }]}>{KEY_ROOTS.map(r => <Chip key={r} label={r} active={k?.root === r} testID={`${prefix}-${r}`} onPress={() => allowClear && k?.root === r ? onChange('') : set(r, !!k?.minor)} />)}</View>
      <View style={s.row}>
        <Chip label={majorLabel} active={!!k && !k.minor} testID={`${prefix}-major`} onPress={() => set(k?.root ?? 'C', false)} />
        <Chip label={minorLabel} active={!!k?.minor} testID={`${prefix}-minor`} onPress={() => set(k?.root ?? 'A', true)} />
      </View>
    </View>
  );
}
