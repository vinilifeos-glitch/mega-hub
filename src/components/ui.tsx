import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../state/AppContext';
import type { Lang } from '../i18n';
export type { Lang } from '../i18n';

/* ── Icons (Ionicons only) ──────────────────────────────────── */
export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export function Icon({ name, size = 18, color, style }: { name: IconName; size?: number; color?: string; style?: any }) {
  const c = useColors();
  return <Ionicons name={name} size={size} color={color ?? c.muted} style={style} />;
}
const DEPT_ICONS: Record<string, IconName> = { 'd-music': 'musical-notes-outline', 'd-kids': 'happy-outline', 'd-obreiros': 'people-outline' };
export const deptIcon = (id: string): IconName => DEPT_ICONS[id] ?? 'grid-outline';
/** Department heading: tinted icon tile in the department colour + name. */
export function DeptTitle({ dep, suffix, style }: { dep: { id: string; name: string; color: string }; suffix?: string; style?: any }) {
  const { deptName } = useApp(); const s = useStyles(); const dc = useDeptColor();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }, style]}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: tint(dep.color), alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
        <Icon name={deptIcon(dep.id)} size={18} color={dc(dep.color)} />
      </View>
      <Text style={[s.h2, { flexShrink: 1 }]}>{deptName(dep.id)}{suffix ?? ''}</Text>
    </View>
  );
}

/* ── Design tokens ─────────────────────────────────────────────
   Deep ink neutrals + one fresh teal accent, in a light and a dark
   palette with identical keys. Components read them via useColors(). */
export const lightColors = {
  bg: '#EDF3F1',        // soft teal-tinted background
  card: '#FFFFFF',
  text: '#0F172A',      // ink
  muted: '#475569',
  subtle: '#94A3B8',
  border: '#D9E3E0',
  soft: '#E4ECE9',
  primary: '#0F766E',   // teal 700 (white text AA)
  onPrimary: '#FFFFFF',
  primarySoft: '#CCFBF1',
  primaryText: '#115E59',
  header: '#0F172A',    // dark header band
  onHeader: '#F8FAFC',
  onHeaderMuted: '#A5B4C8',
  tabBar: '#FFFFFF',
  green: '#15803D', greenSoft: '#DCFCE7',
  amber: '#B45309', amberSoft: '#FEF3C7',
  red: '#DC2626', redSoft: '#FEE2E2',
  shadow: '#0F172A',
};
export type Palette = typeof lightColors;
export const darkColors: Palette = {
  bg: '#0B1220',
  card: '#151F31',
  text: '#F1F5F9',
  muted: '#A6B3C7',
  subtle: '#64748B',
  border: '#26344B',
  soft: '#1D2A40',
  primary: '#2DD4BF',   // teal 400 (ink text AA)
  onPrimary: '#042F2E',
  primarySoft: '#123A3A',
  primaryText: '#5EEAD4',
  header: '#060B16',
  onHeader: '#F8FAFC',
  onHeaderMuted: '#94A3B8',
  tabBar: '#0F1829',
  green: '#4ADE80', greenSoft: '#12301F',
  amber: '#FBBF24', amberSoft: '#3A2A0A',
  red: '#F87171', redSoft: '#3B1414',
  shadow: '#000000',
};
export type ThemeMode = 'light' | 'dark';
const ThemeCtx = React.createContext<{ mode: ThemeMode; colors: Palette; setMode: (m: ThemeMode) => void }>({ mode: 'light', colors: lightColors, setMode: () => {} });
/** Supplies the palette for `mode`. `setMode` lets the Profile toggle drive it. */
export function ThemeProvider({ mode, setMode, children }: { mode: ThemeMode; setMode?: (m: ThemeMode) => void; children: React.ReactNode }) {
  const value = React.useMemo(() => ({ mode, colors: mode === 'dark' ? darkColors : lightColors, setMode: setMode ?? (() => {}) }), [mode, setMode]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}
export const useColors = () => React.useContext(ThemeCtx).colors;
export const useThemeMode = () => { const c = React.useContext(ThemeCtx); return { mode: c.mode, setMode: c.setMode }; };
/** Department colour as a translucent tint (works on light and dark). */
/** Lighten a colour toward white (used for department colours on dark surfaces). */
export const lighten = (hex: string, amt = 0.45) => { const n = parseInt(hex.replace('#', ''), 16); const f = (v: number) => Math.round(v + (255 - v) * amt); return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`; };
/** Department colour readable on the current surface. */
export function useDeptColor() { const { mode } = useThemeMode(); return (hex: string) => (mode === 'dark' ? lighten(hex) : hex); }
export const tint = (hex: string, alpha = 0.16) => { const n = parseInt(hex.replace('#', ''), 16); return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`; };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };
export const contentMax = 640; // content + tab bar width on wide screens
const makeType = (c: Palette) => ({
  title: { fontSize: 28, fontWeight: '800' as const, color: c.onHeader, letterSpacing: -0.6 },
  h2: { fontSize: 17, fontWeight: '700' as const, color: c.text },
  body: { fontSize: 15, color: c.text },
  small: { fontSize: 14, color: c.muted, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600' as const, color: c.muted },
});
const makeShadow = (c: Palette) => ({ shadowColor: c.shadow, shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 3 });
export const touch = 48; // minimum touch target


/* ── Layout ─────────────────────────────────────────────────── */
const BACK_TO_MORE = ['/profile', '/team', '/accounts'];
/** Screen = dark header band (title + subtitle) over a tinted content area. */
export function Screen({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets(); const c = useColors(); const s = useStyles(); const { t } = useApp();
  const path = usePathname(); const router = useRouter();
  const back = BACK_TO_MORE.includes(path);
  const inner = { width: '100%' as const, maxWidth: contentMax, alignSelf: 'center' as const, paddingHorizontal: space.lg + 4 };
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingBottom: space.xxl + 8 }}>
      <View style={[s.header, { paddingTop: insets.top + (back ? space.md : space.xl) }]}>
        <View style={inner}>
          {back && (
            <Pressable onPress={() => router.navigate('/more')} accessibilityRole="button" accessibilityLabel={t('more.back')} hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, alignSelf: 'flex-start' }}>
              <Icon name="chevron-back" size={20} color={c.onHeaderMuted} />
              <Text style={{ color: c.onHeaderMuted, fontSize: 15, fontWeight: '600' }}>{t('more.title')}</Text>
            </Pressable>
          )}
          <Text style={s.title} accessibilityRole="header">{title}</Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={[inner, { marginTop: space.lg }]}>{children}</View>
    </ScrollView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const s = useStyles();
  return <View style={[s.card, style]}>{children}</View>;
}

