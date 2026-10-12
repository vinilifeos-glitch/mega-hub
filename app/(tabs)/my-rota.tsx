import { Text } from 'react-native';
import { useMe } from '../../src/state/AppContext';
import { Card, Empty, Screen, formatDate, s } from '../../src/components/ui';
import { isoToDdmm, todayIso } from '../../src/data/dates';

export default function MyRota() {
  const { data, currentUser } = useMe();
  const mine = data.assignments
    .filter(a => a.userId === currentUser.id)
    .map(a => ({ a, sv: data.services.find(x => x.id === a.serviceId), dep: data.departments.find(d => d.id === a.departmentId) }))
    .filter((x): x is { a: typeof x.a; sv: NonNullable<typeof x.sv>; dep: NonNullable<typeof x.dep> } => !!x.sv && !!x.dep && x.sv.date >= todayIso())
    .sort((x, y) => (x.sv.date + x.sv.start).localeCompare(y.sv.date + y.sv.start));
  return (
    <Screen title="My Rota" subtitle="Where you're serving">
      {mine.length === 0 && <Empty text="You're not on any rota yet. Keep your unavailable dates up to date!" />}
      {mine.map(({ a, sv, dep }) => (
        <Card key={a.id} style={{ borderLeftWidth: 5, borderLeftColor: dep.color }}>
          <Text style={s.h2}>{sv.title}</Text>
          <Text style={s.small}>{formatDate(sv.date)} · {isoToDdmm(sv.date)} · {sv.start}–{sv.end}</Text>
          {sv.location ? <Text style={s.small}>📍 {sv.location}</Text> : null}
          <Text style={[s.h2, { marginTop: 6, color: dep.color }]}>{dep.emoji} {a.position}</Text>
          <Text style={s.small}>{dep.name}</Text>
        </Card>
      ))}
    </Screen>
  );
}
