import { Tabs } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { useApp } from '../../src/state/AppContext';
import { colors } from '../../src/components/ui';
import { ChangePasswordScreen, SignInScreen } from '../../src/screens/Auth';

const icon = (e: string) => () => <Text style={{ fontSize: 20 }}>{e}</Text>;

export default function TabsLayout() {
  const { ready, currentUser, canManageAccounts } = useApp();
  if (!ready) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></View>;
  if (!currentUser) return <SignInScreen />;
  if (currentUser.mustChangePassword) return <ChangePasswordScreen firstTime />;
  const manager = currentUser.role !== 'volunteer';
  const serves = currentUser.role === 'volunteer' || currentUser.departmentIds.length > 0;
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, tabBarLabelStyle: { fontSize: 10 }, headerStyle: { backgroundColor: colors.bg }, headerTitleStyle: { fontWeight: '800' } }}>
      <Tabs.Screen name="index" options={{ title: 'Home', headerTitle: 'Mega Hub', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="departments" options={{ title: 'Teams', headerTitle: 'Departments', tabBarIcon: icon('⛪') }} />
      <Tabs.Screen name="availability" options={{ title: 'Available', headerTitle: 'Availability', tabBarIcon: icon('📅'), href: serves ? undefined : null }} />
      <Tabs.Screen name="my-rota" options={{ title: 'My Rota', tabBarIcon: icon('🙋'), href: serves ? undefined : null }} />
      <Tabs.Screen name="rotas" options={{ title: 'Rotas', headerTitle: 'Build Rotas', tabBarIcon: icon('🗂️'), href: manager ? undefined : null }} />
      <Tabs.Screen name="roles" options={{ title: 'Roles', headerTitle: 'My Roles', tabBarIcon: icon('🎯') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', headerTitle: 'My Profile', tabBarIcon: icon('👤') }} />
      <Tabs.Screen name="people" options={{ title: 'People', tabBarIcon: icon('👥'), href: canManageAccounts ? undefined : null }} />
    </Tabs>
  );
}
