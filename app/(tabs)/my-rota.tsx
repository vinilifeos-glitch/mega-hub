import { Text } from 'react-native';
import { useApp } from '../../src/state/AppContext';
import { Card, Empty, Screen, formatDate, s } from '../../src/components/ui';

export default function MyRota() {
  const { data, currentUser } = useApp();
  const mine = data.assignments
    .filter(a => a.userId === currentUser.id)
    .map(a => ({ a, sv: data.services.find(x => x.id === a.serviceId)!, dep: data.departments.find(d => d.id === a.departmentId)! }))
    .sort((x, y) => x.sv.date.localeCompare(y.sv.date));
  return (
    <Screen title="My Rota" subtitle="Where you're serving">
      {mine.length === 0 && <Empty text="You're not on any rota yet. Make sure your availability is up to date!" />}
      {mine.map(({ a, sv, dep }) => (
        <Card key={a.id} style={{ borderLeftWidth: 5, borderLeftColor: dep.color }}>
          <Text style={s.small}>{formatDate(sv.date)} · {sv.time} · {sv.title}</Text>
          <Text style={[s.h2, { marginTop: 4 }]}>{dep.emoji} {a.position}</Text>
          <Text style={s.small}>{dep.name}</Text>
        </Card>
      ))}
    </Screen>
  );
}
