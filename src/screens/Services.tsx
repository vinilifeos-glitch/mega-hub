import { useTabReset } from '../tabReset';
import { useLocalSearchParams, router } from 'expo-router';
import { SetlistCard } from './Setlist';
import { displayName } from '../display';
import { DateField } from '../components/DateField';
import { useEffect, useState } from 'react';
import { Alert, Modal, Platform, Pressable, Text, View } from 'react-native';
import { confirmAsk } from '../components/confirm';
import { PickerRow, PickerSectionLabel, BusyChoiceSheet } from '../components/rota';
import { pickStatus, sameRoleSlot } from '../data/rota';
import { formatDobInput, useMe } from '../state/AppContext';
import { awayOn, noteOn } from '../data/unavailability';
import { Badge, DeptBadge, StatusBadge, Button, DeptTitle, Icon, IconButton, deptIcon, Card, Chip, Empty, Field, Screen, Notice, useColors, useStyles } from '../components/ui';
import { Service, Slot } from '../types';
import { formatTimeInput, isoToDdmm, toIso, todayIso, upcomingSundayIso } from '../data/dates';


export const DEFAULT_LOCATION = '1 Main St, Farcet, Peterborough PE7 3AN';
const DOUBLE: Record<string, number> = { 'd-kids:Assistant': 2, 'd-music:Backing Vocals': 2, 'd-music:Assembly': 3 };

