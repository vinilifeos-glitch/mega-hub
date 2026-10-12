import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AccountInput, formatDobInput, useMe, validContact, validDob } from '../../src/state/AppContext';
import { Button, Card, Chip, Empty, Field, Screen, colors, s } from '../../src/components/ui';
import { Role, User } from '../../src/types';
import { toIso, todayIso } from '../../src/data/dates';

const roleName: Record<Role, string> = { owner: 'Owner', admin: 'Admin', volunteer: 'Volunteer' };
const order: Role[] = ['owner', 'admin', 'volunteer'];
const fold = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function Accounts() {
  const { data, canManageAccounts, currentUser } = useMe();
  const [mode, setMode] = useState<{ kind: 'new' } | { kind: 'edit'; id: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [dep, setDep] = useState<string>('all'); // 'all' | 'none' | depId
  const [pos, setPos] = useState<string | null>(null);
  const [tier, setTier] = useState<Role | null>(null);
  const users = useMemo(() => {
    const terms = fold(q).split(/\s+/).filter(Boolean);
    return [...data.users]
      .filter(u => terms.every(t => fold([u.firstName, u.middleNames, u.lastName, u.username, u.name].join(' ')).includes(t)))
      .filter(u => dep === 'all' || (dep === 'none' ? u.departmentIds.length === 0 : u.departmentIds.includes(dep)))
      .filter(u => !pos || dep === 'all' || dep === 'none' || (u.positions?.[dep] ?? []).includes(pos))
      .filter(u => !tier || u.role === tier)
      .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || a.name.localeCompare(b.name));
  }, [data.users, q, dep, pos, tier]);
  if (!canManageAccounts) return <Screen title="Accounts"><Empty text="Only the owner can manage accounts." /></Screen>;
  const close = (m?: string) => { setMode(null); setNotice(m ?? null); };
  if (mode?.kind === 'new') return <NewAccount onClose={close} />;
  if (mode) return <FullEditor user={data.users.find(x => x.id === mode.id)!} onClose={close} />;
  const depName = (id: string) => data.departments.find(d => d.id === id)?.name ?? id;
  const selDep = data.departments.find(d => d.id === dep);
  const filtered = q !== '' || dep !== 'all' || !!pos || !!tier;
  return (
    <Screen title="Accounts" subtitle={`${data.users.filter(u => u.active).length} active accounts`}>
      <Button label="+ New account" onPress={() => { setNotice(null); setMode({ kind: 'new' }); }} testID="newaccount" />
      {notice && <Card style={{ backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', marginTop: 12 }}><Text selectable>{notice}</Text></Card>}
      <Card style={{ marginTop: 12 }}>
        <Field label="Search by name or username" value={q} onChangeText={setQ} placeholder="e.g. vitoria" testID="acc-search" />
        <Text style={s.section}>Department</Text>
        <View style={s.row}>
          <Chip label="All" active={dep === 'all'} onPress={() => { setDep('all'); setPos(null); }} testID="f-dep-all" />
          {data.departments.map(d => <Chip key={d.id} testID={`f-dep-${d.id}`} label={`${d.emoji} ${d.name}`} color={d.color} active={dep === d.id} onPress={() => { setDep(d.id); setPos(null); }} />)}
          <Chip label="No department" active={dep === 'none'} onPress={() => { setDep('none'); setPos(null); }} testID="f-dep-none" />
        </View>
        {selDep && <>
          <Text style={s.section}>Role in {selDep.name}</Text>
          <View style={s.row}>
            <Chip label="Any" color={selDep.color} active={!pos} onPress={() => setPos(null)} />
            {selDep.positions.map(r => <Chip key={r} testID={`f-role-${r}`} label={r} color={selDep.color} active={pos === r} onPress={() => setPos(pos === r ? null : r)} />)}
          </View>
        </>}
        <Text style={s.section}>Access tier</Text>
        <View style={s.row}>
          <Chip label="Any" active={!tier} onPress={() => setTier(null)} />
          {order.map(r => <Chip key={r} testID={`f-tier-${r}`} label={roleName[r]} active={tier === r} onPress={() => setTier(tier === r ? null : r)} />)}
        </View>
        <View style={[s.row, { justifyContent: 'space-between', marginTop: 4 }]}>
          <Text style={{ fontWeight: '700', color: colors.text }} testID="acc-count">{users.length} {users.length === 1 ? 'result' : 'results'}</Text>
          {filtered && <Pressable testID="f-clear" onPress={() => { setQ(''); setDep('all'); setPos(null); setTier(null); }}><Text style={{ color: colors.primary, fontWeight: '700' }}>Clear filters</Text></Pressable>}
        </View>
      </Card>
      {users.length === 0 && <Empty text="No accounts match." />}
      {users.map(u => (
        <Card key={u.id} style={{ opacity: u.active ? 1 : 0.55 }}>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <Text style={[s.h2, { flex: 1 }]}>{u.name}{u.id === currentUser.id ? ' (you)' : ''}</Text>
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>{roleName[u.role].toUpperCase()}</Text>
          </View>
          <Text style={s.small}>@{u.username}{u.contact ? ` · ${u.contact}` : ''}</Text>
          {u.role === 'admin' && <Text style={s.small}>Admin of: {(u.adminOf ?? []).map(depName).join(', ') || 'none yet'}</Text>}
          <Text style={s.small}>{u.departmentIds.length ? u.departmentIds.map(id => `${depName(id)}${(u.positions?.[id] ?? []).length ? ` (${u.positions![id].join(', ')})` : ''}`).join(' · ') : 'No department yet'}{u.active ? '' : ' · Deactivated'}</Text>
          <Button label="Edit" outline onPress={() => { setNotice(null); setMode({ kind: 'edit', id: u.id }); }} testID={`edit-${u.username}`} />
        </Card>
      ))}
    </Screen>
  );
}

function FullEditor({ user, onClose }: { user: User; onClose: (m?: string) => void }) {
  const { data, ownerUpdateAccount, saveProfile, addUnavailable, removeUnavailable, allowedRoles, currentUser } = useMe();
  const [f, setF] = useState({ firstName: user.firstName, middleNames: user.middleNames, lastName: user.lastName, dob: user.dob, contact: user.contact ?? '' });
  const [username, setUsername] = useState(user.username);
  const [pw, setPw] = useState('');
  const [role, setRole] = useState<Role>(user.role);
  const [active, setActive] = useState(user.active);
  const [adminOf, setAdminOf] = useState<string[]>(user.adminOf ?? []);
  const [depIds, setDepIds] = useState<string[]>([...user.departmentIds]);
  const [positions, setPositions] = useState<Record<string, string[]>>(JSON.parse(JSON.stringify(user.positions ?? {})));
  const [dates, setDates] = useState<string[]>((user.unavailable ?? []).filter(x => x >= todayIso()));
  const [newDate, setNewDate] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const self = user.id === currentUser.id;
  const toggle = <T,>(arr: T[], v: T) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
  const save = async () => {
    if (!f.firstName.trim()) return setErr('First name is required.');
    if (f.dob && !validDob(f.dob)) return setErr('Date of birth must be a real date as DD/MM/YYYY.');
    if (!validContact(f.contact.trim())) return setErr('Contact number looks invalid.');
    const e = await ownerUpdateAccount(user.id, { username, role, active, newPassword: pw, adminOf });
    if (e) return setErr(e);
    const e2 = saveProfile(user.id, { ...f, departmentIds: depIds, positions });
    if (e2) return setErr(e2);
    const old = (user.unavailable ?? []).filter(x => x >= todayIso());
    old.filter(x => !dates.includes(x)).forEach(x => removeUnavailable(x, user.id));
    dates.filter(x => !old.includes(x)).forEach(x => addUnavailable(x, user.id));
    onClose(`Saved ${f.firstName}${pw ? ' (password changed)' : ''}.`);
  };
  const sec = (t: string) => <Text style={[s.section, { marginTop: 18 }]}>{t}</Text>;
  return (
    <Screen title={`Edit ${user.name}`} subtitle={`@${user.username}`}>
      {sec('Personal details')}
      <Card>
        <Field label="First name" value={f.firstName} onChangeText={v => setF({ ...f, firstName: v })} autoCapitalize="words" testID="e-first" />
        <Field label="Middle names (optional)" value={f.middleNames} onChangeText={v => setF({ ...f, middleNames: v })} autoCapitalize="words" testID="e-middle" />
        <Field label="Last name" value={f.lastName} onChangeText={v => setF({ ...f, lastName: v })} autoCapitalize="words" testID="e-last" />
        <Field label="Date of birth (DD/MM/YYYY)" value={f.dob} placeholder="21/04/1995" keyboardType="number-pad" maxLength={10} onChangeText={v => setF({ ...f, dob: formatDobInput(v) })} testID="e-dob" />
        <Field label="Contact number (optional)" value={f.contact} keyboardType="phone-pad" onChangeText={v => setF({ ...f, contact: v })} testID="e-contact" />
      </Card>
      {sec('Sign-in')}
      <Card>
        <Field label="Username" value={username} onChangeText={setUsername} testID="e-username" />
        <Field label="Set new password (leave blank to keep current)" value={pw} onChangeText={setPw} secureTextEntry testID="e-password" />
      </Card>
      {sec('Access')}
      <Card>
        <Text style={s.small}>Access tier</Text>
        <View style={[s.row, { marginTop: 6 }]}>{allowedRoles.map(r => <Chip key={r} testID={`e-tier-${r}`} label={roleName[r]} active={role === r} onPress={() => !self && setRole(r)} />)}</View>
        {role === 'admin' && <>
          <Text style={s.small}>Administers departments</Text>
          <View style={[s.row, { marginTop: 6 }]}>{data.departments.map(d => <Chip key={d.id} testID={`e-adminof-${d.id}`} label={`${d.emoji} ${d.name}`} color={d.color} active={adminOf.includes(d.id)} onPress={() => setAdminOf(toggle(adminOf, d.id))} />)}</View>
        </>}
        <Text style={s.small}>Status</Text>
        <View style={[s.row, { marginTop: 6 }]}>
          <Chip label="Active" color={colors.green} active={active} onPress={() => setActive(true)} />
          {!self && <Chip testID="e-deactivate" label="Deactivated" color={colors.red} active={!active} onPress={() => setActive(false)} />}
        </View>
        {self && <Text style={s.small}>You can't change your own tier or deactivate yourself.</Text>}
      </Card>
      {sec('Departments & roles')}
      {data.departments.map(d => {
        const inDep = depIds.includes(d.id);
        return (
          <Card key={d.id} style={{ borderLeftWidth: 5, borderLeftColor: inDep ? d.color : colors.border }}>
            <Chip testID={`e-dep-${d.id}`} label={`${inDep ? '✓ ' : ''}${d.emoji} ${d.name}`} color={d.color} active={inDep}
              onPress={() => { setDepIds(toggle(depIds, d.id)); if (!positions[d.id]) setPositions({ ...positions, [d.id]: [] }); }} />
            {inDep && <View style={s.row}>{d.positions.map(r => <Chip key={r} testID={`e-role-${d.id}-${r}`} label={r} color={d.color} active={(positions[d.id] ?? []).includes(r)}
              onPress={() => setPositions({ ...positions, [d.id]: toggle(positions[d.id] ?? [], r) })} />)}</View>}
          </Card>
        );
      })}
      {sec('Unavailable dates')}
      <Card>
        <Field label="Add date (DD/MM/YYYY)" value={newDate} keyboardType="number-pad" maxLength={10} onChangeText={v => setNewDate(formatDobInput(v))} testID="e-unavail" />
        <Button label="Add date" outline testID="e-unavail-add" onPress={() => {
          const iso = toIso(newDate); if (!iso || iso < todayIso()) return setErr('Enter a real future date as DD/MM/YYYY.');
          setDates([...new Set([...dates, iso])].sort()); setNewDate(''); setErr(null);
        }} />
        {dates.length === 0 ? <Text style={[s.small, { marginTop: 8 }]}>No unavailable dates.</Text> : dates.map(iso => (
          <View key={iso} style={[s.row, { justifyContent: 'space-between', marginTop: 8 }]}>
            <Text style={{ color: colors.text }}>✕ {iso.split('-').reverse().join('/')}</Text>
            <Pressable onPress={() => setDates(dates.filter(x => x !== iso))}><Text style={{ color: colors.red, fontWeight: '700' }}>Remove</Text></Pressable>
          </View>
        ))}
      </Card>
      {err && <Text style={{ color: colors.red, marginVertical: 8 }} testID="e-error">{err}</Text>}
      <Button label="Save" onPress={save} testID="e-save" />
      <Button label="Cancel" outline onPress={() => onClose()} />
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
