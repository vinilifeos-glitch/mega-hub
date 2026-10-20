import { displayName } from '../../src/display';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMe } from '../../src/state/AppContext';
import { Badge, Card, DeptTitle, Icon, Screen, useColors, useStyles, useDeptAccent, withNames, NAMES_SLOT } from '../../src/components/ui';
import { RolesView } from '../../src/screens/Profile';

export default function Departments() {
  const deptAcc = useDeptAccent();
  const colors = useColors(); const s = useStyles();
  const { data, canManage, canManageAccounts, currentUser, t, ownerName, roleName, deptName } = useMe();
  // Membership cards only (RolesView). Dept admins also see departments they administer even if not listed as members.
  const mine = new Set([...(currentUser.departmentIds ?? []), ...((currentUser.role === 'admin' ? currentUser.adminOf : undefined) ?? [])]);
  const extra = data.departments.filter(d => mine.has(d.id) && !currentUser.departmentIds.includes(d.id));
  return (
    <Screen title={t('departmentsScreen.title')} subtitle={t('departmentsScreen.subtitle')}>
      <Text style={s.section}>{t('departmentsScreen.mine')}</Text>
      <RolesView user={currentUser} linkTestId={id => `open-dept-${id}`} />
      {extra.map(d => {
        const admins = data.users.filter(u => u.active && u.role === 'admin' && (u.adminOf ?? []).includes(d.id));
        const members = data.users.filter(u => u.active && u.departmentIds.includes(d.id));
        return (
          <Pressable key={d.id} testID={`open-dept-${d.id}`} accessibilityRole="button" accessibilityLabel={t('dept.openA11y', { dept: deptName(d.id) })} onPress={() => router.push(`/dept/${d.id}` as any)}><Card style={{ borderLeftWidth: 3, borderLeftColor: deptAcc(d) }}>
            <View style={[s.row, { justifyContent: 'space-between', flexWrap: 'nowrap' }]}>
              <View style={{ flex: 1 }}><DeptTitle dep={d} /></View>
              {canManage(d.id) && <Badge tone="accent" icon="shield-checkmark" label={t('common.youManage')} />}
              <Icon name="chevron-forward" size={18} color={colors.subtle} style={{ marginLeft: 8 }} />
            </View>
            <Text style={[s.small, { marginTop: 4 }]}>{admins.length ? withNames(t('departmentsScreen.admins', { names: NAMES_SLOT }), admins.map(u => ({ name: displayName(u), me: u.id === currentUser.id }))) : t('departmentsScreen.noAdmins', { owner: ownerName })}</Text>
            <Text style={[s.label, { marginTop: 10, marginBottom: 6 }]}>{t('ui.rolesLabel')}</Text>
            <View style={s.row}>{d.positions.map(p => <Badge key={p} label={roleName(d.id, p)} />)}</View>
            <Text style={{ marginTop: 6, color: colors.text }}>{members.length ? withNames(t(members.length === 1 ? 'departmentsScreen.member' : 'departmentsScreen.members', { count: members.length, names: NAMES_SLOT }), members.map(u => ({ name: displayName(u), me: u.id === currentUser.id }))) : t('departmentsScreen.noMembers')}</Text>
          </Card></Pressable>
        );
      })}
      {currentUser.role !== 'owner' && <Text style={[s.small, { marginBottom: 8 }]}>{t('departmentsScreen.assignedBy', { owner: ownerName })}</Text>}
      {canManageAccounts && <Text style={[s.small, { marginTop: 4 }]} testID="depts-manage-hint">{t('departmentsScreen.manageInAccounts')}</Text>}
    </Screen>
  );
}
