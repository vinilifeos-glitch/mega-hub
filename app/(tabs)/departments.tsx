import { Text, View } from 'react-native';
import { useApp } from '../../src/state/AppContext';
import { Card, Screen, colors, s } from '../../src/components/ui';

export default function Departments() {
  const { data, canManage } = useApp();
  return (
    <Screen title="Departments" subtitle="Teams serving across the church">
      {data.departments.map(d => {
        const leader = data.users.find(u => u.id === d.leaderId);
        const members = data.users.filter(u => u.departmentIds.includes(d.id));
        return (
          <Card key={d.id} style={{ borderLeftWidth: 5, borderLeftColor: d.color }}>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <Text style={s.h2}>{d.emoji}  {d.name}</Text>
              {canManage(d.id) && <Text style={{ color: d.color, fontWeight: '700', fontSize: 12 }}>YOU MANAGE</Text>}
            </View>
            <Text style={[s.small, { marginTop: 4 }]}>Leader: {leader?.name ?? 'Not assigned (Admin covers)'}</Text>
            <Text style={s.small}>Roles: {d.positions.join(', ')}</Text>
            <Text style={{ marginTop: 6, color: colors.text }}>{members.length} volunteers: {members.map(m => m.name.split(' ')[0]).join(', ')}</Text>
          </Card>
        );
      })}
    </Screen>
  );
}
