import React from 'react';
import { useTabReset } from '../tabReset';
import { useLocalSearchParams, router } from 'expo-router';
import { SetlistCard } from './Setlist';
import { AssemblyNoteCard } from './AssemblyNote';
import { ServiceLessonsCard } from './ServiceLessons';
import { leaveGuarded, useUnsavedGuard } from '../unsaved';
import { displayName } from '../display';
import { DateField } from '../components/DateField';
import { useEffect, useState } from 'react';
import { Alert, Modal, Platform, Pressable, Text, View } from 'react-native';
import { confirmAsk } from '../components/confirm';
import { PickerRow, PickerSectionLabel, BusyChoiceSheet } from '../components/rota';
import { pickStatus, sameRoleSlot, roleIdx, planAssign } from '../data/rota';
import { formatDobInput, useMe } from '../state/AppContext';
import { awayOn, noteOn } from '../data/unavailability';
import { Badge, CollapsibleCard, DeptBadge, StatusBadge, Button, DeptTitle, Icon, IconButton, deptIcon, Card, Chip, Empty, Field, Screen, Notice, useColors, useStyles } from '../components/ui';
import { Assignment, Service, SetlistItem, Slot } from '../types';
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
    if (view.kind === 'edit') { setView({ kind: 'detail', id: sv.id }); return null; } // separate edit screen retired: details are edited inline
    return <ServiceDetail service={sv} msg={msg} onBack={m => { setMsg(m ?? null); setView(null); }} onDeleted={m => { setMsg(m); setView(null); }} />;
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

