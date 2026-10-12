import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';

export const colors = { bg: '#F6F4FB', card: '#FFFFFF', primary: '#5B3FD6', text: '#1F1B2E', muted: '#6B6680', border: '#E7E3F3', green: '#16A34A', red: '#DC2626' };

export function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function Screen({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Chip({ label, active, onPress, color }: { label: string; active?: boolean; onPress?: () => void; color?: string }) {
  const c = color ?? colors.primary;
  return (
    <Pressable onPress={onPress} style={[s.chip, { borderColor: c, backgroundColor: active ? c : 'transparent' }]}>
      <Text style={{ color: active ? '#fff' : c, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function Empty({ text }: { text: string }) {
  return <Text style={{ color: colors.muted, textAlign: 'center', marginVertical: 24 }}>{text}</Text>;
}

export const s = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 15, color: colors.muted, marginTop: 4, marginBottom: 16 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#E7E3F3', borderRadius: 10, padding: 10, marginTop: 4, fontSize: 16, backgroundColor: '#fff', color: '#1F1B2E' },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  h2: { fontSize: 17, fontWeight: '700', color: colors.text },
  small: { fontSize: 13, color: colors.muted },
  section: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', marginTop: 12, marginBottom: 8, letterSpacing: 0.5 },
});

export function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.small}>{label}</Text>
      <TextInput autoCapitalize="none" autoCorrect={false} placeholderTextColor="#aaa" style={[s.input, style]} {...rest} />
    </View>
  );
}

export function Button({ label, onPress, color, outline, testID }: { label: string; onPress?: () => void; color?: string; outline?: boolean; testID?: string }) {
  const c = color ?? colors.primary;
  return (
    <Pressable testID={testID} onPress={onPress} style={{ backgroundColor: outline ? 'transparent' : c, borderColor: c, borderWidth: 1.5, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center', marginTop: 6 }}>
      <Text style={{ color: outline ? c : '#fff', fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

