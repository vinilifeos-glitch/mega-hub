import { DateField } from '../../src/components/DateField';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatDobInput, useMe } from '../../src/state/AppContext';
import { covers } from '../../src/data/unavailability';
import { UnavailEditor } from '../../src/components/UnavailEditor';
import { toIso, todayIso } from '../../src/data/dates';
import { Button, Card, Empty, Field, Screen, Notice, useColors, useStyles } from '../../src/components/ui';

export default function AvailabilityScreen() {
  const colors = useColors(); const s = useStyles();
  const { data, currentUser, addUnavailable, removeUnavailable, t, fmtDate } = useMe();
  const [v, setV] = useState(''); const [note, setNote] = useState(''); const [err, setErr] = useState<string | null>(null);
  const dates = (currentUser.unavailable ?? []).filter(x => (x.to ?? x.date) >= todayIso());
  const add = () => {
    const iso = toIso(v);
    if (!iso) return setErr(t('errors.dateInvalid'));
    if (iso < todayIso()) return setErr(t('errors.datePast'));
    addUnavailable(iso, undefined, note); setV(''); setNote(''); setErr(null);
  };
  return (
    <Screen title={t('availability.title')} subtitle={t('availability.subtitle')}>
      <Card>
        <UnavailEditor entries={currentUser.unavailable ?? []} onAdd={e => addUnavailable(e.date, undefined, e.note, e.to)} onRemove={d => removeUnavailable(d)}
          extra={e => { const svcs = data.services.filter(sv => covers(e, sv.date)); return <Text style={s.small}>{svcs.length ? t('availability.misses', { services: svcs.map(x => x.title).join(', ') }) : t('availability.noServices')}</Text>; }} />
      </Card>
    </Screen>
  );
}