/* ── Badges ─────────────────────────────────────────────────── */
export type BadgeTone = 'accent' | 'neutral' | 'success' | 'warning' | 'danger';
/** One pill badge for roles, departments and status. Pass `color` for a department tint. */
export function Badge({ label, tone = 'neutral', color, icon, testID }: { label: string; tone?: BadgeTone; color?: string; icon?: IconName; testID?: string }) {
  const c = useColors();
  const map: Record<BadgeTone, [string, string]> = {
    accent: [c.primarySoft, c.primaryText], neutral: [c.soft, c.muted], success: [c.greenSoft, c.green], warning: [c.amberSoft, c.amber], danger: [c.redSoft, c.red],
  };
  const dc = useDeptColor();
  const [bg, fg] = color ? [tint(color, 0.18), dc(color)] : map[tone];
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, marginBottom: 4, maxWidth: '100%' }}>
      {icon ? <Ionicons name={icon} size={13} color={fg} style={{ marginRight: 4 }} /> : null}
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700', letterSpacing: 0.2, flexShrink: 1 }}>{label}</Text>
    </View>
  );
}
const ROLE_BADGE: Record<'owner' | 'admin' | 'volunteer', [BadgeTone, IconName]> = { owner: ['accent', 'star'], admin: ['warning', 'shield-checkmark'], volunteer: ['neutral', 'person'] };
export function RoleBadge({ role }: { role: 'owner' | 'admin' | 'volunteer' }) {
  const { t } = useApp(); const [tone, icon] = ROLE_BADGE[role];
  return <Badge label={t(`tiers.${role}`)} tone={tone} icon={icon} />;
}
export function DeptBadge({ dep, label }: { dep: { id: string; color: string }; label?: string }) {
  const { deptName } = useApp();
  return <Badge label={label ?? deptName(dep.id)} color={dep.color} icon={deptIcon(dep.id)} />;
}
const STATUS_BADGE: Record<'assigned' | 'open' | 'away', [BadgeTone, IconName]> = { assigned: ['success', 'checkmark-circle'], open: ['neutral', 'ellipse-outline'], away: ['danger', 'airplane'] };
export function StatusBadge({ status, label }: { status: 'assigned' | 'open' | 'away'; label?: string }) {
  const { t } = useApp(); const [tone, icon] = STATUS_BADGE[status];
  return <Badge label={label ?? t(`badges.${status}`)} tone={tone} icon={icon} />;
}

