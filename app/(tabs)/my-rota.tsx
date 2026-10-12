import { Text, View } from 'react-native';
import { useMe } from '../../src/state/AppContext';
import { Card, Icon, deptIcon, Empty, Screen, s } from '../../src/components/ui';
import { isoToDdmm, todayIso } from '../../src/data/dates';

export default function MyRota() {
  const { data, currentUser, t, fmtDate, deptName, roleName } = useMe();
  const mine = data.assignments
    .filter(a => a.userId === currentUser.id)
    .map(a => ({ a, sv: data.services.find(x => x.id === a.serviceId), dep: data.departments.find(d => d.id === a.departmentId) }))
    .filter((x): x is { a: typeof x.a; sv: NonNullable<typeof x.sv>; dep: NonNullable<typeof x.dep> } => !!x.sv && !!x.dep && x.sv.date >= todayIso())
    .sort((x, y) => (x.sv.date + x.sv.start).localeCompare(y.sv.date + y.sv.start));
  return (
    <Screen title={t('myRota.title')} subtitle={t('myRota.subtitle')}>
      {mine.length === 0 && <Empty icon="calendar-clear-outline" text={t('myRota.empty')} />}
      {mine.map(({ a, sv, dep }) => (
        <Card key={a.id} style={{ borderLeftWidth: 3, borderLeftColor: dep.color }}>
          <Text style={s.h2}>{sv.title}</Text>
          <Text style={s.small}>{fmtDate(sv.date)} · {isoToDdmm(sv.date)} · {sv.start}–{sv.end}</Text>
          {sv.location ? <Text style={s.small}>{sv.location}</Text> : null}
          <View style={[s.row, { marginTop: 8 }]}><Icon name={deptIcon(dep.id)} size={18} color={dep.color} style={{ marginRight: 8 }} /><Text style={[s.h2, { color: dep.color }]}>{roleName(dep.id, a.position)}</Text></View>
          <Text style={s.small}>{deptName(dep.id)}</Text>
        </Card>
      ))}
    </Screen>
  );
}
