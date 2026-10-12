import { DateField } from '../../src/components/DateField';
import { useState } from 'react';
import { Text } from 'react-native';
import { formatDobInput, useMe } from '../../src/state/AppContext';
import { Button, Card, Field, LanguagePicker, Screen, colors, s, Notice } from '../../src/components/ui';
import { PersonalInfo } from '../../src/screens/Profile';
import { ChangePasswordScreen } from '../../src/screens/Auth';

export default function MyProfile() {
  const { currentUser: me, saveMyProfile, signOut, t, language, setLanguage } = useMe();
  const [mode, setMode] = useState<'view' | 'edit' | 'password'>('view');
  const init = () => ({ firstName: me.firstName, middleNames: me.middleNames, lastName: me.lastName, dob: me.dob, contact: me.contact ?? '' });
  const [f, setF] = useState(init);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (mode === 'password') return <ChangePasswordScreen onDone={() => { setMode('view'); setMsg(t('auth.passwordChanged')); }} onCancel={() => setMode('view')} />;
  if (mode === 'edit') return (
    <Screen title={t('profile.editTitle')} subtitle={t('profile.usernameLocked', { username: me.username })}>
      <Card>
        <Field label={t('fields.firstName')} value={f.firstName} onChangeText={v => setF({ ...f, firstName: v })} autoCapitalize="words" testID="me-first" />
        <Field label={t('fields.middleNames')} value={f.middleNames} onChangeText={v => setF({ ...f, middleNames: v })} autoCapitalize="words" testID="me-middle" />
        <Field label={t('fields.surname')} value={f.lastName} onChangeText={v => setF({ ...f, lastName: v })} autoCapitalize="words" testID="me-last" />
        <DateField label={t('fields.dob')} limit="past" value={f.dob} onChange={v => setF({ ...f, dob: v })} testID="me-dob" />
        <Field label={t('fields.contact')} value={f.contact} placeholder={t('fields.contactPlaceholder')} keyboardType="phone-pad" onChangeText={v => setF({ ...f, contact: v })} testID="me-contact" />
        {err && <Notice tone="error" text={err} />}
        <Button label={t('common.save')} testID="me-save" onPress={() => { const e = saveMyProfile(f); setErr(e); if (!e) { setMode('view'); setMsg(t('profile.saved')); } }} />
        <Button label={t('common.cancel')} outline onPress={() => { setErr(null); setMode('view'); }} />
      </Card>
    </Screen>
  );
  return (
    <Screen title={t('profile.title')} subtitle={t('profile.subtitle')}>
      {msg && <Notice text={msg} />}
      <PersonalInfo user={me} title={me.name} />
      <Text style={s.section}>{t('language.title')}</Text>
      <Card>
        <Text style={[s.small, { marginBottom: 12 }]}>{t('language.hint')}</Text>
        <LanguagePicker value={language} onChange={setLanguage} />
      </Card>
      <Text style={s.section}>{t('profile.accountSection')}</Text>
      <Button label={t('profile.editDetails')} onPress={() => { setMsg(null); setF(init()); setMode('edit'); }} testID="edit-me" />
      <Button label={t('auth.changePassword')} outline onPress={() => { setMsg(null); setMode('password'); }} testID="change-password" />
      <Button label={t('auth.signOut')} color={colors.red} outline onPress={signOut} testID="signout" />
    </Screen>
  );
}
