import { DateField } from '../../src/components/DateField';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AccountInput, formatDobInput, useMe, validContact, validDob } from '../../src/state/AppContext';
import { Button, Icon, deptIcon, Card, Chip, Empty, Field, Screen, colors, s, Notice } from '../../src/components/ui';
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
  if (!canManageAccounts) return <Screen title="Accounts" subtitle="Create and manage everyone's sign-in."><Empty text="Only the owner can manage accounts." /></Screen>;
  const close = (m?: string) => { setMode(null); setNotice(m ?? null); };
  if (mode?.kind === 'new') return <NewAccount onClose={close} />;
  if (mode) return <FullEditor user={data.users.find(x => x.id === mode.id)!} onClose={close} />;
  const depName = (id: string) => data.departments.find(d => d.id === id)?.name ?? id;
  const selDep = data.departments.find(d => d.id === dep);
  const filtered = q !== '' || dep !== 'all' || !!pos || !!tier;
  return (
    <Screen title="Accounts" subtitle="Everyone who can sign in to Mega Hub.">
      <Button label="New account" onPress={() => { setNotice(null); setMode({ kind: 'new' }); }} testID="newaccount" />
      {notice && <Card style={{ backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', marginTop: 12 }}><Text selectable>{notice}</Text></Card>}
      <Card style={{ marginTop: 12 }}>
        <Field label="Search by name or username" value={q} onChangeText={setQ} placeholder="e.g. vitoria" testID="acc-search" />
        <Text style={s.section}>Department</Text>
        <View style={s.row}>
          <Chip label="All" active={dep === 'all'} onPress={() => { setDep('all'); setPos(null); }} testID="f-dep-all" />
          {data.departments.map(d => <Chip key={d.id} testID={`f-dep-${d.id}`} icon={deptIcon(d.id)} label={d.name} color={d.color} active={dep === d.id} onPress={() => { setDep(d.id); setPos(null); }} />)}
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
        <Pressable key={u.id} testID={`edit-${u.username}`} accessibilityRole="button" accessibilityLabel={`Edit ${u.name}`} onPress={() => { setNotice(null); setMode({ kind: 'edit', id: u.id }); }}
          style={({ pressed }) => [s.card, { paddingVertical: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', opacity: u.active ? 1 : 0.55, backgroundColor: pressed ? colors.soft : colors.card }]}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <View style={[s.row, { flexWrap: 'wrap' }]}>
              <Text style={[s.h2, { marginRight: 8, flexShrink: 1 }]}>{u.name}{u.id === currentUser.id ? ' (you)' : ''}</Text>
              <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 12, backgroundColor: colors.primarySoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' }}>{roleName[u.role]}{u.active ? '' : ' · Deactivated'}</Text>
            </View>
            <Text style={s.small} numberOfLines={2}>@{u.username}{u.role === 'admin' ? ` · Admin of ${(u.adminOf ?? []).map(depName).join(', ') || 'none yet'}` : ''}{u.departmentIds.length ? ` · ${u.departmentIds.map(id => `${depName(id)}${(u.positions?.[id] ?? []).length ? ` (${u.positions![id].join(', ')})` : ''}`).join(' · ')}` : ' · No department yet'}</Text>
          </View>
          <Icon name="chevron-forward" size={20} />
        </Pressable>
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
        <Field label="Surname" value={f.lastName} onChangeText={v => setF({ ...f, lastName: v })} autoCapitalize="words" testID="e-last" />
        <DateField label="Date of birth" limit="past" value={f.dob} onChange={v => setF({ ...f, dob: v })} testID="e-dob" />
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
          <View style={[s.row, { marginTop: 6 }]}>{data.departments.map(d => <Chip key={d.id} testID={`e-adminof-${d.id}`} icon={deptIcon(d.id)} label={d.name} color={d.color} active={adminOf.includes(d.id)} onPress={() => setAdminOf(toggle(adminOf, d.id))} />)}</View>
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
          <Card key={d.id} style={{ borderLeftWidth: 3, borderLeftColor: inDep ? d.color : colors.border }}>
            <Chip testID={`e-dep-${d.id}`} icon={inDep ? 'checkmark' : deptIcon(d.id)} label={d.name} color={d.color} active={inDep}
              onPress={() => { setDepIds(toggle(depIds, d.id)); if (!positions[d.id]) setPositions({ ...positions, [d.id]: [] }); }} />
            {inDep && <View style={s.row}>{d.positions.map(r => <Chip key={r} testID={`e-role-${d.id}-${r}`} label={r} color={d.color} active={(positions[d.id] ?? []).includes(r)}
              onPress={() => setPositions({ ...positions, [d.id]: toggle(positions[d.id] ?? [], r) })} />)}</View>}
          </Card>
        );
      })}
      {sec('Unavailable dates')}
      <Card>
        <DateField label="Add unavailable date" limit="future" value={newDate} onChange={setNewDate} testID="e-unavail" />
        <Button label="Add date" outline testID="e-unavail-add" onPress={() => {
          const iso = toIso(newDate); if (!iso || iso < todayIso()) return setErr('Enter a real future date as DD/MM/YYYY.');
          setDates([...new Set([...dates, iso])].sort()); setNewDate(''); setErr(null);
        }} />
        {dates.length === 0 ? <Text style={[s.small, { marginTop: 8 }]}>No unavailable dates.</Text> : dates.map(iso => (
          <View key={iso} style={[s.row, { justifyContent: 'space-between', marginTop: 8 }]}>
            <Text style={{ color: colors.text }}>{iso.split('-').reverse().join('/')}</Text>
            <Pressable onPress={() => setDates(dates.filter(x => x !== iso))}><Text style={{ color: colors.red, fontWeight: '700' }}>Remove</Text></Pressable>
          </View>
        ))}
      </Card>
      {err && <Notice tone="error" text={err} />}
      <Button label="Save" onPress={save} testID="e-save" />
      <Button label="Cancel" outline onPress={() => onClose()} />
    </Screen>
  );
}

function NewAccount({ onClose }: { onClose: (m?: string) => void }) {
  const { data, allowedRoles, saveAccount } = useMe();
  const [f, setF] = useState({ firstName: '', middleNames: '', lastName: '', dob: '', contact: '' });
  const [username, setUsername] = useState(''); const [userEdited, setUserEdited] = useState(false);
  const [pw, setPw] = useState(''); const [mustChange, setMustChange] = useState(true);
  const [role, setRole] = useState<Role>('volunteer');
  const [adminOf, setAdminOf] = useState<string[]>([]);
  const [depIds, setDepIds] = useState<string[]>([]);
  const [positions, setPositions] = useState<Record<string, string[]>>({});
  const [err, setErr] = useState<string | null>(null);
  const toggle = <T,>(arr: T[], v: T) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
  const autoUser = (first: string) => first.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]/g, '');
  const taken = username.trim() !== '' && data.users.some(u => fold(u.username) === fold(username.trim()));
  const name = [f.firstName, f.middleNames, f.lastName].map(x => x.trim()).filter(Boolean).join(' ');
  const save = async () => {
    if (!f.firstName.trim()) return setErr('First name is required.');
    if (taken) return setErr('That username is already taken.');
    const e = await saveAccount(null, { name, username, role, departmentIds: depIds, tempPassword: pw, ...f, positions, adminOf, mustChange });
    if (e) setErr(e); else onClose(`Created @${username.trim()}.${mustChange ? " They'll be asked to choose their own password at first sign-in." : ''}`);
  };
  const sec = (t: string) => <Text style={[s.section, { marginTop: 18 }]}>{t}</Text>;
  return (
    <Screen title="New account" subtitle="Set up a sign-in for a new person.">
      {sec('Personal details')}
      <Card>
        <Field label="First name" value={f.firstName} autoCapitalize="words" testID="n-first"
          onChangeText={v => { setF({ ...f, firstName: v }); if (!userEdited) setUsername(autoUser(v)); }} />
        <Field label="Middle names (optional)" value={f.middleNames} onChangeText={v => setF({ ...f, middleNames: v })} autoCapitalize="words" testID="n-middle" />
        <Field label="Surname" value={f.lastName} onChangeText={v => setF({ ...f, lastName: v })} autoCapitalize="words" testID="n-last" />
        <DateField label="Date of birth (optional)" limit="past" value={f.dob} onChange={v => setF({ ...f, dob: v })} testID="n-dob" />
        <Field label="Contact number (optional)" value={f.contact} keyboardType="phone-pad" onChangeText={v => setF({ ...f, contact: v })} testID="n-contact" />
      </Card>
      {sec('Sign-in')}
      <Card>
        <Field label="Username" value={username} onChangeText={v => { setUsername(v); setUserEdited(true); }} testID="n-username" />
        {taken && <Text style={{ color: colors.red, marginTop: -6, marginBottom: 8 }} testID="n-taken">@{username.trim()} is already taken — choose another.</Text>}
        <Field label="Password" value={pw} onChangeText={setPw} secureTextEntry testID="n-password" />
        <View style={s.row}>
          <Chip icon={mustChange ? 'checkmark' : 'square-outline'} label="Ask them to change it at first sign-in" active={mustChange} onPress={() => setMustChange(!mustChange)} testID="n-mustchange" />
        </View>
      </Card>
      {sec('Access')}
      <Card>
        <Text style={s.small}>Access tier</Text>
        <View style={[s.row, { marginTop: 6 }]}>{allowedRoles.map(r => <Chip key={r} testID={`n-tier-${r}`} label={roleName[r]} active={role === r} onPress={() => setRole(r)} />)}</View>
        {role === 'admin' && <>
          <Text style={s.small}>Administers departments</Text>
          <View style={[s.row, { marginTop: 6 }]}>{data.departments.map(d => <Chip key={d.id} testID={`n-adminof-${d.id}`} icon={deptIcon(d.id)} label={d.name} color={d.color} active={adminOf.includes(d.id)} onPress={() => setAdminOf(toggle(adminOf, d.id))} />)}</View>
        </>}
      </Card>
      {sec('Departments & roles')}
      {data.departments.map(d => {
        const inDep = depIds.includes(d.id);
        return (
          <Card key={d.id} style={{ borderLeftWidth: 3, borderLeftColor: inDep ? d.color : colors.border }}>
            <Chip testID={`n-dep-${d.id}`} icon={inDep ? 'checkmark' : deptIcon(d.id)} label={d.name} color={d.color} active={inDep}
              onPress={() => { setDepIds(toggle(depIds, d.id)); if (!positions[d.id]) setPositions({ ...positions, [d.id]: [] }); }} />
            {inDep && <View style={s.row}>{d.positions.map(r => <Chip key={r} testID={`n-role-${d.id}-${r}`} label={r} color={d.color} active={(positions[d.id] ?? []).includes(r)}
              onPress={() => setPositions({ ...positions, [d.id]: toggle(positions[d.id] ?? [], r) })} />)}</View>}
          </Card>
        );
      })}
      {err && <Notice tone="error" text={err} />}
      <Button label="Create account" onPress={save} testID="saveaccount" />
      <Button label="Cancel" outline onPress={() => onClose()} />
    </Screen>
  );
}
