import { Redirect, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../../src/state/AppContext';
import { DeptTeam } from '../../../src/screens/DeptPage';
export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { ready, currentUser } = useApp();
  if (!ready) return null; if (!currentUser || currentUser.mustChangePassword) return <Redirect href="/" />;
  return <DeptTeam id={String(id)} />;
}
