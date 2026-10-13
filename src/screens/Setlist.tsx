import { MUSIC_DEPT } from '../state/permissions';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useMe } from '../state/AppContext';
import { CardHeader, GhostButton, SearchField, Badge, Button, Card, Chip, Field, Icon, IconButton, Notice, useColors, useStyles } from '../components/ui';
import { Service, SetlistItem } from '../types';

const KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Bb', 'Eb', 'Ab'];

const cleanItem = (p: { key?: string; notes?: string; songId?: string | null }) => {
  const o: Partial<SetlistItem> = {}; const k = p.key?.trim().slice(0, 8); const n = p.notes?.trim().slice(0, 200);
  if (k) o.key = k; if (n) o.notes = n; if (p.songId) o.songId = p.songId; return o;
};
/** Pure setlist edits (pending state; persisted by the screen's Save). */
export const setlistOps = {
  add: (l: SetlistItem[], song: { title: string; key?: string; notes?: string; songId?: string | null }): SetlistItem[] =>
    [...l, { id: `so-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, title: song.title.trim(), ...cleanItem(song) }],
  update: (l: SetlistItem[], id: string, p: { title: string; key?: string; notes?: string }): SetlistItem[] =>
    l.map(x => x.id === id ? { id: x.id, title: p.title.trim(), ...cleanItem({ ...p, songId: x.songId }) } : x),
  remove: (l: SetlistItem[], id: string) => l.filter(x => x.id !== id),
  move: (l: SetlistItem[], id: string, dir: 'up' | 'down') => { const i = l.findIndex(x => x.id === id); const j = dir === 'up' ? i - 1 : i + 1; if (i < 0 || j < 0 || j >= l.length) return l; const n = [...l]; [n[i], n[j]] = [n[j], n[i]]; return n; },
};

/** Service setlist card. Controlled: `list` is the pending setlist, `onChange` updates it (nothing persists until the screen's Save). */
export function SetlistCard({ service: sv, list, onChange, startEditing }: { service?: Service; list: SetlistItem[]; onChange: (l: SetlistItem[]) => void; startEditing?: boolean }) {
  const colors = useColors(); const s = useStyles();
  const { data, t, canEditSetlist } = useMe();
  const editor = canEditSetlist(sv);
  const addSong = (_: unknown, song: Parameters<typeof setlistOps.add>[1]) => { if (!song.title.trim()) return t('errors.songTitle'); onChange(setlistOps.add(list, song)); return null; };
  const updateSong = (_: unknown, id: string, p: { title: string; key?: string; notes?: string }) => { if (!p.title.trim()) return t('errors.songTitle'); onChange(setlistOps.update(list, id, p)); return null; };
  const removeSong = (_: unknown, id: string) => onChange(setlistOps.remove(list, id));
  const moveSong = (_: unknown, id: string, dir: 'up' | 'down') => onChange(setlistOps.move(list, id, dir));
  const svId = sv?.id;
  const [editing, setEditing] = useState(!!startEditing);
  const [form, setForm] = useState<{ id: string | null; title: string; key: string; notes: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  if (!editor && !sv?.setlist) return null;
  const open = (x?: SetlistItem) => { setErr(null); setForm({ id: x?.id ?? null, title: x?.title ?? '', key: x?.key ?? '', notes: x?.notes ?? '' }); };
  const submit = () => {
    if (!form) return;
    const e = form.id ? updateSong(svId, form.id, { title: form.title, key: form.key, notes: form.notes }) : addSong(svId, { title: form.title, key: form.key, notes: form.notes });
    setErr(e); if (!e) setForm(null);
  };
  return (
    <View testID="setlist-card"><Card style={{ borderLeftWidth: 3, borderLeftColor: data.departments.find(d => d.id === MUSIC_DEPT)?.color ?? colors.primary }}>
      <View style={[s.row, { justifyContent: 'space-between', flexWrap: 'nowrap' }]}>
        <View style={[s.row, { flexWrap: 'nowrap', flex: 1 }]}>
          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
            <Icon name="musical-notes" size={18} color={colors.primaryText} />
          </View>
          <Text style={[s.h2, { marginRight: 8 }]}>{t('setlist.title')}</Text>
          <Badge label={t('setlist.count', { n: list.length })} testID="setlist-count" />
        </View>
        {editor && !editing && <Pressable testID="setlist-edit" accessibilityRole="button" onPress={() => setEditing(true)} hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 8 }}>
          <Icon name="create-outline" size={16} color={colors.primaryText} style={{ marginRight: 4 }} />
          <Text style={{ color: colors.primaryText, fontWeight: '700' }}>{t('setlist.edit')}</Text>
        </Pressable>}
      </View>
      {list.length === 0 && <View style={{ alignItems: 'center', paddingVertical: 20 }}>
        <Icon name="musical-note-outline" size={28} color={colors.subtle} style={{ marginBottom: 6 }} />
        <Text style={[s.small, { textAlign: 'center' }]} testID="setlist-empty">{t('setlist.empty')}</Text>
      </View>}
      <View style={{ marginTop: 8 }}>
      {list.map((x, i) => (
        <View key={x.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, paddingVertical: 10 }}>
          <View style={[s.row, { flexWrap: 'nowrap', alignItems: 'center' }]}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Text style={{ color: colors.muted, fontWeight: '700', fontSize: 13 }}>{i + 1}</Text>
            </View>
            <Pressable testID={`song-row-${x.id}`} disabled={!editing} onPress={() => open(x)} style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{x.title}</Text>
              {x.notes ? <Text style={s.small} numberOfLines={1}>{x.notes}</Text> : null}
            </Pressable>
            {x.key ? <View testID={`song-key-${x.id}`} style={{ backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, minWidth: 36, alignItems: 'center' }}>
              <Text style={{ color: colors.primaryText, fontWeight: '800', fontSize: 13 }}>{x.key}</Text>
            </View> : null}
            {x.songId && (data.songs ?? []).some(z => z.id === x.songId) ? <Pressable testID={`song-chords-${x.id}`} accessibilityLabel={x.title} onPress={() => router.push((x.key ? `/song/${x.songId}?key=${encodeURIComponent(x.key)}` : `/song/${x.songId}`) as any)} hitSlop={8} style={{ marginLeft: 8 }}><Icon name="musical-notes-outline" size={20} /></Pressable> : null}
            {editing && <View style={[s.row, { flexWrap: 'nowrap', marginLeft: 4 }]}>
              <IconButton testID={`song-up-${x.id}`} icon="chevron-up" color={colors.muted} label={t('setlist.up', { title: x.title })} onPress={() => moveSong(svId, x.id, 'up')} />
              <IconButton testID={`song-down-${x.id}`} icon="chevron-down" color={colors.muted} label={t('setlist.down', { title: x.title })} onPress={() => moveSong(svId, x.id, 'down')} />
              <IconButton testID={`song-rm-${x.id}`} icon="remove-circle-outline" color={colors.red} label={t('setlist.remove', { title: x.title })} onPress={() => removeSong(svId, x.id)} />
            </View>}
          </View>
          {form?.id === x.id && editor_()}
        </View>
      ))}
      </View>
      {editing && !form && <View style={[s.row, { justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 4 }]}>
        <View />
        <Pressable testID="setlist-done" accessibilityRole="button" onPress={() => setEditing(false)} style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 18, borderRadius: 999, backgroundColor: colors.primary, justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
          <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>{t('setlist.done')}</Text>
        </Pressable>
      </View>}
      {editing && !form && <View style={{ marginTop: 4 }}>
        {pick === null ? <GhostButton icon="library-outline" label={t('song.pick')} onPress={() => setPick('')} testID="pick-library" /> : <View style={{ marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.border }} testID="library-picker">
          <CardHeader icon="library-outline" title={t('song.pick')} />
          <SearchField value={pick} onChangeText={setPick} placeholder={t('dept.search')} testID="pick-search" />
          {(data.songs ?? []).filter(z => !pick.trim() || (z.title + ' ' + (z.composer ?? z.artist ?? '')).toLowerCase().includes(pick.trim().toLowerCase())).sort((a, b) => a.title.localeCompare(b.title)).map(z => (
            <Pressable key={z.id} testID={`pick-${z.id}`} accessibilityRole="button" onPress={() => { addSong(svId, { title: z.title, key: z.key, songId: z.id }); setPick(null); }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: 10, borderRadius: 10, backgroundColor: pressed ? colors.border : 'transparent' })}>
              <Icon name="add-circle-outline" size={18} color={colors.primaryText} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '600' }} numberOfLines={1}>{z.title}</Text>{(z.composer ?? z.artist) ? <Text style={s.small} numberOfLines={1}>{z.composer ?? z.artist}</Text> : null}</View>
              {z.key ? <Badge label={z.key} tone="accent" /> : null}
            </Pressable>
          ))}
          {(data.songs ?? []).length === 0 && <Text style={s.small}>{t('dept.noSongs')}</Text>}
          <GhostButton icon="close" color={colors.muted} label={t('setlist.cancel')} onPress={() => setPick(null)} />
        </View>}
      </View>}
    </Card></View>
  );
  function editor_() {
    return (
      <View style={{ marginTop: 10, padding: 14, borderRadius: 14, backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.border }} testID="song-editor">
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: 6 }} testID="song-title">{form!.title}</Text>
        <Text style={s.label}>{t('setlist.key')}</Text>
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
    <Pressable testID={`rota-setlist-${sv.id}`} onPress={onOpen} accessibilityRole="button" style={({ pressed }) => ({ marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: pressed ? colors.border : colors.soft })}>
      <View style={[s.row, { flexWrap: 'nowrap', marginBottom: 6 }]}>
        <Icon name="musical-notes" size={14} color={colors.primaryText} style={{ marginRight: 6 }} />
        <Text style={[s.label, { color: colors.primaryText }]}>{t('setlist.title')}</Text>
      </View>
      {list.slice(0, 3).map((x, i) => (
        <View key={x.id} style={[s.row, { flexWrap: 'nowrap', paddingVertical: 2 }]}>
          <Text style={{ color: colors.muted, width: 18, fontWeight: '700', fontSize: 13 }}>{i + 1}</Text>
          <Text style={{ color: colors.text, flex: 1, fontWeight: '600' }} numberOfLines={1}>{x.title}</Text>
          {x.key ? <Text style={{ color: colors.primaryText, fontWeight: '800', fontSize: 12, marginLeft: 8 }}>{x.key}</Text> : null}
        </View>
      ))}
      {list.length > 3 && <Text style={{ color: colors.primaryText, fontWeight: '600', marginTop: 4 }}>{t('setlist.more', { n: list.length - 3 })}</Text>}
    </Pressable>
  );
}
