import { useState } from 'react';
import { Text, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { LanguagePicker, Button, Card, Field, Screen, Notice, useColors, useStyles } from '../components/ui';

export function SignInScreen() {
  const colors = useColors(); const s = useStyles();
  const { signIn, t, ownerName, language, setDeviceLanguage } = useApp();
  const [u, setU] = useState(''); const [p, setP] = useState(''); const [err, setErr] = useState<string | null>(null);
  const go = async () => setErr(await signIn(u, p));
  return (
    <Screen title={t('common.appName')} subtitle={t('auth.signInSubtitle')}>
      <Card>
        <Field label={t('fields.username')} value={u} onChangeText={setU} testID="username" />
        <Field label={t('fields.password')} value={p} onChangeText={setP} secureTextEntry onSubmitEditing={go} testID="password" />
        {err && <Notice tone="error" text={err} />}
        <Button label={t('auth.signIn')} onPress={go} testID="signin" />
      </Card>
      <Text style={[s.small, { textAlign: 'center', marginTop: 8 }]}>{t('auth.noAccount', { owner: ownerName })}</Text>
      <View style={{ width: '100%', maxWidth: 280, alignSelf: 'center', marginTop: 24 }}>
        <Text style={[s.label, { textAlign: 'center', marginBottom: 8 }]}>{t('language.title')}</Text>
        <LanguagePicker value={language} onChange={setDeviceLanguage} />
      </View>
    </Screen>
  );
}

export function ChangePasswordScreen({ firstTime, onDone, onCancel }: { firstTime?: boolean; onDone?: () => void; onCancel?: () => void }) {
  const colors = useColors(); const s = useStyles();
  const { changePassword, signOut, t } = useApp();
  const [o, setO] = useState(''); const [n, setN] = useState(''); const [c, setC] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    if (n !== c) return setErr(t('auth.passwordsDontMatch'));
    const e = await changePassword(o, n); setErr(e); if (!e) onDone?.();
  };
  return (
    <Screen title={firstTime ? t('auth.choosePassword') : t('auth.changePassword')} subtitle={firstTime ? t('auth.tempIntro') : t('auth.changeYourPassword')}>
      <Card>
        <Field label={firstTime ? t('auth.temporaryPassword') : t('auth.currentPassword')} value={o} onChangeText={setO} secureTextEntry testID="oldpw" />
        <Field label={t('auth.newPassword')} value={n} onChangeText={setN} secureTextEntry testID="newpw" />
        <Field label={t('auth.confirmPassword')} value={c} onChangeText={setC} secureTextEntry testID="confirmpw" />
        {err && <Notice tone="error" text={err} />}
        <Button label={t('auth.savePassword')} onPress={go} testID="savepw" />
        {firstTime ? <Button label={t('auth.signOut')} outline onPress={signOut} /> : onCancel ? <Button label={t('common.cancel')} outline onPress={onCancel} /> : null}
      </Card>
    </Screen>
  );
}
