import { useState } from 'react';
import { Text, View } from 'react-native';
import { AccountInput, useMe } from '../../src/state/AppContext';
import { Button, Card, Chip, Empty, Field, Screen, colors, s } from '../../src/components/ui';
import { Role, User } from '../../src/types';
import { ProfileEditor } from '../../src/screens/Profile';

const roleName: Record<Role, string> = { owner: 'Owner', admin: 'Admin', volunteer: 'Volunteer' };
const order: Role[] = ['owner', 'admin', 'volunteer'];

export default function Accounts() {
  const { data, canManageAccounts, currentUser } = useMe();
  const [mode, setMode] = useState<{ kind: 'new' } | { kind: 'profile' | 'account'; id: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  if (!canManageAccounts) return <Screen title="Accounts"><Empty text="Only the owner can manage accounts." /></Screen>;
  const close = (m?: string) => { setMode(null); setNotice(m ?? null); };
  if (mode?.kind === 'new') return <NewAccount onClose={close} />;
  if (mode) {
    const u = data.users.find(x => x.id === mode.id)!;
    return mode.kind === 'profile' ? <ProfileEditor user={u} onClose={close} /> : <AccountEditor user={u} onClose={close} />;
  }
  const users = [...data.users].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || a.name.localeCompare(b.name));
  const depName = (id: string) => data.departments.find(d => d.id === id)?.name ?? id;
  return (
    <Screen title="Accounts" subtitle={`${users.filter(u => u.active).length} active accounts`}>
      <Button label="+ New account" onPress={() => { setNotice(null); setMode({ kind: 'new' }); }} testID="newaccount" />
      {notice && <Card style={{ backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', marginTop: 12 }}><Text selectable>{notice}</Text></Card>}
      <View style={{ height: 12 }} />
      {users.map(u => (
        <Card key={u.id} style={{ opacity: u.active ? 1 : 0.55 }}>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <Text style={s.h2}>{u.name}{u.id === currentUser.id ? ' (you)' : ''}</Text>
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>{roleName[u.role].toUpperCase()}</Text>
          </View>
          <Text style={s.small}>@{u.username}{u.contact ? ` · ${u.contact}` : ''}</Text>
          {u.role === 'admin' && <Text style={s.small}>Admin of: {(u.adminOf ?? []).map(depName).join(', ') || 'none yet'}</Text>}
          <Text style={s.small}>{u.departmentIds.length ? u.departmentIds.map(depName).join(', ') : 'No department yet'}{u.active ? '' : ' · Deactivated'}</Text>
          <View style={[s.row, { marginTop: 8 }]}>
            <Chip testID={`profile-${u.username}`} label="Profile & roles" onPress={() => { setNotice(null); setMode({ kind: 'profile', id: u.id }); }} />
            <Chip testID={`account-${u.username}`} label="Account & access" onPress={() => { setNotice(null); setMode({ kind: 'account', id: u.id }); }} />
          </View>
        </Card>
      ))}
    </Screen>
  );
}

function AccountEditor({ user, onClose }: { user: User; onClose: (m?: string) => void }) {
  const { ownerUpdateAccount, allowedRoles } = useMe();
  const [username, setUsername] = useState(user.username);
  const [role, setRole] = useState<Role>(user.role);
  const [active, setActive] = useState(user.active);
  const [pw, setPw] = useState('');
  const [adminOf, setAdminOf] = useState<string[]>(user.adminOf ?? []);
  const { data } = useMe();
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    const e = await ownerUpdateAccount(user.id, { username, role, active, newPassword: pw, adminOf });
    if (e) setErr(e); else onClose(`Saved account @${username}${pw ? ' (password changed)' : ''}.`);
  };
  return (
    <Screen title={`Account: ${user.name}`} subtitle="Sign-in and access">
      <Card>
        <Field label="Username" value={username} onChangeText={setUsername} testID="acc-username" />
        <Field label="Set new password (leave blank to keep current)" value={pw} onChangeText={setPw} secureTextEntry testID="acc-password" />
        <Text style={s.section}>Access tier</Text>
        <View style={s.row}>{allowedRoles.map(r => <Chip key={r} testID={`tier-${r}`} label={roleName[r]} active={role === r} onPress={() => setRole(r)} />)}</View>
        {role === 'admin' && <>
          <Text style={s.section}>Administers departments</Text>
          <View style={s.row}>{data.departments.map(d => <Chip key={d.id} testID={`adminof-${d.id}`} label={`${d.emoji} ${d.name}`} color={d.color} active={adminOf.includes(d.id)}
            onPress={() => setAdminOf(adminOf.includes(d.id) ? adminOf.filter(x => x !== d.id) : [...adminOf, d.id])} />)}</View>
          <Text style={s.small}>Admins can edit people, roles and availability in these departments and build their rotas.</Text>
        </>}
        <Text style={s.section}>Status</Text>
        <View style={s.row}>
          <Chip label="Active" color={colors.green} active={active} onPress={() => setActive(true)} />
          <Chip testID="acc-deactivate" label="Deactivated" color={colors.red} active={!active} onPress={() => setActive(false)} />
        </View>
        {err && <Text style={{ color: colors.red, marginVertical: 6 }}>{err}</Text>}
        <Button label="Save account" onPress={save} testID="acc-save" />
        <Button label="Cancel" outline onPress={() => onClose()} />
      </Card>
      <Text style={s.small}>Names, date of birth, contact number and departments & roles are under “Profile & roles”.</Text>
    </Screen>
  );
}

function NewAccount({ onClose }: { onClose: (m?: string) => void }) {
  const { data, allowedRoles, saveAccount } = useMe();
  const [f, setF] = useState<AccountInput>({ name: '', username: '', role: 'volunteer', departmentIds: [], tempPassword: '' });
  const [err, setErr] = useState<string | null>(null);
  const toggle = (id: string) => setF({ ...f, departmentIds: f.departmentIds.includes(id) ? f.departmentIds.filter(x => x !== id) : [...f.departmentIds, id] });
  const save = async () => { const e = await saveAccount(null, f); if (e) setErr(e); else onClose(`Created @${f.username}. They'll be asked to choose their own password at first sign-in.`); };
  return (
    <Screen title="New account">
      <Card>
        <Field label="Full name" value={f.name} onChangeText={name => setF({ ...f, name })} autoCapitalize="words" testID="fullname" />
        <Field label="Username" value={f.username} onChangeText={username => setF({ ...f, username })} testID="newusername" />
        <Field label="Temporary password" value={f.tempPassword} onChangeText={tempPassword => setF({ ...f, tempPassword })} secureTextEntry testID="temppw" />
        <Text style={s.section}>Access tier</Text>
        <View style={s.row}>{allowedRoles.map(r => <Chip key={r} label={roleName[r]} active={f.role === r} onPress={() => setF({ ...f, role: r })} />)}</View>
        <Text style={s.section}>Departments (set roles after creating, under “Profile & roles”)</Text>
        <View style={s.row}>{data.departments.map(d => <Chip key={d.id} label={`${d.emoji} ${d.name}`} color={d.color} active={f.departmentIds.includes(d.id)} onPress={() => toggle(d.id)} />)}</View>
        {err && <Text style={{ color: colors.red, marginVertical: 6 }}>{err}</Text>}
        <Button label="Create account" onPress={save} testID="saveaccount" />
        <Button label="Cancel" outline onPress={() => onClose()} />
      </Card>
    </Screen>
  );
}