/* ── Controls ───────────────────────────────────────────────── */
export function Chip({ label, active, onPress, color, testID, icon }: { label: string; active?: boolean; onPress?: () => void; color?: string; testID?: string; icon?: IconName }) {
  const colors = useColors(); const s = useStyles();
  const ic = color ?? colors.primary;
  return (
    <Pressable testID={testID} onPress={onPress} disabled={!onPress}
      style={({ pressed }) => [s.chip, active ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.border, backgroundColor: pressed ? colors.soft : colors.card }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
        {icon ? <Icon name={icon} size={16} color={active ? colors.onPrimary : !onPress ? colors.subtle : ic} style={{ marginRight: 6 }} /> : null}
        <Text style={{ color: active ? colors.onPrimary : !onPress ? colors.subtle : colors.text, fontWeight: '600', fontSize: 14, flexShrink: 1 }}>{label}</Text>
      </View>
    </Pressable>
  );
}

/** Primary = filled accent. `outline` = secondary. `danger` (or legacy red `color`) + outline = destructive text button. */
export function Button({ label, onPress, color, outline, danger: dangerProp, testID }: { label: string; onPress?: () => void; color?: string; outline?: boolean; danger?: boolean; testID?: string }) {
  const colors = useColors(); const s = useStyles();
  const danger = dangerProp || color === lightColors.red || color === darkColors.red;
  const fill = (danger ? colors.red : color) ?? colors.primary;
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => [s.btn,
        outline
          ? { backgroundColor: pressed ? colors.soft : danger ? 'transparent' : colors.card, borderColor: danger ? 'transparent' : colors.border }
          : { backgroundColor: fill, borderColor: fill, opacity: pressed ? 0.85 : 1 }]}>
      <Text style={{ color: outline ? (danger ? colors.red : colors.text) : colors.onPrimary, fontWeight: '700', fontSize: 16, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

export function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, style, ...rest } = props; const colors = useColors(); const s = useStyles();
  return (
    <View style={{ marginBottom: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={s.label}>{label}</Text>
        {rest.editable === false ? <Icon name="lock-closed" size={12} color={colors.subtle} style={{ marginLeft: 6 }} /> : null}
      </View>
      <TextInput autoCapitalize="none" autoCorrect={false} placeholderTextColor={colors.subtle} accessibilityState={{ disabled: rest.editable === false }}
        style={[s.input, rest.editable === false ? { backgroundColor: colors.soft, color: colors.muted, borderColor: colors.soft } : null, style]} {...rest} />
    </View>
  );
}

/** Icon-only button: always labelled for screen readers, 44px+ target. */
export function IconButton({ icon, label, onPress, color, testID, style }: { icon: IconName; label: string; onPress?: () => void; color?: string; testID?: string; style?: ViewStyle }) {
  const colors = useColors();
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8}
      style={({ pressed }) => [{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: pressed ? colors.soft : 'transparent' }, style]}>
      <Icon name={icon} size={22} color={color ?? colors.primary} />
    </Pressable>
  );
}

/** Generic segmented control. */
export function Segmented<T extends string>({ value, onChange, options, testIDPrefix }: { value: T; onChange: (v: T) => void; options: { v: T; label: string; icon?: IconName }[]; testIDPrefix: string }) {
  const colors = useColors(); const s = useStyles();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: colors.soft, borderRadius: radius.md, padding: 4 }}>
      {options.map(o => {
        const on = o.v === value;
        return (
          <Pressable key={o.v} testID={`${testIDPrefix}-${o.v}`} onPress={() => onChange(o.v)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={o.label}
            style={[{ flex: 1, flexDirection: 'row', minHeight: 44, paddingVertical: space.sm, paddingHorizontal: space.sm, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.card : 'transparent' }, on ? s.shadow : null]}>
            {o.icon ? <Icon name={o.icon} size={16} color={on ? colors.primary : colors.muted} style={{ marginRight: 6 }} /> : null}
            <Text style={{ fontSize: 15, fontWeight: on ? '700' : '500', color: on ? colors.text : colors.muted, textAlign: 'center', flexShrink: 1 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Segmented control for the account language (labels are each language's own name). */
export function LanguagePicker({ value, onChange }: { value: Lang; onChange: (v: Lang) => void }) {
  const { t } = useApp();
  return <Segmented testIDPrefix="lang" value={value} onChange={onChange} options={[{ v: 'pt', label: t('language.pt') }, { v: 'en', label: t('language.en') }]} />;
}

/** Light / Dark appearance toggle. */
export function ThemeToggle({ value, onChange }: { value: ThemeMode; onChange: (v: ThemeMode) => void }) {
  const { t } = useApp();
  return <Segmented testIDPrefix="theme" value={value} onChange={onChange} options={[{ v: 'light', label: t('appearance.light'), icon: 'sunny-outline' }, { v: 'dark', label: t('appearance.dark'), icon: 'moon-outline' }]} />;
}

/* ── Feedback ───────────────────────────────────────────────── */
export function Empty({ text, icon }: { text: string; icon?: IconName }) {
  const colors = useColors(); const s = useStyles();
  return (
    <View style={s.empty}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: space.md }}>
        <Icon name={icon ?? 'file-tray-outline'} size={28} color={colors.primaryText} />
      </View>
      <Text style={{ fontSize: 15, lineHeight: 22, color: colors.muted, textAlign: 'center', maxWidth: 360, width: '100%' }}>{text}</Text>
    </View>
  );
}

export function Notice({ text, tone = 'success' }: { text: string; tone?: 'success' | 'error' | 'warning' }) {
  const colors = useColors(); const s = useStyles();
  const [bg, fg] = tone === 'success' ? [colors.greenSoft, colors.green] : tone === 'warning' ? [colors.amberSoft, colors.amber] : [colors.redSoft, colors.red];
  return (
    <View style={[s.notice, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 14, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

const makeStyles = (c: Palette) => {
  const type = makeType(c); const shadow = makeShadow(c);
  return StyleSheet.create({
    title: type.title,
    subtitle: { fontSize: 15, lineHeight: 21, color: c.onHeaderMuted, marginTop: space.xs },
    header: { backgroundColor: c.header, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingBottom: space.xl + 8 },
    card: { backgroundColor: c.card, borderRadius: radius.lg, padding: space.lg + 2, marginBottom: space.md, borderWidth: 1, borderColor: c.border, ...shadow },
    chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6, minHeight: 36, maxWidth: '100%', justifyContent: 'center', marginRight: space.sm, marginBottom: space.sm },
    input: { borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: 14, minHeight: touch, marginTop: 6, fontSize: 16, backgroundColor: c.card, color: c.text },
    btn: { borderWidth: 1, borderRadius: radius.md, minHeight: touch, paddingHorizontal: space.lg, paddingVertical: space.md, alignItems: 'center', justifyContent: 'center', marginTop: space.sm },
    row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
    h2: type.h2,
    small: type.small,
    label: type.label,
    section: { ...type.label, color: c.primaryText, textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 12, fontWeight: '700', marginTop: space.xl, marginBottom: space.md },
    empty: { alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.sm, backgroundColor: c.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, marginBottom: space.md },
    notice: { borderRadius: radius.md, paddingHorizontal: space.lg, paddingVertical: space.md, marginBottom: space.md },
    shadow,
  });
};
const styleCache = new Map<Palette, ReturnType<typeof makeStyles>>();
/** Themed shared styles (cached per palette). */
export function useStyles() { const c = useColors(); let v = styleCache.get(c); if (!v) { v = makeStyles(c); styleCache.set(c, v); } return v; }