function ServiceDetail({ service: sv, msg, onBack, onDeleted }: { service: Service; msg: string | null; onBack: (msg?: string) => void; onDeleted: (msg: string) => void }) {
  const colors = useColors(); const s = useStyles();
  const { data, currentUser, canManage, saveServiceEdits, saveService, canEditSetlist, canEditServiceLessons, canEditAssemblyNote, deleteService, publishService, t, fmtDate, deptName, roleName } = useMe();
  // Pending edits (nothing persists until Save). null = no pending change for that part (shows stored data).
  const stored = data.assignments.filter(a => a.serviceId === sv.id);
  const [pAsg, setPAsg] = useState<Assignment[] | null>(null);
  const [pSet, setPSet] = useState<SetlistItem[] | null>(null);
  const [pLes, setPLes] = useState<string[] | null>(null);
  const [pNote, setPNote] = useState<string | null>(null);
  // Inline details (owner only, as before: saveService is owner-only)
  const canDetails = currentUser.role === 'owner';
  const storedDet = { title: sv.title, location: sv.location ?? '', date: isoToDdmm(sv.date), start: sv.start, end: sv.end };
  const [pDet, setPDet] = useState<typeof storedDet | null>(null);
  const det = pDet ?? storedDet;
  const setDet = (p: Partial<typeof storedDet>) => setPDet({ ...det, ...p });
  const detDirty = pDet !== null && JSON.stringify(pDet) !== JSON.stringify(storedDet);
  const newIso = detDirty ? toIso(det.date) : null;
  const [awayAsk, setAwayAsk] = useState(false);
  const asg = pAsg ?? stored; const setlist = pSet ?? sv.setlist ?? []; const lessons = pLes ?? sv.lessons ?? []; const note = pNote ?? sv.assemblyNote ?? '';
  const norm = (l: Assignment[]) => JSON.stringify(l.map(a => [a.id, a.userId]).sort());
  const dirty = detDirty || (pAsg !== null && norm(pAsg) !== norm(stored)) || (pSet !== null && JSON.stringify(pSet) !== JSON.stringify(sv.setlist ?? [])) || (pLes !== null && JSON.stringify(pLes) !== JSON.stringify(sv.lessons ?? [])) || (pNote !== null && pNote.replace(/\s+$/, '') !== (sv.assemblyNote ?? ''));
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const commit = (): string | false => {
    if (!dirty) return '';
    let iso: string | null = null;
    if (detDirty) { // validate details first so nothing is half-saved
      iso = toIso(det.date); const hm = /^([01]\d|2[0-3]):[0-5]\d$/;
      const ve = !det.title.trim() ? t('errors.nameRequired') : !iso ? t('errors.dateInvalid') : !hm.test(det.start) || !hm.test(det.end) ? t('errors.timeFormat') : det.end <= det.start ? t('errors.endAfterStart') : null;
      if (ve) { setErr(ve); return false; }
    }
    if (pAsg || pSet || pLes || pNote !== null) { const e = saveServiceEdits(sv.id, { ...(pAsg ? { assignments: pAsg } : {}), ...(pSet ? { setlist: pSet } : {}), ...(pLes ? { lessons: pLes } : {}), ...(pNote !== null ? { assemblyNote: pNote } : {}) }); if (e) { setErr(e); return false; } }
    if (detDirty && iso) { const e = saveService(sv.id, { title: det.title, location: det.location, date: iso, start: det.start, end: det.end, slots: sv.slots, ...(sv.status ? { status: sv.status } : {}) }); if (e) { setErr(e); return false; } }
    setPAsg(null); setPSet(null); setPLes(null); setPNote(null); setPDet(null); setErr(null); return t('services.changesSaved');
  };
  useUnsavedGuard(dirty, { save: commit, back: m => onBack(m) });
  const unassign = (id: string) => setPAsg(asg.filter(a => a.id !== id));
  const assign = (serviceId: string, departmentId: string, position: string, index: number, userId: string, mode?: 'double' | 'swap'): string | null => {
    if (!canManage(departmentId)) return t('errors.slotScope');
    const u = data.users.find(x => x.id === userId); if (!u || !u.active) return t('errors.notFound');
    if (!(u.positions?.[departmentId] ?? []).includes(position)) return t('errors.doesntHoldRole', { name: u.firstName, role: position });
    if (awayOn(u, sv.date)) return t('errors.unavailableThatDay', { name: u.firstName });
    const tgt = `${serviceId}:${departmentId}:${position}:${index}`;
    if (sameRoleSlot(asg, userId, departmentId, position, tgt)) return t('errors.sameRole', { name: u.firstName, role: roleName(departmentId, position) });
    if (mode === 'swap' && asg.some(a => a.userId === userId && a.id !== tgt && !canManage(a.departmentId))) return t('errors.slotScope');
    const r = planAssign(asg, { serviceId, departmentId, position, index, userId }, mode);
    if ('error' in r) return t('errors.alreadyServing', { name: u.firstName });
    setPAsg(r.assignments); return null;
  };
  // People who would be dropped because they're away on the new (unsaved) date
  const awayNames = newIso && newIso !== sv.date ? asg.flatMap(a => { const u = data.users.find(x => x.id === a.userId); return u && awayOn(u, newIso) ? [`${displayName(u)} (${roleName(a.departmentId, a.position)})`] : []; }) : [];
  const saveAndBack = () => { const m = commit(); if (m !== false) onBack(m || undefined); };
  const canEditAny = canDetails || data.departments.some(d => canManage(d.id) && sv.slots.some(z => z.departmentId === d.id)) || canEditSetlist(sv) || canEditServiceLessons(sv) || canEditAssemblyNote;
  const [open, setOpen] = useState<string | null>(null); // slot key being filled
  const [err, setErr] = useState<string | null>(null);
  const [busyPick, setBusyPick] = useState<{ m: { firstName: string; username: string }; detail: string; run: (mode: 'double' | 'swap') => void } | null>(null);
  const isOwner = currentUser.role === 'owner';
  const draft = sv.status === 'draft';
  const del = () => confirmAsk(draft ? t('services.deleteDraft') : t('services.deleteConfirmTitle'), t(draft ? 'services.deleteDraftConfirm' : 'services.deleteConfirm', { title: sv.title, date: isoToDdmm(sv.date) }),
    t('common.delete'), t('common.cancel'), () => { deleteService(sv.id); onDeleted(draft ? t('services.draftDeleted') : t('services.deleted')); });
  const [pubMsg, setPubMsg] = useState<string | null>(null);
  // Collapsible sections: department cards start expanded; the Assembly note starts collapsed. State lives on this screen.
  const [secOpen, setSecOpen] = useState<Record<string, boolean>>({});
  const [noteOpen, setNoteOpen] = useState(false);
  const showNote = canEditAssemblyNote || note.trim().length > 0;
  const noteCard = (nested: boolean) => showNote ? <AssemblyNoteCard key="note" nested={nested} value={note} onChange={v => setPNote(v)} editable={canEditAssemblyNote} open={noteOpen} onToggle={setNoteOpen} /> : null;
  return (
    <Screen title={sv.title} subtitle={`${fmtDate(sv.date)} · ${isoToDdmm(sv.date)} · ${sv.start}–${sv.end}${sv.location ? ` · ${sv.location}` : ''}`} backTo={{ label: t('services.title'), onPress: () => leaveGuarded(m => onBack(m)) }}>
      {msg && !savedMsg && <Notice text={msg} />}
      {savedMsg && !dirty && <Notice text={savedMsg} />}
      {pubMsg && <Notice text={pubMsg} />}
      {draft && <View style={[s.row, { marginBottom: 8 }]}><StatusBadge status="draft" label={t('services.draft')} testID="draft-badge" /><Text style={[s.small, { marginLeft: 8, flex: 1 }]}>{t('services.draftHint')}</Text></View>}
      {canDetails && <View testID="svd-details"><CollapsibleCard toggleID="svd-details-toggle" icon="information-circle-outline" title={t('services.detailsTitle')}>
        <Field label={t('fields.name')} value={det.title} onChangeText={v => setDet({ title: v })} autoCapitalize="words" testID="sv-title" />
        <Field label={t('fields.location')} value={det.location} onChangeText={v => setDet({ location: v })} autoCapitalize="words" placeholder={t('fields.locationPlaceholder')} testID="sv-location" />
        <DateField label={t('fields.date')} value={det.date} onChange={v => setDet({ date: v })} testID="sv-date" />
        <View style={[s.row, { flexWrap: 'nowrap' }]}>
          <View style={{ flex: 1, marginRight: 8 }}><Field label={t('fields.start')} value={det.start} keyboardType="number-pad" maxLength={5} onChangeText={v => setDet({ start: formatTimeInput(v) })} testID="sv-start" /></View>
          <View style={{ flex: 1 }}><Field label={t('fields.end')} value={det.end} keyboardType="number-pad" maxLength={5} onChangeText={v => setDet({ end: formatTimeInput(v) })} testID="sv-end" /></View>
        </View>
        {awayNames.length > 0 && <View testID="svd-away-notice" style={{ backgroundColor: colors.amberSoft, borderRadius: 12, padding: 12, marginTop: 4 }}><Text style={{ color: colors.text }}>{t('services.awayWillRemove', { names: awayNames.join(', ') })}</Text></View>}
      </CollapsibleCard></View>}
      <Modal visible={awayAsk} transparent animationType="fade" onRequestClose={() => setAwayAsk(false)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View testID="away-sheet" accessibilityRole="alert" style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, maxWidth: 420, width: '100%', alignSelf: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8 }}>{t('services.awayConfirmTitle')}</Text>
            <Text style={{ fontSize: 15, color: colors.muted, marginBottom: 12 }}>{t('services.awayWillRemove', { names: awayNames.join(', ') })}</Text>
            <Button label={t('unsaved.save')} testID="away-save" onPress={() => { setAwayAsk(false); saveAndBack(); }} />
            <Button label={t('unsaved.cancel')} outline testID="away-cancel" onPress={() => setAwayAsk(false)} />
          </View>
        </View>
      </Modal>
      <Modal visible={!!busyPick} transparent animationType="fade" onRequestClose={() => setBusyPick(null)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.4)' }}>
          {busyPick && <BusyChoiceSheet name={busyPick.m.username} detail={busyPick.detail} onDouble={() => busyPick.run('double')} onSwap={() => busyPick.run('swap')} onCancel={() => setBusyPick(null)}
            testIDs={{ root: 'busy-sheet', double: 'busy-double', swap: 'busy-swap', cancel: 'busy-cancel' }} />}
        </View>
      </Modal>
      {/* Setlist sits right after Music's slots; if Music isn't shown it falls back to after all departments. */}
      {(() => { const setCard = <SetlistCard key="setlist" service={sv} list={setlist} onChange={l => setPSet(l)} />;
        const musicShown = sv.slots.some(z => z.departmentId === 'd-music');
        const lesCard = <ServiceLessonsCard key="lessons" service={sv} list={lessons} onChange={l => setPLes(l)} editable={canEditServiceLessons(sv)} />;
        const kidsShown = sv.slots.some(z => z.departmentId === 'd-kids');
        return <>{!musicShown && noteCard(false)}{data.departments.map(d => {
        const slots = sv.slots.filter(z => z.departmentId === d.id).sort((a, b) => roleIdx(data, d.id, a.position) - roleIdx(data, d.id, b.position));
        if (!slots.length) return null;
        const after = d.id === 'd-music' ? setCard : d.id === 'd-kids' ? lesCard : null;
        const manage = canManage(d.id);
        const members = data.users.filter(u => u.active && u.departmentIds.includes(d.id));
        return (<React.Fragment key={d.id}>
          <CollapsibleCard toggleID={`svd-dept-toggle-${d.id}`} testID={`svd-dept-${d.id}`} style={{ borderLeftWidth: 3, borderLeftColor: d.color }} a11yLabel={t('services.slotsA11y', { dept: deptName(d.id) })}
            open={secOpen[d.id] ?? true} onToggle={o => setSecOpen(m => ({ ...m, [d.id]: o }))}
            header={<View><DeptTitle dep={d} />{!manage && <Text style={[s.small, { marginLeft: 42 }]}>{t('common.viewOnly')}</Text>}</View>}>
            {slots.flatMap(sl => Array.from({ length: sl.count }, (_, i) => {
              const key = `${sv.id}:${d.id}:${sl.position}:${i}`;
              const a = asg.find(x => x.id === key);
              const who = data.users.find(u => u.id === a?.userId);
              const me = who?.id === currentUser.id;
              const holders = members.filter(m => (m.positions?.[d.id] ?? []).includes(sl.position));
              return (
                <View key={key} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 8 }}>
                  <View style={[s.row, { justifyContent: 'space-between' }]}>
                    <Text style={{ fontWeight: '600', color: colors.text }}>{roleName(d.id, sl.position)}{sl.count > 1 ? ` ${i + 1}` : ''}</Text>
                    <View style={s.row}>
                      {who ? <View style={[s.row, { flexWrap: 'nowrap', flexShrink: 1 }]}><Icon name="checkmark-circle" size={16} color={me ? colors.primary : colors.green} style={{ marginRight: 4 }} /><Text style={{ color: me ? colors.primary : colors.text, fontWeight: me ? '800' : '600', flexShrink: 1 }}>{`${displayName(who)}${me ? ` ${t('common.you')}` : ''}`}</Text></View> : null}
                      {manage && <Pressable testID={`slot-${d.id}-${sl.position}-${i}`} hitSlop={8} onPress={() => { setErr(null); setOpen(open === key ? null : key); }}><Text style={{ color: colors.primary, fontWeight: '700', marginLeft: 10 }}>{who ? t('common.change') : t('common.fill')}</Text></Pressable>}
                    </View>
                  </View>
                  {open === key && (() => {
                    const rows = holders.filter(m => m.id !== who?.id).map(m => {
                      const away = awayOn(m, sv.date); const same = sameRoleSlot(asg, m.id, d.id, sl.position, key);
                      const st = away ? 'away' as const : same ? 'same' as const : pickStatus(asg, sv.id, m.id, key, away);
                      const detail = st === 'same' ? t('services.alreadyInRole') : st === 'away' ? (noteOn(m, sv.date) ?? t('rota.away')) : undefined;
                      return { m, st, detail };
                    });
                    const pick = (m: typeof holders[number], mode?: 'double' | 'swap') => { const e = assign(sv.id, d.id, sl.position, i, m.id, mode); setErr(e); setBusyPick(null); if (!e) setOpen(null); };
                    return (
                      <View testID={`picker-${key}`} style={{ marginTop: 8 }}>
                        {holders.length === 0 && <Text style={s.small}>{t('services.nobodyHoldsDept', { dept: deptName(d.id), role: roleName(d.id, sl.position) })}</Text>}
                        {a && (() => { const cu = holders.find(h => h.id === a.userId) ?? data.users.find(u => u.id === a.userId); return cu ? <View style={{ marginBottom: 6 }}><Chip testID={`pick-current-${cu.username}`} label={displayName(cu)} color={d.color} active icon="checkmark-circle" onPress={() => { unassign(a.id); setOpen(null); }} /></View> : null; })()}
                        {(['free', 'busy', 'away', 'same'] as const).map(k => { const g = rows.filter(r => r.st === k && r.m.id !== a?.userId); if (!g.length) return null; return (
                          <View key={k} testID={`pick-section-${k}`}>
                            {k !== 'same' && <PickerSectionLabel kind={k} count={g.length} />}
                            {g.map(r => <PickerRow key={r.m.id} name={displayName(r.m).replace(/^@/, '')} status={k === 'same' ? 'away' : k} detail={r.detail} testID={`pick-${k}-${r.m.username}`}
                              onPress={k === 'free' ? () => pick(r.m) : k === 'busy' ? () => setBusyPick({ m: r.m, detail: asg.filter(z => z.userId === r.m.id && z.id !== key).map(z => roleName(z.departmentId, z.position)).join(', '), run: (mode: 'double' | 'swap') => pick(r.m, mode) }) : undefined} />)}
                          </View>); })}
                      </View>
                    );
                  })()}
                </View>
              );
            }))}
            {d.id === 'd-music' && noteCard(true)}
          </CollapsibleCard>{after}</React.Fragment>
        );
      })}{!musicShown && setCard}{!kidsShown && lesCard}</>; })()}
      <View style={[s.row, { marginTop: 4, marginBottom: 4 }]}>{([['checkmark-circle-outline', t('services.legendAvailable')], ['close-circle-outline', t('services.legendAway')], ['time-outline', t('services.legendBusy')]] as const).map(([n, l]) => <View key={l} style={[s.row, { marginRight: 16, marginBottom: 4 }]}><Icon name={n} size={16} style={{ marginRight: 4 }} /><Text style={s.small}>{l}</Text></View>)}</View>
      <Text style={s.small}>{t('services.onlyHolders')}</Text>
      {isOwner && draft && <Button label={t('services.publish')} onPress={() => { publishService(sv.id); setPubMsg(t('services.published')); }} testID="publish-service" />}
      {err && <Notice tone="error" text={err} />}
      {canEditAny && <Button label={t('services.saveEdits')} disabled={!dirty} onPress={() => awayNames.length ? setAwayAsk(true) : saveAndBack()} testID="svd-save" />}
      {isOwner && <Button label={draft ? t('services.deleteDraft') : t('services.deleteService')} danger onPress={del} testID={draft ? 'delete-draft' : 'delete-service'} />}
    </Screen>
  );
}

