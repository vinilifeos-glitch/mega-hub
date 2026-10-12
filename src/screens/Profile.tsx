import { useState } from 'react';
import { Text, View } from 'react-native';
import { fullName, ProfileInput, useMe } from '../state/AppContext';
import { Button, Card, Chip, Field, Screen, colors, s } from '../components/ui';
import { User } from '../types';

const roleName = { owner: 'Owner', admin: 'Admin', leader: 'Department Leader', volunteer: 'Volunteer' };
const fmtDob = (d: string) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not set';

function Row({ k, v }: { k: string; v: string }) {
  return <View style={{ marginBottom: 8 }}><Text style={s.small}>{k}</Text><Text style={{ fontSize: 16, color: colors.text }}>{v || '—'}</Text></View>;
}

export function ProfileView({ user, title }: { user: User; title?: string }) {
  const { data } = useMe();
  const deps = data.departments.filter(d => user.departmentIds.includes(d.id));
  return (
    <>
      <Card>
        <Text style={[s.h2, { marginBottom: 10 }]}>{title ?? user.name}</Text>
        <Row k="First name" v={user.firstName} />
        <Row k="Middle names" v={user.middleNames} />
        <Row k="Last name" v={user.lastName} />
        <Row k="Date of birth" v={fmtDob(user.dob)} />
        <Row k="Account" v={`@${user.username} · ${roleName[user.role]}`} />
      </Card>
      <Text style={s.section}>Departments & roles</Text>
      {deps.length === 0 && <Card><Text style={s.small}>Not assigned to any department yet.</Text></Card>}
      {deps.map(d => {
        const roles = user.positions?.[d.id] ?? [];
        return (
          <Card key={d.id} style={{ borderLeftWidth: 5, borderLeftColor: d.color }}>
            <Text style={s.h2}>{d.emoji}  {d.name}{d.leaderId === user.id ? '  · Leader' : ''}</Text>
            <View style={[s.row, { marginTop: 8 }]}>
              {roles.length ? roles.map(r => <Chip key={r} label={r} color={d.color} active />) : <Text style={s.small}>No roles assigned yet</Text>}
            </View>
          </Card>
        );
      })}
    </>
  );
}

export function ProfileEditor({ user, onClose }: { user: User; onClose: (msg?: string) => void }) {
  const { data, saveProfile } = useMe();
  const [f, setF] = useState<ProfileInput>({
    firstName: user.firstName, middleNames: user.middleNames, lastName: user.lastName, dob: user.dob,
    departmentIds: [...user.departmentIds], positions: JSON.parse(JSON.stringify(user.positions ?? {})),
  });
  const [err, setErr] = useState<string | null>(null);
  const toggleDep = (id: string) => setF(p => p.departmentIds.includes(id)
    ? { ...p, departmentIds: p.departmentIds.filter(x => x !== id) }
    : { ...p, departmentIds: [...p.departmentIds, id], positions: { ...p.positions, [id]: p.positions[id] ?? [] } });
  const toggleRole = (dep: string, r: string) => setF(p => {
    const cur = p.positions[dep] ?? [];
    return { ...p, positions: { ...p.positions, [dep]: cur.includes(r) ? cur.filter(x => x !== r) : [...cur, r] } };
  });
  const save = () => { const e = saveProfile(user.id, f); if (e) setErr(e); else onClose(`Saved profile for ${fullName(f)}.`); };
  return (
    <Screen title={`Edit profile`} subtitle={`@${user.username}`}>
      <Card>
        <Field label="First name" value={f.firstName} onChangeText={v => setF({ ...f, firstName: v })} autoCapitalize="words" testID="pf-first" />
        <Field label="Middle names (optional)" value={f.middleNames} onChangeText={v => setF({ ...f, middleNames: v })} autoCapitalize="words" testID="pf-middle" />
        <Field label="Last name" value={f.lastName} onChangeText={v => setF({ ...f, lastName: v })} autoCapitalize="words" testID="pf-last" />
        <Field label="Date of birth (YYYY-MM-DD)" value={f.dob} placeholder="1995-04-21" onChangeText={v => setF({ ...f, dob: v })} testID="pf-dob" />
      </Card>
      <Text style={s.section}>Departments & roles</Text>
      {data.departments.map(d => {
        const inDep = f.departmentIds.includes(d.id);
        return (
          <Card key={d.id} style={{ borderLeftWidth: 5, borderLeftColor: inDep ? d.color : colors.border }}>
            <Chip testID={`dep-${d.id}`} label={`${inDep ? '✓ ' : ''}${d.emoji} ${d.name}`} color={d.color} active={inDep} onPress={() => toggleDep(d.id)} />
            {inDep && (
              <>
                <Text style={[s.small, { marginBottom: 6 }]}>Roles in {d.name} (tap to select several)</Text>
                <View style={s.row}>
                  {d.positions.map(r => <Chip key={r} testID={`role-${d.id}-${r}`} label={r} color={d.color} active={(f.positions[d.id] ?? []).includes(r)} onPress={() => toggleRole(d.id, r)} />)}
                </View>
              </>
            )}
          </Card>
        );
      })}
      {err && <Text style={{ color: colors.red, marginVertical: 6 }}>{err}</Text>}
      <Button label="Save profile" onPress={save} testID="pf-save" />
      <Button label="Cancel" outline onPress={() => onClose()} />
    </Screen>
  );
}
