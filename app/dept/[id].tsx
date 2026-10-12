import { Redirect, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../src/state/AppContext';
import { DeptPage } from '../../src/screens/DeptPage';
export default function DeptRoute() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { ready, currentUser } = useApp();
  if (!ready) return null; if (!currentUser || currentUser.mustChangePassword) return <Redirect href="/" />;
  return <DeptPage id={String(id)} />;
}