type Row = { id: string; dep: string; role: string; assigneeId?: string };
let rowSeq = 0;
const newRowId = () => `r${++rowSeq}`;

function ServiceForm({ service, onClose, onDeleted }: { service?: Service; onClose: (msg?: string, id?: string) => void; onDeleted?: (msg: string) => void }) {
  const colors = useColors(); const s = useStyles();
  const { data, saveService, deleteService, canManage, canEditSetlist, canEditServiceLessons, canEditAssemblyNote, t, deptName, roleName } = useMe();
  const [setlist, setSetlist] = useState<SetlistItem[]>(service?.setlist ?? []);
  const [lessons, setLessons] = useState<string[]>(service?.lessons ?? []);
  const [assemblyNote, setAssemblyNote] = useState<string>(service?.assemblyNote ?? '');
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
  // Collapsible sections (state per screen): department cards start expanded so creating a service is quick; the Assembly note starts collapsed.
  const [deptOpen, setDeptOpen] = useState<Record<string, boolean>>({});
  const [noteOpen, setNoteOpen] = useState(false);
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
  const snap = () => JSON.stringify([title, location, date, start, end, data.departments.map(d => rows.filter(x => x.dep === d.id).sort((a, b) => roleIdx(data, d.id, a.role) - roleIdx(data, d.id, b.role)).map(x => [x.role, x.assigneeId ?? ''])), setlist, lessons, assemblyNote.replace(/\s+$/, '')]);
  const [initial] = useState(snap);
  const [done, setDone] = useState(false);
  const dirty = !done && snap() !== initial;
  /** Validate + persist. Returns the success message, or false (error shown). Never navigates. */
  const persist = (status: 'draft' | 'published'): string | false => {
    if (!iso) { setErr(t('errors.dateInvalid')); return false; }
    if (!service && iso < todayIso()) { setErr(t('errors.datePast')); return false; }
    const slots: Slot[] = []; const pk: { departmentId: string; position: string; index: number; userId: string }[] = [];
    for (const d of data.departments) for (const p of [...d.positions, ...rows.filter(x => x.dep === d.id && !d.positions.includes(x.role)).map(x => x.role)].filter((v, i, a) => a.indexOf(v) === i)) {
      const rs = rows.filter(x => x.dep === d.id && x.role === p);
      if (!rs.length) continue;
      slots.push({ departmentId: d.id, position: p, count: rs.length });
      rs.forEach((x, i) => { if (x.assigneeId) pk.push({ departmentId: d.id, position: p, index: i, userId: x.assigneeId }); });
    }
    const withSet = canEditSetlist(service) && (setlist.length || service?.setlist) ? { setlist } : {};
    const withLes = canEditServiceLessons(service) && (lessons.length || service?.lessons) ? { lessons } : {};
    const withNote = canEditAssemblyNote && (assemblyNote.trim() || service?.assemblyNote) ? { assemblyNote } : {};
    const e = saveService(service?.id ?? null, { title, location, date: iso, start, end, slots, status, ...withSet, ...withLes, ...withNote }, pk);
    if (e) { setErr(e); return false; }
    setDone(true);
    return status === 'draft' ? t('services.draftSaved') : isDraftSv ? t('services.published') : service ? t('services.updated') : t('services.created');
  };
  const save = (status: 'draft' | 'published') => { const m = persist(status); if (m !== false) onClose(m); };
  useUnsavedGuard(dirty, { save: () => persist(service && !isDraftSv ? 'published' : isDraftSv ? 'draft' : 'published'), back: m => onClose(m) });
  const leave = () => leaveGuarded(m => onClose(m));
  return (
    <Screen title={service ? t('services.editService') : t('services.newService')} subtitle={t('services.formSubtitle')} backTo={{ label: service ? service.title : t('services.title'), onPress: leave }}>
      <Modal visible={!!formBusy} transparent animationType="fade" onRequestClose={() => setFormBusy(null)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.4)' }}>
          {formBusy && <BusyChoiceSheet name={formBusy.u.username} detail={formBusy.detail} onDouble={() => formBusy.run('double')} onSwap={() => formBusy.run('swap')} onCancel={() => setFormBusy(null)}
            testIDs={{ root: 'busy-sheet', double: 'busy-double', swap: 'busy-swap', cancel: 'busy-cancel' }} />}
        </View>
      </Modal>
      <CollapsibleCard toggleID="sv-details-toggle" testID="sv-details" icon="information-circle-outline" title={t('services.detailsTitle')}>
        <Field label={t('fields.name')} value={title} onChangeText={setTitle} autoCapitalize="words" testID="sv-title" />
        <Field label={t('fields.location')} value={location} onChangeText={setLocation} autoCapitalize="words" placeholder={t('fields.locationPlaceholder')} testID="sv-location" />
        <DateField label={t('fields.date')} limit={service ? undefined : 'future'} value={date} onChange={setDate} testID="sv-date" />
        <View style={[s.row, { flexWrap: 'nowrap' }]}>
          <View style={{ flex: 1, marginRight: 8 }}><Field label={t('fields.start')} value={start} keyboardType="number-pad" maxLength={5} onChangeText={v => setStart(formatTimeInput(v))} testID="sv-start" /></View>
          <View style={{ flex: 1 }}><Field label={t('fields.end')} value={end} keyboardType="number-pad" maxLength={5} onChangeText={v => setEnd(formatTimeInput(v))} testID="sv-end" /></View>
        </View>
      </CollapsibleCard>
      <Text style={s.section}>{t('services.slotsAndPeople')}</Text>
      {notice && <Card style={{ backgroundColor: colors.amberSoft, borderColor: colors.amberSoft }}><Text testID="sv-notice" style={{ color: colors.text }}>{notice}</Text></Card>}
      {(() => { const setCard = canEditSetlist(service) ? <SetlistCard key="setlist" service={service} list={setlist} onChange={setSetlist} startEditing={!service} /> : null;
        const musicShown = data.departments.some(d => d.id === 'd-music');
        const lesCard = canEditServiceLessons(service) ? <ServiceLessonsCard key="lessons" service={service} list={lessons} onChange={setLessons} editable startEditing={!service} /> : null;
        const kidsShown = data.departments.some(d => d.id === 'd-kids');
        const noteCard = (nested: boolean) => canEditAssemblyNote ? <AssemblyNoteCard key="note" nested={nested} value={assemblyNote} onChange={setAssemblyNote} editable open={noteOpen} onToggle={setNoteOpen} /> : null;
        return <>{!musicShown && noteCard(false)}{data.departments.map(d => {
        const mine = rows.filter(x => x.dep === d.id).sort((a, b) => roleIdx(data, d.id, a.role) - roleIdx(data, d.id, b.role));
        const manage = canManage(d.id);
        const open = deptOpen[d.id] ?? true;
        return (<React.Fragment key={d.id}>
          <CollapsibleCard toggleID={`dept-toggle-${d.id}`} testID={`dept-card-${d.id}`} style={{ borderLeftWidth: 3, borderLeftColor: d.color }} a11yLabel={t('services.slotsA11y', { dept: deptName(d.id) })}
            open={open} onToggle={o => setDeptOpen(m => ({ ...m, [d.id]: o }))}
            header={
              <View style={{ opacity: manage ? 1 : 0.6 }}>
                <DeptTitle dep={d} />
                <View style={{ marginTop: 8, marginLeft: 42 }} testID={`dept-status-${d.id}`}>
                  <Badge tone={mine.length && mine.every(x => x.assigneeId) ? 'success' : mine.some(x => x.assigneeId) ? 'warning' : 'neutral'} icon={mine.length && mine.every(x => x.assigneeId) ? 'checkmark-circle' : 'ellipse-outline'}
                    label={`${mine.length ? t('services.assignedCount', { n: mine.filter(x => x.assigneeId).length, total: mine.length }) : t('services.noSlots')}${manage ? '' : ` · ${t('common.viewOnly')}`}`} />
                </View>
              </View>}>
            <View style={{ opacity: manage ? 1 : 0.6 }}>
            {mine.map(x => {
              const same = mine.filter(y => y.role === x.role); const n = same.indexOf(x);
              const who = x.assigneeId ? userById(x.assigneeId) : undefined;
              const opts = eligibleFor(x.id);
              return (
                <View key={x.id} testID={`row-${d.id}-${x.role}-${n}`} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 6, minHeight: 48, justifyContent: 'center' }}>
                  <View style={[s.row, { flexWrap: 'nowrap', alignItems: 'center' }]}>
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.text, marginRight: 8 }} numberOfLines={2}>{roleName(d.id, x.role)}{same.length > 1 ? ` ${n + 1}` : ''}</Text>
                    <Pressable testID={`fp-${d.id}-${x.role}-${n}`} disabled={!manage} onPress={() => setOpenPick(openPick === x.id ? null : x.id)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                      accessibilityRole="button" accessibilityState={{ expanded: openPick === x.id }} accessibilityLabel={`${roleName(d.id, x.role)}: ${who ? displayName(who) : t('ui.assignPlaceholder')}`}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', height: 32, maxWidth: '55%', borderWidth: 1, borderColor: who ? colors.primary : colors.border, backgroundColor: openPick === x.id || pressed ? colors.soft : who ? colors.primarySoft : colors.card, borderRadius: 999, paddingLeft: 12, paddingRight: 8 })}>
                      <Text numberOfLines={1} style={{ flexShrink: 1, color: who ? colors.primaryText : colors.muted, fontWeight: who ? '700' : '600', fontSize: 13.5, lineHeight: 18 }}>{who ? displayName(who) : t('ui.assignPlaceholder')}</Text>
                      <Icon name={openPick === x.id ? 'chevron-up' : 'chevron-down'} size={14} color={who ? colors.primaryText : colors.muted} style={{ marginLeft: 6 }} />
                    </Pressable>
                    {manage && <IconButton testID={`rm-${d.id}-${x.role}-${n}`} icon="remove-circle-outline" label={t('services.removeSlot')} color={colors.red} onPress={() => removeSlot(x.id)} style={{ marginLeft: 4 }} />}
                  </View>
                  {openPick === x.id && manage && <View style={[s.row, { marginTop: 8 }]}>
                    {opts.length === 0 && <Text style={s.small}>{t('services.noneAvailable')}</Text>}
                    {opts.map(u => {
                      if (u.id === who?.id) return <Chip key={u.id} testID={`fpick-current-${u.username}`} label={displayName(u)} color={d.color} active icon="checkmark-circle"
                        onPress={() => { assign(x.id, null); setOpenPick(null); }} />;
                      const others = u.id === who?.id ? [] : rows.filter(r => r.id !== x.id && r.assigneeId === u.id);
                      const sameR = others.find(r => r.dep === x.dep && r.role === x.role);
                      if (sameR) return <Chip key={u.id} testID={`fpick-same-${u.username}`} label={`${displayName(u)} · ${t('services.alreadyInRole')}`} color={colors.subtle} icon="remove-circle-outline" />;
                      if (others.length) { const detail = others.map(r => `${deptName(r.dep)} · ${roleName(r.dep, r.role)}`).join(', ');
                        return <Chip key={u.id} testID={`fpick-busy-${u.username}`} label={displayName(u)} color={colors.amber} icon="time-outline"
                          onPress={() => setFormBusy({ u, detail: others.map(r => roleName(r.dep, r.role)).join(', '), run: mode => { setRows(r => r.map(z => z.id === x.id && canManage(z.dep) ? { ...z, assigneeId: u.id } : mode === 'swap' && z.assigneeId === u.id && z.id !== x.id ? { ...z, assigneeId: undefined } : z)); setFormBusy(null); setOpenPick(null); setNotice(null); } })} />; }
                      return <Chip key={u.id} testID={`fpick-${u.username}`} label={displayName(u)} color={d.color} active={who?.id === u.id}
                        onPress={() => { assign(x.id, u.id); setOpenPick(null); setNotice(null); }} />; })}
                    {awayHolders(x.id).map(u => <Chip key={u.id} testID={`fpick-away-${u.username}`} label={`${displayName(u)} · ${(iso ? noteOn(u, iso) : null) ?? t('rota.away')}`} color={colors.red} icon="close-circle-outline" />)}
                  </View>}
                </View>
              );
            })}
            {manage && <>
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 2, paddingTop: 8 }}>
                <Pressable testID={`add-role-${d.id}`} accessibilityRole="button" accessibilityState={{ expanded: openAdd === d.id }} onPress={() => setOpenAdd(openAdd === d.id ? null : d.id)}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 12, borderRadius: 12, backgroundColor: pressed ? colors.soft : 'transparent' })}>
                  <Icon name="add" size={18} color={colors.primaryText} style={{ marginRight: 6 }} />
                  <Text style={{ color: colors.primaryText, fontWeight: '700', fontSize: 15 }}>{t('ui.addRole')}</Text>
                </Pressable>
              </View>
              {openAdd === d.id && <View style={[s.row, { marginTop: 6 }]}>{d.positions.map(p => <Chip key={p} testID={`sl-add-${d.id}-${p}`} label={`+ ${roleName(d.id, p)}`} color={d.color} onPress={() => { addSlot(d.id, p); setOpenAdd(null); }} />)}</View>}
            </>}
            </View>
            {d.id === 'd-music' && noteCard(true)}
          </CollapsibleCard>{d.id === 'd-music' && setCard}{d.id === 'd-kids' && lesCard}</React.Fragment>
        );
      })}{!musicShown && setCard}{!kidsShown && lesCard}</>; })()}
      {err && <Notice tone="error" text={err} />}
      <Button label={!service ? t('services.createService') : isDraftSv ? t('services.publish') : t('services.saveService')} onPress={() => save('published')} testID="sv-save" />
      {(!service || isDraftSv) && <Button label={t('services.saveDraft')} outline onPress={() => save('draft')} testID="sv-save-draft" />}
      {isDraftSv && <Button label={t('services.deleteDraft')} danger testID="sv-delete-draft" onPress={() => confirmAsk(t('services.deleteDraft'), t('services.deleteDraftConfirm', { title: service!.title, date: isoToDdmm(service!.date) }), t('common.delete'), t('common.cancel'), () => { deleteService(service!.id); onDeleted?.(t('services.draftDeleted')); })} />}
      <Button label={t('common.cancel')} outline onPress={leave} testID="sv-cancel" />
    </Screen>
  );
}
