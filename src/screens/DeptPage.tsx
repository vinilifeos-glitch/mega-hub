import React, { useState } from 'react';
import { confirmAsk } from '../components/confirm';
import { ACCEPT, MAX_FILE, LessonErr, addLesson, deleteLesson, downloadLesson, fileTypeOk, fmtSize, openLesson, renameLesson, useLessons, LESSONS_REMOTE } from '../data/files';
import { Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useMe } from '../state/AppContext';
import { displayName } from '../display';
import { CardHeader, GhostButton, SearchField, Badge, Button, Card, DeptTitle, Field, Icon, IconButton, Notice, Screen, useColors, useStyles, useDeptAccent } from '../components/ui';
import { KIDS_DEPT, MUSIC_DEPT, canEditLessonsRule } from '../state/permissions';
import { MemberEditor } from './MemberEditor';
import { roleIdx, sortRoles } from '../data/rota';

export const goBack = (fallback: string) => { if (router.canGoBack()) router.back(); else router.replace(fallback as any); };
export const openUrl = (u: string) => { if (Platform.OS === 'web') globalThis.open?.(u, '_blank', 'noopener'); else Linking.openURL(u); };

export function DeptPage({ id }: { id: string }) {
  const colors = useColors(); const s = useStyles();
  const { data, t, deptName, canEditDept, canViewDept, setDeptAbout } = useMe();
  const d = data.departments.find(x => x.id === id);
  const [editing, setEditing] = useState(false);
  const [about, setAbout] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const allowed = d && canViewDept(d.id);
  if (!d || !allowed) return <Screen title={t('song.notFound')} backTo={{ label: t('dept.back'), onPress: () => goBack('/departments') }}><Text style={s.small}>{t('errors.notFound')}</Text></Screen>;
  const editor = canEditDept(d.id);
  const members = data.users.filter(u => u.active && u.departmentIds.includes(d.id));
  const leaders = data.users.filter(u => u.active && u.role === 'admin' && (u.adminOf ?? []).includes(d.id));
  return (
    <Screen title={deptName(d.id)} subtitle={t('dept.members', { n: members.length })} backTo={{ label: t('dept.back'), onPress: () => goBack('/departments') }}>
      <View testID={`dept-page-${d.id}`}>
        <View style={[s.row, { justifyContent: 'space-between', marginBottom: 8 }]}>
          <DeptTitle dep={d} />
          {editor && <Pressable testID="dept-edit" accessibilityRole="button" onPress={() => { setEditing(!editing); setAbout(null); setErr(null); }}
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
        {err && <Notice tone="error" text={err} />}
        {/* Sections: Music = Songs + Team; Kids = Team + Lessons; others = Team. */}
        <View style={[s.row, { flexWrap: 'nowrap' }]}>
          {d.id === MUSIC_DEPT && <View style={{ flex: 1, marginRight: 8 }}><Button label={t('dept.songs')} outline onPress={() => router.push(`/dept/${d.id}/songs` as any)} testID="dept-songs" /></View>}
          <View style={{ flex: 1 }}><Button label={t('dept.team')} outline onPress={() => router.push(`/dept/${d.id}/team` as any)} testID="dept-team" /></View>
          {d.id === KIDS_DEPT && <View style={{ flex: 1, marginLeft: 8 }}><Button label={t('dept.lessons')} outline onPress={() => router.push(`/dept/${d.id}/lessons` as any)} testID="dept-lessons" /></View>}
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
  const deptAcc = useDeptAccent();
  const colors = useColors(); const s = useStyles(); const { data, t, deptName, roleName, canEditMember, myAdminDeps } = useMe();
  const [open, setOpen] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const d = useDept(id); if (!d) return <NoAccess id={id} />;
  // Owner: everywhere. Admins: only in departments they administer (canEditMember keeps the owner/name/contact limits).
  const mayEdit = (u: (typeof data.users)[number]) => myAdminDeps.includes(d.id) && canEditMember(u);
  const editing = open ? data.users.find(u => u.id === open) : null;
  if (editing && mayEdit(editing)) return <MemberEditor user={editing} backLabel={t('dept.teamTitle', { dept: deptName(d.id) })} onClose={m => { setOpen(null); setMsg(m ?? null); }} />;
  const people = data.users.filter(u => u.active && u.departmentIds.includes(d.id))
    .map(u => ({ u, roles: sortRoles(data, d.id, u.positions?.[d.id] ?? []) }))
    .sort((a, b) => (a.roles.length ? roleIdx(data, d.id, a.roles[0]) : 999) - (b.roles.length ? roleIdx(data, d.id, b.roles[0]) : 999) || a.u.username.localeCompare(b.u.username));
  return (
    <Screen title={t('dept.teamTitle', { dept: deptName(d.id) })} subtitle={t('dept.members', { n: people.length })} backTo={{ label: deptName(d.id), onPress: () => goBack(`/dept/${d.id}`) }}>
      {msg && <Notice tone="success" text={msg} />}
      <Card style={{ borderLeftWidth: 3, borderLeftColor: deptAcc(d) }}>
        {people.length === 0 && <Text style={s.small}>{t('departmentsScreen.noMembers')}</Text>}
        {people.map(({ u, roles }, i) => { const ed = mayEdit(u); return (
          <Pressable key={u.id} testID={`team-row-${u.username}`} disabled={!ed} onPress={() => { setMsg(null); setOpen(u.id); }}
            accessibilityRole={ed ? 'button' : undefined} accessibilityLabel={ed ? t('dept.editMember', { name: displayName(u) }) : undefined}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, paddingVertical: 10, backgroundColor: pressed ? colors.soft : 'transparent' })}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{displayName(u)}</Text>
              <Text style={s.small}>{roles.length ? roles.map(r => roleName(d.id, r)).join(', ') : t('departmentsScreen.noRoles')}</Text>
            </View>
            {ed && <View testID={`team-edit-${u.username}`}><Icon name="create-outline" size={18} color={colors.primaryText} /></View>}
          </Pressable>); })}
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

/** Kids lessons: owner + Kids admins upload/rename/delete; every Kids viewer can open/download. Local-only storage (megahub:files:v1). */
export function DeptLessons({ id }: { id: string }) {
  const colors = useColors(); const s = useStyles(); const { currentUser, t, deptName } = useMe();
  const lessons = useLessons(id);
  const [title, setTitle] = useState(''); const [file, setFile] = useState<{ name: string; mime: string; size: number; dataUrl: string } | null>(null);
  const [err, setErr] = useState<string | null>(null); const [ren, setRen] = useState<{ id: string; title: string } | null>(null);
  const [inputKey, setInputKey] = useState(0); const [busy, setBusy] = useState(false);
  const d = useDept(id); if (!d || d.id !== KIDS_DEPT) return <NoAccess id={id} />;
  const admin = canEditLessonsRule(currentUser);
  const msg = (e: LessonErr, size?: number) => e === 'scope' ? t('dept.errScope') : e === 'title' ? t('dept.errTitle') : e === 'type' ? t('dept.errType') : e === 'size' ? t('dept.errSize', { size: fmtSize(size ?? 0) }) : e === 'quota' ? t('dept.errQuota') : null;
  const onPick = (ev: any) => {
    const f: File | undefined = ev?.target?.files?.[0]; setErr(null); setFile(null); if (!f) return;
    if (!fileTypeOk(f.name, f.type)) { setErr(msg('type')); setInputKey(k => k + 1); return; }
    if (f.size > MAX_FILE) { setErr(msg('size', f.size)); setInputKey(k => k + 1); return; }
    const r = new FileReader(); r.onload = () => { setFile({ name: f.name, mime: f.type, size: f.size, dataUrl: String(r.result) }); if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, '')); };
    r.onerror = () => setErr(msg('type')); r.readAsDataURL(f);
  };
  const upload = async () => { if (!file || busy) { if (!file) setErr(t('dept.errNoFile')); return; } setBusy(true); const e = await addLesson(currentUser as any, d.id, title, file); setErr(msg(e, file.size)); if (!e) { setFile(null); setTitle(''); setInputKey(k => k + 1); } setBusy(false); };
  return (
    <Screen title={t('dept.lessonsTitle')} backTo={{ label: deptName(d.id), onPress: () => goBack(`/dept/${d.id}`) }}>
      {admin && !LESSONS_REMOTE && <Notice tone="warning" text={t('dept.lessonLocalNote')} testID="lessons-local-note" />}
      {admin && <Card>
        <CardHeader icon="cloud-upload-outline" title={t('dept.lessonUpload')} />
        <Text style={[s.small, { marginBottom: 8 }]}>{t('dept.lessonAccept')}</Text>
        {Platform.OS === 'web' && React.createElement('input', { key: inputKey, type: 'file', accept: ACCEPT, onChange: onPick, 'data-testid': 'lesson-file', 'aria-label': t('dept.lessonPick'), style: { marginBottom: 10, color: colors.text, fontSize: 15 } })}
        {file && <Text style={[s.small, { marginBottom: 6 }]} testID="lesson-picked">{file.name} · {fmtSize(file.size)}</Text>}
        <Field label={t('dept.lessonTitle')} value={title} onChangeText={setTitle} maxLength={120} testID="lesson-title" />
        <Button label={t('dept.lessonUpload')} onPress={upload} disabled={!file || busy} testID="lesson-upload" />
      </Card>}
      {err && <Notice tone="error" text={err} testID="lesson-error" />}
      <Card>
        <CardHeader icon="document-text-outline" title={t('dept.lessons')} right={<Badge label={String(lessons.length)} />} />
        {lessons.length === 0 && <Text style={s.small} testID="lessons-empty">{t('dept.lessonsEmpty')}</Text>}
        {lessons.map((l, i) => (
          <View key={l.id} testID={`lesson-row-${l.id}`} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, paddingVertical: 10 }}>
            {ren?.id === l.id ? <>
              <Field label={t('dept.lessonTitle')} value={ren.title} onChangeText={v => setRen({ ...ren, title: v })} maxLength={120} testID="lesson-rename-input" />
              <Button label={t('dept.save')} onPress={async () => { const e = await renameLesson(currentUser as any, l.id, ren.title); setErr(msg(e)); if (!e) setRen(null); }} testID="lesson-rename-save" />
              <Button label={t('dept.cancel')} outline onPress={() => setRen(null)} testID="lesson-rename-cancel" />
            </> : <View style={[s.row, { flexWrap: 'nowrap', alignItems: 'center' }]}>
              <Pressable style={{ flex: 1 }} onPress={() => openLesson(l)} accessibilityRole="link" testID={`lesson-open-${l.id}`}>
                <Text style={{ color: colors.text, fontWeight: '700' }} testID={`lesson-title-${l.id}`}>{l.title}</Text>
                <Text style={s.small}>{l.name} · {fmtSize(l.size)}</Text>
              </Pressable>
              <IconButton testID={`lesson-dl-${l.id}`} icon="download-outline" color={colors.primaryText} label={t('dept.lessonDownload')} onPress={() => downloadLesson(l)} />
              {admin && <>
                <IconButton testID={`lesson-ren-${l.id}`} icon="create-outline" color={colors.primaryText} label={t('dept.lessonRename')} onPress={() => { setErr(null); setRen({ id: l.id, title: l.title }); }} />
                <IconButton testID={`lesson-del-${l.id}`} icon="trash-outline" color={colors.red} label={t('dept.lessonDelete')} onPress={() => confirmAsk(t('dept.lessonDelete'), t('dept.lessonDelConfirm', { title: l.title }), t('dept.lessonDelete'), t('dept.cancel'), async () => setErr(msg(await deleteLesson(currentUser as any, l.id))))} />
              </>}
            </View>}
          </View>
        ))}
      </Card>
    </Screen>
  );
}
