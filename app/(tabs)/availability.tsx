import { DateField } from '../../src/components/DateField';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatDobInput, useMe } from '../../src/state/AppContext';
import { toIso, todayIso } from '../../src/data/dates';
import { Button, Card, Empty, Field, Screen, colors, formatDate, s } from '../../src/components/ui';

export default function AvailabilityScreen() {
  const { data, currentUser, addUnavailable, removeUnavailable } = useMe();
  const [v, setV] = useState(''); const [err, setErr] = useState<string | null>(null);
  const dates = (currentUser.unavailable ?? []).filter(x => x >= todayIso());
  const add = () => {
    const iso = toIso(v);
    if (!iso) return setErr('Enter a real date as DD/MM/YYYY.');
    if (iso < todayIso()) return setErr('That date is in the past.');
    addUnavailable(iso); setV(''); setErr(null);
  };
  return (
    <Screen title="Availability" subtitle="Add the dates you CAN'T serve. You're treated as available on every other day.">
      <Card>
        <DateField label="Date I'm unavailable" limit="future" value={v} onChange={setV} onSubmit={add} testID="unavail-date" />
        {err && <Text style={{ color: colors.red, marginBottom: 6 }}>{err}</Text>}
        <Button label="Add unavailable date" onPress={add} testID="unavail-add" />
      </Card>
      <Text style={s.section}>My unavailable dates</Text>
      {dates.length === 0 && <Empty text="No dates added. You're available for every service." />}
      {dates.map(iso => {
        const svcs = data.services.filter(sv => sv.date === iso);
        return (
          <Card key={iso}>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <View>
                <Text style={s.h2}>✕ {iso.split('-').reverse().join('/')} · {formatDate(iso).split(' ')[0]}</Text>
                <Text style={s.small}>{svcs.length ? `Misses: ${svcs.map(x => x.title).join(', ')}` : 'No services scheduled that day'}</Text>
              </View>
              <Pressable testID={`unavail-remove-${iso}`} onPress={() => removeUnavailable(iso)}><Text style={{ color: colors.red, fontWeight: '700' }}>Remove</Text></Pressable>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
