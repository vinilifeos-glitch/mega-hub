import { useState } from 'react';
import { Text, View } from 'react-native';
import { AccountInput, useMe } from '../../src/state/AppContext';
import { Button, Card, Chip, Empty, Field, Screen, colors, s } from '../../src/components/ui';
import { randomPassword } from '../../src/data/auth';
import { Role, User } from '../../src/types';
import { ProfileEditor, ProfileView } from '../../src/screens/Profile';

const roleName: Record<Role, string> = { owner: 'Owner', admin: 'Admin', leader: 'Leader', volunteer: 'Volunteer' };
const order: Role[] = ['owner', 'admin', 'leader', 'volunteer'];

export default function People() {
  const app = useMe();
  const { data, canManageAccounts, canEditAccount, allowedRoles, saveAccount, resetPassword, setActive, currentUser } = app;
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ user: User; edit: boolean } | null>(null);
  const isOwner = currentUser.role === 'owner';
  if (!canManageAccounts) return <Screen title="People"><Empty text="Only the owner and admins can manage accounts." /></Screen>;
  if (profile) {
    const fresh = data.users.find(u => u.id === profile.user.id) ?? profile.user;
    if (profile.edit) return <ProfileEditor user={fresh} onClose={m => { setProfile(null); setNotice(m ?? null); }} />;
    return (
      <Screen title="Profile">
        <ProfileView user={fresh} />
        {isOwner && <Button label="Edit profile" onPress={() => setProfile({ user: fresh, edit: true })} testID="pf-edit" />}
        <Button label="Back" outline onPress={() => setProfile(null)} />
      </Screen>
    );
  }
  if (editing) return <AccountForm user={editing === 'new' ? null : editing} onClose={msg => { setEditing(null); setNotice(msg ?? null); }} />;

  const users = [...data.users].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || a.name.localeCompare(b.name));
  const depName = (id: string) => data.departments.find(d => d.id === id)?.name ?? id;
  return (
    <Screen title="People" subtitle={`${users.filter(u => u.active).length} active accounts`}>
      <Button label="+ New account" onPress={() => { setNotice(null); setEditing('new'); }} testID="newaccount" />
      {notice && <Card style={{ backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', marginTop: 12 }}><Text selectable>{notice}</Text></Card>}
      <View style={{ height: 12 }} />
      {users.map(u => {
        const editable = canEditAccount(u);
        return (
          <Card key={u.id} style={{ opacity: u.active ? 1 : 0.55 }}>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <Text style={s.h2}>{u.name}{u.id === currentUser.id ? ' (you)' : ''}</Text>
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>{roleName[u.role].toUpperCase()}</Text>
            </View>
            <Text style={s.small}>@{u.username} · {u.departmentIds.length ? u.departmentIds.map(depName).join(', ') : 'No department yet'}</Text>
            <Text style={s.small}>{!u.active ? 'Deactivated' : u.mustChangePassword ? 'Temporary password (not changed yet)' : 'Active'}</Text>
            {(editable || isOwner) && (
              <View style={[s.row, { marginTop: 8 }]}>
                <Chip testID={`profile-${u.username}`} label="Profile" onPress={() => { setNotice(null); setProfile({ user: u, edit: false }); }} />
                {editable && <Chip label="Account" onPress={() => { setNotice(null); setEditing(u); }} />}
                {editable && u.id !== currentUser.id && <Chip label="Reset password" onPress={async () => {
                  const pw = randomPassword(); const e = await resetPassword(u.id, pw);
                  setNotice(e ?? `New temporary password for @${u.username}: ${pw}\nShare it privately — they'll be asked to change it at sign-in.`);
                }} />}
                {editable && u.id !== currentUser.id && u.role !== 'owner' && <Chip color={u.active ? colors.red : colors.green} label={u.active ? 'Deactivate' : 'Reactivate'}
                  onPress={() => setNotice(setActive(u.id, !u.active) ?? `@${u.username} ${u.active ? 'deactivated' : 'reactivated'}.`)} />}
              </View>
            )}
          </Card>
        );
      })}
      {allowedRoles.includes('admin') ? null : <Text style={s.small}>Only the owner can create or edit admin accounts.</Text>}
    </Screen>
  );
}

function AccountForm({ user, onClose }: { user: User | null; onClose: (msg?: string) => void }) {
  const { data, allowedRoles, saveAccount, currentUser } = useMe();
  const isSelfOwner = user?.role === 'owner';
  const [f, setF] = useState<AccountInput>({
    name: user?.name ?? '', username: user?.username ?? '', role: user?.role ?? 'volunteer',
    departmentIds: user?.departmentIds ?? [], tempPassword: user ? undefined : randomPassword(),
  });
  const [err, setErr] = useState<string | null>(null);
  const roles: Role[] = isSelfOwner ? ['owner'] : allowedRoles;
  const toggle = (id: string) => setF({ ...f, departmentIds: f.departmentIds.includes(id) ? f.departmentIds.filter(x => x !== id) : [...f.departmentIds, id] });
  const save = async () => {
    const e = await saveAccount(user?.id ?? null, f);
    if (e) return setErr(e);
    onClose(user ? `Saved @${f.username}.` : `Created @${f.username}. Temporary password: ${f.tempPassword}\nShare it privately — they'll be asked to change it at first sign-in.`);
  };
  return (
    <Screen title={user ? `Edit ${user.name}` : 'New account'}>
      <Card>
        <Field label="Full name" value={f.name} onChangeText={name => setF({ ...f, name })} autoCapitalize="words" testID="fullname" />
        <Field label="Username" value={f.username} onChangeText={username => setF({ ...f, username })} testID="newusername" />
        {!user && <Field label="Temporary password" value={f.tempPassword} onChangeText={tempPassword => setF({ ...f, tempPassword })} testID="temppw" />}
        <Text style={s.section}>Role</Text>
        <View style={s.row}>{roles.map(r => <Chip key={r} label={roleName[r]} active={f.role === r} onPress={() => setF({ ...f, role: r })} />)}</View>
        <Text style={s.section}>Departments{f.role === 'leader' ? ' (they will lead these)' : ''}</Text>
        <View style={s.row}>{data.departments.map(d => <Chip key={d.id} label={`${d.emoji} ${d.name}`} color={d.color} active={f.departmentIds.includes(d.id)} onPress={() => toggle(d.id)} />)}</View>
        {err && <Text style={{ color: colors.red, marginVertical: 6 }}>{err}</Text>}
        <Button label={user ? 'Save changes' : 'Create account'} onPress={save} testID="saveaccount" />
        <Button label="Cancel" outline onPress={() => onClose()} />
      </Card>
    </Screen>
  );
}
