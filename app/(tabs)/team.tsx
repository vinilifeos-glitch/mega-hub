import { DateField } from '../../src/components/DateField';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatDobInput, useMe } from '../../src/state/AppContext';
import { NOTE_MAX } from '../../src/data/unavailability';
import { Button, DeptTitle, deptIcon, Card, Chip, Empty, Field, Screen, colors, s, Notice } from '../../src/components/ui';
import { User } from '../../src/types';
import { toIso, todayIso } from '../../src/data/dates';

export default function Team() {
  const { data, myAdminDeps, currentUser, canEditMember, t, ownerName, roleName } = useMe();
  const [editId, setEditId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const deps = data.departments.filter(d => myAdminDeps.includes(d.id));
  if (editId) return <MemberEditor user={data.users.find(u => u.id === editId)!} onClose={m => { setEditId(null); setMsg(m ?? null); }} />;
  if (!deps.length) return <Screen title={t('team.title')} subtitle={t('team.subtitle')}><Empty text={t('team.noDepts', { owner: ownerName })} /></Screen>;
  const unassigned = data.users.filter(u => u.active && u.departmentIds.length === 0 && u.role === 'volunteer');
  const row = (u: User, depId?: string) => (
    <Pressable key={u.id + (depId ?? '')} testID={`member-${u.username}`} onPress={() => { setMsg(null); setEditId(u.id); }} disabled={!canEditMember(u)}>
      <View style={[s.row, { justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '600', color: colors.text }}>{u.name}</Text>
          <Text style={s.small}>{depId ? ((u.positions?.[depId] ?? []).map(r => roleName(depId, r)).join(', ') || t('team.noRolesYet')) : t('team.notInDeptShort')}</Text>
        </View>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('common.editArrow')}</Text>
      </View>
    </Pressable>
  );
  return (
    <Screen title={t('team.title')} subtitle={t('team.subtitle')}>
      {msg && <Notice text={msg} />}
      {deps.map(d => {
        const members = data.users.filter(u => u.active && u.departmentIds.includes(d.id));
        return (
          <Card key={d.id} style={{ borderLeftWidth: 3, borderLeftColor: d.color }}>
            <DeptTitle dep={d} suffix={` · ${members.length}`} />
            {members.length ? members.map(u => row(u, d.id)) : <Text style={s.small}>{t('team.noMembers')}</Text>}
          </Card>
        );
      })}
      {unassigned.length > 0 && <Card>
        <Text style={s.h2}>{t('team.notInDept')}</Text>
        {unassigned.map(u => row(u))}
      </Card>}
    </Screen>
  );
}

function MemberEditor({ user, onClose }: { user: User; onClose: (m?: string) => void }) {
  const { data, myAdminDeps, adminSaveMember, addUnavailable, removeUnavailable, t, ownerName, deptName, roleName } = useMe();
  const deps = data.departments.filter(d => myAdminDeps.includes(d.id));
  const [f, setF] = useState({ firstName: user.firstName, middleNames: user.middleNames, lastName: user.lastName, dob: user.dob, contact: user.contact ?? '' });
  const [dm, setDm] = useState<Record<string, string[] | null>>(Object.fromEntries(deps.map(d => [d.id, user.departmentIds.includes(d.id) ? [...(user.positions?.[d.id] ?? [])] : null])));
  const [date, setDate] = useState(''); const [note, setNote] = useState(''); const [err, setErr] = useState<string | null>(null);
  const live = data.users.find(u => u.id === user.id) ?? user;
  const dates = (live.unavailable ?? []).filter(x => x.date >= todayIso());
  const toggleRole = (dep: string, r: string) => setDm(p => ({ ...p, [dep]: (p[dep] ?? []).includes(r) ? p[dep]!.filter(x => x !== r) : [...(p[dep] ?? []), r] }));
  return (
    <Screen title={t('team.editTitle', { name: user.name })} subtitle={t('team.editSubtitle', { owner: ownerName })}>
      <Card>
        <Field label={t('fields.firstName')} value={f.firstName} onChangeText={v => setF({ ...f, firstName: v })} autoCapitalize="words" testID="m-first" />
        <Field label={t('fields.middleNames')} value={f.middleNames} onChangeText={v => setF({ ...f, middleNames: v })} autoCapitalize="words" />
        <Field label={t('fields.surname')} value={f.lastName} onChangeText={v => setF({ ...f, lastName: v })} autoCapitalize="words" testID="m-last" />
        <DateField label={t('fields.dob')} limit="past" value={f.dob} onChange={v => setF({ ...f, dob: v })} testID="m-dob" />
        <Field label={t('fields.contact')} value={f.contact} keyboardType="phone-pad" onChangeText={v => setF({ ...f, contact: v })} />
      </Card>
      <Text style={s.section}>{t('team.yourDepts')}</Text>
      {deps.map(d => {
        const inDep = dm[d.id] !== null;
        return (
          <Card key={d.id} style={{ borderLeftWidth: 3, borderLeftColor: inDep ? d.color : colors.border }}>
            <Chip testID={`m-dep-${d.id}`} icon={inDep ? 'checkmark' : deptIcon(d.id)} label={deptName(d.id)} color={d.color} active={inDep} onPress={() => setDm({ ...dm, [d.id]: inDep ? null : [] })} />
            {inDep && <View style={s.row}>{d.positions.map(r => <Chip key={r} testID={`m-role-${d.id}-${r}`} label={roleName(d.id, r)} color={d.color} active={dm[d.id]!.includes(r)} onPress={() => toggleRole(d.id, r)} />)}</View>}
          </Card>
        );
      })}
      {err && <Notice tone="error" text={err} />}
      <Button label={t('common.saveChanges')} testID="m-save" onPress={() => { const e = adminSaveMember(user.id, { ...f, departments: dm }); if (e) setErr(e); else onClose(t('team.saved', { name: f.firstName })); }} />
      <Text style={s.section}>{t('availability.unavailableDates')}</Text>
      <Card>
        <DateField label={t('availability.add')} limit="future" value={date} onChange={setDate} testID="m-unavail" />
        <Field label={t('availability.noteLabel')} value={note} onChangeText={setNote} maxLength={NOTE_MAX} placeholder={t('availability.notePlaceholder')} testID="m-unavail-note" />
        <Button label={t('availability.add')} outline testID="m-unavail-add" onPress={() => {
          const iso = toIso(date); if (!iso || iso < todayIso()) return setErr(t('errors.futureDateInvalid'));
          addUnavailable(iso, user.id, note); setDate(''); setNote(''); setErr(null);
        }} />
        {dates.length === 0 ? <Text style={[s.small, { marginTop: 8 }]}>{t('availability.noDates')}</Text> : dates.map(({ date: iso, note: n }) => (
          <View key={iso} style={[s.row, { justifyContent: 'space-between', marginTop: 8 }]}>
            <View style={{ flex: 1 }}><Text style={{ color: colors.text }}>{iso.split('-').reverse().join('/')}</Text>{n ? <Text style={s.small}>{n}</Text> : null}</View>
            <Pressable onPress={() => removeUnavailable(iso, user.id)}><Text style={{ color: colors.red, fontWeight: '700' }}>{t('common.remove')}</Text></Pressable>
          </View>
        ))}
      </Card>
      <Button label={t('common.back')} outline onPress={() => onClose()} />
    </Screen>
  );
}
