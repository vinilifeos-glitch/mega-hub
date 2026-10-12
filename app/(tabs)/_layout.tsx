import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useApp } from '../../src/state/AppContext';
import { colors } from '../../src/components/ui';

const icon = (e: string) => () => <Text style={{ fontSize: 20 }}>{e}</Text>;

export default function TabsLayout() {
  const { currentUser } = useApp();
  const manager = currentUser.role !== 'volunteer';
  const serves = currentUser.departmentIds.length > 0;
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, headerStyle: { backgroundColor: colors.bg }, headerTitleStyle: { fontWeight: '800' } }}>
      <Tabs.Screen name="index" options={{ title: 'Home', headerTitle: 'Mega Hub', tabBarIcon: icon('🏠') }} />
      <Tabs.Screen name="departments" options={{ title: 'Departments', tabBarIcon: icon('⛪') }} />
      <Tabs.Screen name="availability" options={{ title: 'Availability', tabBarIcon: icon('📅'), href: serves ? undefined : null }} />
      <Tabs.Screen name="my-rota" options={{ title: 'My Rota', tabBarIcon: icon('🙋'), href: serves ? undefined : null }} />
      <Tabs.Screen name="rotas" options={{ title: 'Build Rotas', tabBarIcon: icon('🗂️'), href: manager ? undefined : null }} />
    </Tabs>
  );
}
