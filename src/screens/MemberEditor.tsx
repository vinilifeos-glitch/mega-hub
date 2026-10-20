import { sortRoles } from '../data/rota';
import { UnavailEditor } from '../components/UnavailEditor';
import { displayName } from '../display';
import { canEditPersonal } from '../state/permissions';
import { DateField } from '../components/DateField';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useMe } from '../state/AppContext';
import { Icon, Button, deptIcon, Card, Chip, Field, Screen, Notice, useColors, useStyles, useDeptAccent } from '../components/ui';
import { User } from '../types';
import { todayIso } from '../data/dates';

/** Admin/owner member editor (existing admin limits: personal fields locked for admins, only their own departments, never the owner). */
export function MemberEditor({ user, onClose, backLabel }: { user: User; onClose: (m?: string) => void; backLabel?: string }) {
  const deptAcc = useDeptAccent();
  const colors = useColors(); const s = useStyles();
  const { data, currentUser, myAdminDeps, adminSaveMember, addUnavailable, removeUnavailable, t, ownerName, deptName, roleName } = useMe();
  const deps = data.departments.filter(d => myAdminDeps.includes(d.id));
  const [f, setF] = useState({ firstName: user.firstName, middleNames: user.middleNames, lastName: user.lastName, dob: user.dob, contact: user.contact ?? '' });
  const [dm, setDm] = useState<Record<string, string[] | null>>(Object.fromEntries(deps.map(d => [d.id, user.departmentIds.includes(d.id) ? [...(user.positions?.[d.id] ?? [])] : null])));
  const [date, setDate] = useState(''); const [note, setNote] = useState(''); const [err, setErr] = useState<string | null>(null);
  const live = data.users.find(u => u.id === user.id) ?? user;
  const dates = (live.unavailable ?? []).filter(x => (x.to ?? x.date) >= todayIso());
  const toggleRole = (dep: string, r: string) => setDm(p => ({ ...p, [dep]: (p[dep] ?? []).includes(r) ? p[dep]!.filter(x => x !== r) : [...(p[dep] ?? []), r] }));
  const lock = !canEditPersonal(currentUser, user.id);
  return (
    <Screen title={t('team.editTitle', { name: displayName(user) })} subtitle={t('team.editSubtitle', { owner: ownerName })} backTo={{ label: backLabel ?? t('team.title'), onPress: () => onClose() }}>
      <Card>
        <Field label={t('fields.firstName')} value={f.firstName} onChangeText={v => setF({ ...f, firstName: v })} editable={!lock} autoCapitalize="words" testID="m-first" />
        <Field label={t('fields.middleNames')} value={f.middleNames} onChangeText={v => setF({ ...f, middleNames: v })} editable={!lock} autoCapitalize="words" />
        <Field label={t('fields.surname')} value={f.lastName} onChangeText={v => setF({ ...f, lastName: v })} editable={!lock} autoCapitalize="words" testID="m-last" />
        <DateField label={t('fields.dob')} limit="past" value={f.dob} onChange={v => setF({ ...f, dob: v })} testID="m-dob" />
        <Field label={t('fields.contact')} value={f.contact} keyboardType="phone-pad" onChangeText={v => setF({ ...f, contact: v })} editable={!lock} />
        {lock && <View style={[s.row, { flexWrap: 'nowrap' }]}><Icon name="lock-closed" size={14} style={{ marginRight: 6 }} /><Text style={[s.small, { flexShrink: 1 }]}>{t('more.ownerOnlyField')}</Text></View>}
      </Card>
      <Text style={s.section}>{t('team.yourDepts')}</Text>
      {deps.map(d => {
        const inDep = dm[d.id] !== null;
        return (
          <Card key={d.id} style={{ borderLeftWidth: 3, borderLeftColor: inDep ? deptAcc(d) : colors.border }}>
            <Chip testID={`m-dep-${d.id}`} icon={inDep ? 'checkmark' : deptIcon(d.id)} label={deptName(d.id)} color={deptAcc(d)} active={inDep} onPress={() => setDm({ ...dm, [d.id]: inDep ? null : [] })} />
            {inDep && <View style={s.row}>{d.positions.map(r => <Chip key={r} testID={`m-role-${d.id}-${r}`} label={roleName(d.id, r)} color={deptAcc(d)} active={dm[d.id]!.includes(r)} onPress={() => toggleRole(d.id, r)} />)}</View>}
          </Card>
        );
      })}
      {err && <Notice tone="error" text={err} />}
      <Button label={t('common.saveChanges')} testID="m-save" onPress={() => { const e = adminSaveMember(user.id, { ...f, departments: dm }); if (e) setErr(e); else onClose(t('team.saved', { name: displayName(user) })); }} />
      <Text style={s.section}>{t('availability.unavailableDates')}</Text>
      <Card>
        <UnavailEditor entries={dates} onAdd={e => addUnavailable(e.date, user.id, e.note, e.to)} onRemove={d => removeUnavailable(d, user.id)} />
      </Card>
    </Screen>
  );
}
