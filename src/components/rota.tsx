/**
 * Presentational rota / picker pieces. Prop-driven only (no data access);
 * labels default to i18n `rota.*` keys and can be overridden via props.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useApp } from '../state/AppContext';
import { Badge, Button, DeptBadge, GhostButton, Icon, radius, space, useColors, useStyles } from './ui';

export type PickerStatus = 'free' | 'busy' | 'away';

/** One person in an assign picker. `away` rows are not pressable. */
export function PickerRow({ name, status, detail, onPress, testID }: { name: string; status: PickerStatus; detail?: string; onPress?: () => void; testID?: string }) {
  const c = useColors(); const { t } = useApp();
  const away = status === 'away'; const busy = status === 'busy';
  const bg = busy ? c.statusTintAmber : away ? c.soft : c.card;
  return (
    <Pressable testID={testID} onPress={away ? undefined : onPress} disabled={away}
      accessibilityRole="button" accessibilityState={{ disabled: away }}
      accessibilityLabel={`@${name}${detail ? `, ${detail}` : ''}${away ? `, ${t('rota.away')}` : busy ? `, ${t('rota.servingElsewhere')}` : ''}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: space.sm, paddingRight: space.md,
        paddingLeft: away ? space.md - 4 : space.md, marginBottom: 6, borderRadius: radius.md, backgroundColor: pressed && !away ? c.soft : bg,
        borderWidth: 1, borderColor: busy ? c.amberSoft : c.border, borderLeftWidth: away ? 4 : 1, borderLeftColor: away ? c.red : busy ? c.amberSoft : c.border,
        opacity: away ? 0.7 : 1 })}>
      {status === 'free' ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.green, marginRight: space.md }} /> : null}
      {busy ? <Icon name="time-outline" size={18} color={c.statusTextAmber} style={{ marginRight: space.sm }} /> : null}
      {away ? <Icon name="airplane-outline" size={18} color={c.subtle} style={{ marginRight: space.sm }} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '600', color: away ? c.muted : c.text }}>@{name}</Text>
        {away && detail ? <Text numberOfLines={2} style={{ fontSize: 13, color: c.statusTextRed, marginTop: 2 }}>{detail}</Text> : null}
      </View>
      {busy && detail ? <View style={{ backgroundColor: c.amberSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, marginLeft: space.sm, maxWidth: '55%' }}>
        <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: c.statusTextAmber }}>{detail}</Text></View> : null}
      {!away ? <Icon name="add-circle-outline" size={20} color={busy ? c.statusTextAmber : c.primary} style={{ marginLeft: space.sm }} /> : null}
    </Pressable>
  );
}

const SECTION: Record<PickerStatus, ['checkmark-circle' | 'time' | 'remove-circle', 'green' | 'statusTextAmber' | 'statusTextRed', 'rota.available' | 'rota.servingElsewhere' | 'rota.unavailable']> = {
  free: ['checkmark-circle', 'green', 'rota.available'], busy: ['time', 'statusTextAmber', 'rota.servingElsewhere'], away: ['remove-circle', 'statusTextRed', 'rota.unavailable'],
};
/** Heading above a group of PickerRows. Pass `kind` for the default label/icon, or `label`. */
export function PickerSectionLabel({ kind = 'free', label, count, testID }: { kind?: PickerStatus; label?: string; count?: number; testID?: string }) {
  const c = useColors(); const { t } = useApp(); const [icon, col, key] = SECTION[kind];
  return (
    <View testID={testID} accessibilityRole="header" style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.md, marginBottom: space.sm }}>
      <Icon name={icon} size={16} color={c[col]} style={{ marginRight: 6 }} />
      <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: c.muted, flexShrink: 1 }}>{label ?? t(key)}</Text>
      {count != null ? <Text style={{ fontSize: 12, fontWeight: '700', color: c.subtle, marginLeft: 6 }}>{count}</Text> : null}
    </View>
  );
}

/** Confirmation shown after tapping a busy PickerRow. Render inline or inside a Modal. */
export function BusyChoiceSheet({ name, detail, onDouble, onSwap, onCancel, testIDs = {} }: {
  name: string; detail: string; onDouble: () => void; onSwap: () => void; onCancel: () => void;
  testIDs?: { root?: string; swap?: string; double?: string; cancel?: string };
}) {
  const c = useColors(); const s = useStyles(); const { t } = useApp();
  return (
    <View testID={testIDs.root ?? 'pick-busy-sheet'} accessibilityRole="alert" style={[s.card, { backgroundColor: c.statusTintAmber, borderColor: c.amberSoft }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: space.sm }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: c.amberSoft, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
          <Icon name="swap-horizontal" size={18} color={c.statusTextAmber} />
        </View>
        <Text style={{ flex: 1, fontSize: 16, lineHeight: 22, color: c.text, fontWeight: '600' }}>{t('rota.rolesAssigned' as any, { roles: detail })}</Text>
      </View>
      <Button label={t('rota.swap')} onPress={onSwap} testID={testIDs.swap ?? 'pick-swap'} />
      <Button label={t('rota.doubleBook')} outline onPress={onDouble} testID={testIDs.double ?? 'pick-double'} />
      <GhostButton label={t('rota.cancel')} icon="close" onPress={onCancel} testID={testIDs.cancel ?? 'pick-cancel'} />
    </View>
  );
}

/** "Your role" card on My Rota. */
export function RotaRoleCard({ roles, title, testID }: { roles: { dep: { id: string; color: string }; role: string; testID?: string }[]; title?: string; testID?: string }) {
  const c = useColors(); const s = useStyles(); const { t } = useApp();
  return (
    <View testID={testID} style={[s.card, { backgroundColor: c.primarySoft, borderColor: c.primarySoft }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm }}>
        <Icon name="person-circle" size={20} color={c.primaryText} style={{ marginRight: 8 }} />
        <Text style={{ fontSize: 13, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', color: c.primaryText }}>{title ?? t('rota.yourRole')}</Text>
      </View>
      {roles.map((r, i) => (
        <View key={i} testID={r.testID} style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', paddingVertical: 4 }}>
          <DeptBadge dep={r.dep} />
          <Text style={{ fontSize: 17, fontWeight: '700', color: c.text, marginLeft: 4, flexShrink: 1 }}>{r.role}</Text>
        </View>
      ))}
    </View>
  );
}

/** "Your team" card: role left, @name right (blank when unassigned). */
export function RotaTeamCard({ rows, title, testID, at = true }: { at?: boolean; rows: { role: string; name?: string; suffix?: string; testID?: string }[]; title?: string; testID?: string }) {
  const c = useColors(); const s = useStyles(); const { t } = useApp();
  return (
    <View testID={testID} style={s.card}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.xs }}>
        <Icon name="people" size={18} color={c.primary} style={{ marginRight: 8 }} />
        <Text style={{ fontSize: 13, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', color: c.muted }}>{title ?? t('rota.yourTeam')}</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} testID={r.testID} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
          <Text numberOfLines={2} style={{ flex: 1, fontSize: 15, color: c.muted, paddingRight: space.sm }}>{r.role}</Text>
          {r.name ? <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: c.text, maxWidth: '55%' }}>{at ? '@' : ''}{r.name}{r.suffix ? <Text style={{ fontWeight: '500', color: c.primaryText }}>{` ${r.suffix}`}</Text> : null}</Text>
            : null}
        </View>
      ))}
    </View>
  );
}

/** Full-width primary "Live" button. */
export function LiveButton({ onPress, label, testID = 'live-open' }: { onPress?: () => void; label?: string; testID?: string }) {
  const c = useColors(); const { t } = useApp(); const text = label ?? t('rota.live');
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={text}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: 52, borderRadius: radius.md, backgroundColor: c.primary, opacity: pressed ? 0.85 : 1, marginTop: space.sm, paddingHorizontal: space.lg })}>
      <Icon name="play" size={18} color={c.onPrimary} style={{ marginRight: 8 }} />
      <Text style={{ color: c.onPrimary, fontWeight: '800', fontSize: 16 }}>{text}</Text>
    </Pressable>
  );
}
