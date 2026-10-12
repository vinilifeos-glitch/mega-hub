import { Redirect, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../src/state/AppContext';
import { RotaView } from '../../src/screens/RotaView';
export default function RotaRoute() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>(); const { ready, currentUser } = useApp();
  if (!ready) return null; if (!currentUser || currentUser.mustChangePassword) return <Redirect href="/" />;
  return <RotaView serviceId={String(serviceId)} />;
}
