import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* ── Design tokens ─────────────────────────────────────────────
   One neutral palette + a single accent. Status colours are only
   used for success / error feedback. Department colours stay as
   small identifying accents. */
export const colors = {
  bg: '#F7F7F8',        // app background
  card: '#FFFFFF',      // surfaces
  text: '#18181B',      // primary text
  muted: '#71717A',     // secondary text
  subtle: '#A1A1AA',    // placeholders, disabled
  border: '#E4E4E7',    // hairlines
  soft: '#F4F4F5',      // pressed / secondary fills
  primary: '#4F46E5',   // the one accent
  primarySoft: '#EEF2FF',
  green: '#15803D',
  greenSoft: '#F0FDF4',
  red: '#DC2626',
  redSoft: '#FEF2F2',
};
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
export const type = {
  title: { fontSize: 28, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.5 },
  h2: { fontSize: 17, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  small: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600' as const, color: colors.muted },
};
export const touch = 48; // minimum touch target

export function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/* ── Layout ─────────────────────────────────────────────────── */
export function Screen({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingHorizontal: space.lg + 4, paddingTop: insets.top + space.xl, paddingBottom: space.xxl + 8, width: '100%', maxWidth: 640, alignSelf: 'center' }}>
      <Text style={s.title} accessibilityRole="header">{title}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : <View style={{ height: space.xl }} />}
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

/* ── Controls ───────────────────────────────────────────────── */
export function Chip({ label, active, onPress, color, testID }: { label: string; active?: boolean; onPress?: () => void; color?: string; testID?: string }) {
  const c = color ?? colors.primary;
  return (
    <Pressable testID={testID} onPress={onPress} disabled={!onPress}
      style={({ pressed }) => [s.chip, active ? { backgroundColor: c, borderColor: c } : { borderColor: colors.border, backgroundColor: pressed ? colors.soft : colors.card }]}>
      <Text style={{ color: active ? '#fff' : !onPress ? colors.subtle : colors.text, fontWeight: '500', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

/** Primary = filled accent. `outline` = secondary (neutral). A red `color` with outline = destructive text button. */
export function Button({ label, onPress, color, outline, testID }: { label: string; onPress?: () => void; color?: string; outline?: boolean; testID?: string }) {
  const danger = color === colors.red;
  const fill = color ?? colors.primary;
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [s.btn,
        outline
          ? { backgroundColor: pressed ? colors.soft : danger ? 'transparent' : colors.card, borderColor: danger ? 'transparent' : colors.border }
          : { backgroundColor: fill, borderColor: fill, opacity: pressed ? 0.85 : 1 }]}>
      <Text style={{ color: outline ? (danger ? colors.red : colors.text) : '#fff', fontWeight: '600', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

export function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ marginBottom: space.lg }}>
      <Text style={s.label}>{label}</Text>
      <TextInput autoCapitalize="none" autoCorrect={false} placeholderTextColor={colors.subtle} style={[s.input, style]} {...rest} />
    </View>
  );
}

/* ── Feedback ───────────────────────────────────────────────── */
export function Empty({ text, icon }: { text: string; icon?: string }) {
  return (
    <View style={s.empty}>
      <Text style={{ fontSize: 32, marginBottom: space.sm }}>{icon ?? '🌿'}</Text>
      <Text style={{ ...type.small, textAlign: 'center', maxWidth: 280 }}>{text}</Text>
    </View>
  );
}

export function Notice({ text, tone = 'success' }: { text: string; tone?: 'success' | 'error' }) {
  const ok = tone === 'success';
  return (
    <View style={[s.notice, { backgroundColor: ok ? colors.greenSoft : colors.redSoft }]}>
      <Text style={{ color: ok ? colors.green : colors.red, fontSize: 14, fontWeight: '500' }}>{text}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  title: type.title,
  subtitle: { ...type.small, fontSize: 15, marginTop: space.xs, marginBottom: space.xl },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg, marginBottom: space.md, borderWidth: 1, borderColor: colors.border },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14, minHeight: 36, justifyContent: 'center', marginRight: space.sm, marginBottom: space.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, minHeight: touch, marginTop: 6, fontSize: 16, backgroundColor: colors.card, color: colors.text },
  btn: { borderWidth: 1, borderRadius: radius.md, minHeight: touch, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center', marginTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  h2: type.h2,
  small: type.small,
  label: type.label,
  section: { ...type.label, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: space.xl, marginBottom: space.md },
  empty: { alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.lg },
  notice: { borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.md, marginBottom: space.md },
});
