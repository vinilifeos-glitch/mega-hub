import { useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from '../src/state/AppContext';
import { ThemeMode, ThemeProvider } from '../src/components/ui';

export default function RootLayout() {
  // TODO(Tom): drive from AppContext `theme` / `setTheme(t)` once the notes branch lands (per-user, plus device-level last theme for sign-in).
  const [mode, setMode] = useState<ThemeMode>('light');
  return (
    <AppProvider>
      <ThemeProvider mode={mode} setMode={setMode}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </AppProvider>
  );
}
