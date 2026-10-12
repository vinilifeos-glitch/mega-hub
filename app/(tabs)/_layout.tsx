import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, View } from 'react-native';
import { useApp } from '../../src/state/AppContext';
import { colors } from '../../src/components/ui';
import { ChangePasswordScreen, SignInScreen } from '../../src/screens/Auth';

const icon = (name: string) => ({ focused, color, size }: { focused: boolean; color: any; size: number }) =>
  <Ionicons name={(focused ? name : `${name}-outline`) as React.ComponentProps<typeof Ionicons>['name']} size={size ?? 24} color={color} />;

export default function TabsLayout() {
  const { ready, currentUser, canManageAccounts } = useApp();
  if (!ready) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}><ActivityIndicator color={colors.primary} /></View>;
  if (!currentUser) return <SignInScreen />;
  if (currentUser.mustChangePassword) return <ChangePasswordScreen firstTime />;
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarLabelStyle: { fontSize: 11, fontWeight: '600' }, tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, height: 64, paddingTop: 6, paddingBottom: 8 } }}>
      <Tabs.Screen name="index" options={{ title: 'Services', headerTitle: 'Mega Hub', tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="departments" options={{ title: 'Depts', headerTitle: 'Departments', tabBarIcon: icon('grid') }} />
      <Tabs.Screen name="availability" options={{ title: 'Available', headerTitle: 'Availability', tabBarIcon: icon('close-circle'), }} />
      <Tabs.Screen name="my-rota" options={{ title: 'My rota', tabBarIcon: icon('hand-left'), }} />
      <Tabs.Screen name="team" options={{ title: 'Team', headerTitle: 'My team', tabBarIcon: icon('people'), href: currentUser.role === 'admin' ? undefined : null }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', headerTitle: 'My profile', tabBarIcon: icon('person-circle') }} />
      <Tabs.Screen name="accounts" options={{ title: 'Accounts', tabBarIcon: icon('key'), href: canManageAccounts ? undefined : null }} />
    </Tabs>
  );
}
