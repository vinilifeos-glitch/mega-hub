import { Redirect, useLocalSearchParams } from 'expo-router';
import { useApp } from '../../src/state/AppContext';
import { SongView } from '../../src/screens/SongView';
export default function SongRoute() {
  const { id, key } = useLocalSearchParams<{ id: string; key?: string }>(); const { ready, currentUser } = useApp();
  if (!ready) return null; if (!currentUser || currentUser.mustChangePassword) return <Redirect href="/" />;
  return <SongView id={String(id)} keyParam={key ? String(key) : undefined} />;
}
