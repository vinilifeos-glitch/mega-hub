import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useApp } from '../../src/state/AppContext';
import { Card, Chip, Empty, Screen, colors, formatDate, s } from '../../src/components/ui';

export default function Rotas() {
  const { data, managedDepartments, isAvailable, assign, unassign, holdsRole } = useApp();
  const [serviceId, setServiceId] = useState(data.services[0]?.id);
  const [depId, setDepId] = useState<string | undefined>(managedDepartments[0]?.id);
  const dep = managedDepartments.find(d => d.id === depId) ?? managedDepartments[0];

  if (!dep) return <Screen title="Build Rotas"><Empty text="You don't manage any departments." /></Screen>;
  const members = data.users.filter(u => u.departmentIds.includes(dep.id));

  return (
    <Screen title="Build Rotas" subtitle="Assign available volunteers to each role">
      <Text style={s.section}>Service / event</Text>
      <View style={s.row}>
        {data.services.map(sv => <Chip key={sv.id} label={`${formatDate(sv.date)} · ${sv.title}`} active={sv.id === serviceId} onPress={() => setServiceId(sv.id)} />)}
      </View>
      <Text style={s.section}>Department</Text>
      <View style={s.row}>
        {managedDepartments.map(d => <Chip key={d.id} label={`${d.emoji} ${d.name}`} color={d.color} active={d.id === dep.id} onPress={() => setDepId(d.id)} />)}
      </View>

      {dep.positions.map(pos => {
        const current = data.assignments.find(a => a.serviceId === serviceId && a.departmentId === dep.id && a.position === pos);
        const person = data.users.find(u => u.id === current?.userId);
        const busy = (uid: string) => data.assignments.some(a => a.serviceId === serviceId && a.userId === uid && a.id !== current?.id);
        return (
          <Card key={pos}>
            <View style={[s.row, { justifyContent: 'space-between' }]}>
              <Text style={s.h2}>{pos}</Text>
              {current && (
                <Pressable onPress={() => unassign(current.id)}><Text style={{ color: colors.red, fontWeight: '600' }}>Clear</Text></Pressable>
              )}
            </View>
            <Text style={[s.small, { marginBottom: 8 }]}>{person ? `Assigned: ${person.name}` : 'Unfilled — tap a volunteer'}</Text>
            <View style={s.row}>
              {members.filter(m => holdsRole(m.id, dep.id, pos)).length === 0 && <Text style={s.small}>Nobody holds this role yet. The owner can add it to someone's profile.</Text>}
              {members.filter(m => holdsRole(m.id, dep.id, pos)).map(m => {
                const av = isAvailable(m.id, serviceId!);
                const blocked = av === false || busy(m.id);
                const tag = av === true ? '✓' : av === false ? '✕' : '?';
                return (
                  <Chip key={m.id} color={blocked ? '#B8B3C7' : dep.color} active={m.id === current?.userId}
                    label={`${tag} ${m.name.split(' ')[0]}${busy(m.id) ? ' (busy)' : ''}`}
                    onPress={blocked ? undefined : () => assign(serviceId!, dep.id, pos, m.id)} />
                );
              })}
            </View>
          </Card>
        );
      })}
      <Text style={s.small}>Only people who hold the role are listed. ✓ available · ? not answered · ✕ unavailable (can't be picked) · busy = already serving elsewhere that day</Text>
    </Screen>
  );
}