export function ServicesHome() {
  const colors = useColors(); const s = useStyles();
  const { data, currentUser, t, fmtDate, roleName } = useMe();
  const [view, setView] = useState<{ kind: 'detail' | 'edit'; id: string } | { kind: 'new' } | null>(null);
  useTabReset(() => { setView(null); setMsg(null); });
  const { svc } = useLocalSearchParams<{ svc?: string }>();
  useEffect(() => { if (svc) { setView({ kind: 'detail', id: svc }); router.setParams({ svc: undefined }); } }, [svc]);
  const [msg, setMsg] = useState<string | null>(null);
  const isOwner = currentUser.role === 'owner';
  if (view?.kind === 'new') return <ServiceForm onClose={(m, id) => { setMsg(m ?? null); setView(id ? { kind: 'detail', id } : null); }} />;
  if (view) {
    const sv = data.services.find(x => x.id === view.id);
    if (!sv) { setView(null); return null; }
    if (view.kind === 'edit') return <ServiceForm service={sv} onDeleted={m => { setMsg(m); setView(null); }} onClose={m => { setMsg(m ?? null); setView({ kind: 'detail', id: sv.id }); }} />;
    return <ServiceDetail service={sv} msg={msg} onBack={() => { setMsg(null); setView(null); }} onEdit={() => setView({ kind: 'edit', id: sv.id })} onDeleted={m => { setMsg(m); setView(null); }} />;
  }
  const upcoming = data.services.filter(x => x.date >= todayIso()).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return (
    <Screen title={t('services.title')} subtitle={t('services.greeting', { name: currentUser.firstName })}>
      {msg && <Notice text={msg} />}
      {isOwner && <Button label={t('services.newService')} onPress={() => { setMsg(null); setView({ kind: 'new' }); }} testID="new-service" />}
      <View style={{ height: 12 }} />
      {upcoming.length === 0 && <Empty text={isOwner ? t('services.emptyOwner') : t('services.empty')} />}
      {upcoming.map(sv => {
        const mine = data.assignments.filter(a => a.serviceId === sv.id && a.userId === currentUser.id);
        return (
          <Pressable key={sv.id} testID={`svc-${sv.date}`} onPress={() => { setMsg(null); setView({ kind: 'detail', id: sv.id }); }}>
            <Card style={sv.status === 'draft' ? { borderStyle: 'dashed', borderColor: colors.amber, borderWidth: 1.5, backgroundColor: colors.soft } : mine.length ? { borderColor: colors.primary, borderWidth: 1.5 } : undefined}>
              <View style={[s.row, { justifyContent: 'space-between' }]}><Text style={s.h2}>{sv.title}</Text>{sv.status === 'draft' && <StatusBadge status="draft" label={t('services.draft')} testID={`draft-badge-${sv.date}`} />}</View>
              <Text style={s.small}>{fmtDate(sv.date)} · {isoToDdmm(sv.date)} · {sv.start}–{sv.end}</Text>
              {sv.location ? <View style={[s.row, { flexWrap: 'nowrap', marginTop: 2 }]}><Icon name="location-outline" size={14} style={{ marginRight: 4 }} /><Text style={[s.small, { flexShrink: 1 }]}>{sv.location}</Text></View> : null}
              {mine.length > 0 && <View style={{ marginTop: 8 }}><StatusBadge status="assigned" label={t('services.youreServing', { roles: mine.map(a => roleName(a.departmentId, a.position)).join(', ') })} /></View>}
              <View style={[s.row, { marginTop: 8 }]}>
                {data.departments.map(d => {
                  const need = sv.slots.filter(z => z.departmentId === d.id).reduce((n, z) => n + z.count, 0);
                  if (!need) return null;
                  const got = data.assignments.filter(a => a.serviceId === sv.id && a.departmentId === d.id).length;
                  return got >= need ? <Badge key={d.id} tone="success" icon={deptIcon(d.id)} label={`${got}/${need}`} /> : <DeptBadge key={d.id} dep={d} label={`${got}/${need}`} />;
                })}
              </View>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}

function ServiceDetail({ service: sv, msg, onBack, onEdit, onDeleted }: { service: Service; msg: string | null; onBack: () => void; onEdit: () => void; onDeleted: (msg: string) => void }) {
  const colors = useColors(); const s = useStyles();
  const { data, currentUser, canManage, assign, unassign, whyBlocked, deleteService, publishService, t, fmtDate, deptName, roleName } = useMe();
  const [open, setOpen] = useState<string | null>(null); // slot key being filled
  const [err, setErr] = useState<string | null>(null);
  const [busyPick, setBusyPick] = useState<{ m: { firstName: string; username: string }; detail: string; run: (mode: 'double' | 'swap') => void } | null>(null);
  const isOwner = currentUser.role === 'owner';
  const draft = sv.status === 'draft';
  const del = () => confirmAsk(draft ? t('services.deleteDraft') : t('services.deleteConfirmTitle'), t(draft ? 'services.deleteDraftConfirm' : 'services.deleteConfirm', { title: sv.title, date: isoToDdmm(sv.date) }),
    t('common.delete'), t('common.cancel'), () => { deleteService(sv.id); onDeleted(draft ? t('services.draftDeleted') : t('services.deleted')); });
  const [pubMsg, setPubMsg] = useState<string | null>(null);
  return (
    <Screen title={sv.title} subtitle={`${fmtDate(sv.date)} · ${isoToDdmm(sv.date)} · ${sv.start}–${sv.end}${sv.location ? ` · ${sv.location}` : ''}`} backTo={{ label: t('services.title'), onPress: onBack }}>
      {msg && <Notice text={msg} />}
      {pubMsg && <Notice text={pubMsg} />}
      {draft && <View style={[s.row, { marginBottom: 8 }]}><StatusBadge status="draft" label={t('services.draft')} testID="draft-badge" /><Text style={[s.small, { marginLeft: 8, flex: 1 }]}>{t('services.draftHint')}</Text></View>}
      {err && <Notice tone="error" text={err} />}
      <Modal visible={!!busyPick} transparent animationType="fade" onRequestClose={() => setBusyPick(null)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.4)' }}>
          {busyPick && <BusyChoiceSheet name={busyPick.m.username} detail={busyPick.detail} onDouble={() => busyPick.run('double')} onSwap={() => busyPick.run('swap')} onCancel={() => setBusyPick(null)}
            testIDs={{ root: 'busy-sheet', double: 'busy-double', swap: 'busy-swap', cancel: 'busy-cancel' }} />}
        </View>
      </Modal>
      {data.departments.map(d => {
        const slots = sv.slots.filter(z => z.departmentId === d.id);
        if (!slots.length) return null;
        const manage = canManage(d.id);
        const members = data.users.filter(u => u.active && u.departmentIds.includes(d.id));
        return (
          <Card key={d.id} style={{ borderLeftWidth: 3, borderLeftColor: d.color }}>
            <DeptTitle dep={d} />
            {!manage && <Text style={s.small}>{t('common.viewOnly')}</Text>}
            {slots.flatMap(sl => Array.from({ length: sl.count }, (_, i) => {
              const key = `${sv.id}:${d.id}:${sl.position}:${i}`;
              const a = data.assignments.find(x => x.id === key);
              const who = data.users.find(u => u.id === a?.userId);
              const me = who?.id === currentUser.id;
              const holders = members.filter(m => (m.positions?.[d.id] ?? []).includes(sl.position));
              return (
                <View key={key} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 8 }}>
                  <View style={[s.row, { justifyContent: 'space-between' }]}>
                    <Text style={{ fontWeight: '600', color: colors.text }}>{roleName(d.id, sl.position)}{sl.count > 1 ? ` ${i + 1}` : ''}</Text>
                    <View style={s.row}>
                      {who ? <View style={[s.row, { flexWrap: 'nowrap', flexShrink: 1 }]}><Icon name="checkmark-circle" size={16} color={me ? colors.primary : colors.green} style={{ marginRight: 4 }} /><Text style={{ color: me ? colors.primary : colors.text, fontWeight: me ? '800' : '600', flexShrink: 1 }}>{`${displayName(who)}${me ? ` ${t('common.you')}` : ''}`}</Text></View> : <View style={{ marginTop: 4 }}><StatusBadge status="open" label={t('common.unfilled')} /></View>}
                      {manage && <Pressable testID={`slot-${d.id}-${sl.position}-${i}`} onPress={() => { setErr(null); setOpen(open === key ? null : key); }}><Text style={{ color: colors.primary, fontWeight: '700', marginLeft: 10 }}>{who ? t('common.change') : t('common.fill')}</Text></Pressable>}
                    </View>
                  </View>
                  {open === key && (() => {
                    const rows = holders.filter(m => m.id !== who?.id).map(m => {
                      const away = awayOn(m, sv.date); const same = sameRoleSlot(data.assignments.filter(z => z.serviceId === sv.id), m.id, d.id, sl.position, key);
                      const st = away ? 'away' as const : same ? 'same' as const : pickStatus(data.assignments, sv.id, m.id, key, away);
                      const other = data.assignments.find(z => z.serviceId === sv.id && z.userId === m.id && z.id !== key);
                      const detail = st === 'same' ? t('services.alreadyInRole') : st === 'away' ? (noteOn(m, sv.date) ?? t('rota.away')) : st === 'busy' && other ? t('services.alsoServingAs', { role: data.assignments.filter(z => z.serviceId === sv.id && z.userId === m.id && z.id !== key).map(z => `${deptName(z.departmentId)} · ${roleName(z.departmentId, z.position)}`).join(', ') }) : undefined;
                      return { m, st, detail };
                    });
                    const pick = (m: typeof holders[number], mode?: 'double' | 'swap') => { const e = assign(sv.id, d.id, sl.position, i, m.id, mode); setErr(e); setBusyPick(null); if (!e) setOpen(null); };
                    return (
                      <View testID={`picker-${key}`} style={{ marginTop: 8 }}>
                        {holders.length === 0 && <Text style={s.small}>{t('services.nobodyHoldsDept', { dept: deptName(d.id), role: roleName(d.id, sl.position) })}</Text>}
                        {(['free', 'busy', 'away', 'same'] as const).map(k => { const g = rows.filter(r => r.st === k); if (!g.length) return null; return (
                          <View key={k} testID={`pick-section-${k}`}>
                            {k !== 'same' && <PickerSectionLabel kind={k} count={g.length} />}
                            {g.map(r => <PickerRow key={r.m.id} name={displayName(r.m).replace(/^@/, '')} status={k === 'same' ? 'away' : k} detail={r.detail} testID={`pick-${k}-${r.m.username}`}
                              onPress={k === 'free' ? () => pick(r.m) : k === 'busy' ? () => setBusyPick({ m: r.m, detail: r.detail ?? '', run: (mode: 'double' | 'swap') => pick(r.m, mode) }) : undefined} />)}
                          </View>); })}
                        {a && <Chip label={t('common.clear')} color={colors.red} onPress={() => { unassign(a.id); setOpen(null); }} testID="pick-clear" />}
                      </View>
                    );
                  })()}
                </View>
              );
            }))}
          </Card>
        );
      })}
      <SetlistCard service={sv} />
      <View style={[s.row, { marginTop: 4, marginBottom: 4 }]}>{([['checkmark-circle-outline', t('services.legendAvailable')], ['close-circle-outline', t('services.legendAway')], ['time-outline', t('services.legendBusy')]] as const).map(([n, l]) => <View key={l} style={[s.row, { marginRight: 16, marginBottom: 4 }]}><Icon name={n} size={16} style={{ marginRight: 4 }} /><Text style={s.small}>{l}</Text></View>)}</View>
      <Text style={s.small}>{t('services.onlyHolders')}</Text>
      {isOwner && draft && <Button label={t('services.publish')} onPress={() => { publishService(sv.id); setPubMsg(t('services.published')); }} testID="publish-service" />}
      {isOwner && <Button label={t('services.editService')} outline onPress={onEdit} testID="edit-service" />}
      {isOwner && <Button label={draft ? t('services.deleteDraft') : t('services.deleteService')} danger onPress={del} testID={draft ? 'delete-draft' : 'delete-service'} />}
    </Screen>
  );
}

type Row = { id: string; dep: string; role: string; assigneeId?: string };
let rowSeq = 0;
const newRowId = () => `r${++rowSeq}`;

function ServiceForm({ service, onClose, onDeleted }: { service?: Service; onClose: (msg?: string, id?: string) => void; onDeleted?: (msg: string) => void }) {
  const colors = useColors(); const s = useStyles();
  const { data, saveService, deleteService, canManage, t, deptName, roleName } = useMe();
  const [title, setTitle] = useState(service?.title ?? t('services.defaultName'));
  const [location, setLocation] = useState(service?.location ?? DEFAULT_LOCATION);
  const [date, setDate] = useState(isoToDdmm(service?.date ?? upcomingSundayIso()));
  const [start, setStart] = useState(service?.start ?? '16:00');
  const [end, setEnd] = useState(service?.end ?? '21:00');
  // Form state: flat list of slot rows; converted back to Slot[] + picks on save (data shape unchanged)
  const [rows, setRows] = useState<Row[]>(() => {
    const src: Slot[] = service?.slots ?? data.departments.flatMap(d => d.positions.map(p => ({ departmentId: d.id, position: p, count: DOUBLE[`${d.id}:${p}`] ?? 1 })));
    const asg = data.assignments.filter(a => a.serviceId === service?.id);
    return src.flatMap(z => Array.from({ length: z.count }, (_, i) => ({ id: newRowId(), dep: z.departmentId, role: z.position,
      assigneeId: asg.find(a => a.departmentId === z.departmentId && a.position === z.position && a.index === i)?.userId })));
  });
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openPick, setOpenPick] = useState<string | null>(null);
  const [openAdd, setOpenAdd] = useState<string | null>(null);
  const [openDept, setOpenDept] = useState<string | null>(null);
  const iso = toIso(date);
  const userById = (id: string) => data.users.find(u => u.id === id);
  const addSlot = (dep: string, role: string) => { if (canManage(dep)) setRows(r => [...r, { id: newRowId(), dep, role }]); };
  const removeSlot = (id: string) => setRows(r => r.filter(x => x.id !== id || !canManage(x.dep)));
  const assign = (slotId: string, userId: string | null) => setRows(r => r.map(x => x.id === slotId && canManage(x.dep) ? { ...x, assigneeId: userId ?? undefined } : x));
  const [formBusy, setFormBusy] = useState<{ u: { username: string }; detail: string; run: (mode: 'double' | 'swap') => void } | null>(null);
  const awayHolders = (slotId: string) => { const row = rows.find(x => x.id === slotId); if (!row) return [];
    return data.users.filter(u => u.active && u.departmentIds.includes(row.dep) && (u.positions?.[row.dep] ?? []).includes(row.role) && awayOn(u, iso)); };
  const eligibleFor = (slotId: string) => {
    const row = rows.find(x => x.id === slotId); if (!row) return [];
    return data.users.filter(u => u.active && u.departmentIds.includes(row.dep) && (u.positions?.[row.dep] ?? []).includes(row.role)
      && !awayOn(u, iso));
  };
  // drop picks that became unavailable when the date changes
  useEffect(() => {
    const bad: string[] = [];
    const next = rows.map(x => { const u = x.assigneeId ? userById(x.assigneeId) : undefined;
      if (u && awayOn(u, iso)) { bad.push(`${displayName(u)} (${roleName(x.dep, x.role)})`); return { ...x, assigneeId: undefined }; } return x; });
    if (bad.length) { setRows(next); setNotice(t('services.removedPicks', { names: bad.join(', ') })); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso]);
  const isDraftSv = service?.status === 'draft';
  const save = (status: 'draft' | 'published') => {
    if (!iso) return setErr(t('errors.dateInvalid'));
    if (!service && iso < todayIso()) return setErr(t('errors.datePast'));
    const slots: Slot[] = []; const pk: { departmentId: string; position: string; index: number; userId: string }[] = [];
    for (const d of data.departments) for (const p of [...d.positions, ...rows.filter(x => x.dep === d.id && !d.positions.includes(x.role)).map(x => x.role)].filter((v, i, a) => a.indexOf(v) === i)) {
      const rs = rows.filter(x => x.dep === d.id && x.role === p);
      if (!rs.length) continue;
      slots.push({ departmentId: d.id, position: p, count: rs.length });
      rs.forEach((x, i) => { if (x.assigneeId) pk.push({ departmentId: d.id, position: p, index: i, userId: x.assigneeId }); });
    }
    const e = saveService(service?.id ?? null, { title, location, date: iso, start, end, slots, status }, pk);
    if (e) return setErr(e);
    onClose(status === 'draft' ? t('services.draftSaved') : isDraftSv ? t('services.published') : service ? t('services.updated') : t('services.created'));
  };
  return (
    <Screen title={service ? t('services.editService') : t('services.newService')} subtitle={t('services.formSubtitle')}>
      <Modal visible={!!formBusy} transparent animationType="fade" onRequestClose={() => setFormBusy(null)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.4)' }}>
          {formBusy && <BusyChoiceSheet name={formBusy.u.username} detail={formBusy.detail} onDouble={() => formBusy.run('double')} onSwap={() => formBusy.run('swap')} onCancel={() => setFormBusy(null)}
            testIDs={{ root: 'busy-sheet', double: 'busy-double', swap: 'busy-swap', cancel: 'busy-cancel' }} />}
        </View>
      </Modal>
      <Card>
        <Field label={t('fields.name')} value={title} onChangeText={setTitle} autoCapitalize="words" testID="sv-title" />
        <Field label={t('fields.location')} value={location} onChangeText={setLocation} autoCapitalize="words" placeholder={t('fields.locationPlaceholder')} testID="sv-location" />
        <DateField label={t('fields.date')} limit={service ? undefined : 'future'} value={date} onChange={setDate} testID="sv-date" />
        <View style={[s.row, { flexWrap: 'nowrap' }]}>
          <View style={{ flex: 1, marginRight: 8 }}><Field label={t('fields.start')} value={start} keyboardType="number-pad" maxLength={5} onChangeText={v => setStart(formatTimeInput(v))} testID="sv-start" /></View>
          <View style={{ flex: 1 }}><Field label={t('fields.end')} value={end} keyboardType="number-pad" maxLength={5} onChangeText={v => setEnd(formatTimeInput(v))} testID="sv-end" /></View>
        </View>
      </Card>
      <Text style={s.section}>{t('services.slotsAndPeople')}</Text>
      <Text style={[s.small, { marginBottom: 8 }]}>{t('services.assignHint', { date: iso ? isoToDdmm(iso) : t('services.thatDate') })}</Text>
      {notice && <Card style={{ backgroundColor: colors.amberSoft, borderColor: colors.amberSoft }}><Text testID="sv-notice" style={{ color: colors.text }}>{notice}</Text></Card>}
      {data.departments.map(d => {
        const mine = rows.filter(x => x.dep === d.id);
        const manage = canManage(d.id);
        const open = openDept === d.id;
        return (
          <Card key={d.id} style={{ borderLeftWidth: 3, borderLeftColor: d.color, opacity: manage ? 1 : 0.6 }}>
            <Pressable testID={`dept-toggle-${d.id}`} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={t('services.slotsA11y', { dept: deptName(d.id) })} onPress={() => setOpenDept(open ? null : d.id)} style={[s.row, { justifyContent: 'space-between', flexWrap: 'nowrap', minHeight: 44 }]}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <DeptTitle dep={d} />
                <View style={{ marginTop: 8, marginLeft: 42 }} testID={`dept-status-${d.id}`}>
                  <Badge tone={mine.length && mine.every(x => x.assigneeId) ? 'success' : mine.some(x => x.assigneeId) ? 'warning' : 'neutral'} icon={mine.length && mine.every(x => x.assigneeId) ? 'checkmark-circle' : 'ellipse-outline'}
                    label={`${mine.length ? t('services.assignedCount', { n: mine.filter(x => x.assigneeId).length, total: mine.length }) : t('services.noSlots')}${manage ? '' : ` · ${t('common.viewOnly')}`}`} />
                </View>
              </View>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} /></View>
            </Pressable>
            {open && mine.map(x => {
              const same = mine.filter(y => y.role === x.role); const n = same.indexOf(x);
              const who = x.assigneeId ? userById(x.assigneeId) : undefined;
              const opts = eligibleFor(x.id);
              return (
                <View key={x.id} testID={`row-${d.id}-${x.role}-${n}`} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 6, minHeight: 56, justifyContent: 'center' }}>
                  <View style={[s.row, { flexWrap: 'nowrap', alignItems: 'center' }]}>
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.text, marginRight: 8 }} numberOfLines={2}>{roleName(d.id, x.role)}{same.length > 1 ? ` ${n + 1}` : ''}</Text>
                    <Pressable testID={`fp-${d.id}-${x.role}-${n}`} disabled={!manage} onPress={() => setOpenPick(openPick === x.id ? null : x.id)}
                      accessibilityRole="button" accessibilityState={{ expanded: openPick === x.id }} accessibilityLabel={`${roleName(d.id, x.role)}: ${who ? displayName(who) : t('ui.assignPlaceholder')}`}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', minHeight: 40, maxWidth: '55%', borderWidth: 1, borderColor: who ? colors.primary : colors.border, backgroundColor: openPick === x.id || pressed ? colors.soft : who ? colors.primarySoft : colors.card, borderRadius: 999, paddingLeft: 14, paddingRight: 10 })}>
                      <Text numberOfLines={1} style={{ flexShrink: 1, color: who ? colors.primaryText : colors.muted, fontWeight: who ? '700' : '500', fontSize: 14 }}>{who ? displayName(who) : t('ui.assignPlaceholder')}</Text>
                      <Icon name={openPick === x.id ? 'chevron-up' : 'chevron-down'} size={14} color={who ? colors.primaryText : colors.muted} style={{ marginLeft: 6 }} />
                    </Pressable>
                    {manage && <IconButton testID={`rm-${d.id}-${x.role}-${n}`} icon="remove-circle-outline" label={t('services.removeSlot')} color={colors.red} onPress={() => removeSlot(x.id)} style={{ marginLeft: 4 }} />}
                  </View>
                  {openPick === x.id && manage && <View style={[s.row, { marginTop: 8 }]}>
                    {opts.length === 0 && <Text style={s.small}>{t('services.noneAvailable')}</Text>}
                    {opts.map(u => {
                      const others = u.id === who?.id ? [] : rows.filter(r => r.id !== x.id && r.assigneeId === u.id);
                      const sameR = others.find(r => r.dep === x.dep && r.role === x.role);
                      if (sameR) return <Chip key={u.id} testID={`fpick-same-${u.username}`} label={`${displayName(u)} · ${t('services.alreadyInRole')}`} color={colors.subtle} icon="remove-circle-outline" />;
                      if (others.length) { const detail = others.map(r => `${deptName(r.dep)} · ${roleName(r.dep, r.role)}`).join(', ');
                        return <Chip key={u.id} testID={`fpick-busy-${u.username}`} label={`${displayName(u)} · ${t('services.alsoServingAs', { role: detail })}`} color={colors.amber} icon="time-outline"
                          onPress={() => setFormBusy({ u, detail, run: mode => { setRows(r => r.map(z => z.id === x.id && canManage(z.dep) ? { ...z, assigneeId: u.id } : mode === 'swap' && z.assigneeId === u.id && z.id !== x.id ? { ...z, assigneeId: undefined } : z)); setFormBusy(null); setOpenPick(null); setNotice(null); } })} />; }
                      return <Chip key={u.id} testID={`fpick-${u.username}`} label={displayName(u)} color={d.color} active={who?.id === u.id}
                        onPress={() => { assign(x.id, u.id); setOpenPick(null); setNotice(null); }} />; })}
                    {awayHolders(x.id).map(u => <Chip key={u.id} testID={`fpick-away-${u.username}`} label={`${displayName(u)} · ${(iso ? noteOn(u, iso) : null) ?? t('rota.away')}`} color={colors.red} icon="close-circle-outline" />)}
                    {who && <Chip label={t('services.leaveUnfilled')} color={colors.red} onPress={() => { assign(x.id, null); setOpenPick(null); }} />}
                  </View>}
                </View>
              );
            })}
            {open && manage && <>
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 2, paddingTop: 8 }}>
                <Pressable testID={`add-role-${d.id}`} accessibilityRole="button" accessibilityState={{ expanded: openAdd === d.id }} onPress={() => setOpenAdd(openAdd === d.id ? null : d.id)}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: pressed ? colors.soft : 'transparent' })}>
                  <Icon name="add" size={18} color={colors.primaryText} style={{ marginRight: 6 }} />
                  <Text style={{ color: colors.primaryText, fontWeight: '700', fontSize: 15 }}>{t('ui.addRole')}</Text>
                </Pressable>
              </View>
              {openAdd === d.id && <View style={[s.row, { marginTop: 6 }]}>{d.positions.map(p => <Chip key={p} testID={`sl-add-${d.id}-${p}`} label={`+ ${roleName(d.id, p)}`} color={d.color} onPress={() => { addSlot(d.id, p); setOpenAdd(null); }} />)}</View>}
            </>}
          </Card>
        );
      })}
      {err && <Notice tone="error" text={err} />}
      <Button label={!service ? t('services.createService') : isDraftSv ? t('services.publish') : t('services.saveService')} onPress={() => save('published')} testID="sv-save" />
      {(!service || isDraftSv) && <Button label={t('services.saveDraft')} outline onPress={() => save('draft')} testID="sv-save-draft" />}
      {isDraftSv && <Button label={t('services.deleteDraft')} danger testID="sv-delete-draft" onPress={() => confirmAsk(t('services.deleteDraft'), t('services.deleteDraftConfirm', { title: service!.title, date: isoToDdmm(service!.date) }), t('common.delete'), t('common.cancel'), () => { deleteService(service!.id); onDeleted?.(t('services.draftDeleted')); })} />}
      <Button label={t('common.cancel')} outline onPress={() => onClose()} />
    </Screen>
  );
}
