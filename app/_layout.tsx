import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProvider, useApp } from '../src/state/AppContext';
import { ThemeProvider } from '../src/components/ui';
import { ConfirmHost } from '../src/components/confirm';

/** Palette follows the per-user theme from AppContext (device last theme on the sign-in screen). */
function Themed() {
  const { theme, setTheme } = useApp();
  return (
    <ThemeProvider mode={theme} setMode={setTheme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
      <ConfirmHost />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return <AppProvider><Themed /></AppProvider>;
}
