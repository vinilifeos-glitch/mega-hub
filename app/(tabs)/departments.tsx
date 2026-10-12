import { displayName } from '../../src/display';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMe } from '../../src/state/AppContext';
import { Badge, Card, DeptTitle, Screen, useColors, useStyles } from '../../src/components/ui';
import { RolesView } from '../../src/screens/Profile';

export default function Departments() {
  const colors = useColors(); const s = useStyles();
  const { data, canManage, canViewDept, currentUser, t, ownerName, roleName } = useMe();
  const seesAll = currentUser.role !== 'volunteer';
  return (
    <Screen title={t('departmentsScreen.title')} subtitle={t('departmentsScreen.subtitle')}>
      <Text style={s.section}>{t('departmentsScreen.mine')}</Text>
      <RolesView user={currentUser} />
      {!seesAll && data.departments.filter(d => currentUser.departmentIds.includes(d.id)).map(d => (
        <Pressable key={d.id} testID={`open-dept-${d.id}`} onPress={() => router.push(`/dept/${d.id}` as any)}><Card style={{ borderLeftWidth: 3, borderLeftColor: d.color }}><View style={[s.row, { justifyContent: 'space-between' }]}><DeptTitle dep={d} /><Text style={{ color: colors.primary, fontWeight: '700' }}>{t('dept.open')} ›</Text></View></Card></Pressable>
      ))}
      {currentUser.role !== 'owner' && <Text style={[s.small, { marginBottom: 8 }]}>{t('departmentsScreen.assignedBy', { owner: ownerName })}</Text>}
      {seesAll && <>
        <Text style={s.section}>{t('departmentsScreen.all')}</Text>
        {data.departments.filter(d => canViewDept(d.id)).map(d => {
          const admins = data.users.filter(u => u.active && u.role === 'admin' && (u.adminOf ?? []).includes(d.id));
          const members = data.users.filter(u => u.active && u.departmentIds.includes(d.id));
          return (
            <Pressable key={d.id} testID={`open-dept-${d.id}`} onPress={() => router.push(`/dept/${d.id}` as any)}><Card style={{ borderLeftWidth: 3, borderLeftColor: d.color }}>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <DeptTitle dep={d} />
                {canManage(d.id) && <Badge tone="accent" icon="shield-checkmark" label={t('common.youManage')} />}
              </View>
              <Text style={[s.small, { marginTop: 4 }]}>{admins.length ? t('departmentsScreen.admins', { names: admins.map(displayName).join(', ') }) : t('departmentsScreen.noAdmins', { owner: ownerName })}</Text>
              <Text style={[s.label, { marginTop: 10, marginBottom: 6 }]}>{t('ui.rolesLabel')}</Text>
              <View style={s.row}>{d.positions.map(p => <Badge key={p} label={roleName(d.id, p)} />)}</View>
              <Text style={{ marginTop: 6, color: colors.text }}>{members.length ? t(members.length === 1 ? 'departmentsScreen.member' : 'departmentsScreen.members', { count: members.length, names: members.map(displayName).join(', ') }) : t('departmentsScreen.noMembers')}</Text>
              <Text style={{ marginTop: 6, color: colors.primary, fontWeight: '700' }}>{t('dept.open')} ›</Text>
            </Card></Pressable>
          );
        })}
      </>}
    </Screen>
  );
}
