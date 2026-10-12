import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, View } from 'react-native';
import { useApp } from '../../src/state/AppContext';
import { colors, contentMax } from '../../src/components/ui';
import { ChangePasswordScreen, SignInScreen } from '../../src/screens/Auth';

const icon = (name: string) => ({ focused, color, size }: { focused: boolean; color: any; size: number }) =>
  <Ionicons name={(focused ? name : `${name}-outline`) as React.ComponentProps<typeof Ionicons>['name']} size={size ?? 24} color={color} />;

export default function TabsLayout() {
  const { ready, currentUser, canManageAccounts, t } = useApp();
  if (!ready) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}><ActivityIndicator color={colors.primary} /></View>;
  if (!currentUser) return <SignInScreen />;
  if (currentUser.mustChangePassword) return <ChangePasswordScreen firstTime />;
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarLabel: ({ children, color }: { children: string; color: any }) => <Text numberOfLines={2} allowFontScaling style={{ color, fontSize: 11, lineHeight: 13, fontWeight: '600', textAlign: 'center', paddingHorizontal: 1 }}>{children}</Text>, tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, height: 68, paddingTop: 6, paddingBottom: 10, width: '100%', maxWidth: contentMax, alignSelf: 'center' }, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.services'), headerTitle: t('common.appName'), tabBarIcon: icon('home') }} />
      <Tabs.Screen name="departments" options={{ title: t('tabs.departments'), headerTitle: t('departmentsScreen.title'), tabBarIcon: icon('grid') }} />
      <Tabs.Screen name="availability" options={{ title: t('tabs.availability'), headerTitle: t('availability.title'), tabBarIcon: icon('calendar'), }} />
      <Tabs.Screen name="my-rota" options={{ title: t('tabs.myRota'), tabBarIcon: icon('clipboard'), }} />
      <Tabs.Screen name="team" options={{ title: t('tabs.team'), headerTitle: t('team.title'), tabBarIcon: icon('people'), href: currentUser.role === 'admin' ? undefined : null }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile'), headerTitle: t('profile.title'), tabBarIcon: icon('person-circle') }} />
      <Tabs.Screen name="accounts" options={{ title: t('tabs.accounts'), tabBarIcon: icon('key'), href: canManageAccounts ? undefined : null }} />
    </Tabs>
  );
}
