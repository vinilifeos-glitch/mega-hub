import { useState } from 'react';
import { Text } from 'react-native';
import { useMe } from '../../src/state/AppContext';
import { Button, Screen, colors, s } from '../../src/components/ui';
import { ProfileEditor, RolesView } from '../../src/screens/Profile';

export default function MyRoles() {
  const { currentUser } = useMe();
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (editing) return <ProfileEditor user={currentUser} onClose={m => { setEditing(false); setMsg(m ?? null); }} />;
  return (
    <Screen title="My Roles" subtitle="Departments and roles you serve in">
      {msg && <Text style={[s.small, { marginBottom: 8, color: colors.green }]}>{msg}</Text>}
      <RolesView user={currentUser} />
      {currentUser.role === 'owner'
        ? <Button label="Edit my departments & roles" onPress={() => setEditing(true)} />
        : <Text style={[s.small, { marginTop: 8 }]}>Roles are assigned by Vini (the owner).</Text>}
    </Screen>
  );
}
