import { useState } from 'react';
import { Text } from 'react-native';
import { useMe } from '../../src/state/AppContext';
import { Button, Card, Field, Screen, colors, s } from '../../src/components/ui';
import { PersonalInfo, ProfileEditor } from '../../src/screens/Profile';
import { ChangePasswordScreen } from '../../src/screens/Auth';

export default function MyProfile() {
  const { currentUser, saveMyContact } = useMe();
  const [mode, setMode] = useState<'view' | 'edit' | 'contact' | 'password'>('view');
  const [contact, setContact] = useState(currentUser.contact ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const owner = currentUser.role === 'owner';
  if (mode === 'password') return <ChangePasswordScreen onDone={() => { setMode('view'); setMsg('Password changed.'); }} />;
  if (mode === 'edit') return <ProfileEditor user={currentUser} onClose={m => { setMode('view'); setMsg(m ?? null); }} />;
  return (
    <Screen title="My Profile" subtitle="Your personal details">
      {msg && <Text style={[s.small, { marginBottom: 8, color: colors.green }]}>{msg}</Text>}
      <PersonalInfo user={currentUser} title={currentUser.name} />
      {mode === 'contact' && (
        <Card>
          <Field label="Contact number (optional)" value={contact} placeholder="+44 7700 900123" keyboardType="phone-pad" onChangeText={setContact} testID="my-contact" />
          {err && <Text style={{ color: colors.red, marginBottom: 6 }}>{err}</Text>}
          <Button label="Save number" testID="save-contact" onPress={() => { const e = saveMyContact(contact); setErr(e); if (!e) { setMode('view'); setMsg('Contact number saved.'); } }} />
          <Button label="Cancel" outline onPress={() => { setMode('view'); setErr(null); setContact(currentUser.contact ?? ''); }} />
        </Card>
      )}
      {mode === 'view' && (owner
        ? <Button label="Edit my profile" onPress={() => setMode('edit')} testID="edit-my-profile" />
        : <>
            <Button label="Edit contact number" onPress={() => { setMsg(null); setMode('contact'); }} testID="edit-contact" />
            <Text style={[s.small, { marginTop: 8 }]}>To change your name, date of birth or username, ask Vini (the owner).</Text>
          </>)}
      <Button label="Change password" outline onPress={() => { setMsg(null); setMode('password'); }} testID="change-password" />
    </Screen>
  );
}
