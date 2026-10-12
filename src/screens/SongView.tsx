import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMe } from '../state/AppContext';
import { Badge, Button, Card, Chip, Field, IconButton, Notice, Screen, useColors, useStyles } from '../components/ui';
import { goBack, openUrl } from './DeptPage';
import { KeyPicker, MONO, SongSheet } from './SongSheet';
import { barsToText, convertLegacy, keyLabel, parseBars, parseKey } from '../data/music';
import { Song, SongSection } from '../types';

const PRESETS = ['Intro', 'Verse', 'Pre-chorus', 'Chorus', 'Bridge', 'Outro'];
type SecForm = { id: string; name: string; cue: string; barsText: string; notes: string };
type Form = { title: string; composer: string; key: string; timeSignature: string; bpm: string; link: string; chords: string; sections: SecForm[] };
let seq = 0; const sid = () => `sc-${Date.now().toString(36)}${++seq}`;
const toForm = (g?: Song): Form => ({ title: g?.title ?? '', composer: g?.composer ?? g?.artist ?? '', key: g?.key ?? '', timeSignature: g?.timeSignature ?? '', bpm: g?.bpm ? String(g.bpm) : '', link: g?.link ?? '', chords: g?.chords ?? '',
  sections: (g?.sections ?? []).map(x => ({ id: x.id, name: x.name, cue: x.cue ?? '', barsText: barsToText(x.bars), notes: x.notes ?? '' })) });

