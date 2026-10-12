import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useMe } from '../state/AppContext';
import { SetlistPreview } from './Setlist';
import { Card, Empty, Icon, Screen, useColors, useStyles } from '../components/ui';
import { LiveButton, RotaRoleCard, RotaTeamCard } from '../components/rota';
import { isoToDdmm } from '../data/dates';
import { teamFor } from '../data/rota';
import { displayName } from '../display';

/** My Rota detail: service info, my roles, the team per department; setlist + Live only for Music people (data is already scoped). */
export function RotaView({ serviceId }: { serviceId: string }) {
  const s = useStyles(); const c = useColors(); const B = { fontSize: 15, color: c.text }; const { data, currentUser, t, fmtDate, deptName, roleName, canLive } = useMe();
  const back = { label: t('myRota.title'), onPress: () => router.navigate('/my-rota' as any) };
  const sv = data.services.find(x => x.id === serviceId);
  const mine = sv ? data.assignments.filter(a => a.serviceId === sv.id && a.userId === currentUser.id) : [];
  if (!sv || sv.status === 'draft' || mine.length === 0) return <Screen title={t('myRota.title')} backTo={back}><View testID="rota-view-missing"><Empty text={t('myRota.notFound')} /></View></Screen>;
  const team = teamFor(data, sv.id);
  const hasSetlist = (sv.setlist ?? []).length > 0;
  return (
    <Screen title={sv.title} backTo={back}>
      <View testID={`rota-detail-${sv.id}`}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <Icon name="calendar-outline" size={18} style={{ marginRight: 8 }} />
            <Text style={[B, { fontWeight: '700', flexShrink: 1 }]}>{fmtDate(sv.date)} · {isoToDdmm(sv.date)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: sv.location ? 6 : 0 }}>
            <Icon name="time-outline" size={18} style={{ marginRight: 8 }} />
            <Text style={B}>{sv.start}–{sv.end}</Text>
          </View>
          {sv.location ? <View style={{ flexDirection: 'row', alignItems: 'center' }}><Icon name="location-outline" size={18} style={{ marginRight: 8 }} /><Text testID="rota-location" style={[B, { flexShrink: 1 }]}>{sv.location}</Text></View> : null}
        </Card>
        <RotaRoleCard title={t('myRota.yourRoles')} roles={mine.flatMap(a => { const dep = data.departments.find(d => d.id === a.departmentId); return dep ? [{ dep, role: roleName(a.departmentId, a.position), testID: `rota-myrole-${a.id}` }] : []; })} />
        {mine.filter(a => !data.departments.some(d => d.id === a.departmentId)).map(a => <View key={a.id} testID={`rota-myrole-${a.id}`}><Text style={s.label}>{roleName(a.departmentId, a.position)}</Text></View>)}
        {team.map(g => (
          <RotaTeamCard key={g.departmentId} testID={`rota-team-${g.departmentId}`} title={`${t('myRota.team')} · ${deptName(g.departmentId)}`}
            rows={g.members.map(m => ({ role: roleName(g.departmentId, m.position), name: displayName({ username: m.username }).replace(/^@/, ''), suffix: m.userId === currentUser.id ? `(${t('myRota.you')})` : undefined, testID: `rota-member-${m.assignmentId}` }))} />))}
        {hasSetlist && <SetlistPreview service={sv} onOpen={() => router.navigate({ pathname: '/', params: { svc: sv.id } })} />}
        {hasSetlist && canLive(sv.id) && <LiveButton label={t('live.open')} onPress={() => router.push(`/live/${sv.id}` as any)} testID="rota-live-open" />}
      </View>
    </Screen>
  );
}
