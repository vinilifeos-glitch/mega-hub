import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useMe } from '../state/AppContext';
import { Badge, Button, Card, Chip, Field, Icon, IconButton, Notice, useColors, useStyles } from '../components/ui';
import { Service, SetlistItem } from '../types';

const KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Bb', 'Eb', 'Ab'];

/** Service setlist card (detail screen). Visible only if AppContext left `setlist` on the service (or the viewer can edit). */
export function SetlistCard({ service: sv }: { service: Service }) {
  const colors = useColors(); const s = useStyles();
  const { data, t, canEditSetlist, addSong, updateSong, removeSong, moveSong } = useMe();
  const editor = canEditSetlist(sv);
  const list = sv.setlist ?? [];
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{ id: string | null; title: string; key: string; notes: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  if (!editor && !sv.setlist) return null;
  const open = (x?: SetlistItem) => { setErr(null); setForm({ id: x?.id ?? null, title: x?.title ?? '', key: x?.key ?? '', notes: x?.notes ?? '' }); };
  const submit = () => {
    if (!form) return;
    const e = form.id ? updateSong(sv.id, form.id, { title: form.title, key: form.key, notes: form.notes }) : addSong(sv.id, { title: form.title, key: form.key, notes: form.notes });
    setErr(e); if (!e) setForm(null);
  };
  return (
    <View testID="setlist-card"><Card>
      <View style={[s.row, { justifyContent: 'space-between' }]}>
        <Text style={s.h2}>{t('setlist.title')} <Text style={s.small} testID="setlist-count">· {t('setlist.count', { n: list.length })}</Text></Text>
        {editor && !editing && <Pressable testID="setlist-edit" onPress={() => setEditing(true)}><Text style={{ color: colors.primary, fontWeight: '700' }}>{t('setlist.edit')}</Text></Pressable>}
      </View>
      {list.length === 0 && <Text style={[s.small, { marginTop: 6 }]} testID="setlist-empty">{t('setlist.empty')}</Text>}
      {list.map((x, i) => (
        <View key={x.id} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 8 }}>
          <View style={[s.row, { flexWrap: 'nowrap', alignItems: 'center' }]}>
            <Pressable testID={`song-row-${x.id}`} disabled={!editing} onPress={() => open(x)} style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{i + 1}. {x.title}</Text>
              {x.notes ? <Text style={s.small}>{x.notes}</Text> : null}
            </Pressable>
            {x.key ? <Badge label={x.key} tone="accent" testID={`song-key-${x.id}`} /> : null}
            {x.songId && (data.songs ?? []).some(z => z.id === x.songId) ? <Pressable testID={`song-chords-${x.id}`} accessibilityLabel={x.title} onPress={() => router.push(`/song/${x.songId}` as any)} hitSlop={8} style={{ marginLeft: 8 }}><Icon name="musical-notes-outline" size={20} /></Pressable> : null}
            {editing && <>
              <IconButton testID={`song-up-${x.id}`} icon="chevron-up" label={t('setlist.up', { title: x.title })} onPress={() => moveSong(sv.id, x.id, 'up')} />
              <IconButton testID={`song-down-${x.id}`} icon="chevron-down" label={t('setlist.down', { title: x.title })} onPress={() => moveSong(sv.id, x.id, 'down')} />
              <IconButton testID={`song-rm-${x.id}`} icon="close" color={colors.red} label={t('setlist.remove', { title: x.title })} onPress={() => removeSong(sv.id, x.id)} />
            </>}
          </View>
          {form?.id === x.id && editor_()}
        </View>
      ))}
      {form && form.id === null && editor_()}
      {editing && !form && <>
        <Button label={t('setlist.addSong')} outline onPress={() => open()} testID="add-song" />
        {pick === null ? <Button label={t('song.pick')} outline onPress={() => setPick('')} testID="pick-library" /> : <View style={{ marginTop: 8 }} testID="library-picker">
          <TextInput value={pick} onChangeText={setPick} placeholder={t('dept.search')} placeholderTextColor={colors.muted} testID="pick-search"
            style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, marginBottom: 8, color: colors.text }} />
          {(data.songs ?? []).filter(z => !pick.trim() || (z.title + ' ' + (z.artist ?? '')).toLowerCase().includes(pick.trim().toLowerCase())).sort((a, b) => a.title.localeCompare(b.title)).map(z => (
            <Chip key={z.id} testID={`pick-${z.id}`} label={`${z.title}${z.key ? ` (${z.key})` : ''}`} onPress={() => { addSong(sv.id, { title: z.title, key: z.key, songId: z.id }); setPick(null); }} />
          ))}
          {(data.songs ?? []).length === 0 && <Text style={s.small}>{t('dept.noSongs')}</Text>}
          <Button label={t('setlist.cancel')} outline onPress={() => setPick(null)} />
        </View>}
        <Button label={t('setlist.done')} onPress={() => setEditing(false)} testID="setlist-done" />
      </>}
    </Card></View>
  );
  function editor_() {
    return (
      <View style={{ marginTop: 8 }} testID="song-editor">
        <Field label={t('setlist.songTitle')} value={form!.title} onChangeText={v => setForm(f => f && { ...f, title: v })} testID="song-title" />
        <Text style={s.small}>{t('setlist.key')}</Text>
        <View style={[s.row, { marginVertical: 6 }]}>{KEYS.map(k => <Chip key={k} label={k} active={form!.key === k} testID={`song-keychip-${k}`} onPress={() => setForm(f => f && { ...f, key: f.key === k ? '' : k })} />)}</View>
        <Field label={t('setlist.customKey')} value={form!.key} maxLength={8} onChangeText={v => setForm(f => f && { ...f, key: v })} testID="song-key" />
        <Field label={t('setlist.notes')} value={form!.notes} multiline maxLength={200} onChangeText={v => setForm(f => f && { ...f, notes: v })} testID="song-notes" />
        {err && <Notice tone="error" text={err} />}
        <Button label={t('setlist.save')} onPress={submit} testID="song-save" />
        <Button label={t('setlist.cancel')} outline onPress={() => setForm(null)} testID="song-cancel" />
      </View>
    );
  }
}

/** Compact preview for My Rota: first 3 titles with keys, then '+N more'. */
export function SetlistPreview({ service: sv, onOpen }: { service: Service; onOpen: () => void }) {
  const s = useStyles(); const colors = useColors(); const { t } = useMe();
  const list = sv.setlist ?? []; if (!list.length) return null;
  return (
    <Pressable testID={`rota-setlist-${sv.id}`} onPress={onOpen} style={{ marginTop: 8 }}>
      <Text style={[s.small, { fontWeight: '700' }]}>{t('setlist.title')}</Text>
      {list.slice(0, 3).map((x, i) => <Text key={x.id} style={{ color: colors.text }}>{i + 1}. {x.title}{x.key ? ` (${x.key})` : ''}</Text>)}
      {list.length > 3 && <Text style={{ color: colors.primary, fontWeight: '600' }}>{t('setlist.more', { n: list.length - 3 })}</Text>}
    </Pressable>
  );
}