export function SongView({ id, keyParam }: { id: string; keyParam?: string }) {
  const colors = useColors(); const s = useStyles();
  const { data, t, canEditSongs, addLibSong, updateLibSong, removeLibSong } = useMe();
  const isNew = id === 'new';
  const song = (data.songs ?? []).find(x => x.id === id);
  const [size, setSize] = useState(18);
  const [toKey, setToKey] = useState<string>(keyLabel(parseKey(keyParam)) || song?.key || '');
  const [form, setForm] = useState<Form | null>(isNew ? toForm() : null);
  const [err, setErr] = useState<string | null>(null);
  const back = { label: t('song.back'), onPress: () => goBack('/departments') };
  if (!isNew && !song) return <Screen title={t('song.notFound')} backTo={back}><Text style={s.small}>{t('song.notFound')}</Text></Screen>;
  if (isNew && !canEditSongs) return <Screen title={t('song.notFound')} backTo={back}><Text style={s.small}>{t('errors.setlistScope')}</Text></Screen>;

  const payload = (f: Form) => ({ title: f.title, composer: f.composer, key: f.key, timeSignature: f.timeSignature, bpm: f.bpm ? Number(f.bpm) : undefined, link: f.link, chords: f.chords,
    sections: f.sections.map<SongSection>(x => ({ id: x.id, name: x.name, cue: x.cue, notes: x.notes, bars: parseBars(x.barsText) })) });
  const save = () => {
    if (!form) return;
    if (isNew) { const r = addLibSong(payload(form)); if (typeof r !== 'string') return setErr(r.error); router.replace(`/song/${r}` as any); return; }
    const e = updateLibSong(song!.id, payload(form)); setErr(e); if (!e) { setForm(null); setToKey(parseKey(form.key) ? keyLabel(parseKey(form.key)) : ''); }
  };
  const del = () => {
    const go = () => { removeLibSong(song!.id); goBack('/departments'); };
    const msg = t('song.delConfirm', { title: song!.title });
    if (Platform.OS === 'web') { if (globalThis.confirm?.(msg)) go(); } else Alert.alert(t('song.del'), msg, [{ text: t('song.cancel'), style: 'cancel' }, { text: t('song.del'), style: 'destructive', onPress: go }]);
  };

  if (form) {
    const setSec = (i: number, p: Partial<SecForm>) => setForm({ ...form, sections: form.sections.map((x, j) => j === i ? { ...x, ...p } : x) });
    const move = (i: number, d: number) => { const n = [...form.sections]; const j = i + d; if (j < 0 || j >= n.length) return; [n[i], n[j]] = [n[j], n[i]]; setForm({ ...form, sections: n }); };
    const conv = form.chords && !form.sections.length ? convertLegacy(form.chords) : null;
    return (
      <Screen title={isNew ? t('dept.addSong').replace(/^\+\s*/, '') : t('song.edit')} backTo={isNew ? back : { label: t('song.cancel'), onPress: () => setForm(null) }}>
        <Card>
          <Field label={t('song.title')} value={form.title} onChangeText={v => setForm({ ...form, title: v })} testID="song-f-title" />
          <Field label={t('song.composer')} value={form.composer} onChangeText={v => setForm({ ...form, composer: v })} testID="song-f-composer" />
          <Text style={s.small}>{t('song.key')}</Text>
          <KeyPicker value={form.key} onChange={k => setForm({ ...form, key: k })} prefix="song-f-key" majorLabel={t('song.major')} minorLabel={t('song.minor')} allowClear />
          <View style={[s.row, { flexWrap: 'nowrap', marginTop: 8 }]}>
            <View style={{ flex: 1, marginRight: 8 }}><Field label={t('song.timeSignature')} value={form.timeSignature} placeholder="4/4" maxLength={10} onChangeText={v => setForm({ ...form, timeSignature: v })} testID="song-f-time" /></View>
            <View style={{ flex: 1 }}><Field label={t('song.bpm')} value={form.bpm} keyboardType="number-pad" maxLength={3} onChangeText={v => setForm({ ...form, bpm: v.replace(/\D/g, '') })} testID="song-f-bpm" /></View>
          </View>
          <Field label={t('song.link')} value={form.link} onChangeText={v => setForm({ ...form, link: v })} autoCapitalize="none" keyboardType="url" testID="song-f-link" />
        </Card>
        <Text style={s.section}>{t('song.sections')}</Text>
        <Text style={[s.small, { marginBottom: 8 }]}>{t('song.barsHint')}</Text>
        {form.sections.map((x, i) => (
          <Card key={x.id}>
            <View testID={`section-form-${i}`} style={[s.row, { justifyContent: 'space-between' }]}>
              <Text style={s.h2}>{x.name || t('song.sectionName')}</Text>
              <View style={[s.row, { flexWrap: 'nowrap' }]}>
                <IconButton testID={`section-up-${i}`} icon="chevron-up" label={t('dept.up', { title: x.name })} onPress={() => move(i, -1)} />
                <IconButton testID={`section-down-${i}`} icon="chevron-down" label={t('dept.down', { title: x.name })} onPress={() => move(i, 1)} />
                <IconButton testID={`section-rm-${i}`} icon="close" color={colors.red} label={t('dept.remove', { title: x.name })} onPress={() => setForm({ ...form, sections: form.sections.filter((_, j) => j !== i) })} />
              </View>
            </View>
            <View style={s.row}>{PRESETS.map(p => <Chip key={p} label={t(`song.preset.${p}` as any)} active={x.name === t(`song.preset.${p}` as any)} testID={`section-preset-${i}-${p}`} onPress={() => setSec(i, { name: t(`song.preset.${p}` as any) })} />)}</View>
            <Field label={t('song.sectionName')} value={x.name} maxLength={40} onChangeText={v => setSec(i, { name: v })} testID={`section-name-${i}`} />
            <Field label={t('song.cue')} value={x.cue} maxLength={120} onChangeText={v => setSec(i, { cue: v })} testID={`section-cue-${i}`} />
            <Field label={t('song.bars')} value={x.barsText} autoCapitalize="none" placeholder="| FM7 | | CM7 | |" onChangeText={v => setSec(i, { barsText: v })} testID={`section-bars-${i}`} style={{ fontFamily: MONO }} />
            <Text style={s.small} testID={`section-barcount-${i}`}>{t('song.barCount', { n: parseBars(x.barsText).length })}</Text>
            <Field label={t('song.notes')} value={x.notes} multiline maxLength={500} onChangeText={v => setSec(i, { notes: v })} testID={`section-notes-${i}`} />
          </Card>
        ))}
        <Button label={t('song.addSection')} outline testID="section-add" onPress={() => setForm({ ...form, sections: [...form.sections, { id: sid(), name: form.sections.length ? t('song.preset.Verse') : t('song.preset.Intro'), cue: '', barsText: '', notes: '' }] })} />
        {form.chords ? <Card>
          <Text style={s.h2}>{t('song.legacy')}</Text>
          <Field label={t('song.chords')} value={form.chords} multiline autoCapitalize="none" onChangeText={v => setForm({ ...form, chords: v })} testID="song-f-chords" style={{ fontFamily: MONO, minHeight: 120, textAlignVertical: 'top' }} />
          {conv && <Button label={t('song.convert')} outline testID="song-convert" onPress={() => setForm({ ...form, chords: '', sections: conv.map(c => ({ id: sid(), name: c.name, cue: '', barsText: barsToText(c.bars), notes: '' })) })} />}
        </Card> : null}
        {err && <Notice tone="error" text={err} />}
        <Button label={t('song.save')} onPress={save} testID="song-save" />
        <Button label={t('song.cancel')} outline onPress={() => isNew ? goBack('/departments') : setForm(null)} />
      </Screen>
    );
  }
  const sg = song!;
  const meta = [sg.timeSignature, sg.bpm ? `${sg.bpm} BPM` : ''].filter(Boolean).join(' · ');
  return (
    <Screen title={sg.title} subtitle={sg.composer ?? sg.artist} backTo={back}>
      <View style={[s.row, { marginBottom: 8 }]}>
        {sg.key ? <Badge label={`${t('song.originalKey')}: ${sg.key}`} tone="accent" testID="song-key" /> : null}
        {meta ? <Text style={[s.small, { marginLeft: 8 }]} testID="song-meta">{meta}</Text> : null}
      </View>
      {sg.key && sg.sections?.length ? <Card>
        <Text style={s.small}>{t('song.transpose')}: <Text style={{ fontWeight: '800', color: colors.text }} testID="transpose-current">{toKey || sg.key}</Text></Text>
        <KeyPicker value={toKey || sg.key} onChange={setToKey} prefix="transpose" majorLabel={t('song.major')} minorLabel={t('song.minor')} />
        {toKey && toKey !== sg.key ? <Chip label={t('song.resetKey', { key: sg.key })} testID="transpose-reset" onPress={() => setToKey(sg.key!)} /> : null}
      </Card> : null}
      <View style={[s.row, { justifyContent: 'flex-end', marginBottom: 4 }]}>
        <Chip label="A−" testID="song-smaller" onPress={() => setSize(z => Math.max(12, z - 2))} />
        <Chip label="A+" testID="song-bigger" onPress={() => setSize(z => Math.min(36, z + 2))} />
      </View>
      <Card>
        <ScrollView horizontal={!sg.sections?.length} testID="chord-view">
          <View style={{ minWidth: '100%' }}>
            {!sg.sections?.length && !sg.chords && <Text style={s.small}>{t('song.noChords')}</Text>}
            <SongSheet song={sg} toKey={toKey || sg.key} size={size} />
          </View>
        </ScrollView>
      </Card>
      {sg.link ? <Pressable onPress={() => openUrl(sg.link!)} testID="song-link"><Text style={{ color: colors.primary, fontWeight: '600', marginBottom: 8 }}>{sg.link}</Text></Pressable> : null}
      {canEditSongs && <Button label={t('song.edit')} outline onPress={() => setForm(toForm(sg))} testID="song-edit" />}
      {canEditSongs && <Button label={t('song.del')} danger outline onPress={del} testID="song-delete" />}
    </Screen>
  );
}
