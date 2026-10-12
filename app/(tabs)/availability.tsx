import { DateField } from '../../src/components/DateField';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatDobInput, useMe } from '../../src/state/AppContext';
import { NOTE_MAX } from '../../src/data/unavailability';
import { toIso, todayIso } from '../../src/data/dates';
import { Button, Card, Empty, Field, Screen, colors, s, Notice } from '../../src/components/ui';

export default function AvailabilityScreen() {
  const { data, currentUser, addUnavailable, removeUnavailable, t, fmtDate } = useMe();
  const [v, setV] = useState(''); const [note, setNote] = useState(''); const [err, setErr] = useState<string | null>(null);
  const dates = (currentUser.unavailable ?? []).filter(x => x.date >= todayIso());
  const add = () => {
    const iso = toIso(v);
    if (!iso) return setErr(t('errors.dateInvalid'));
    if (iso < todayIso()) return setErr(t('errors.datePast'));
    addUnavailable(iso, undefined, note); setV(''); setNote(''); setErr(null);
  };
  return (
    <Screen title={t('availability.title')} subtitle={t('availability.subtitle')}>
      <Card>
        <DateField label={t('availability.dateLabel')} limit="future" value={v} onChange={setV} onSubmit={add} testID="unavail-date" />
        <Field label={t('availability.noteLabel')} value={note} onChangeText={setNote} maxLength={NOTE_MAX} placeholder={t('availability.notePlaceholder')} testID="unavail-note" />
        {err && <Notice tone="error" text={err} />}
        <Button label={t('availability.add')} onPress={add} testID="unavail-add" />
      </Card>
      <Text style={s.section}>{t('availability.mine')}</Text>
      {dates.length === 0 && <Empty icon="checkmark-circle-outline" text={t('availability.empty')} />}
      {dates.map(e => { const iso = e.date;
        const svcs = data.services.filter(sv => sv.date === iso);
        return (
          <Card key={iso}>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <View>
                <Text style={s.h2}>{iso.split('-').reverse().join('/')} · {fmtDate(iso).split(/[ ,]/)[0]}</Text>
                {e.note ? <Text style={s.small} testID={`unavail-note-${e.date}`}>{e.note}</Text> : null}
                <Text style={s.small}>{svcs.length ? t('availability.misses', { services: svcs.map(x => x.title).join(', ') }) : t('availability.noServices')}</Text>
              </View>
              <Pressable testID={`unavail-remove-${iso}`} onPress={() => removeUnavailable(iso)} hitSlop={12} style={{ minHeight: 44, justifyContent: 'center', paddingLeft: 12 }}><Text style={{ color: colors.red, fontWeight: '700' }}>{t('common.remove')}</Text></Pressable>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
