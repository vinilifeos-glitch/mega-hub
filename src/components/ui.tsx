import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

/* ── Icons (Ionicons only) ──────────────────────────────────── */
export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export function Icon({ name, size = 18, color = colors.muted, style }: { name: IconName; size?: number; color?: string; style?: any }) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}
const DEPT_ICONS: Record<string, IconName> = { 'd-music': 'musical-notes-outline', 'd-kids': 'happy-outline', 'd-obreiros': 'people-outline' };
export const deptIcon = (id: string): IconName => DEPT_ICONS[id] ?? 'grid-outline';
/** Department heading: icon in the department colour + name. */
export function DeptTitle({ dep, suffix, style }: { dep: { id: string; name: string; color: string }; suffix?: string; style?: any }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }, style]}>
      <Icon name={deptIcon(dep.id)} size={20} color={dep.color} style={{ marginRight: 8 }} />
      <Text style={[type.h2, { flexShrink: 1 }]}>{dep.name}{suffix ?? ''}</Text>
    </View>
  );
}

/* ── Design tokens ─────────────────────────────────────────────
   One neutral palette + a single accent. Status colours are only
   used for success / error feedback. Department colours stay as
   small identifying accents. */
export const colors = {
  bg: '#F5F6F8',        // app background (cool neutral)
  card: '#FFFFFF',      // surfaces
  text: '#111827',      // primary text
  muted: '#4B5563',     // secondary text (AA contrast on white and bg)
  subtle: '#9CA3AF',    // placeholders, disabled
  border: '#E5E7EB',    // hairlines
  soft: '#F3F4F6',      // pressed / secondary fills
  primary: '#2F54EB',   // the one accent
  primarySoft: '#EEF2FF',
  green: '#15803D',
  greenSoft: '#F0FDF4',
  red: '#DC2626',
  redSoft: '#FEF2F2',
};
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };
export const contentMax = 640; // content + tab bar width on wide screens
export const shadow = { shadowColor: '#111827', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 1 };
export const type = {
  title: { fontSize: 30, fontWeight: '700' as const, color: colors.text, letterSpacing: -0.6 },
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
      contentContainerStyle={{ paddingHorizontal: space.lg + 4, paddingTop: insets.top + space.xl, paddingBottom: space.xxl + 8, width: '100%', maxWidth: contentMax, alignSelf: 'center' }}>
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
export function Chip({ label, active, onPress, color, testID, icon }: { label: string; active?: boolean; onPress?: () => void; color?: string; testID?: string; icon?: IconName }) {
  const c = color ?? colors.primary;
  return (
    <Pressable testID={testID} onPress={onPress} disabled={!onPress}
      style={({ pressed }) => [s.chip, active ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.border, backgroundColor: pressed ? colors.soft : colors.card }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
        {icon ? <Icon name={icon} size={16} color={active ? '#fff' : !onPress ? colors.subtle : c} style={{ marginRight: 6 }} /> : null}
        <Text style={{ color: active ? '#fff' : !onPress ? colors.subtle : colors.text, fontWeight: '500', fontSize: 14, flexShrink: 1 }}>{label}</Text>
      </View>
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
      <Text style={{ color: outline ? (danger ? colors.red : colors.text) : '#fff', fontWeight: '600', fontSize: 16, textAlign: 'center' }}>{label}</Text>
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

/** Icon-only button: always labelled for screen readers, 44px+ target. */
export function IconButton({ icon, label, onPress, color, testID, style }: { icon: IconName; label: string; onPress?: () => void; color?: string; testID?: string; style?: ViewStyle }) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}
      style={({ pressed }) => [{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: pressed ? colors.soft : 'transparent' }, style]}>
      <Icon name={icon} size={22} color={color ?? colors.primary} />
    </Pressable>
  );
}

/** Presentational segmented control for the account language. */
export type Lang = 'pt' | 'en';
export function LanguagePicker({ value, onChange }: { value: Lang; onChange: (v: Lang) => void }) {
  const opts: { v: Lang; label: string }[] = [{ v: 'pt', label: 'Português' }, { v: 'en', label: 'English' }];
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: colors.soft, borderRadius: radius.md, padding: 4 }}>
      {opts.map(o => {
        const on = o.v === value;
        return (
          <Pressable key={o.v} testID={`lang-${o.v}`} onPress={() => onChange(o.v)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={o.label}
            style={{ flex: 1, minHeight: 44, paddingVertical: space.sm, paddingHorizontal: space.sm, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.card : 'transparent', ...(on ? shadow : {}) }}>
            <Text style={{ fontSize: 15, fontWeight: on ? '600' : '500', color: on ? colors.text : colors.muted, textAlign: 'center' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ── Feedback ───────────────────────────────────────────────── */
export function Empty({ text, icon }: { text: string; icon?: IconName }) {
  return (
    <View style={s.empty}>
      <Icon name={icon ?? 'file-tray-outline'} size={36} color={colors.primary} style={{ marginBottom: space.md }} />
      <Text style={{ fontSize: 15, lineHeight: 22, color: colors.muted, textAlign: 'center', maxWidth: 360, width: '100%' }}>{text}</Text>
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
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg + 2, marginBottom: space.md, borderWidth: 1, borderColor: '#EEF0F3', ...shadow },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6, minHeight: 36, maxWidth: '100%', justifyContent: 'center', marginRight: space.sm, marginBottom: space.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, minHeight: touch, marginTop: 6, fontSize: 16, backgroundColor: colors.card, color: colors.text },
  btn: { borderWidth: 1, borderRadius: radius.md, minHeight: touch, paddingHorizontal: space.lg, paddingVertical: space.md, alignItems: 'center', justifyContent: 'center', marginTop: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  h2: type.h2,
  small: type.small,
  label: type.label,
  section: { ...type.label, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: space.xl, marginBottom: space.md },
  empty: { alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.sm, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: '#EEF0F3', marginBottom: space.md },
  notice: { borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.md, marginBottom: space.md },
});
