import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { DateField } from './DateField';
import { Field, Notice, Button, useColors, useStyles } from './ui';
import { useApp } from '../state/AppContext';
import { NOTE_MAX, formatRange, rangeEnd, rangeError } from '../data/unavailability';
import { toIso, todayIso } from '../data/dates';
import { Unavailability } from '../types';

/** From / To (optional) / note entry + list. `onAdd` returns an error string or null. */
export function UnavailEditor({ entries, onAdd, onRemove, extra }: { entries: Unavailability[]; onAdd: (e: Unavailability) => string | null | void; onRemove: (from: string) => void; extra?: (e: Unavailability) => React.ReactNode }) {
  const colors = useColors(); const s = useStyles(); const { t } = useApp();
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [note, setNote] = useState(''); const [err, setErr] = useState<string | null>(null);
  const add = () => {
    const f = toIso(from); const tt = to.trim() ? toIso(to) : undefined;
    const re = rangeError(f, tt, todayIso()); if (re) return setErr(t(`errors.${re}` as any));
    const n = note.trim();
    const e = onAdd({ date: f!, ...(tt && tt > f! ? { to: tt } : {}), ...(n ? { note: n } : {}) });
    if (e) return setErr(e);
    setFrom(''); setTo(''); setNote(''); setErr(null);
  };
  const list = entries.filter(e => rangeEnd(e) >= todayIso());
  return (
    <View>
      <View style={[s.row, { flexWrap: 'nowrap', alignItems: 'flex-start' }]}>
        <View style={{ flex: 1, marginRight: 8 }}><DateField label={t('unav.from')} limit="future" value={from} onChange={setFrom} testID="unav-from" /></View>
        <View style={{ flex: 1 }}><DateField label={t('unav.to')} limit="future" value={to} onChange={setTo} onSubmit={add} testID="unav-to" /></View>
      </View>
      <Text style={[s.small, { marginBottom: 6 }]}>{t('unav.toHint')}</Text>
      <Field label={t('unav.note')} value={note} onChangeText={setNote} maxLength={NOTE_MAX} placeholder={t('availability.notePlaceholder')} testID="unav-note" />
      {err && <Notice tone="error" text={err} />}
      <Button label={t('unav.add')} outline onPress={add} testID="unav-add" />
      {list.length === 0 ? <Text style={[s.small, { marginTop: 8 }]}>{t('availability.noDates')}</Text> : list.map(e => (
        <View key={e.date} testID={`unav-row-${e.date}`} style={[s.row, { justifyContent: 'space-between', flexWrap: 'nowrap', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }} testID={`unav-label-${e.date}`}>{formatRange(e)}</Text>
            {e.note ? <Text style={s.small} testID={`unav-notetext-${e.date}`}>{e.note}</Text> : null}
            {extra?.(e)}
          </View>
          <Pressable testID={`unav-del-${e.date}`} accessibilityRole="button" accessibilityLabel={`${t('unav.remove')} ${formatRange(e)}`} onPress={() => onRemove(e.date)} hitSlop={12} style={{ minHeight: 44, justifyContent: 'center', paddingLeft: 12 }}>
            <Text style={{ color: colors.red, fontWeight: '700' }}>{t('unav.remove')}</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
