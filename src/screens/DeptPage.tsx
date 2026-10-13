import { useState } from 'react';
import { Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useMe } from '../state/AppContext';
import { displayName } from '../display';
import { CardHeader, GhostButton, SearchField, Badge, Button, Card, DeptTitle, Field, Icon, IconButton, Notice, Screen, useColors, useStyles } from '../components/ui';
import { Resource } from '../types';
import { MUSIC_DEPT } from '../state/permissions';
import { roleIdx, sortRoles } from '../data/rota';

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
          {editor && <Pressable testID="dept-edit" accessibilityRole="button" onPress={() => { setEditing(!editing); setAbout(null); setRes(null); setErr(null); }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', minHeight: 40, paddingHorizontal: 14, borderRadius: 999, backgroundColor: editing ? colors.primary : pressed ? colors.soft : colors.card, borderWidth: 1, borderColor: editing ? colors.primary : colors.border })}>
            <Icon name={editing ? 'checkmark' : 'create-outline'} size={16} color={editing ? colors.onPrimary : colors.primaryText} style={{ marginRight: 6 }} />
            <Text style={{ color: editing ? colors.onPrimary : colors.primaryText, fontWeight: '700' }}>{editing ? t('dept.done') : t('dept.edit')}</Text>
          </Pressable>}
        </View>
        <Card>
          <CardHeader icon="information-circle-outline" title={t('dept.about')} />
          {editing && about !== null ? <>
            <Field label={t('dept.description')} value={about} onChangeText={setAbout} multiline maxLength={1000} testID="dept-about-input" />
            <Button label={t('dept.save')} onPress={() => { const e = setDeptAbout(d.id, about); setErr(e); if (!e) setAbout(null); }} testID="dept-about-save" />
          </> : <Pressable disabled={!editing} onPress={() => setAbout(d.description ?? '')} testID="dept-about">
            <Text style={{ color: d.description ? colors.text : colors.muted, fontSize: 15, lineHeight: 22 }}>{d.description || t('dept.noAbout')}</Text>
          </Pressable>}
          <View style={[s.row, { flexWrap: 'nowrap', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }]}><Icon name="shield-checkmark-outline" size={16} style={{ marginRight: 6 }} /><Text style={[s.small, { flexShrink: 1 }]}>{leaders.length ? t('dept.leaders', { names: leaders.map(displayName).join(', ') }) : t('dept.noLeaders')}</Text></View>
        </Card>
        <Card>
          <CardHeader icon="link-outline" title={t('dept.resources')} />
          {list.length === 0 && <Text style={[s.small, { marginTop: 4 }]}>{t('dept.noResources')}</Text>}
          {list.map((r: Resource) => (
            <View key={r.id} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 8 }}>
              <View style={[s.row, { flexWrap: 'nowrap', alignItems: 'center' }]}>
                <Pressable testID={`res-row-${r.id}`} style={{ flex: 1 }} onPress={() => editing ? setRes({ id: r.id, title: r.title, url: r.url }) : openUrl(r.url)} accessibilityRole="link">
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{r.title}</Text>
                  <Text style={s.small}>{domain(r.url)}</Text>
                </Pressable>
                {!editing && <Icon name="open-outline" size={18} color={colors.primaryText} />}
                {editing && <>
                  <IconButton testID={`res-up-${r.id}`} icon="chevron-up" color={colors.muted} label={t('dept.up', { title: r.title })} onPress={() => moveResource(d.id, r.id, 'up')} />
                  <IconButton testID={`res-down-${r.id}`} icon="chevron-down" color={colors.muted} label={t('dept.down', { title: r.title })} onPress={() => moveResource(d.id, r.id, 'down')} />
                  <IconButton testID={`res-rm-${r.id}`} icon="remove-circle-outline" color={colors.red} label={t('dept.remove', { title: r.title })} onPress={() => removeResource(d.id, r.id)} />
                </>}
              </View>
            </View>
          ))}
          {editing && res && <View style={{ marginTop: 10, padding: 14, borderRadius: 14, backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.border }}>
            <Field label={t('dept.resTitle')} value={res.title} onChangeText={v => setRes({ ...res, title: v })} testID="res-title" />
            <Field label={t('dept.resUrl')} value={res.url} onChangeText={v => setRes({ ...res, url: v })} autoCapitalize="none" keyboardType="url" testID="res-url" />
            <Button label={t('dept.save')} onPress={saveRes} testID="res-save" />
            <Button label={t('dept.cancel')} outline onPress={() => setRes(null)} />
          </View>}
          {editing && !res && <GhostButton label={t('dept.addResource')} onPress={() => setRes({ id: null, title: '', url: '' })} testID="add-resource" />}
        </Card>
        {err && <Notice tone="error" text={err} />}
        <View style={[s.row, { flexWrap: 'nowrap' }]}>
          <View style={{ flex: 1, marginRight: d.id === MUSIC_DEPT ? 8 : 0 }}><Button label={t('dept.team')} outline onPress={() => router.push(`/dept/${d.id}/team` as any)} testID="dept-team" /></View>
          {d.id === MUSIC_DEPT && <View style={{ flex: 1 }}><Button label={t('dept.songs')} outline onPress={() => router.push(`/dept/${d.id}/songs` as any)} testID="dept-songs" /></View>}
        </View>
      </View>
    </Screen>
  );
}

function useDept(id: string) {
  const { data, canViewDept } = useMe(); const d = data.departments.find(x => x.id === id);
  return d && canViewDept(d.id) ? d : null;
}
function NoAccess({ id }: { id: string }) {
  const s = useStyles(); const { t } = useMe();
  return <Screen title={t('song.notFound')} backTo={{ label: t('dept.back'), onPress: () => goBack(`/dept/${id}`) }}><Text style={s.small}>{t('errors.notFound')}</Text></Screen>;
}

