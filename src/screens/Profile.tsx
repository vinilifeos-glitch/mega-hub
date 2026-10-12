import { DateField } from '../components/DateField';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { formatDobInput, fullName, ProfileInput, useMe } from '../state/AppContext';
import { RoleBadge, Button, DeptTitle, deptIcon, Card, Chip, Field, Screen, Notice, useColors, useStyles } from '../components/ui';
import { User } from '../types';


function Row({ k, v }: { k: string; v: string }) {
  const colors = useColors(); const s = useStyles();
  const { t } = useMe();
  return <View style={{ marginBottom: 8 }}><Text style={s.small}>{k}</Text><Text style={{ fontSize: 16, color: colors.text }}>{v || t('common.notSet')}</Text></View>;
}

export function PersonalInfo({ user, title }: { user: User; title?: string }) {
  const colors = useColors(); const s = useStyles();
  const { t, tierName } = useMe();
  return (
    <Card>
      <View style={[s.row, { justifyContent: 'space-between', marginBottom: 10 }]}><Text style={[s.h2, { flexShrink: 1, marginRight: 8 }]}>{title ?? user.name}</Text><RoleBadge role={user.role} /></View>
      <Row k={t('rows.firstName')} v={user.firstName} />
      <Row k={t('rows.middleNames')} v={user.middleNames} />
      <Row k={t('rows.surname')} v={user.lastName} />
      <Row k={t('rows.dob')} v={user.dob} />
      <Row k={t('rows.username')} v={`@${user.username}`} />
      <Row k={t('rows.contact')} v={user.contact ?? ''} />
      <Row k={t('rows.email')} v={user.email ?? ''} />
      <Row k={t('rows.accountType')} v={tierName(user.role)} />
    </Card>
  );
}

export function RolesView({ user }: { user: User }) {
  const colors = useColors(); const s = useStyles();
  const { data, t, roleName } = useMe();
  const deps = data.departments.filter(d => user.departmentIds.includes(d.id));
  return (
    <>
      {deps.length === 0 && <Card><Text style={s.small}>{t('departmentsScreen.notAssigned')}</Text></Card>}
      {deps.map(d => {
        const roles = user.positions?.[d.id] ?? [];
        return (
          <Card key={d.id} style={{ borderLeftWidth: 3, borderLeftColor: d.color }}>
            <DeptTitle dep={d} suffix={(user.role === 'admin' && (user.adminOf ?? []).includes(d.id)) || user.role === 'owner' ? t('departmentsScreen.adminSuffix') : ''} />
            <View style={[s.row, { marginTop: 8 }]}>
              {roles.length ? roles.map(r => <Chip key={r} label={roleName(d.id, r)} color={d.color} active />) : <Text style={s.small}>{t('departmentsScreen.noRoles')}</Text>}
            </View>
          </Card>
        );
      })}
    </>
  );
}

export function ProfileView({ user, title }: { user: User; title?: string }) {
  const colors = useColors(); const s = useStyles();
  const { t } = useMe();
  return (<><PersonalInfo user={user} title={title} /><Text style={s.section}>{t('profile.departmentsRoles')}</Text><RolesView user={user} /></>);
}

export function ProfileEditor({ user, onClose }: { user: User; onClose: (msg?: string) => void }) {
  const colors = useColors(); const s = useStyles();
  const { data, saveProfile, t, deptName, roleName } = useMe();
  const [f, setF] = useState<ProfileInput>({
    contact: user.contact ?? '', firstName: user.firstName, middleNames: user.middleNames, lastName: user.lastName, dob: user.dob,
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
  const save = () => { const e = saveProfile(user.id, f); if (e) setErr(e); else onClose(t('profile.savedFor', { name: fullName(f) })); };
  return (
    <Screen title={t('profile.editProfile')} subtitle={`${t('rows.username')}: @${user.username}`}>
      <Card>
        <Field label={t('fields.firstName')} value={f.firstName} onChangeText={v => setF({ ...f, firstName: v })} autoCapitalize="words" testID="pf-first" />
        <Field label={t('fields.middleNames')} value={f.middleNames} onChangeText={v => setF({ ...f, middleNames: v })} autoCapitalize="words" testID="pf-middle" />
        <Field label={t('fields.surname')} value={f.lastName} onChangeText={v => setF({ ...f, lastName: v })} autoCapitalize="words" testID="pf-last" />
        <Field label={t('fields.contact')} value={f.contact} placeholder={t('fields.contactPlaceholder')} keyboardType="phone-pad" onChangeText={v => setF({ ...f, contact: v })} testID="pf-contact" />
        <DateField label={t('fields.dob')} limit="past" value={f.dob} onChange={v => setF({ ...f, dob: v })} testID="pf-dob" />
      </Card>
      <Text style={s.section}>{t('profile.departmentsRoles')}</Text>
      {data.departments.map(d => {
        const inDep = f.departmentIds.includes(d.id);
        return (
          <Card key={d.id} style={{ borderLeftWidth: 3, borderLeftColor: inDep ? d.color : colors.border }}>
            <Chip testID={`dep-${d.id}`} icon={inDep ? 'checkmark' : deptIcon(d.id)} label={deptName(d.id)} color={d.color} active={inDep} onPress={() => toggleDep(d.id)} />
            {inDep && (
              <>
                <Text style={[s.small, { marginBottom: 6 }]}>{t('profile.rolesHint', { dept: deptName(d.id) })}</Text>
                <View style={s.row}>
                  {d.positions.map(r => <Chip key={r} testID={`role-${d.id}-${r}`} label={roleName(d.id, r)} color={d.color} active={(f.positions[d.id] ?? []).includes(r)} onPress={() => toggleRole(d.id, r)} />)}
                </View>
              </>
            )}
          </Card>
        );
      })}
      {err && <Notice tone="error" text={err} />}
      <Button label={t('profile.saveProfile')} onPress={save} testID="pf-save" />
      <Button label={t('common.cancel')} outline onPress={() => onClose()} />
    </Screen>
  );
}
