import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMe } from '../state/AppContext';
import { Badge, Button, Card, Chip, Field, Notice, Screen, useColors, useStyles } from '../components/ui';
import { goBack, openUrl } from './DeptPage';

const KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Bb', 'Eb', 'Ab'];
// A line is a chord line if every token looks like a chord (C, F#m7, Bb/D, Gsus4, N.C., |).
const CHORD = /^(\(?[A-G](#|b)?(m|maj|min|dim|aug|sus|add)?\d*(sus\d|add\d|maj\d|b\d|#\d)*(\/[A-G](#|b)?)?\)?|\||N\.C\.|x\d)$/;
export const isChordLine = (l: string) => { const tk = l.trim().split(/\s+/).filter(Boolean); return tk.length > 0 && tk.every(x => CHORD.test(x)); };

export function SongView({ id }: { id: string }) {
  const colors = useColors(); const s = useStyles();
  const { data, t, canEditSongs, addLibSong, updateLibSong, removeLibSong } = useMe();
  const isNew = id === 'new';
  const song = (data.songs ?? []).find(x => x.id === id);
  const [size, setSize] = useState(16);
  const [form, setForm] = useState<{ title: string; artist: string; key: string; chords: string; link: string } | null>(isNew ? { title: '', artist: '', key: '', chords: '', link: '' } : null);
  const [err, setErr] = useState<string | null>(null);
  const back = { label: t('song.back'), onPress: () => goBack('/departments') };
  if (!isNew && !song) return <Screen title={t('song.notFound')} backTo={back}><Text style={s.small}>{t('song.notFound')}</Text></Screen>;
  if (isNew && !canEditSongs) return <Screen title={t('song.notFound')} backTo={back}><Text style={s.small}>{t('errors.setlistScope')}</Text></Screen>;
  const save = () => {
    if (!form) return;
    if (isNew) { const r = addLibSong(form); if (typeof r !== 'string') return setErr(r.error); router.replace(`/song/${r}` as any); return; }
    const e = updateLibSong(song!.id, form); setErr(e); if (!e) setForm(null);
  };
  const del = () => {
    const go = () => { removeLibSong(song!.id); goBack('/departments'); };
    const msg = t('song.delConfirm', { title: song!.title });
    if (Platform.OS === 'web') { if (globalThis.confirm?.(msg)) go(); } else Alert.alert(t('song.del'), msg, [{ text: t('song.cancel'), style: 'cancel' }, { text: t('song.del'), style: 'destructive', onPress: go }]);
  };
  if (form) return (
    <Screen title={isNew ? t('dept.addSong').replace(/^\+\s*/, '') : t('song.edit')} backTo={isNew ? back : { label: t('song.cancel'), onPress: () => setForm(null) }}>
      <Card>
        <Field label={t('song.title')} value={form.title} onChangeText={v => setForm({ ...form, title: v })} testID="lib-title" />
        <Field label={t('song.artist')} value={form.artist} onChangeText={v => setForm({ ...form, artist: v })} testID="lib-artist" />
        <Text style={s.small}>{t('song.key')}</Text>
        <View style={[s.row, { marginVertical: 6 }]}>{KEYS.map(k => <Chip key={k} label={k} active={form.key === k} testID={`lib-keychip-${k}`} onPress={() => setForm({ ...form, key: form.key === k ? '' : k })} />)}</View>
        <Field label={t('setlist.customKey')} value={form.key} maxLength={8} onChangeText={v => setForm({ ...form, key: v })} testID="lib-key" />
        <Field label={t('song.chords')} value={form.chords} onChangeText={v => setForm({ ...form, chords: v })} multiline autoCapitalize="none" testID="lib-chords"
          style={{ fontFamily: Platform.select({ web: 'ui-monospace, Menlo, Consolas, monospace', ios: 'Menlo', default: 'monospace' }), minHeight: 200, textAlignVertical: 'top' }} />
        <Field label={t('song.link')} value={form.link} onChangeText={v => setForm({ ...form, link: v })} autoCapitalize="none" keyboardType="url" testID="lib-link" />
        {err && <Notice tone="error" text={err} />}
        <Button label={t('song.save')} onPress={save} testID="lib-save" />
        <Button label={t('song.cancel')} outline onPress={() => isNew ? goBack('/departments') : setForm(null)} />
      </Card>
    </Screen>
  );
  const sg = song!;
  return (
    <Screen title={sg.title} subtitle={sg.artist} backTo={back}>
      <View style={[s.row, { justifyContent: 'space-between', marginBottom: 8 }]}>
        <View style={s.row}>{sg.key ? <Badge label={`${t('song.key')}: ${sg.key}`} tone="accent" testID="chord-key" /> : null}</View>
        <View style={s.row}>
          <Chip label="A−" testID="chord-smaller" onPress={() => setSize(z => Math.max(12, z - 2))} />
          <Chip label="A+" testID="chord-bigger" onPress={() => setSize(z => Math.min(32, z + 2))} />
        </View>
      </View>
      <Card>
        <ScrollView horizontal testID="chord-view">
          <View>
            {(sg.chords ?? '').length === 0 && <Text style={s.small}>{t('song.noChords')}</Text>}
            {(sg.chords ?? '').split('\n').map((l, i) => {
              const ch = isChordLine(l);
              return <Text key={i} testID={ch ? 'chord-line' : undefined} style={{ fontFamily: Platform.select({ web: 'ui-monospace, Menlo, Consolas, monospace', ios: 'Menlo', default: 'monospace' }), fontSize: size, lineHeight: size * 1.4, color: ch ? colors.primary : colors.text, fontWeight: ch ? '700' : '400' }}>{l || ' '}</Text>;
            })}
          </View>
        </ScrollView>
      </Card>
      {sg.link ? <Pressable onPress={() => openUrl(sg.link!)} testID="song-link"><Text style={{ color: colors.primary, fontWeight: '600', marginBottom: 8 }}>{sg.link}</Text></Pressable> : null}
      {canEditSongs && <Button label={t('song.edit')} outline onPress={() => setForm({ title: sg.title, artist: sg.artist ?? '', key: sg.key ?? '', chords: sg.chords ?? '', link: sg.link ?? '' })} testID="song-edit" />}
      {canEditSongs && <Button label={t('song.del')} danger outline onPress={del} testID="song-delete" />}
    </Screen>
  );
}
