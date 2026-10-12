import { useState } from 'react';
import { Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useMe } from '../state/AppContext';
import { displayName } from '../display';
import { Badge, Button, Card, DeptTitle, Field, Icon, IconButton, Notice, Screen, useColors, useStyles } from '../components/ui';
import { Resource } from '../types';
import { MUSIC_DEPT } from '../state/permissions';

export const goBack = (fallback: string) => { if (router.canGoBack()) router.back(); else router.replace(fallback as any); };
export const openUrl = (u: string) => { if (Platform.OS === 'web') globalThis.open?.(u, '_blank', 'noopener'); else Linking.openURL(u); };
const domain = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

export function DeptPage({ id }: { id: string }) {
  const colors = useColors(); const s = useStyles();
  const { data, currentUser, t, deptName, canEditDept, canViewDept, setDeptAbout, addResource, updateResource, removeResource, moveResource } = useMe();
  const d = data.departments.find(x => x.id === id);
  const [editing, setEditing] = useState(false);
  const [about, setAbout] = useState<string | null>(null);
  const [res, setRes] = useState<{ id: string | null; title: string; url: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const allowed = d && canViewDept(d.id);
  if (!d || !allowed) return <Screen title={t('song.notFound')} backTo={{ label: t('dept.back'), onPress: () => goBack('/departments') }}><Text style={s.small}>{t('errors.notFound')}</Text></Screen>;
  const editor = canEditDept(d.id);
  const members = data.users.filter(u => u.active && u.departmentIds.includes(d.id));
  const leaders = data.users.filter(u => u.active && u.role === 'admin' && (u.adminOf ?? []).includes(d.id));
  const list = d.resources ?? [];
  const saveRes = () => { if (!res) return; const e = res.id ? updateResource(d.id, res.id, res) : addResource(d.id, res); setErr(e); if (!e) setRes(null); };
  return (
    <Screen title={deptName(d.id)} subtitle={t('dept.members', { n: members.length })} backTo={{ label: t('dept.back'), onPress: () => goBack('/departments') }}>
      <View testID={`dept-page-${d.id}`}>
        <View style={[s.row, { justifyContent: 'space-between', marginBottom: 8 }]}>
          <DeptTitle dep={d} />
          {editor && <Pressable testID="dept-edit" onPress={() => { setEditing(!editing); setAbout(null); setRes(null); setErr(null); }}><Text style={{ color: colors.primary, fontWeight: '700' }}>{editing ? t('dept.done') : t('dept.edit')}</Text></Pressable>}
        </View>
        <Card>
          <Text style={s.h2}>{t('dept.about')}</Text>
          {editing && about !== null ? <>
            <Field label={t('dept.description')} value={about} onChangeText={setAbout} multiline maxLength={1000} testID="dept-about-input" />
            <Button label={t('dept.save')} onPress={() => { const e = setDeptAbout(d.id, about); setErr(e); if (!e) setAbout(null); }} testID="dept-about-save" />
          </> : <Pressable disabled={!editing} onPress={() => setAbout(d.description ?? '')} testID="dept-about">
            <Text style={{ color: d.description ? colors.text : colors.muted, marginTop: 4 }}>{d.description || t('dept.noAbout')}</Text>
          </Pressable>}
          <Text style={[s.small, { marginTop: 8 }]}>{leaders.length ? t('dept.leaders', { names: leaders.map(displayName).join(', ') }) : t('dept.noLeaders')}</Text>
        </Card>
        <Card>
          <Text style={s.h2}>{t('dept.resources')}</Text>
          {list.length === 0 && <Text style={[s.small, { marginTop: 4 }]}>{t('dept.noResources')}</Text>}
          {list.map((r: Resource) => (
            <View key={r.id} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 8 }}>
              <View style={[s.row, { flexWrap: 'nowrap', alignItems: 'center' }]}>
                <Pressable testID={`res-row-${r.id}`} style={{ flex: 1 }} onPress={() => editing ? setRes({ id: r.id, title: r.title, url: r.url }) : openUrl(r.url)} accessibilityRole="link">
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>{r.title}</Text>
                  <Text style={s.small}>{domain(r.url)}</Text>
                </Pressable>
                {editing && <>
                  <IconButton testID={`res-up-${r.id}`} icon="chevron-up" label={t('dept.up', { title: r.title })} onPress={() => moveResource(d.id, r.id, 'up')} />
                  <IconButton testID={`res-down-${r.id}`} icon="chevron-down" label={t('dept.down', { title: r.title })} onPress={() => moveResource(d.id, r.id, 'down')} />
                  <IconButton testID={`res-rm-${r.id}`} icon="close" color={colors.red} label={t('dept.remove', { title: r.title })} onPress={() => removeResource(d.id, r.id)} />
                </>}
              </View>
            </View>
          ))}
          {editing && res && <View style={{ marginTop: 8 }}>
            <Field label={t('dept.resTitle')} value={res.title} onChangeText={v => setRes({ ...res, title: v })} testID="res-title" />
            <Field label={t('dept.resUrl')} value={res.url} onChangeText={v => setRes({ ...res, url: v })} autoCapitalize="none" keyboardType="url" testID="res-url" />
            <Button label={t('dept.save')} onPress={saveRes} testID="res-save" />
            <Button label={t('dept.cancel')} outline onPress={() => setRes(null)} />
          </View>}
          {editing && !res && <Button label={t('dept.addResource')} outline onPress={() => setRes({ id: null, title: '', url: '' })} testID="add-resource" />}
        </Card>
        {err && <Notice tone="error" text={err} />}
        {d.id === MUSIC_DEPT && <SongLibrary />}
      </View>
    </Screen>
  );
}

function SongLibrary() {
  const colors = useColors(); const s = useStyles();
  const { data, t, canEditSongs } = useMe();
  const [q, setQ] = useState('');
  const songs = [...(data.songs ?? [])].sort((a, b) => a.title.localeCompare(b.title));
  const n = q.trim().toLowerCase();
  const shown = n ? songs.filter(x => x.title.toLowerCase().includes(n) || (x.composer ?? x.artist ?? '').toLowerCase().includes(n)) : songs;
  return (
    <Card>
      <Text style={s.h2}>{t('dept.library')}</Text>
      <TextInput value={q} onChangeText={setQ} placeholder={t('dept.search')} placeholderTextColor={colors.muted} testID="song-search"
        style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, marginVertical: 8, color: colors.text }} />
      {shown.length === 0 && <Text style={s.small}>{t('dept.noSongs')}</Text>}
      {shown.map(x => (
        <Pressable key={x.id} testID={`song-row-${x.id}`} onPress={() => router.push(`/song/${x.id}` as any)} style={[s.row, { flexWrap: 'nowrap', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 8 }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>{x.title}</Text>
            {(x.composer ?? x.artist) ? <Text style={s.small}>{x.composer ?? x.artist}</Text> : null}
          </View>
          {x.key ? <Badge label={x.key} tone="accent" /> : null}
          {x.chords ? <Icon name="musical-notes-outline" size={18} style={{ marginLeft: 8 }} /> : null}
        </Pressable>
      ))}
      {canEditSongs && <Button label={t('dept.addSong')} outline onPress={() => router.push('/song/new' as any)} testID="lib-add-song" />}
    </Card>
  );
}
