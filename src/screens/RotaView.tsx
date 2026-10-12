import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMe } from '../state/AppContext';
import { SetlistPreview } from './Setlist';
import { Button, Card, DeptBadge, Empty, Icon, Screen, StatusBadge, useStyles } from '../components/ui';
import { isoToDdmm } from '../data/dates';
import { teamFor } from '../data/rota';

/** My Rota detail: service info, my roles, the team per department; setlist + Live only for Music people (data is already scoped). */
export function RotaView({ serviceId }: { serviceId: string }) {
  const s = useStyles(); const { data, currentUser, t, fmtDate, deptName, roleName, canLive } = useMe();
  const back = { label: t('myRota.title'), onPress: () => router.navigate('/my-rota' as any) };
  const sv = data.services.find(x => x.id === serviceId);
  const mine = sv ? data.assignments.filter(a => a.serviceId === sv.id && a.userId === currentUser.id) : [];
  if (!sv || sv.status === 'draft' || mine.length === 0) return <Screen title={t('myRota.title')} backTo={back}><View testID="rota-view-missing"><Empty text={t('myRota.notFound')} /></View></Screen>;
  const team = teamFor(data, sv.id);
  const hasSetlist = (sv.setlist ?? []).length > 0;
  return (
    <Screen title={sv.title} subtitle={`${fmtDate(sv.date)} · ${isoToDdmm(sv.date)} · ${sv.start}–${sv.end}`} backTo={back}>
      <View testID={`rota-detail-${sv.id}`}>
        {sv.location ? <View style={[s.row, { flexWrap: 'nowrap' }]}><Icon name="location-outline" size={14} style={{ marginRight: 4 }} /><Text testID="rota-location" style={s.small}>{sv.location}</Text></View> : null}
        <Card>
          <Text style={s.h2}>{t('myRota.yourRoles')}</Text>
          {mine.map(a => { const dep = data.departments.find(d => d.id === a.departmentId); return (
            <View key={a.id} testID={`rota-myrole-${a.id}`} style={[s.row, { marginTop: 6 }]}>
              <Text style={s.label}>{roleName(a.departmentId, a.position)}</Text>
              {dep ? <DeptBadge dep={dep} /> : null}<StatusBadge status="assigned" />
            </View>); })}
        </Card>
        <Card>
          <Text style={s.h2}>{t('myRota.team')}</Text>
          {team.map(g => (
            <View key={g.departmentId} testID={`rota-team-${g.departmentId}`} style={{ marginTop: 8 }}>
              <Text style={s.label}>{deptName(g.departmentId)}</Text>
              {g.members.map(m => (
                <Text key={m.assignmentId} testID={`rota-member-${m.assignmentId}`} style={s.small}>
                  {roleName(g.departmentId, m.position)}: {m.name}{m.userId === currentUser.id ? ` (${t('myRota.you')})` : ''}
                </Text>))}
            </View>))}
        </Card>
        {hasSetlist && <SetlistPreview service={sv} onOpen={() => router.navigate({ pathname: '/', params: { svc: sv.id } })} />}
        {hasSetlist && canLive(sv.id) && <Button label={t('live.open')} onPress={() => router.push(`/live/${sv.id}` as any)} testID="rota-live-open" />}
      </View>
    </Screen>
  );
}
