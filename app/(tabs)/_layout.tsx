import { Tabs, router } from 'expo-router';
import { emitTabReset } from '../../src/tabReset';
import { leaveGuarded } from '../../src/unsaved';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Text, View } from 'react-native';
import { useApp } from '../../src/state/AppContext';
import { contentMax, useColors } from '../../src/components/ui';
import { ChangePasswordScreen, SignInScreen } from '../../src/screens/Auth';

const icon = (name: string) => ({ focused, color, size }: { focused: boolean; color: any; size: number }) =>
  <Ionicons name={(focused ? name : `${name}-outline`) as React.ComponentProps<typeof Ionicons>['name']} size={size ?? 24} color={color} />;

export default function TabsLayout() {
  const colors = useColors();
  const { ready, currentUser, t } = useApp();
  if (!ready) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}><ActivityIndicator color={colors.primary} /></View>;
  if (!currentUser) return <SignInScreen />;
  if (currentUser.mustChangePassword) return <ChangePasswordScreen firstTime />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
    <Tabs screenListeners={({ route }) => ({ tabPress: (e: any) => { e.preventDefault(); leaveGuarded(() => { emitTabReset(); router.navigate((route.name === 'index' ? '/' : `/${route.name}`) as any); }); } })} screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarLabel: ({ children, color }: { children: string; color: any }) => <Text numberOfLines={2} allowFontScaling style={{ color, fontSize: 11, lineHeight: 13, fontWeight: '600', textAlign: 'center', paddingHorizontal: 1 }}>{children}</Text>, tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.border, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderLeftColor: colors.border, borderRightColor: colors.border, borderTopLeftRadius: 16, borderTopRightRadius: 16, height: 68, paddingTop: 6, paddingBottom: 10, width: '100%', maxWidth: contentMax, alignSelf: 'center', shadowColor: colors.shadow, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -2 }, elevation: 8 }, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="index" options={{ title: t('tabs.services'), headerTitle: t('common.appName'), tabBarIcon: icon('home') }} />
      <Tabs.Screen name="my-rota" options={{ title: t('tabs.myRota'), tabBarIcon: icon('clipboard') }} />
      <Tabs.Screen name="availability" options={{ title: t('tabs.availability'), headerTitle: t('availability.title'), tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="departments" options={{ title: t('tabs.departments'), headerTitle: t('departmentsScreen.title'), tabBarIcon: icon('grid') }} />
      <Tabs.Screen name="more" options={{ title: t('more.title'), tabBarIcon: icon('ellipsis-horizontal-circle') }} />
      {/* Reached from More (permission checks unchanged inside each screen and on the More list). */}
      <Tabs.Screen name="profile" options={{ href: null, title: t('tabs.profile') }} />
      <Tabs.Screen name="team" options={{ href: null, title: t('tabs.team') }} />
      <Tabs.Screen name="accounts" options={{ href: null, title: t('tabs.accounts') }} />
    </Tabs>
    </View>
  );
}
