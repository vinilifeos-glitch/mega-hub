import { useState } from 'react';
import { Text, View } from 'react-native';
import { useMe } from '../../src/state/AppContext';
import { ChangePasswordScreen } from '../../src/screens/Auth';
import { Button, Card, Screen, colors, formatDate, s } from '../../src/components/ui';

const roleLabel = { owner: 'Owner', admin: 'Overall Admin', leader: 'Department Leader', volunteer: 'Volunteer' };

export default function Home() {
  const { data, currentUser, managedDepartments, signOut } = useMe();
  const next = data.services[0];
  const mine = data.assignments.filter(a => a.userId === currentUser.id);
  const filled = (depIds: string[]) => data.assignments.filter(a => a.serviceId === next?.id && depIds.includes(a.departmentId)).length;
  const slots = (depIds: string[]) => data.departments.filter(d => depIds.includes(d.id)).reduce((n, d) => n + d.positions.length, 0);
  const [changing, setChanging] = useState(false);
  if (changing) return <ChangePasswordScreen onDone={() => setChanging(false)} />;
  const myDeps = managedDepartments.map(d => d.id);

  return (
    <Screen title={`Hi, ${currentUser.name.split(' ')[0]} 👋`} subtitle={`${roleLabel[currentUser.role]} · @${currentUser.username}`}>

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
      {currentUser.role === 'volunteer' && currentUser.departmentIds.length === 0 && (
        <Card><Text style={s.small}>You haven't been added to a department yet. An admin will assign you soon.</Text></Card>
      )}
      <Button label="Change password" outline onPress={() => setChanging(true)} />
      <Button label="Sign out" color={colors.red} outline onPress={signOut} testID="signout" />
    </Screen>
  );
}
