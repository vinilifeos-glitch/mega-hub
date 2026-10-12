import { Tabs } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { useApp } from '../../src/state/AppContext';
import { colors } from '../../src/components/ui';
import { ChangePasswordScreen, SignInScreen } from '../../src/screens/Auth';

const icon = (e: string) => ({ focused }: { focused: boolean }) => <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>{e}</Text>;

export default function TabsLayout() {
  const { ready, currentUser, canManageAccounts } = useApp();
  if (!ready) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}><ActivityIndicator color={colors.primary} /></View>;
  if (!currentUser) return <SignInScreen />;
  if (currentUser.mustChangePassword) return <ChangePasswordScreen firstTime />;
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarLabelStyle: { fontSize: 11, fontWeight: '600' }, tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, height: 64, paddingTop: 6, paddingBottom: 8 } }}>
      <Tabs.Screen name="index" options={{ title: 'Services', headerTitle: 'Mega Hub', tabBarIcon: icon('🗓️') }} />
      <Tabs.Screen name="departments" options={{ title: 'Teams', headerTitle: 'Departments', tabBarIcon: icon('🏛️') }} />
      <Tabs.Screen name="availability" options={{ title: 'Away', headerTitle: 'Availability', tabBarIcon: icon('🚫'), }} />
      <Tabs.Screen name="my-rota" options={{ title: 'My Rota', tabBarIcon: icon('✋'), }} />
      <Tabs.Screen name="team" options={{ title: 'Team', headerTitle: 'My Team', tabBarIcon: icon('👥'), href: currentUser.role === 'admin' ? undefined : null }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', headerTitle: 'My Profile', tabBarIcon: icon('👤') }} />
      <Tabs.Screen name="accounts" options={{ title: 'Accounts', tabBarIcon: icon('🔑'), href: canManageAccounts ? undefined : null }} />
    </Tabs>
  );
}
