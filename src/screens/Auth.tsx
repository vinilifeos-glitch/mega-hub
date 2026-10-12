import { useState } from 'react';
import { Text } from 'react-native';
import { useApp } from '../state/AppContext';
import { Button, Card, Field, Screen, colors, s, Notice } from '../components/ui';

export function SignInScreen() {
  const { signIn } = useApp();
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState<string | null>(null);
  const go = async () => setErr(await signIn(u, p));
  return (
    <Screen title="Mega Hub" subtitle="Sign in to see your services and rota.">
      <Card>
        <Field label="Username" value={u} onChangeText={setU} testID="username" />
        <Field label="Password" value={p} onChangeText={setP} secureTextEntry onSubmitEditing={go} testID="password" />
        {err && <Notice tone="error" text={err} />}
        <Button label="Sign in" onPress={go} testID="signin" />
      </Card>
      <Text style={[s.small, { textAlign: 'center', marginTop: 8 }]}>No account? Ask your department admin or Vini to create one for you.</Text>
    </Screen>
  );
}

export function ChangePasswordScreen({ firstTime, onDone, onCancel }: { firstTime?: boolean; onDone?: () => void; onCancel?: () => void }) {
  const { changePassword, signOut } = useApp();
  const [o, setO] = useState(''); const [n, setN] = useState(''); const [c, setC] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    if (n !== c) return setErr("New passwords don't match.");
    const e = await changePassword(o, n); setErr(e); if (!e) onDone?.();
  };
  return (
    <Screen title="Choose a new password" subtitle={firstTime ? 'Your password is temporary. Please set your own before continuing.' : 'Change your password'}>
      <Card>
        <Field label={firstTime ? 'Temporary password' : 'Current password'} value={o} onChangeText={setO} secureTextEntry testID="oldpw" />
        <Field label="New password (min 4 characters)" value={n} onChangeText={setN} secureTextEntry testID="newpw" />
        <Field label="Confirm new password" value={c} onChangeText={setC} secureTextEntry testID="confirmpw" />
        {err && <Notice tone="error" text={err} />}
        <Button label="Save password" onPress={go} testID="savepw" />
        {firstTime ? <Button label="Sign out" outline onPress={signOut} /> : onCancel ? <Button label="Cancel" outline onPress={onCancel} /> : null}
      </Card>
    </Screen>
  );
}
