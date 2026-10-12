import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMe } from '../../src/state/AppContext';
import { Card, Icon, IconName, RoleBadge, Screen, useColors, useStyles } from '../../src/components/ui';

/** Groups Profile (with language + appearance), Team (admins) and Accounts (owner). */
export default function More() {
  const colors = useColors(); const s = useStyles();
  const { currentUser, canManageAccounts, t } = useMe();
  const router = useRouter();
  const link = (href: '/profile' | '/team' | '/accounts', icon: IconName, title: string, hint: string, last?: boolean) => (
    <Pressable key={href} testID={`more-${href.slice(1)}`} accessibilityRole="button" accessibilityLabel={title} onPress={() => router.navigate(href)}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, minHeight: 56, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
        <Icon name={icon} size={20} color={colors.primaryText} />
      </View>
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={s.h2}>{title}</Text>
        <Text style={s.small}>{hint}</Text>
      </View>
      <Icon name="chevron-forward" size={20} />
    </Pressable>
  );
  const isAdmin = currentUser.role === 'admin';
  return (
    <Screen title={t('more.title')} subtitle={t('more.subtitle')}>
      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.header, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
          <Text style={{ color: colors.onHeader, fontSize: 18, fontWeight: '800' }}>{(currentUser.firstName || currentUser.username).slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.h2}>{currentUser.name}</Text>
          <Text style={[s.small, { marginBottom: 6 }]}>@{currentUser.username}</Text>
          <RoleBadge role={currentUser.role} />
        </View>
      </Card>
      <Text style={s.section}>{t('more.settings')}</Text>
      <Card style={{ paddingVertical: 4 }}>{link('/profile', 'person-circle-outline', t('more.profile'), t('more.profileHint'), true)}</Card>
      {(isAdmin || canManageAccounts) && <>
        <Text style={s.section}>{t('more.admin')}</Text>
        <Card style={{ paddingVertical: 4 }}>
          {isAdmin && link('/team', 'people-outline', t('more.team'), t('more.teamHint'), !canManageAccounts)}
          {canManageAccounts && link('/accounts', 'key-outline', t('more.accounts'), t('more.accountsHint'), true)}
        </Card>
      </>}
    </Screen>
  );
}
