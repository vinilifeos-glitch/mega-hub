import { sortRoles } from '../../src/data/rota';
import { UnavailEditor } from '../../src/components/UnavailEditor';
import { AppData } from '../../src/types';
import { useTabReset } from '../../src/tabReset';
import { DateField } from '../../src/components/DateField';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AccountInput, formatDobInput, useMe, validContact, validDob, validEmail } from '../../src/state/AppContext';
import { Badge, RoleBadge, Button, Icon, deptIcon, Card, Chip, Empty, Field, Screen, Notice, useColors, useStyles } from '../../src/components/ui';
import { Role, Unavailability, User } from '../../src/types';
import { NOTE_MAX } from '../../src/data/unavailability';
import { toIso, todayIso } from '../../src/data/dates';

const order: Role[] = ['owner', 'admin', 'volunteer'];
const fold = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function Accounts() {
  const colors = useColors(); const s = useStyles();
  const { data, canManageAccounts, currentUser, t, deptName, roleName, tierName } = useMe();
  const [mode, setMode] = useState<{ kind: 'new' } | { kind: 'edit'; id: string } | null>(null);
  useTabReset(() => setMode(null));
  const [notice, setNotice] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [dep, setDep] = useState<string>('all'); // 'all' | 'none' | depId
  const [pos, setPos] = useState<string | null>(null);
  const [tier, setTier] = useState<Role | null>(null);
  const users = useMemo(() => {
    const terms = fold(q).split(/\s+/).filter(Boolean);
    return [...data.users]
      .filter(u => terms.every(term => fold([u.firstName, u.middleNames, u.lastName, u.username, u.name].join(' ')).includes(term)))
      .filter(u => dep === 'all' || (dep === 'none' ? u.departmentIds.length === 0 : u.departmentIds.includes(dep)))
      .filter(u => !pos || dep === 'all' || dep === 'none' || (u.positions?.[dep] ?? []).includes(pos))
      .filter(u => !tier || u.role === tier)
      .sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || a.name.localeCompare(b.name));
  }, [data.users, q, dep, pos, tier]);
  if (!canManageAccounts) return <Screen title={t('accounts.title')} subtitle={t('accounts.ownerOnlySubtitle')}><Empty text={t('accounts.ownerOnly')} /></Screen>;
  const close = (m?: string) => { setMode(null); setNotice(m ?? null); };
  if (mode?.kind === 'new') return <NewAccount onClose={close} />;
  if (mode) return <FullEditor user={data.users.find(x => x.id === mode.id)!} onClose={close} />;
  const depName = deptName;
  const selDep = data.departments.find(d => d.id === dep);
  const filtered = q !== '' || dep !== 'all' || !!pos || !!tier;
  return (
    <Screen title={t('accounts.title')} subtitle={t('accounts.listSubtitle')}>
      <Button label={t('accounts.newAccount')} onPress={() => { setNotice(null); setMode({ kind: 'new' }); }} testID="newaccount" />
      {notice && <Card style={{ backgroundColor: colors.greenSoft, borderColor: colors.greenSoft, marginTop: 12 }}><Text selectable style={{ color: colors.text }}>{notice}</Text></Card>}
      <Card style={{ marginTop: 12 }}>
        <Field label={t('fields.search')} value={q} onChangeText={setQ} placeholder={t('fields.searchPlaceholder')} testID="acc-search" />
        <Text style={s.section}>{t('accounts.department')}</Text>
        <View style={s.row}>
          <Chip label={t('common.all')} active={dep === 'all'} onPress={() => { setDep('all'); setPos(null); }} testID="f-dep-all" />
          {data.departments.map(d => <Chip key={d.id} testID={`f-dep-${d.id}`} icon={deptIcon(d.id)} label={deptName(d.id)} color={d.color} active={dep === d.id} onPress={() => { setDep(d.id); setPos(null); }} />)}
          <Chip label={t('accounts.noDepartment')} active={dep === 'none'} onPress={() => { setDep('none'); setPos(null); }} testID="f-dep-none" />
        </View>
        {selDep && <>
          <Text style={s.section}>{t('accounts.roleIn', { dept: deptName(selDep.id) })}</Text>
          <View style={s.row}>
            <Chip label={t('common.any')} color={selDep.color} active={!pos} onPress={() => setPos(null)} />
            {selDep.positions.map(r => <Chip key={r} testID={`f-role-${r}`} label={roleName(selDep.id, r)} color={selDep.color} active={pos === r} onPress={() => setPos(pos === r ? null : r)} />)}
          </View>
        </>}
        <Text style={s.section}>{t('fields.accessTier')}</Text>
        <View style={s.row}>
          <Chip label={t('common.any')} active={!tier} onPress={() => setTier(null)} />
          {order.map(r => <Chip key={r} testID={`f-tier-${r}`} label={tierName(r)} active={tier === r} onPress={() => setTier(tier === r ? null : r)} />)}
        </View>
        <View style={[s.row, { justifyContent: 'space-between', marginTop: 4 }]}>
          <Text style={{ fontWeight: '700', color: colors.text }} testID="acc-count">{users.length === 1 ? t('common.result') : t('common.results', { count: users.length })}</Text>
          {filtered && <Pressable testID="f-clear" onPress={() => { setQ(''); setDep('all'); setPos(null); setTier(null); }}><Text style={{ color: colors.primary, fontWeight: '700' }}>{t('accounts.clearFilters')}</Text></Pressable>}
        </View>
      </Card>
      {users.length === 0 && <Empty text={t('accounts.noMatch')} />}
      {users.map(u => (
        <Pressable key={u.id} testID={`edit-${u.username}`} accessibilityRole="button" accessibilityLabel={t('accounts.editA11y', { name: u.name })} onPress={() => { setNotice(null); setMode({ kind: 'edit', id: u.id }); }}
          style={({ pressed }) => [s.card, { paddingVertical: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', opacity: u.active ? 1 : 0.55, backgroundColor: pressed ? colors.soft : colors.card }]}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <View style={[s.row, { flexWrap: 'wrap' }]}>
              <Text style={[s.h2, { marginRight: 8, flexShrink: 1 }]}>{u.name}{u.id === currentUser.id ? ` ${t('common.you')}` : ''}</Text>
              <RoleBadge role={u.role} />{u.active ? null : <Badge tone="danger" label={t('common.deactivated')} />}
            </View>
            <Text style={s.small} numberOfLines={2}>{t('rows.username')}: @{u.username}{u.role === 'admin' ? ` · ${t('accounts.adminOf', { depts: (u.adminOf ?? []).map(depName).join(', ') || t('accounts.noneYet') })}` : ''}{u.departmentIds.length ? ` · ${u.departmentIds.map(id => `${depName(id)}${(u.positions?.[id] ?? []).length ? ` (${sortRoles(data, id, u.positions![id]).map(r => roleName(id, r)).join(', ')})` : ''}`).join(' · ')}` : ` · ${t('accounts.noDeptYet')}`}</Text>
          </View>
          <Icon name="chevron-forward" size={20} />
        </Pressable>
      ))}
    </Screen>
  );
}

function FullEditor({ user, onClose }: { user: User; onClose: (m?: string) => void }) {
  const colors = useColors(); const s = useStyles();
  const { data, ownerUpdateAccount, saveProfile, addUnavailable, removeUnavailable, allowedRoles, currentUser, t, deptName, roleName, tierName } = useMe();
  const [f, setF] = useState({ firstName: user.firstName, middleNames: user.middleNames, lastName: user.lastName, dob: user.dob, contact: user.contact ?? '', email: user.email ?? '' });
  const [username, setUsername] = useState(user.username);
  const [pw, setPw] = useState('');
  const [role, setRole] = useState<Role>(user.role);
  const [active, setActive] = useState(user.active);
  const [adminOf, setAdminOf] = useState<string[]>(user.adminOf ?? []);
  const [depIds, setDepIds] = useState<string[]>([...user.departmentIds]);
  const [positions, setPositions] = useState<Record<string, string[]>>(JSON.parse(JSON.stringify(user.positions ?? {})));
  const [dates, setDates] = useState<Unavailability[]>((user.unavailable ?? []).filter(x => (x.to ?? x.date) >= todayIso()));
  const [newDate, setNewDate] = useState(''); const [newNote, setNewNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const self = user.id === currentUser.id;
  const toggle = <T,>(arr: T[], v: T) => arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
  const save = async () => {
    if (!f.firstName.trim()) return setErr(t('errors.firstNameRequired'));
    if (f.dob && !validDob(f.dob)) return setErr(t('errors.dobInvalid'));
    if (!validContact(f.contact.trim())) return setErr(t('errors.contactInvalid'));
    if (!validEmail(f.email)) return setErr(t('errors.emailInvalid'));
    const e = await ownerUpdateAccount(user.id, { username, role, active, newPassword: pw, adminOf });
    if (e) return setErr(e);
    const e2 = saveProfile(user.id, { ...f, departmentIds: depIds, positions });
    if (e2) return setErr(e2);
    const old = (user.unavailable ?? []).filter(x => (x.to ?? x.date) >= todayIso());
    old.filter(x => !dates.some(y => y.date === x.date)).forEach(x => removeUnavailable(x.date, user.id));
    dates.filter(x => { const o = old.find(y => y.date === x.date); return !o || (o.note ?? '') !== (x.note ?? '') || (o.to ?? '') !== (x.to ?? ''); }).forEach(x => addUnavailable(x.date, user.id, x.note, x.to));
    onClose(t(pw ? 'accounts.savedPw' : 'accounts.saved', { name: f.firstName }));
  };
  const sec = (label: string) => <Text style={[s.section, { marginTop: 18 }]}>{label}</Text>;
  return (
    <Screen title={t('accounts.editTitle', { name: user.name })} subtitle={`${t('rows.username')}: @${user.username}`}>
      {sec(t('profile.personalDetails'))}
      <Card>
        <Field label={t('fields.firstName')} value={f.firstName} onChangeText={v => setF({ ...f, firstName: v })} autoCapitalize="words" testID="e-first" />
        <Field label={t('fields.middleNames')} value={f.middleNames} onChangeText={v => setF({ ...f, middleNames: v })} autoCapitalize="words" testID="e-middle" />
        <Field label={t('fields.surname')} value={f.lastName} onChangeText={v => setF({ ...f, lastName: v })} autoCapitalize="words" testID="e-last" />
        <DateField label={t('fields.dob')} limit="past" value={f.dob} onChange={v => setF({ ...f, dob: v })} testID="e-dob" />
        <Field label={t('fields.contact')} value={f.contact} keyboardType="phone-pad" onChangeText={v => setF({ ...f, contact: v })} testID="e-contact" />
        <Field label={t('fields.email')} value={f.email} placeholder={t('fields.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" onChangeText={v => setF({ ...f, email: v })} testID="e-email" />
      </Card>
      {sec(t('accounts.signIn'))}
      <Card>
        <Field label={t('fields.username')} value={username} onChangeText={setUsername} testID="e-username" />
        <Field label={t('accounts.setPassword')} value={pw} onChangeText={setPw} secureTextEntry testID="e-password" />
      </Card>
      {sec(t('accounts.access'))}
      <Card>
        <Text style={s.small}>{t('fields.accessTier')}</Text>
        <View style={[s.row, { marginTop: 6 }]}>{allowedRoles.map(r => <Chip key={r} testID={`e-tier-${r}`} label={tierName(r)} active={role === r} onPress={() => !self && setRole(r)} />)}</View>
        {role === 'admin' && <>
          <Text style={s.small}>{t('accounts.administers')}</Text>
          <View style={[s.row, { marginTop: 6 }]}>{data.departments.map(d => <Chip key={d.id} testID={`e-adminof-${d.id}`} icon={deptIcon(d.id)} label={deptName(d.id)} color={d.color} active={adminOf.includes(d.id)} onPress={() => setAdminOf(toggle(adminOf, d.id))} />)}</View>
        </>}
        <Text style={s.small}>{t('fields.status')}</Text>
        <View style={[s.row, { marginTop: 6 }]}>
          <Chip label={t('common.active')} color={colors.green} active={active} onPress={() => setActive(true)} />
          {!self && <Chip testID="e-deactivate" label={t('common.deactivated')} color={colors.red} active={!active} onPress={() => setActive(false)} />}
        </View>
        {self && <Text style={s.small}>{t('accounts.selfLimit')}</Text>}
      </Card>
      {sec(t('profile.departmentsRoles'))}
      {data.departments.map(d => {
        const inDep = depIds.includes(d.id);
        return (
          <Card key={d.id} style={{ borderLeftWidth: 3, borderLeftColor: inDep ? d.color : colors.border }}>
            <Chip testID={`e-dep-${d.id}`} icon={inDep ? 'checkmark' : deptIcon(d.id)} label={deptName(d.id)} color={d.color} active={inDep}
              onPress={() => { setDepIds(toggle(depIds, d.id)); if (!positions[d.id]) setPositions({ ...positions, [d.id]: [] }); }} />
            {inDep && <View style={s.row}>{d.positions.map(r => <Chip key={r} testID={`e-role-${d.id}-${r}`} label={roleName(d.id, r)} color={d.color} active={(positions[d.id] ?? []).includes(r)}
              onPress={() => setPositions({ ...positions, [d.id]: toggle(positions[d.id] ?? [], r) })} />)}</View>}
          </Card>
        );
      })}
      {sec(t('availability.unavailableDates'))}
      <Card>
        <UnavailEditor entries={dates} onAdd={e => { setDates([...dates.filter(x => x.date !== e.date), e].sort((p, q) => p.date.localeCompare(q.date))); return null; }} onRemove={d => setDates(dates.filter(x => x.date !== d))} />
      </Card>
      {err && <Notice tone="error" text={err} />}
      <Button label={t('common.save')} onPress={save} testID="e-save" />
      <Button label={t('common.cancel')} outline onPress={() => onClose()} />
    </Screen>
  );
}

function NewAccount({ onClose }: { onClose: (m?: string) => void }) {
  const colors = useColors(); const s = useStyles();
  const { data, allowedRoles, saveAccount, t, deptName, roleName, tierName } = useMe();
  const [f, setF] = useState({ firstName: '', middleNames: '', lastName: '', dob: '', contact: '', email: '' });
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
    if (!f.firstName.trim()) return setErr(t('errors.firstNameRequired'));
    if (taken) return setErr(t('errors.usernameTaken'));
    const e = await saveAccount(null, { name, username, role, departmentIds: depIds, tempPassword: pw, ...f, positions, adminOf, mustChange });
    if (e) setErr(e); else onClose(t(mustChange ? 'accounts.createdMustChange' : 'accounts.created', { name, username: username.trim() }));
  };
  const sec = (label: string) => <Text style={[s.section, { marginTop: 18 }]}>{label}</Text>;
  return (
    <Screen title={t('accounts.newAccount')} subtitle={t('accounts.newSubtitle')}>
      {sec(t('profile.personalDetails'))}
      <Card>
        <Field label={t('fields.firstName')} value={f.firstName} autoCapitalize="words" testID="n-first"
          onChangeText={v => { setF({ ...f, firstName: v }); if (!userEdited) setUsername(autoUser(v)); }} />
        <Field label={t('fields.middleNames')} value={f.middleNames} onChangeText={v => setF({ ...f, middleNames: v })} autoCapitalize="words" testID="n-middle" />
        <Field label={t('fields.surname')} value={f.lastName} onChangeText={v => setF({ ...f, lastName: v })} autoCapitalize="words" testID="n-last" />
        <DateField label={t('fields.dob')} limit="past" value={f.dob} onChange={v => setF({ ...f, dob: v })} testID="n-dob" />
        <Field label={t('fields.contact')} value={f.contact} keyboardType="phone-pad" onChangeText={v => setF({ ...f, contact: v })} testID="n-contact" />
        <Field label={t('fields.email')} value={f.email} placeholder={t('fields.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" onChangeText={v => setF({ ...f, email: v })} testID="n-email" />
      </Card>
      {sec(t('accounts.signIn'))}
      <Card>
        <Field label={t('fields.username')} value={username} onChangeText={v => { setUsername(v); setUserEdited(true); }} testID="n-username" />
        {taken && <Text style={{ color: colors.red, marginTop: -6, marginBottom: 8 }} testID="n-taken">{t('accounts.usernameTaken', { username: username.trim() })}</Text>}
        <Field label={t('fields.password')} value={pw} onChangeText={setPw} secureTextEntry testID="n-password" />
        <View style={s.row}>
          <Chip icon={mustChange ? 'checkmark' : 'square-outline'} label={t('accounts.askChange')} active={mustChange} onPress={() => setMustChange(!mustChange)} testID="n-mustchange" />
        </View>
      </Card>
      {sec(t('accounts.access'))}
      <Card>
        <Text style={s.small}>{t('fields.accessTier')}</Text>
        <View style={[s.row, { marginTop: 6 }]}>{allowedRoles.map(r => <Chip key={r} testID={`n-tier-${r}`} label={tierName(r)} active={role === r} onPress={() => setRole(r)} />)}</View>
        {role === 'admin' && <>
          <Text style={s.small}>{t('accounts.administers')}</Text>
          <View style={[s.row, { marginTop: 6 }]}>{data.departments.map(d => <Chip key={d.id} testID={`n-adminof-${d.id}`} icon={deptIcon(d.id)} label={deptName(d.id)} color={d.color} active={adminOf.includes(d.id)} onPress={() => setAdminOf(toggle(adminOf, d.id))} />)}</View>
        </>}
      </Card>
      {sec(t('profile.departmentsRoles'))}
      {data.departments.map(d => {
        const inDep = depIds.includes(d.id);
        return (
          <Card key={d.id} style={{ borderLeftWidth: 3, borderLeftColor: inDep ? d.color : colors.border }}>
            <Chip testID={`n-dep-${d.id}`} icon={inDep ? 'checkmark' : deptIcon(d.id)} label={deptName(d.id)} color={d.color} active={inDep}
              onPress={() => { setDepIds(toggle(depIds, d.id)); if (!positions[d.id]) setPositions({ ...positions, [d.id]: [] }); }} />
            {inDep && <View style={s.row}>{d.positions.map(r => <Chip key={r} testID={`n-role-${d.id}-${r}`} label={roleName(d.id, r)} color={d.color} active={(positions[d.id] ?? []).includes(r)}
              onPress={() => setPositions({ ...positions, [d.id]: toggle(positions[d.id] ?? [], r) })} />)}</View>}
          </Card>
        );
      })}
      {err && <Notice tone="error" text={err} />}
      <Button label={t('accounts.createAccount')} onPress={save} testID="saveaccount" />
      <Button label={t('common.cancel')} outline onPress={() => onClose()} />
    </Screen>
  );
}