/** Everyone in the department with their role(s) in canonical order; same access as the department page. */
export function DeptTeam({ id }: { id: string }) {
  const colors = useColors(); const s = useStyles(); const { data, t, deptName, roleName } = useMe();
  const d = useDept(id); if (!d) return <NoAccess id={id} />;
  const people = data.users.filter(u => u.active && u.departmentIds.includes(d.id))
    .map(u => ({ u, roles: sortRoles(data, d.id, u.positions?.[d.id] ?? []) }))
    .sort((a, b) => (a.roles.length ? roleIdx(data, d.id, a.roles[0]) : 999) - (b.roles.length ? roleIdx(data, d.id, b.roles[0]) : 999) || a.u.username.localeCompare(b.u.username));
  return (
    <Screen title={t('dept.teamTitle', { dept: deptName(d.id) })} subtitle={t('dept.members', { n: people.length })} backTo={{ label: deptName(d.id), onPress: () => goBack(`/dept/${d.id}`) }}>
      <Card style={{ borderLeftWidth: 3, borderLeftColor: d.color }}>
        {people.length === 0 && <Text style={s.small}>{t('departmentsScreen.noMembers')}</Text>}
        {people.map(({ u, roles }, i) => (
          <View key={u.id} testID={`team-row-${u.username}`} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, paddingVertical: 10 }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{displayName(u)}</Text>
            <Text style={s.small}>{roles.length ? roles.map(r => roleName(d.id, r)).join(', ') : t('departmentsScreen.noRoles')}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

/** Song library page (Music only): grouped by author/band A–Z, songs A–Z, 'Unknown' last. */
export function DeptSongs({ id }: { id: string }) {
  const { t, deptName } = useMe();
  const d = useDept(id); if (!d || d.id !== MUSIC_DEPT) return <NoAccess id={id} />;
  return <Screen title={t('dept.library')} backTo={{ label: deptName(d.id), onPress: () => goBack(`/dept/${d.id}`) }}><SongLibrary /></Screen>;
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
      <CardHeader icon="library-outline" title={t('dept.library')} right={<Badge label={String(songs.length)} />} />
      <SearchField value={q} onChangeText={setQ} placeholder={t('dept.search')} testID="song-search" />
      {shown.length === 0 && <View style={{ alignItems: 'center', paddingVertical: 20 }}><Icon name="musical-note-outline" size={28} color={colors.subtle} style={{ marginBottom: 6 }} /><Text style={[s.small, { textAlign: 'center' }]}>{t('dept.noSongs')}</Text></View>}
      {canEditSongs && <GhostButton label={t('dept.addSong')} onPress={() => router.push('/song/new' as any)} testID="lib-add-song" />}
      {groups(shown, t('dept.unknownAuthor')).map(([author, list]) => <View key={author} testID={`song-group-${author}`}>
        <Text style={[s.label, { marginTop: 12, marginBottom: 2 }]}>{author}</Text>
      {list.map(x => (
        <Pressable key={x.id} testID={`song-row-${x.id}`} onPress={() => router.push(`/song/${x.id}` as any)} style={({ pressed }) => [s.row, { flexWrap: 'nowrap', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, minHeight: 56, paddingVertical: 8, backgroundColor: pressed ? colors.soft : 'transparent' }]}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}><Icon name="musical-note" size={18} color={colors.primaryText} /></View>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>{x.title}</Text>
            {(x.composer ?? x.artist) ? <Text style={s.small}>{x.composer ?? x.artist}</Text> : null}
          </View>
          {x.key ? <Badge label={x.key} tone="accent" /> : null}
          {x.chords || x.sections?.length ? <Icon name="musical-notes-outline" size={16} style={{ marginLeft: 8 }} /> : null}
          {canEditSongs && <Pressable testID={`song-edit-${x.id}`} accessibilityRole="button" accessibilityLabel={t('song.edit')} onPress={() => router.push(`/song/${x.id}?edit=1` as any)} hitSlop={8} style={{ marginLeft: 8 }}><Icon name="create-outline" size={18} color={colors.primaryText} /></Pressable>}
          <Icon name="chevron-forward" size={18} style={{ marginLeft: 4 }} />
        </Pressable>
      ))}</View>)}
    </Card>
  );
}

const authorOf = (x: { composer?: string; artist?: string }) => (x.composer ?? x.artist ?? '').trim();
/** [author, songs] groups: authors A–Z (grouped case-insensitively), songs A–Z, no-author group last. */
export function groups<T extends { title: string; composer?: string; artist?: string }>(songs: T[], unknown: string): [string, T[]][] {
  const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
  const m = new Map<string, T[]>(); for (const x of songs) { const k = authorOf(x).toLocaleLowerCase(); m.set(k, [...(m.get(k) ?? []), x]); }
  const label = (l: T[]) => { const c = new Map<string, number>(); l.forEach(x => c.set(authorOf(x), (c.get(authorOf(x)) ?? 0) + 1));
    return [...c.entries()].sort((a, b) => b[1] - a[1] || +(b[0][0] !== b[0][0].toLowerCase()) - +(a[0][0] !== a[0][0].toLowerCase()))[0][0]; };
  return [...m.entries()].map(([k, l]) => [k ? label(l) : '', [...l].sort((p, q) => cmp(p.title, q.title))] as [string, T[]])
    .sort(([a], [b]) => !a ? 1 : !b ? -1 : cmp(a, b)).map(([a, l]) => [a || unknown, l]);
}
