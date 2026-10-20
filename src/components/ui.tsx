import { useIsFocused } from 'expo-router';
import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';
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
  const { deptName } = useApp(); const s = useStyles(); const accent = useDeptAccent()(dep);
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }, style]}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: tint(accent), alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
        <Icon name={deptIcon(dep.id)} size={18} color={accent} />
      </View>
      <Text style={[s.h2, { flexShrink: 1 }]}>{deptName(dep.id)}{suffix ?? ''}</Text>
    </View>
  );
}

export type ThemeMode = 'light' | 'dark';
/* ── Design tokens ─────────────────────────────────────────────
   Serious, modern palette: deep navy / near-black slate for the header and text, cool greys for
   backgrounds and borders, white cards, and ONE restrained deep-indigo accent. Light and dark palettes
   have identical keys (all text/button pairs meet WCAG AA). Components read them via useColors().
   Department accents are muted tokens too (see deptAccent), so the stored department colours never change. */
export const lightColors = {
  bg: '#F1F4F8',        // cool grey background
  card: '#FFFFFF',
  text: '#0F172A',      // near-black slate ink
  muted: '#475569',
  subtle: '#8592A6',
  border: '#DDE3EB',
  soft: '#EDF1F6',
  primary: '#1E3A8A',   // deep indigo (white text 10.4:1)
  onPrimary: '#FFFFFF',
  primarySoft: '#E3E9F6',
  primaryText: '#1E3A8A',
  header: '#0B1220',    // deep navy header band
  onHeader: '#F8FAFC',
  onHeaderMuted: '#A7B3C6',
  tabBar: '#FFFFFF',
  green: '#2F6B4F', greenSoft: '#E4EFE8',
  amber: '#8A5A12', amberSoft: '#F5EBDA',
  red: '#B42318', redSoft: '#FBEAE8', dangerBorder: '#E7B3AD',
  statusTintAmber: '#FBF6EC', statusTextAmber: '#7A4B0C',
  statusTintRed: '#FCF2F1', statusTextRed: '#8F1D14',
  scrim: 'rgba(11, 18, 32, 0.55)',
  shadow: '#0F172A',
};
export type Palette = typeof lightColors;
export const darkColors: Palette = {
  bg: '#0A0F1A',
  card: '#131B2B',
  text: '#E8EDF5',
  muted: '#A5B0C2',
  subtle: '#6B778B',
  border: '#243048',
  soft: '#1A2437',
  primary: '#93A9E8',   // soft indigo (ink text 8.6:1)
  onPrimary: '#0B1430',
  primarySoft: '#1D2947',
  primaryText: '#B3C3F0',
  header: '#060A12',
  onHeader: '#F1F5F9',
  onHeaderMuted: '#98A5B9',
  tabBar: '#0E1524',
  green: '#86C7A3', greenSoft: '#15281E',
  amber: '#E2B46E', amberSoft: '#30240F',
  red: '#F09287', redSoft: '#371719', dangerBorder: '#6B2A25',
  statusTintAmber: '#261F12', statusTextAmber: '#EBC98E',
  statusTintRed: '#2A1719', statusTextRed: '#F3ABA3',
  scrim: 'rgba(0, 0, 0, 0.65)',
  shadow: '#000000',
};
/** Muted department accents (left strips, tiles, chips, badges), per mode. Keyed by department id. */
export const deptAccents: Record<ThemeMode, Record<string, string>> = {
  light: { 'd-music': '#5B4A8B', 'd-kids': '#36665A', 'd-obreiros': '#7A5A26' },
  dark: { 'd-music': '#A99AD8', 'd-kids': '#8DC0B2', 'd-obreiros': '#D3B27C' },
};
/** Fixed high-contrast stage palette for Live mode (black stage, warm chord colour), independent of light/dark. */
export const stageColors = { bg: '#000000', text: '#FFFFFF', muted: '#B8C0CC', chord: '#FFD54A', border: '#3A4150', card: '#11151C', btn: '#1F2633' };
const ThemeCtx = React.createContext<{ mode: ThemeMode; colors: Palette; setMode: (m: ThemeMode) => void }>({ mode: 'light', colors: lightColors, setMode: () => {} });
/** Supplies the palette for `mode`. `setMode` lets the Profile toggle drive it. */
export function ThemeProvider({ mode, setMode, children }: { mode: ThemeMode; setMode?: (m: ThemeMode) => void; children: React.ReactNode }) {
  const value = React.useMemo(() => ({ mode, colors: mode === 'dark' ? darkColors : lightColors, setMode: setMode ?? (() => {}) }), [mode, setMode]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}
export const useColors = () => React.useContext(ThemeCtx).colors;
export const useThemeMode = () => { const c = React.useContext(ThemeCtx); return { mode: c.mode, setMode: c.setMode }; };
const hexRgb = (hex: string) => { const n = parseInt(hex.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (r: number, g: number, b: number) => '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
/** Desaturate (toward grey) and, for dark mode, lighten an arbitrary colour: fallback accent for departments without a token. */
export const muteColor = (hex: string, mode: ThemeMode) => { const [r, g, b] = hexRgb(hex); const y = 0.3 * r + 0.59 * g + 0.11 * b; const m = (v: number) => v + (y - v) * 0.45;
  const [R, G, B] = [m(r), m(g), m(b)]; return mode === 'dark' ? toHex(R + (255 - R) * 0.45, G + (255 - G) * 0.45, B + (255 - B) * 0.45) : toHex(R * 0.85, G * 0.85, B * 0.85); };
/** Department accent for the current theme (token by id, else a muted version of its stored colour). */
export const deptAccent = (dep: { id: string; color?: string }, mode: ThemeMode) => deptAccents[mode][dep.id] ?? muteColor(dep.color ?? '#64748B', mode);
export function useDeptAccent() { const { mode } = useThemeMode(); return (dep: { id: string; color?: string }) => deptAccent(dep, mode); }
export const tint = (hex: string, alpha = 0.16) => { const n = parseInt(hex.replace('#', ''), 16); return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`; };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };
export const contentMax = 640; // content + tab bar width on wide screens
const makeType = (c: Palette) => ({
  title: { fontSize: 22, fontWeight: '800' as const, color: c.onHeader, letterSpacing: -0.4 },
  h2: { fontSize: 17, fontWeight: '700' as const, color: c.text },
  body: { fontSize: 15, color: c.text },
  small: { fontSize: 14, color: c.muted, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600' as const, color: c.muted },
});
const makeShadow = (c: Palette) => ({ shadowColor: c.shadow, shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 3 });
export const touch = 48; // minimum touch target


/* ── Layout ─────────────────────────────────────────────────── */
/** Hidden routes and where their header back goes (More tab removed). */
const BACK_FOR: Record<string, string> = { '/profile': '/', '/accounts': '/profile' };
/** Screen = dark header band (title + subtitle) over a tinted content area. */
export function Screen({ title, subtitle, children, backTo }: { title: string; subtitle?: string; children: React.ReactNode; backTo?: { label: string; onPress: () => void } }) {
  const insets = useSafeAreaInsets(); const c = useColors(); const s = useStyles(); const { t } = useApp();
  const path = usePathname(); const router = useRouter();
  const focused = useIsFocused();
  const back = !!backTo || (focused && !!BACK_FOR[path]);
  const me = (useApp() as any).currentUser as { firstName?: string; lastName?: string; username: string } | null | undefined;
  const initials = me ? ((me.firstName?.[0] ?? me.username[0] ?? '?') + (me.lastName?.[0] ?? '')).toUpperCase() : '';
  const inner = { width: '100%' as const, maxWidth: contentMax, alignSelf: 'center' as const, paddingHorizontal: space.lg + 4 };
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingBottom: space.xxl + 8 }}>
      <View style={[s.header, { paddingTop: insets.top + (back ? space.sm : space.md) }]}>
        <View style={inner}>
          {back && (
            <Pressable testID="screen-back" onPress={backTo?.onPress ?? (() => { if (path === '/profile' && router.canGoBack()) router.back(); else router.navigate(BACK_FOR[path] as any); })} accessibilityRole="button" accessibilityLabel={backTo?.label ?? (path === '/accounts' ? t('profile.title') : t('common.back'))} hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, alignSelf: 'flex-start' }}>
              <Icon name="chevron-back" size={20} color={c.onHeaderMuted} />
              <Text style={{ color: c.onHeaderMuted, fontSize: 15, fontWeight: '600' }}>{backTo?.label ?? (path === '/accounts' ? t('profile.title') : t('common.back'))}</Text>
            </Pressable>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Text style={[s.title, { flex: 1 }]} accessibilityRole="header">{title}</Text>
            {me && <Pressable testID="header-profile" accessibilityRole="button" accessibilityLabel={t('profile.title')} hitSlop={8} onPress={() => router.navigate('/profile' as any)}
              style={({ pressed }) => ({ width: 34, height: 34, borderRadius: 17, marginLeft: 12, backgroundColor: path === '/profile' ? c.primary : c.onHeaderMuted + '33', borderWidth: 1.5, borderColor: c.onHeaderMuted, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}>
              <Text style={{ color: c.onHeader, fontWeight: '800', fontSize: 15 }}>{initials}</Text>
            </Pressable>}
          </View>
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

/* ── Collapsible card ────────────────────────────────────────
   One shared style for every section on the service screens: header (tap to toggle) + the same round chevron
   on the right. `nested` = card-within-a-card (soft fill, smaller). Controlled (open/onToggle) or uncontrolled (defaultOpen). */
export function Chevron({ open, small }: { open: boolean; small?: boolean }) {
  const c = useColors(); const d = small ? 28 : 32;
  return <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name={open ? 'chevron-up' : 'chevron-down'} size={small ? 16 : 18} color={c.muted} /></View>;
}
export function CollapsibleCard({ toggleID, testID, icon, title, badge, header, right, open: openP, onToggle, defaultOpen = true, nested, style, a11yLabel, children }: {
  toggleID: string; testID?: string; icon?: IconName; title?: string; badge?: React.ReactNode; header?: React.ReactNode; right?: React.ReactNode;
  open?: boolean; onToggle?: (open: boolean) => void; defaultOpen?: boolean; nested?: boolean; style?: ViewStyle; a11yLabel?: string; children?: React.ReactNode;
}) {
  const c = useColors(); const s = useStyles();
  const [own, setOwn] = React.useState(defaultOpen);
  const open = openP ?? own;
  const toggle = () => { const n = !open; if (openP === undefined) setOwn(n); onToggle?.(n); };
  const head = header ?? (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1 }}>
      {icon ? <View style={{ width: nested ? 28 : 32, height: nested ? 28 : 32, borderRadius: nested ? 8 : 10, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}><Icon name={icon} size={nested ? 16 : 18} color={c.primaryText} /></View> : null}
      <Text style={[s.h2, { flexShrink: 1, marginRight: 8 }, nested ? { fontSize: 15 } : null]} numberOfLines={2}>{title}</Text>
      {badge}
    </View>);
  const body = (
    <View testID={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable testID={toggleID} accessibilityRole="button" accessibilityState={{ expanded: open }} aria-expanded={open} accessibilityLabel={a11yLabel ?? title} onPress={toggle}
          style={{ flex: 1, minHeight: nested ? 36 : 40, justifyContent: 'center', marginRight: 6 }}>{head}</Pressable>
        {open && right}
        <Pressable testID={`${toggleID}-chev`} accessibilityRole="button" accessibilityState={{ expanded: open }} aria-expanded={open} accessibilityLabel={a11yLabel ?? title} onPress={toggle} hitSlop={8}>
          <Chevron open={open} small={nested} />
        </Pressable>
      </View>
      {open && children ? <View style={{ marginTop: nested ? 6 : 8 }}>{children}</View> : null}
    </View>);
  if (nested) return <View style={[{ backgroundColor: c.bg, borderRadius: radius.md, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10 }, style]}>{body}</View>;
  return <Card style={style}>{body}</Card>;
}

/* ── Badges ─────────────────────────────────────────────────── */
export type BadgeTone = 'accent' | 'neutral' | 'success' | 'warning' | 'danger';
/** One pill badge for roles, departments and status. Pass `color` for a department tint. */
export function Badge({ label, tone = 'neutral', color, icon, testID }: { label: string; tone?: BadgeTone; color?: string; icon?: IconName; testID?: string }) {
  const c = useColors();
  const map: Record<BadgeTone, [string, string]> = {
    accent: [c.primarySoft, c.primaryText], neutral: [c.soft, c.muted], success: [c.greenSoft, c.green], warning: [c.amberSoft, c.amber], danger: [c.redSoft, c.red],
  };
  const [bg, fg] = color ? [tint(color, 0.18), color] : map[tone];
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
  const { deptName } = useApp(); const accent = useDeptAccent();
  return <Badge label={label ?? deptName(dep.id)} color={accent(dep)} icon={deptIcon(dep.id)} />;
}
const STATUS_BADGE: Record<'assigned' | 'open' | 'away' | 'draft', [BadgeTone, IconName]> = { assigned: ['success', 'checkmark-circle'], open: ['neutral', 'ellipse-outline'], away: ['danger', 'airplane'], draft: ['warning', 'create-outline'] };
export function StatusBadge({ status, label, testID }: { status: 'assigned' | 'open' | 'away' | 'draft'; label?: string; testID?: string }) {
  const { t } = useApp(); const [tone, icon] = STATUS_BADGE[status];
  return <Badge label={label ?? t(`badges.${status}`)} tone={tone} icon={icon} testID={testID} />;
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

/** Primary = filled accent. `outline` = secondary. `danger` = destructive secondary: same shape as outline, red text + red-tinted border (implies outline). */
export function Button({ label, onPress, color, outline, danger: dangerProp, testID, disabled }: { label: string; onPress?: () => void; color?: string; outline?: boolean; danger?: boolean; testID?: string; disabled?: boolean }) {
  const colors = useColors(); const s = useStyles();
  const danger = dangerProp || color === lightColors.red || color === darkColors.red;
  const fill = (danger ? colors.red : color) ?? colors.primary;
  return (
    <Pressable testID={testID} onPress={disabled ? undefined : onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} aria-disabled={!!disabled}
      style={({ pressed }) => [s.btn,
        danger
          ? { backgroundColor: pressed ? colors.redSoft : colors.card, borderColor: colors.dangerBorder }
          : outline
          ? { backgroundColor: pressed ? colors.soft : colors.card, borderColor: colors.border }
          : { backgroundColor: fill, borderColor: fill, opacity: pressed ? 0.85 : 1 },
        // disabled wins over every variant: muted grey, no press feedback, not-allowed cursor on web
        disabled ? { backgroundColor: colors.soft, borderColor: colors.border, opacity: 0.6, ...(Platform.OS === 'web' ? { cursor: 'not-allowed' as any } : {}) } : null]}>
      <Text style={{ color: disabled ? colors.muted : danger ? colors.red : outline ? colors.text : colors.onPrimary, fontWeight: '700', fontSize: 16, textAlign: 'center' }}>{label}</Text>
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

/** Search input with a leading icon (themed). */
export function SearchField(props: React.ComponentProps<typeof TextInput>) {
  const colors = useColors(); const s = useStyles(); const { style, ...rest } = props;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.card, paddingLeft: 12, marginVertical: space.sm }}>
      <Icon name="search" size={18} color={colors.subtle} />
      <TextInput autoCapitalize="none" autoCorrect={false} placeholderTextColor={colors.subtle} style={[s.input, { flex: 1, borderWidth: 0, marginTop: 0, backgroundColor: 'transparent' }, style]} {...rest} />
    </View>
  );
}

/** Low-emphasis text button with a leading icon (e.g. "+ Add song"). */
export function GhostButton({ label, icon = 'add', onPress, testID, color }: { label: string; icon?: IconName; onPress?: () => void; testID?: string; color?: string }) {
  const colors = useColors(); const c = color ?? colors.primaryText;
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 12, marginTop: space.xs, borderRadius: radius.md, backgroundColor: pressed ? colors.soft : 'transparent' })}>
      <Icon name={icon} size={18} color={c} style={{ marginRight: 6 }} />
      <Text style={{ color: c, fontWeight: '700', fontSize: 15 }}>{label.replace(/^\+\s*/, '')}</Text>
    </Pressable>
  );
}

/** Card heading: accent icon tile + title + optional right-hand content. */
export function CardHeader({ icon, title, right }: { icon: IconName; title: string; right?: React.ReactNode }) {
  const colors = useColors(); const s = useStyles();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
        <Icon name={icon} size={18} color={colors.primaryText} />
      </View>
      <Text style={[s.h2, { flex: 1 }]}>{title}</Text>
      {right}
    </View>
  );
}

/** Compact A−/A+ text size control. */
export function SizeControl({ onSmaller, onBigger, smallerID, biggerID, smallerLabel, biggerLabel }: { onSmaller: () => void; onBigger: () => void; smallerID: string; biggerID: string; smallerLabel: string; biggerLabel: string }) {
  const colors = useColors();
  const btn = (label: string, a11y: string, id: string, on: () => void, first?: boolean) => (
    <Pressable testID={id} onPress={on} accessibilityRole="button" accessibilityLabel={a11y}
      style={({ pressed }) => ({ minWidth: 48, minHeight: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.border : 'transparent', borderRightWidth: first ? 1 : 0, borderRightColor: colors.border })}>
      <Text style={{ color: colors.text, fontWeight: '800', fontSize: first ? 14 : 17 }}>{label}</Text>
    </Pressable>
  );
  return <View style={{ flexDirection: 'row', alignSelf: 'flex-end', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.soft, overflow: 'hidden', marginBottom: space.sm }}>{btn('A−', smallerLabel, smallerID, onSmaller, true)}{btn('A+', biggerLabel, biggerID, onBigger)}</View>;
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

export function Notice({ text, tone = 'success', testID }: { text: string; tone?: 'success' | 'error' | 'warning'; testID?: string }) {
  const colors = useColors(); const s = useStyles();
  const [bg, fg] = tone === 'success' ? [colors.greenSoft, colors.green] : tone === 'warning' ? [colors.amberSoft, colors.amber] : [colors.redSoft, colors.red];
  return (
    <View testID={testID} style={[s.notice, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 14, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

const makeStyles = (c: Palette) => {
  const type = makeType(c); const shadow = makeShadow(c);
  return StyleSheet.create({
    title: type.title,
    subtitle: { fontSize: 13, lineHeight: 18, color: c.onHeaderMuted, marginTop: 2 },
    header: { backgroundColor: c.header, borderBottomWidth: 1, borderBottomColor: c.onHeaderMuted + '33', paddingBottom: space.md },
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

