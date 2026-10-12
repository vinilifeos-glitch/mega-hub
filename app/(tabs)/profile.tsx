import { useState } from 'react';
import { Text } from 'react-native';
import { useMe } from '../../src/state/AppContext';
import { Button, Screen, s } from '../../src/components/ui';
import { ProfileEditor, ProfileView } from '../../src/screens/Profile';

export default function MyProfile() {
  const { currentUser } = useMe();
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (editing) return <ProfileEditor user={currentUser} onClose={m => { setEditing(false); setMsg(m ?? null); }} />;
  return (
    <Screen title="My Profile" subtitle={currentUser.role === 'owner' ? 'You can edit every profile from People' : 'Your details and where you serve'}>
      {msg && <Text style={[s.small, { marginBottom: 8 }]}>{msg}</Text>}
      <ProfileView user={currentUser} title={currentUser.name} />
      {currentUser.role === 'owner'
        ? <Button label="Edit my profile" onPress={() => setEditing(true)} testID="edit-my-profile" />
        : <Text style={[s.small, { marginTop: 8 }]}>To change your details or roles, ask Vini (the owner).</Text>}
    </Screen>
  );
}
