import { Text, View } from 'react-native';
import { useMe } from '../../src/state/AppContext';
import { Badge, Card, DeptTitle, Screen, useColors, useStyles } from '../../src/components/ui';
import { RolesView } from '../../src/screens/Profile';

export default function Departments() {
  const colors = useColors(); const s = useStyles();
  const { data, canManage, currentUser, t, ownerName, roleName } = useMe();
  const seesAll = currentUser.role !== 'volunteer';
  return (
    <Screen title={t('departmentsScreen.title')} subtitle={t('departmentsScreen.subtitle')}>
      <Text style={s.section}>{t('departmentsScreen.mine')}</Text>
      <RolesView user={currentUser} />
      {currentUser.role !== 'owner' && <Text style={[s.small, { marginBottom: 8 }]}>{t('departmentsScreen.assignedBy', { owner: ownerName })}</Text>}
      {seesAll && <>
        <Text style={s.section}>{t('departmentsScreen.all')}</Text>
        {data.departments.map(d => {
          const admins = data.users.filter(u => u.active && u.role === 'admin' && (u.adminOf ?? []).includes(d.id));
          const members = data.users.filter(u => u.active && u.departmentIds.includes(d.id));
          return (
            <Card key={d.id} style={{ borderLeftWidth: 3, borderLeftColor: d.color }}>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <DeptTitle dep={d} />
                {canManage(d.id) && <Badge tone="accent" icon="shield-checkmark" label={t('common.youManage')} />}
              </View>
              <Text style={[s.small, { marginTop: 4 }]}>{admins.length ? t('departmentsScreen.admins', { names: admins.map(a => a.name).join(', ') }) : t('departmentsScreen.noAdmins', { owner: ownerName })}</Text>
              <Text style={s.small}>{t('departmentsScreen.roles', { roles: d.positions.map(p => roleName(d.id, p)).join(', ') })}</Text>
              <Text style={{ marginTop: 6, color: colors.text }}>{members.length ? t(members.length === 1 ? 'departmentsScreen.member' : 'departmentsScreen.members', { count: members.length, names: members.map(m => m.firstName).join(', ') }) : t('departmentsScreen.noMembers')}</Text>
            </Card>
          );
        })}
      </>}
    </Screen>
  );
}
