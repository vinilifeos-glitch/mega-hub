import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { useMe } from '../../src/state/AppContext';
import { router } from 'expo-router';
import { SetlistPreview } from '../../src/screens/Setlist';
import { Button, DeptBadge, StatusBadge, Card, Icon, Empty, Screen, Notice, useStyles, useColors } from '../../src/components/ui';
import { isoToDdmm, todayIso } from '../../src/data/dates';
import { byCanon } from '../../src/data/rota';
import { showLocalOsNotification, pushSupported } from '../../src/data/push';
import type { AckStatus } from '../../src/types';

const FOUR_H = 4 * 60 * 60 * 1000;
/** Local (this device) last OS banner time per service — avoids spamming while the app is open. */
const lastLocalNotice: Record<string, number> = {};

/** One card per service; lists every role the person holds in it (canonical department + role order). */
export default function MyRota() {
  const colors = useColors();
  const s = useStyles();
  const { data, currentUser, t, fmtDate, roleName, getRotaAck, acknowledgeRota, refreshData, enablePush } = useMe();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<{ serviceId: string; step: 'choose' | 'unavail' } | null>(null);
  const today = todayIso();
  const services = data.services
    .filter(sv => sv.status !== 'draft' && sv.date >= today)
    .map(sv => ({ sv, roles: data.assignments.filter(a => a.serviceId === sv.id && a.userId === currentUser.id && data.departments.some(d => d.id === a.departmentId))
      .sort(byCanon(data, a => a.departmentId, a => a.position, (a, b) => a.index - b.index)) }))
    .filter(x => x.roles.length > 0)
    .sort((x, y) => (x.sv.date + x.sv.start).localeCompare(y.sv.date + y.sv.start));

  const pending = services.filter(({ sv }) => getRotaAck(sv.id) === 'pending');

  const pendingIds = pending.map(p => p.sv.id).join(',');
  // While the app is open: OS banner for pending rotas at most every 4h (per service).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const tick = () => {
      const now = Date.now();
      for (const { sv } of pending) {
        const last = lastLocalNotice[sv.id] ?? 0;
        if (now - last < FOUR_H) continue;
        if (showLocalOsNotification(t('common.appName'), `${sv.title} · ${fmtDate(sv.date)} — ${t('myRota.pending')}`, `rota-${sv.id}`)) {
          lastLocalNotice[sv.id] = now;
        }
      }
    };
    tick();
    const id = setInterval(tick, 60 * 1000);
    return () => clearInterval(id);
  }, [pendingIds]);

  const borderFor = (st: AckStatus) => st === 'acknowledged' ? colors.green : st === 'unavailable' ? colors.red : colors.amber;
  const badgeFor = (st: AckStatus) => st;

  const doAck = (serviceId: string, status: 'acknowledged' | 'unavailable') => {
    const e = acknowledgeRota(serviceId, status);
    setSheet(null);
    if (e) setMsg(e); else setMsg(status === 'acknowledged' ? t('myRota.ackSaved') : t('myRota.unavailSaved'));
  };

  const onEnablePush = async () => {
    setBusy(true);
    const r = await enablePush();
    setBusy(false);
    setMsg(r === 'ok' ? t('myRota.noticesOn') : r === 'denied' ? t('myRota.noticesDenied') : r === 'unsupported' ? t('myRota.noticesUnsupported') : r === 'no-vapid' ? t('myRota.noticesNoKey') : t('myRota.noticesUnsupported'));
  };

  return (
    <Screen title={t('myRota.title')} subtitle={t('myRota.subtitle')}>
      {msg && <Notice text={msg} />}
      <View style={[s.row, { marginBottom: 8, flexWrap: 'wrap' }]}>
        <Button label={t('myRota.refresh')} outline onPress={async () => { setBusy(true); await refreshData(); setBusy(false); }} testID="rota-refresh" />
        {Platform.OS === 'web' && pushSupported() && <Button label={t('myRota.enableNotices')} outline onPress={onEnablePush} testID="rota-enable-push" />}
      </View>
      {services.length === 0 && <Empty icon="calendar-clear-outline" text={t('myRota.empty')} />}
      {services.map(({ sv, roles }) => {
        const st = getRotaAck(sv.id);
        const open = () => router.push(`/rota/${sv.id}` as any);
        return (
          <Card key={sv.id} style={{ borderLeftWidth: 4, borderLeftColor: borderFor(st), backgroundColor: st === 'acknowledged' ? colors.greenSoft : st === 'pending' ? colors.amberSoft : undefined }}>
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
              <View style={s.row}><StatusBadge status={badgeFor(st)} label={t(`myRota.${st}`)} testID={`rota-ack-${sv.id}`} /></View>
            </Pressable>
            <SetlistPreview service={sv} onOpen={() => router.navigate({ pathname: '/', params: { svc: sv.id } })} />
            {st === 'pending' && <Button label={t('myRota.acknowledge')} onPress={() => setSheet({ serviceId: sv.id, step: 'choose' })} testID={`rota-ack-btn-${sv.id}`} />}
            <Button label={t('myRota.view')} outline onPress={open} testID={`rota-view-${sv.id}`} />
          </Card>
        );
      })}

      <Modal visible={!!sheet} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.scrim }}>
          {sheet?.step === 'choose' && (
            <View testID="ack-sheet" accessibilityRole="alert" style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, maxWidth: 420, width: '100%', alignSelf: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8 }}>{t('myRota.ackTitle')}</Text>
              <Text style={{ fontSize: 15, color: colors.muted, marginBottom: 12 }}>{t('myRota.ackMsg')}</Text>
              <Button label={t('myRota.confirmAck')} testID="ack-confirm" onPress={() => doAck(sheet.serviceId, 'acknowledged')} />
              <Button label={t('myRota.notAvailable')} outline testID="ack-unavailable" onPress={() => setSheet({ ...sheet, step: 'unavail' })} />
              <Button label={t('myRota.cancel')} outline onPress={() => setSheet(null)} testID="ack-cancel" />
            </View>
          )}
          {sheet?.step === 'unavail' && (
            <View testID="unavail-sheet" accessibilityRole="alert" style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, maxWidth: 420, width: '100%', alignSelf: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8 }}>{t('myRota.unavailTitle')}</Text>
              <Text style={{ fontSize: 15, color: colors.muted, marginBottom: 12 }}>{t('myRota.unavailMsg')}</Text>
              <Button label={t('myRota.confirmUnavail')} danger testID="unavail-confirm" onPress={() => doAck(sheet.serviceId, 'unavailable')} />
              <Button label={t('myRota.cancel')} outline onPress={() => setSheet(null)} testID="unavail-cancel" />
            </View>
          )}
        </View>
      </Modal>
    </Screen>
  );
}
