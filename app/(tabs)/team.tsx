import { DateField } from '../../src/components/DateField';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatDobInput, useMe } from '../../src/state/AppContext';
import { Button, Card, Chip, Empty, Field, Screen, colors, s } from '../../src/components/ui';
import { User } from '../../src/types';
import { toIso, todayIso } from '../../src/data/dates';

export default function Team() {
  const { data, myAdminDeps, currentUser, canEditMember } = useMe();
  const [editId, setEditId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const deps = data.departments.filter(d => myAdminDeps.includes(d.id));
  if (editId) return <MemberEditor user={data.users.find(u => u.id === editId)!} onClose={m => { setEditId(null); setMsg(m ?? null); }} />;
  if (!deps.length) return <Screen title="Team"><Empty text="You don't administer any departments yet. Vini (the owner) assigns them." /></Screen>;
  const unassigned = data.users.filter(u => u.active && u.departmentIds.length === 0 && u.role === 'volunteer');
  const row = (u: User, depId?: string) => (
    <Pressable key={u.id + (depId ?? '')} testID={`member-${u.username}`} onPress={() => { setMsg(null); setEditId(u.id); }} disabled={!canEditMember(u)}>
      <View style={[s.row, { justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '600', color: colors.text }}>{u.name}</Text>
          <Text style={s.small}>{depId ? ((u.positions?.[depId] ?? []).join(', ') || 'No roles yet') : 'Not in a department'}</Text>
        </View>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>Edit ›</Text>
      </View>
    </Pressable>
  );
  return (
    <Screen title="Team" subtitle="People in the departments you administer">
      {msg && <Text style={[s.small, { color: colors.green, marginBottom: 8 }]}>{msg}</Text>}
      {deps.map(d => {
        const members = data.users.filter(u => u.active && u.departmentIds.includes(d.id));
        return (
          <Card key={d.id} style={{ borderLeftWidth: 5, borderLeftColor: d.color }}>
            <Text style={s.h2}>{d.emoji}  {d.name} · {members.length}</Text>
            {members.length ? members.map(u => row(u, d.id)) : <Text style={s.small}>No one yet. Add people from the list below.</Text>}
          </Card>
        );
      })}
      {unassigned.length > 0 && <Card>
        <Text style={s.h2}>Not in a department yet</Text>
        {unassigned.map(u => row(u))}
      </Card>}
    </Screen>
  );
}

function MemberEditor({ user, onClose }: { user: User; onClose: (m?: string) => void }) {
  const { data, myAdminDeps, adminSaveMember, addUnavailable, removeUnavailable } = useMe();
  const deps = data.departments.filter(d => myAdminDeps.includes(d.id));
  const [f, setF] = useState({ firstName: user.firstName, middleNames: user.middleNames, lastName: user.lastName, dob: user.dob, contact: user.contact ?? '' });
  const [dm, setDm] = useState<Record<string, string[] | null>>(Object.fromEntries(deps.map(d => [d.id, user.departmentIds.includes(d.id) ? [...(user.positions?.[d.id] ?? [])] : null])));
  const [date, setDate] = useState(''); const [err, setErr] = useState<string | null>(null);
  const live = data.users.find(u => u.id === user.id) ?? user;
  const dates = (live.unavailable ?? []).filter(x => x >= todayIso());
  const toggleRole = (dep: string, r: string) => setDm(p => ({ ...p, [dep]: (p[dep] ?? []).includes(r) ? p[dep]!.filter(x => x !== r) : [...(p[dep] ?? []), r] }));
  return (
    <Screen title={`Edit ${user.name}`} subtitle="Username, password and access are managed by Vini">
      <Card>
        <Field label="First name" value={f.firstName} onChangeText={v => setF({ ...f, firstName: v })} autoCapitalize="words" testID="m-first" />
        <Field label="Middle names (optional)" value={f.middleNames} onChangeText={v => setF({ ...f, middleNames: v })} autoCapitalize="words" />
        <Field label="Surname" value={f.lastName} onChangeText={v => setF({ ...f, lastName: v })} autoCapitalize="words" testID="m-last" />
        <DateField label="Date of birth" limit="past" value={f.dob} onChange={v => setF({ ...f, dob: v })} testID="m-dob" />
        <Field label="Contact number (optional)" value={f.contact} keyboardType="phone-pad" onChangeText={v => setF({ ...f, contact: v })} />
      </Card>
      <Text style={s.section}>Departments & roles (your departments only)</Text>
      {deps.map(d => {
        const inDep = dm[d.id] !== null;
        return (
          <Card key={d.id} style={{ borderLeftWidth: 5, borderLeftColor: inDep ? d.color : colors.border }}>
            <Chip testID={`m-dep-${d.id}`} label={`${inDep ? '✓ ' : ''}${d.emoji} ${d.name}`} color={d.color} active={inDep} onPress={() => setDm({ ...dm, [d.id]: inDep ? null : [] })} />
            {inDep && <View style={s.row}>{d.positions.map(r => <Chip key={r} testID={`m-role-${d.id}-${r}`} label={r} color={d.color} active={dm[d.id]!.includes(r)} onPress={() => toggleRole(d.id, r)} />)}</View>}
          </Card>
        );
      })}
      {err && <Text style={{ color: colors.red, marginVertical: 6 }}>{err}</Text>}
      <Button label="Save changes" testID="m-save" onPress={() => { const e = adminSaveMember(user.id, { ...f, departments: dm }); if (e) setErr(e); else onClose(`Saved ${f.firstName}.`); }} />
      <Text style={s.section}>Unavailable dates</Text>
      <Card>
        <DateField label="Add unavailable date" limit="future" value={date} onChange={setDate} testID="m-unavail" />
        <Button label="Add unavailable date" outline testID="m-unavail-add" onPress={() => {
          const iso = toIso(date); if (!iso || iso < todayIso()) return setErr('Enter a real future date as DD/MM/YYYY.');
          addUnavailable(iso, user.id); setDate(''); setErr(null);
        }} />
        {dates.length === 0 ? <Text style={[s.small, { marginTop: 8 }]}>No unavailable dates.</Text> : dates.map(iso => (
          <View key={iso} style={[s.row, { justifyContent: 'space-between', marginTop: 8 }]}>
            <Text style={{ color: colors.text }}>✕ {iso.split('-').reverse().join('/')}</Text>
            <Pressable onPress={() => removeUnavailable(iso, user.id)}><Text style={{ color: colors.red, fontWeight: '700' }}>Remove</Text></Pressable>
          </View>
        ))}
      </Card>
      <Button label="Back" outline onPress={() => onClose()} />
    </Screen>
  );
}
