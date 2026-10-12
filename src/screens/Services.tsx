import { DateField } from '../components/DateField';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { formatDobInput, useMe } from '../state/AppContext';
import { Button, Card, Chip, Empty, Field, Screen, colors, formatDate, s, Notice } from '../components/ui';
import { Service, Slot } from '../types';
import { formatTimeInput, isoToDdmm, toIso, todayIso, upcomingSundayIso } from '../data/dates';

const DOUBLE: Record<string, number> = { 'd-kids:Assistant': 2, 'd-music:Backing Vocals': 2 };

export function ServicesHome() {
  const { data, currentUser } = useMe();
  const [view, setView] = useState<{ kind: 'detail' | 'edit'; id: string } | { kind: 'new' } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const isOwner = currentUser.role === 'owner';
  if (view?.kind === 'new') return <ServiceForm onClose={(m, id) => { setMsg(m ?? null); setView(id ? { kind: 'detail', id } : null); }} />;
  if (view) {
    const sv = data.services.find(x => x.id === view.id);
    if (!sv) { setView(null); return null; }
    if (view.kind === 'edit') return <ServiceForm service={sv} onClose={m => { setMsg(m ?? null); setView({ kind: 'detail', id: sv.id }); }} />;
    return <ServiceDetail service={sv} msg={msg} onBack={() => { setMsg(null); setView(null); }} onEdit={() => setView({ kind: 'edit', id: sv.id })} onDeleted={() => { setMsg('Service deleted.'); setView(null); }} />;
  }
  const upcoming = data.services.filter(x => x.date >= todayIso()).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return (
    <Screen title="Services" subtitle={`Hi ${currentUser.firstName}. Upcoming services and who's serving.`}>
      {msg && <Notice text={msg} />}
      {isOwner && <Button label="New service" onPress={() => { setMsg(null); setView({ kind: 'new' }); }} testID="new-service" />}
      <View style={{ height: 12 }} />
      {upcoming.length === 0 && <Empty text={isOwner ? 'No upcoming services yet. Tap “New service” to add one.' : 'No upcoming services yet. Check back soon.'} />}
      {upcoming.map(sv => {
        const mine = data.assignments.filter(a => a.serviceId === sv.id && a.userId === currentUser.id);
        return (
          <Pressable key={sv.id} testID={`svc-${sv.date}`} onPress={() => { setMsg(null); setView({ kind: 'detail', id: sv.id }); }}>
            <Card style={mine.length ? { borderColor: colors.primary, backgroundColor: colors.primarySoft } : undefined}>
              <Text style={s.h2}>{sv.title}</Text>
              <Text style={s.small}>{formatDate(sv.date)} · {isoToDdmm(sv.date)} · {sv.start}–{sv.end}{sv.location ? ` · ${sv.location}` : ''}</Text>
              {mine.length > 0 && <Text style={{ color: colors.primary, fontWeight: '700', marginTop: 6 }}>You're serving: {mine.map(a => a.position).join(', ')}</Text>}
              <View style={[s.row, { marginTop: 8 }]}>
                {data.departments.map(d => {
                  const need = sv.slots.filter(z => z.departmentId === d.id).reduce((n, z) => n + z.count, 0);
                  if (!need) return null;
                  const got = data.assignments.filter(a => a.serviceId === sv.id && a.departmentId === d.id).length;
                  return <Text key={d.id} style={{ marginRight: 12, color: got >= need ? colors.green : d.color, fontWeight: '600', fontSize: 13 }}>{d.emoji} {got}/{need}</Text>;
                })}
              </View>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}

function ServiceDetail({ service: sv, msg, onBack, onEdit, onDeleted }: { service: Service; msg: string | null; onBack: () => void; onEdit: () => void; onDeleted: () => void }) {
  const { data, currentUser, canManage, assign, unassign, whyBlocked, deleteService } = useMe();
  const [open, setOpen] = useState<string | null>(null); // slot key being filled
  const [err, setErr] = useState<string | null>(null);
  const isOwner = currentUser.role === 'owner';
  const del = () => {
    const go = () => { deleteService(sv.id); onDeleted(); };
    if (Platform.OS === 'web') { if (globalThis.confirm?.(`Delete ${sv.title} on ${isoToDdmm(sv.date)}?`)) go(); }
    else Alert.alert('Delete service?', `${sv.title} on ${isoToDdmm(sv.date)}`, [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: go }]);
  };
  return (
    <Screen title={sv.title} subtitle={`${formatDate(sv.date)} · ${isoToDdmm(sv.date)} · ${sv.start}–${sv.end}${sv.location ? ` · ${sv.location}` : ''}`}>
      {msg && <Notice text={msg} />}
      {err && <Notice tone="error" text={err} />}
      {data.departments.map(d => {
        const slots = sv.slots.filter(z => z.departmentId === d.id);
        if (!slots.length) return null;
        const manage = canManage(d.id);
        const members = data.users.filter(u => u.active && u.departmentIds.includes(d.id));
        return (
          <Card key={d.id} style={{ borderLeftWidth: 3, borderLeftColor: d.color }}>
            <Text style={s.h2}>{d.emoji}  {d.name}{manage ? '' : ''}</Text>
            {!manage && <Text style={s.small}>View only</Text>}
            {slots.flatMap(sl => Array.from({ length: sl.count }, (_, i) => {
              const key = `${sv.id}:${d.id}:${sl.position}:${i}`;
              const a = data.assignments.find(x => x.id === key);
              const who = data.users.find(u => u.id === a?.userId);
              const me = who?.id === currentUser.id;
              const holders = members.filter(m => (m.positions?.[d.id] ?? []).includes(sl.position));
              return (
                <View key={key} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 8 }}>
                  <View style={[s.row, { justifyContent: 'space-between' }]}>
                    <Text style={{ fontWeight: '600', color: colors.text }}>{sl.position}{sl.count > 1 ? ` ${i + 1}` : ''}</Text>
                    <View style={s.row}>
                      <Text style={{ color: who ? (me ? colors.primary : colors.text) : colors.muted, fontWeight: me ? '800' : '400' }}>{who ? `${who.name}${me ? ' (you)' : ''}` : 'Unfilled'}</Text>
                      {manage && <Pressable testID={`slot-${d.id}-${sl.position}-${i}`} onPress={() => { setErr(null); setOpen(open === key ? null : key); }}><Text style={{ color: colors.primary, fontWeight: '700', marginLeft: 10 }}>{who ? 'Change' : 'Fill'}</Text></Pressable>}
                    </View>
                  </View>
                  {open === key && (
                    <View style={[s.row, { marginTop: 8 }]}>
                      {holders.length === 0 && <Text style={s.small}>Nobody holds {sl.position} yet.</Text>}
                      {holders.map(m => {
                        const why = m.id === who?.id ? null : whyBlocked(sv.id, m.id);
                        return <Chip key={m.id} testID={`pick-${m.username}`} color={why ? colors.subtle : d.color} active={m.id === who?.id}
                          label={`${why === 'unavailable' ? '✕ ' : why === 'busy' ? '⏳ ' : '✓ '}${m.name}${why === 'busy' ? ' (busy)' : why === 'unavailable' ? ' (away)' : ''}`}
                          onPress={why ? undefined : () => { const e = assign(sv.id, d.id, sl.position, i, m.id); setErr(e); if (!e) setOpen(null); }} />;
                      })}
                      {a && <Chip label="Clear" color={colors.red} onPress={() => { unassign(a.id); setOpen(null); }} />}
                    </View>
                  )}
                </View>
              );
            }))}
          </Card>
        );
      })}
      <Text style={s.small}>✓ available · ✕ away that day · ⏳ already serving in this service. Only people holding the role are listed.</Text>
      {isOwner && <Button label="Edit service" outline onPress={onEdit} testID="edit-service" />}
      {isOwner && <Button label="Delete service" color={colors.red} outline onPress={del} testID="delete-service" />}
      <Button label="Back to services" outline onPress={onBack} testID="back-services" />
    </Screen>
  );
}

function ServiceForm({ service, onClose }: { service?: Service; onClose: (msg?: string, id?: string) => void }) {
  const { data, saveService } = useMe();
  const defaults = (): Slot[] => data.departments.flatMap(d => d.positions.map(p => ({ departmentId: d.id, position: p, count: DOUBLE[`${d.id}:${p}`] ?? 1 })));
  const [title, setTitle] = useState(service?.title ?? 'Sunday Service');
  const [location, setLocation] = useState(service?.location ?? data.settings?.lastLocation ?? '');
  const [date, setDate] = useState(isoToDdmm(service?.date ?? upcomingSundayIso()));
  const [start, setStart] = useState(service?.start ?? '16:00');
  const [end, setEnd] = useState(service?.end ?? '21:00');
  const [slots, setSlots] = useState<Slot[]>(service?.slots ?? defaults());
  const [err, setErr] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>(() => Object.fromEntries(
    data.assignments.filter(a => a.serviceId === service?.id).map(a => [`${a.departmentId}:${a.position}:${a.index}`, a.userId])));
  const [notice, setNotice] = useState<string | null>(null);
  const [openPick, setOpenPick] = useState<string | null>(null);
  const iso = toIso(date);
  const userById = (id: string) => data.users.find(u => u.id === id);
  const eligible = (dep: string, pos: string, key: string) => data.users.filter(u => u.active && u.departmentIds.includes(dep)
    && (u.positions?.[dep] ?? []).includes(pos) && !(iso && (u.unavailable ?? []).includes(iso))
    && !Object.entries(picks).some(([k, v]) => v === u.id && k !== key));
  // re-check picks whenever the date or slots change
  useEffect(() => {
    const bad: string[] = [];
    const next = Object.fromEntries(Object.entries(picks).filter(([k, uid]) => {
      const [dep, pos, idx] = k.split(':'); const sl = slots.find(z => z.departmentId === dep && z.position === pos);
      const u = userById(uid);
      const ok = !!sl && +idx < sl.count && !!u && !(iso && (u.unavailable ?? []).includes(iso));
      if (!ok && u) bad.push(`${u.name} (${pos})`);
      return ok;
    }));
    if (bad.length) { setPicks(next); setNotice(`Removed ${bad.join(', ')} — ${iso ? 'unavailable on the new date or slot removed' : 'slot removed'}.`); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso, slots]);
  const setCount = (dep: string, pos: string, c: number) => setSlots(prev => {
    const has = prev.some(z => z.departmentId === dep && z.position === pos);
    if (c <= 0) return prev.filter(z => !(z.departmentId === dep && z.position === pos));
    return has ? prev.map(z => z.departmentId === dep && z.position === pos ? { ...z, count: Math.min(c, 10) } : z) : [...prev, { departmentId: dep, position: pos, count: c }];
  });
  const save = () => {
    if (!iso) return setErr('Enter a real date as DD/MM/YYYY.');
    if (!service && iso < todayIso()) return setErr('That date is in the past.');
    const sid = service?.id ?? null;
    const pk = Object.entries(picks).map(([k, userId]) => { const [departmentId, position, index] = k.split(':'); return { departmentId, position, index: +index, userId }; });
    const e = saveService(sid, { title, location, date: iso, start, end, slots }, pk);
    if (e) return setErr(e);
    onClose(service ? 'Service updated.' : 'Service created.');
  };
  return (
    <Screen title={service ? 'Edit service' : 'New service'}>
      <Card>
        <Field label="Name" value={title} onChangeText={setTitle} autoCapitalize="words" testID="sv-title" />
        <Field label="Location" value={location} onChangeText={setLocation} autoCapitalize="words" placeholder="e.g. Main hall" testID="sv-location" />
        <DateField label="Date" limit={service ? undefined : 'future'} value={date} onChange={setDate} testID="sv-date" />
        <View style={[s.row, { flexWrap: 'nowrap' }]}>
          <View style={{ flex: 1, marginRight: 8 }}><Field label="Start (HH:MM)" value={start} keyboardType="number-pad" maxLength={5} onChangeText={v => setStart(formatTimeInput(v))} testID="sv-start" /></View>
          <View style={{ flex: 1 }}><Field label="End (HH:MM)" value={end} keyboardType="number-pad" maxLength={5} onChangeText={v => setEnd(formatTimeInput(v))} testID="sv-end" /></View>
        </View>
      </Card>
      <Text style={s.section}>Required slots</Text>
      {data.departments.map(d => {
        const missing = d.positions.filter(p => !slots.some(z => z.departmentId === d.id && z.position === p));
        const mine = slots.filter(z => z.departmentId === d.id);
        return (
          <Card key={d.id} style={{ borderLeftWidth: 3, borderLeftColor: d.color }}>
            <Text style={s.h2}>{d.emoji}  {d.name} · {mine.reduce((n, z) => n + z.count, 0)}</Text>
            {mine.map(z => (
              <View key={z.position} style={[s.row, { justifyContent: 'space-between', paddingVertical: 6 }]}>
                <Text style={{ color: colors.text, flex: 1 }}>{z.position}</Text>
                <View style={[s.row, { flexWrap: 'nowrap' }]}>
                  <Chip testID={`sl-minus-${d.id}-${z.position}`} label="−" color={d.color} onPress={() => setCount(d.id, z.position, z.count - 1)} />
                  <Text style={{ width: 24, textAlign: 'center', fontWeight: '700', marginRight: 8 }} testID={`sl-count-${d.id}-${z.position}`}>{z.count}</Text>
                  <Chip testID={`sl-plus-${d.id}-${z.position}`} label="+" color={d.color} onPress={() => setCount(d.id, z.position, z.count + 1)} />
                  <Chip label="Remove" color={colors.red} onPress={() => setCount(d.id, z.position, 0)} />
                </View>
              </View>
            ))}
            {missing.length > 0 && <>
              <Text style={[s.small, { marginTop: 6, marginBottom: 6 }]}>Add a slot:</Text>
              <View style={s.row}>{missing.map(p => <Chip key={p} testID={`sl-add-${d.id}-${p}`} label={`+ ${p}`} color={d.color} onPress={() => setCount(d.id, p, 1)} />)}</View>
            </>}
          </Card>
        );
      })}
      <Text style={s.section}>Assign people (optional)</Text>
      <Text style={[s.small, { marginBottom: 8 }]}>Only people who hold the role, aren't away on {iso ? isoToDdmm(iso) : 'that date'} and aren't already in another slot are listed. Leave slots empty for admins to fill later.</Text>
      {notice && <Card style={{ backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }}><Text testID="sv-notice">{notice}</Text></Card>}
      {data.departments.map(d => {
        const mine = slots.filter(z => z.departmentId === d.id);
        if (!mine.length) return null;
        return (
          <Card key={d.id} style={{ borderLeftWidth: 3, borderLeftColor: d.color }}>
            <Text style={s.h2}>{d.emoji}  {d.name}</Text>
            {mine.flatMap(z => Array.from({ length: z.count }, (_, i) => {
              const key = `${d.id}:${z.position}:${i}`; const who = picks[key] ? userById(picks[key]) : undefined;
              const opts = eligible(d.id, z.position, key);
              return (
                <View key={key} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 8 }}>
                  <View style={[s.row, { justifyContent: 'space-between' }]}>
                    <Text style={{ fontWeight: '600', color: colors.text }}>{z.position}{z.count > 1 ? ` ${i + 1}` : ''}</Text>
                    <Pressable testID={`fp-${d.id}-${z.position}-${i}`} onPress={() => setOpenPick(openPick === key ? null : key)}>
                      <Text style={{ color: who ? colors.text : colors.primary, fontWeight: '600' }}>{who ? `${who.name} ▾` : 'Assign ▾'}</Text>
                    </Pressable>
                  </View>
                  {openPick === key && <View style={[s.row, { marginTop: 8 }]}>
                    {opts.length === 0 && <Text style={s.small}>No one eligible for {z.position}.</Text>}
                    {opts.map(u => <Chip key={u.id} testID={`fpick-${u.username}`} label={u.name} color={d.color} active={who?.id === u.id}
                      onPress={() => { setPicks({ ...picks, [key]: u.id }); setOpenPick(null); setNotice(null); }} />)}
                    {who && <Chip label="Leave unfilled" color={colors.red} onPress={() => { const n = { ...picks }; delete n[key]; setPicks(n); setOpenPick(null); }} />}
                  </View>}
                </View>
              );
            }))}
          </Card>
        );
      })}
      {err && <Notice tone="error" text={err} />}
      <Button label={service ? 'Save service' : 'Create service'} onPress={save} testID="sv-save" />
      <Button label="Cancel" outline onPress={() => onClose()} />
    </Screen>
  );
}
