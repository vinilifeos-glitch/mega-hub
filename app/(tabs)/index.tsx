import { Text, View } from 'react-native';
import { useApp } from '../../src/state/AppContext';
import { Card, Chip, Screen, colors, formatDate, s } from '../../src/components/ui';

const roleLabel = { admin: 'Overall Admin', leader: 'Department Leader', volunteer: 'Volunteer' };

export default function Home() {
  const { data, currentUser, setCurrentUserId, managedDepartments } = useApp();
  const next = data.services[0];
  const mine = data.assignments.filter(a => a.userId === currentUser.id);
  const filled = (depIds: string[]) => data.assignments.filter(a => a.serviceId === next?.id && depIds.includes(a.departmentId)).length;
  const slots = (depIds: string[]) => data.departments.filter(d => depIds.includes(d.id)).reduce((n, d) => n + d.positions.length, 0);
  const myDeps = managedDepartments.map(d => d.id);

  return (
    <Screen title={`Hi, ${currentUser.name.split(' ')[0]} 👋`} subtitle={roleLabel[currentUser.role]}>
      <Card style={{ backgroundColor: '#EEE9FF', borderColor: '#D9CFFF' }}>
        <Text style={s.h2}>Demo: switch user</Text>
        <Text style={[s.small, { marginBottom: 10 }]}>Preview the app as different people (sign-in comes later).</Text>
        <View style={s.row}>
          {data.users.map(u => (
            <Chip key={u.id} label={`${u.name.split(' ')[0]} · ${u.role}`} active={u.id === currentUser.id} onPress={() => setCurrentUserId(u.id)} />
          ))}
        </View>
      </Card>

      {next && (
        <Card>
          <Text style={s.section}>Next up</Text>
          <Text style={s.h2}>{next.title}</Text>
          <Text style={s.small}>{formatDate(next.date)} · {next.time}</Text>
          {currentUser.role !== 'volunteer' && (
            <Text style={{ marginTop: 8, color: colors.primary, fontWeight: '600' }}>
              {filled(myDeps)} / {slots(myDeps)} rota slots filled{currentUser.role === 'leader' ? ' in your department' : ''}
            </Text>
          )}
        </Card>
      )}

      {currentUser.departmentIds.length > 0 && (
        <Card>
          <Text style={s.section}>You're serving</Text>
          <Text style={s.h2}>{mine.length} upcoming {mine.length === 1 ? 'slot' : 'slots'}</Text>
          <Text style={s.small}>Check “My Rota”, and keep your availability up to date.</Text>
        </Card>
      )}
    </Screen>
  );
}
