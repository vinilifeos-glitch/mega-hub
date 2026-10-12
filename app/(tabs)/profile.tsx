import { DateField } from '../../src/components/DateField';
import { useState } from 'react';
import { Text } from 'react-native';
import { formatDobInput, useMe } from '../../src/state/AppContext';
import { Button, Card, Field, LanguagePicker, Lang, Screen, colors, s, Notice } from '../../src/components/ui';
import { PersonalInfo } from '../../src/screens/Profile';
import { ChangePasswordScreen } from '../../src/screens/Auth';

export default function MyProfile() {
  const { currentUser: me, saveMyProfile, signOut } = useMe();
  const [mode, setMode] = useState<'view' | 'edit' | 'password'>('view');
  const init = () => ({ firstName: me.firstName, middleNames: me.middleNames, lastName: me.lastName, dob: me.dob, contact: me.contact ?? '' });
  const [f, setF] = useState(init);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // TODO(Tom): wire to AppContext language setting (useApp().language / setLanguage(lang) from the i18n branch). Local state only, not persisted.
  const [lang, setLang] = useState<Lang>('pt');
  if (mode === 'password') return <ChangePasswordScreen onDone={() => { setMode('view'); setMsg('Password changed.'); }} onCancel={() => setMode('view')} />;
  if (mode === 'edit') return (
    <Screen title="Edit my profile" subtitle={`Username @${me.username} can only be changed by the owner`}>
      <Card>
        <Field label="First name" value={f.firstName} onChangeText={v => setF({ ...f, firstName: v })} autoCapitalize="words" testID="me-first" />
        <Field label="Middle names (optional)" value={f.middleNames} onChangeText={v => setF({ ...f, middleNames: v })} autoCapitalize="words" testID="me-middle" />
        <Field label="Surname" value={f.lastName} onChangeText={v => setF({ ...f, lastName: v })} autoCapitalize="words" testID="me-last" />
        <DateField label="Date of birth" limit="past" value={f.dob} onChange={v => setF({ ...f, dob: v })} testID="me-dob" />
        <Field label="Contact number (optional)" value={f.contact} placeholder="+44 7700 900123" keyboardType="phone-pad" onChangeText={v => setF({ ...f, contact: v })} testID="me-contact" />
        {err && <Notice tone="error" text={err} />}
        <Button label="Save" testID="me-save" onPress={() => { const e = saveMyProfile(f); setErr(e); if (!e) { setMode('view'); setMsg('Profile saved.'); } }} />
        <Button label="Cancel" outline onPress={() => { setErr(null); setMode('view'); }} />
      </Card>
    </Screen>
  );
  return (
    <Screen title="My profile" subtitle="Your personal details.">
      {msg && <Notice text={msg} />}
      <PersonalInfo user={me} title={me.name} />
      <Text style={s.section}>Language</Text>
      <Card>
        <Text style={[s.small, { marginBottom: 12 }]}>Choose the language for your account.</Text>
        <LanguagePicker value={lang} onChange={setLang} />
      </Card>
      <Text style={s.section}>Account</Text>
      <Button label="Edit my details" onPress={() => { setMsg(null); setF(init()); setMode('edit'); }} testID="edit-me" />
      <Button label="Change password" outline onPress={() => { setMsg(null); setMode('password'); }} testID="change-password" />
      <Button label="Sign out" color={colors.red} outline onPress={signOut} testID="signout" />
    </Screen>
  );
}
