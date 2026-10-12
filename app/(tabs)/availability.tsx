import { Text, View } from 'react-native';
import { useApp } from '../../src/state/AppContext';
import { Card, Chip, Screen, colors, formatDate, s } from '../../src/components/ui';

export default function AvailabilityScreen() {
  const { data, currentUser, isAvailable, setAvailability } = useApp();
  return (
    <Screen title="My Availability" subtitle="Let your leaders know when you can serve">
      {data.services.map(sv => {
        const v = isAvailable(currentUser.id, sv.id);
        return (
          <Card key={sv.id}>
            <Text style={s.h2}>{sv.title}</Text>
            <Text style={[s.small, { marginBottom: 10 }]}>{formatDate(sv.date)} · {sv.time}</Text>
            <View style={s.row}>
              <Chip label="✓ Available" color={colors.green} active={v === true} onPress={() => setAvailability(currentUser.id, sv.id, true)} />
              <Chip label="✕ Unavailable" color={colors.red} active={v === false} onPress={() => setAvailability(currentUser.id, sv.id, false)} />
            </View>
            {v === undefined && <Text style={s.small}>Not answered yet</Text>}
          </Card>
        );
      })}
    </Screen>
  );
}
