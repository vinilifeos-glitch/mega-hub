import { Pressable, Text, View } from 'react-native';
import { useMe } from '../../src/state/AppContext';
import { router } from 'expo-router';
import { SetlistPreview } from '../../src/screens/Setlist';
import { Button, DeptBadge, StatusBadge, Card, Icon, Empty, Screen, useStyles } from '../../src/components/ui';
import { isoToDdmm, todayIso } from '../../src/data/dates';
import { byCanon } from '../../src/data/rota';

/** One card per service; lists every role the person holds in it (canonical department + role order). */
export default function MyRota() {
  const s = useStyles();
  const { data, currentUser, t, fmtDate, roleName } = useMe();
  const today = todayIso();
  const services = data.services
    .filter(sv => sv.status !== 'draft' && sv.date >= today)
    .map(sv => ({ sv, roles: data.assignments.filter(a => a.serviceId === sv.id && a.userId === currentUser.id && data.departments.some(d => d.id === a.departmentId))
      .sort(byCanon(data, a => a.departmentId, a => a.position, (a, b) => a.index - b.index)) }))
    .filter(x => x.roles.length > 0)
    .sort((x, y) => (x.sv.date + x.sv.start).localeCompare(y.sv.date + y.sv.start));
  return (
    <Screen title={t('myRota.title')} subtitle={t('myRota.subtitle')}>
      {services.length === 0 && <Empty icon="calendar-clear-outline" text={t('myRota.empty')} />}
      {services.map(({ sv, roles }) => {
        const first = data.departments.find(d => d.id === roles[0].departmentId)!;
        const open = () => router.push(`/rota/${sv.id}` as any);
        return (
          <Card key={sv.id} style={{ borderLeftWidth: 3, borderLeftColor: first.color }}>
            <Pressable testID={`rota-card-${sv.id}`} accessibilityRole="button" accessibilityLabel={`${sv.title} · ${t('myRota.view')}`} onPress={open}>
              <Text style={s.h2}>{sv.title}</Text>
              <Text style={s.small}>{fmtDate(sv.date)} · {isoToDdmm(sv.date)} · {sv.start}–{sv.end}</Text>
              {sv.location ? <View style={[s.row, { flexWrap: 'nowrap', marginTop: 2 }]}><Icon name="location-outline" size={14} style={{ marginRight: 4 }} /><Text style={[s.small, { flexShrink: 1 }]}>{sv.location}</Text></View> : null}
              <View style={{ marginTop: 10 }}>
                {roles.map(a => { const dep = data.departments.find(d => d.id === a.departmentId)!; return (
                  <View key={a.id} testID={`rota-role-${a.id}`} style={[s.row, { flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }]}>
                    <Text style={[s.h2, { marginRight: 8 }]}>{roleName(dep.id, a.position)}</Text><DeptBadge dep={dep} />
                  </View>); })}
              </View>
              <View style={s.row}><StatusBadge status="assigned" /></View>
            </Pressable>
            <SetlistPreview service={sv} onOpen={() => router.navigate({ pathname: '/', params: { svc: sv.id } })} />
            <Button label={t('myRota.view')} outline onPress={open} testID={`rota-view-${sv.id}`} />
          </Card>
        );
      })}
    </Screen>
  );
}
