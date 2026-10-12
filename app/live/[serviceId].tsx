import { Redirect, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../src/state/AppContext';
import { LiveMode } from '../../src/screens/Live';
export default function LiveRoute() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>(); const { ready, currentUser } = useApp();
  if (!ready) return null; if (!currentUser || currentUser.mustChangePassword) return <Redirect href="/" />;
  return <LiveMode serviceId={String(serviceId)} />;
}
