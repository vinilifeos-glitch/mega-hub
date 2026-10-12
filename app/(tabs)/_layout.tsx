import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, View } from 'react-native';
import { useApp } from '../../src/state/AppContext';
import { colors, contentMax } from '../../src/components/ui';
import { ChangePasswordScreen, SignInScreen } from '../../src/screens/Auth';

const icon = (name: string) => ({ focused, color, size }: { focused: boolean; color: any; size: number }) =>
  <Ionicons name={(focused ? name : `${name}-outline`) as React.ComponentProps<typeof Ionicons>['name']} size={size ?? 24} color={color} />;

export default function TabsLayout() {
  const { ready, currentUser, canManageAccounts } = useApp();
  if (!ready) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}><ActivityIndicator color={colors.primary} /></View>;
  if (!currentUser) return <SignInScreen />;
  if (currentUser.mustChangePassword) return <ChangePasswordScreen firstTime />;
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarLabel: ({ children, color }: { children: string; color: any }) => <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} allowFontScaling style={{ color, fontSize: 12, fontWeight: '600', textAlign: 'center', paddingHorizontal: 2 }}>{children}</Text>, tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, height: 68, paddingTop: 6, paddingBottom: 10, width: '100%', maxWidth: contentMax, alignSelf: 'center' }, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="index" options={{ title: 'Services', headerTitle: 'Mega Hub', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="departments" options={{ title: 'Depts', headerTitle: 'Departments', tabBarIcon: icon('grid') }} />
      <Tabs.Screen name="availability" options={{ title: 'Available', headerTitle: 'Availability', tabBarIcon: icon('calendar'), }} />
      <Tabs.Screen name="my-rota" options={{ title: 'My Rota', tabBarIcon: icon('clipboard'), }} />
      <Tabs.Screen name="team" options={{ title: 'Team', headerTitle: 'My team', tabBarIcon: icon('people'), href: currentUser.role === 'admin' ? undefined : null }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', headerTitle: 'My profile', tabBarIcon: icon('person-circle') }} />
      <Tabs.Screen name="accounts" options={{ title: 'Accounts', tabBarIcon: icon('key'), href: canManageAccounts ? undefined : null }} />
    </Tabs>
  );
}
