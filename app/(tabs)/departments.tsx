import { Text, View } from 'react-native';
import { useMe } from '../../src/state/AppContext';
import { Card, Screen, colors, s } from '../../src/components/ui';
import { RolesView } from '../../src/screens/Profile';

export default function Departments() {
  const { data, canManage, currentUser } = useMe();
  const seesAll = currentUser.role !== 'volunteer';
  return (
    <Screen title="Departments" subtitle="Where you serve and the roles you hold.">
      <Text style={s.section}>My departments & roles</Text>
      <RolesView user={currentUser} />
      {currentUser.role !== 'owner' && <Text style={[s.small, { marginBottom: 8 }]}>Departments and roles are assigned by Vini (the owner).</Text>}
      {seesAll && <>
        <Text style={s.section}>All departments</Text>
        {data.departments.map(d => {
          const admins = data.users.filter(u => u.active && u.role === 'admin' && (u.adminOf ?? []).includes(d.id));
          const members = data.users.filter(u => u.active && u.departmentIds.includes(d.id));
          return (
            <Card key={d.id} style={{ borderLeftWidth: 3, borderLeftColor: d.color }}>
              <View style={[s.row, { justifyContent: 'space-between' }]}>
                <Text style={s.h2}>{d.emoji}  {d.name}</Text>
                {canManage(d.id) && <Text style={{ color: d.color, fontWeight: '600', fontSize: 12 }}>You manage</Text>}
              </View>
              <Text style={[s.small, { marginTop: 4 }]}>Admins: {admins.map(a => a.name).join(', ') || 'None yet (Vini covers)'}</Text>
              <Text style={s.small}>Roles: {d.positions.join(', ')}</Text>
              <Text style={{ marginTop: 6, color: colors.text }}>{members.length} people: {members.map(m => m.firstName).join(', ') || '—'}</Text>
            </Card>
          );
        })}
      </>}
    </Screen>
  );
}
