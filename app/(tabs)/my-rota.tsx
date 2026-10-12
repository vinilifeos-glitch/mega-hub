import { Text, View } from 'react-native';
import { useMe } from '../../src/state/AppContext';
import { DeptBadge, StatusBadge, Card, Icon, deptIcon, Empty, Screen, useColors, useStyles } from '../../src/components/ui';
import { isoToDdmm, todayIso } from '../../src/data/dates';

export default function MyRota() {
  const colors = useColors(); const s = useStyles();
  const { data, currentUser, t, fmtDate, deptName, roleName } = useMe();
  const mine = data.assignments
    .filter(a => a.userId === currentUser.id)
    .map(a => ({ a, sv: data.services.find(x => x.id === a.serviceId), dep: data.departments.find(d => d.id === a.departmentId) }))
    .filter((x): x is { a: typeof x.a; sv: NonNullable<typeof x.sv>; dep: NonNullable<typeof x.dep> } => !!x.sv && x.sv.status !== 'draft' && !!x.dep && x.sv.date >= todayIso())
    .sort((x, y) => (x.sv.date + x.sv.start).localeCompare(y.sv.date + y.sv.start));
  return (
    <Screen title={t('myRota.title')} subtitle={t('myRota.subtitle')}>
      {mine.length === 0 && <Empty icon="calendar-clear-outline" text={t('myRota.empty')} />}
      {mine.map(({ a, sv, dep }) => (
        <Card key={a.id} style={{ borderLeftWidth: 3, borderLeftColor: dep.color }}>
          <Text style={s.h2}>{sv.title}</Text>
          <Text style={s.small}>{fmtDate(sv.date)} · {isoToDdmm(sv.date)} · {sv.start}–{sv.end}</Text>
          {sv.location ? <Text style={s.small}>{sv.location}</Text> : null}
          <Text style={[s.h2, { marginTop: 10, marginBottom: 6 }]}>{roleName(dep.id, a.position)}</Text>
          <View style={s.row}><DeptBadge dep={dep} /><StatusBadge status="assigned" /></View>
        </Card>
      ))}
    </Screen>
  );
}
