import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Icon, useColors, useStyles } from './ui';
import { useApp } from '../state/AppContext';
import { dictionaries } from '../i18n';

/** Shared date input: type DD/MM/YYYY (slashes auto-inserted) or pick from the calendar. Value is always DD/MM/YYYY or ''. */
const fmtTyped = (raw: string) => { const g = raw.replace(/\D/g, '').slice(0, 8); return [g.slice(0, 2), g.slice(2, 4), g.slice(4)].filter(Boolean).join('/'); };
const pad = (n: number) => String(n).padStart(2, '0');
const parse = (v: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v); if (!m) return null; const d = new Date(+m[3], +m[2] - 1, +m[1]); return d.getDate() === +m[1] && d.getMonth() === +m[2] - 1 ? d : null; };

export function DateField({ label, value, onChange, testID, placeholder, limit, onSubmit }: {
  label: string; value: string; onChange: (v: string) => void; testID?: string; placeholder?: string;
  limit?: 'past' | 'future'; onSubmit?: () => void;
}) {
  const colors = useColors(); const s = useStyles();
  const { t, language } = useApp();
  const cal = dictionaries[language].calendar;
  const MONTHS = cal.months;
  const [open, setOpen] = useState(false);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const initial = parse(value) ?? (limit === 'past' ? new Date(today.getFullYear() - 25, 0, 1) : today);
  const [view, setView] = useState({ y: initial.getFullYear(), m: initial.getMonth() });
  const sel = parse(value);
  const move = (dm: number) => setView(v => { const d = new Date(v.y, v.m + dm, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const first = new Date(view.y, view.m, 1); const lead = (first.getDay() + 6) % 7; // Monday first
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const disabled = (d: Date) => (limit === 'past' && d > today) || (limit === 'future' && d < today);
  const nav = (lbl: string, dm: number, id: string) => (
    <Pressable onPress={() => move(dm)} testID={testID ? `${testID}-${id}` : undefined} accessibilityRole="button" accessibilityLabel={({ prevyear: t('calendar.prevYear'), prev: t('calendar.prevMonth'), next: t('calendar.nextMonth'), nextyear: t('calendar.nextYear') } as Record<string, string>)[id] ?? lbl} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 18, color: colors.primary, fontWeight: '700' }}>{lbl}</Text></Pressable>
  );
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.row, { flexWrap: 'nowrap' }]}>
        <TextInput value={value} onChangeText={t => { const v = fmtTyped(t); onChange(v); const p = parse(v); if (p) setView({ y: p.getFullYear(), m: p.getMonth() }); }}
          placeholder={placeholder ?? t('calendar.placeholder')} placeholderTextColor="#aaa" keyboardType="number-pad" maxLength={10} onSubmitEditing={onSubmit}
          style={[s.input, { flex: 1 }]} testID={testID} />
        <Pressable onPress={() => { if (sel) setView({ y: sel.getFullYear(), m: sel.getMonth() }); setOpen(!open); }} testID={testID ? `${testID}-cal` : undefined} accessibilityRole="button" accessibilityLabel={t(open ? 'dateField.closeFor' : 'dateField.openFor', { label })}
          style={{ marginLeft: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 12, width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 6, backgroundColor: open ? colors.primarySoft : colors.card }}>
          <Icon name={open ? 'calendar' : 'calendar-outline'} size={22} color={colors.primary} />
        </Pressable>
      </View>
      {open && (
        <View style={{ marginTop: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 8, backgroundColor: colors.card }}>
          <View style={[s.row, { justifyContent: 'space-between', flexWrap: 'nowrap' }]}>
            <View style={[s.row, { flexWrap: 'nowrap' }]}>{nav('«', -12, 'prevyear')}{nav('‹', -1, 'prev')}</View>
            <Text style={{ fontWeight: '700', color: colors.text }} testID={testID ? `${testID}-month` : undefined}>{MONTHS[view.m]} {view.y}</Text>
            <View style={[s.row, { flexWrap: 'nowrap' }]}>{nav('›', 1, 'next')}{nav('»', 12, 'nextyear')}</View>
          </View>
          <View style={[s.row, { flexWrap: 'wrap' }]}>
            {[...cal.weekdaysMin.slice(1), cal.weekdaysMin[0]].map((w, i) => <Text key={i} style={{ width: `${100 / 7}%`, textAlign: 'center', color: colors.muted, fontSize: 12, paddingVertical: 4 }}>{w}</Text>)}
            {cells.map((n, i) => {
              if (!n) return <View key={i} style={{ width: `${100 / 7}%`, height: 36 }} />;
              const d = new Date(view.y, view.m, n); const off = disabled(d);
              const isSel = !!sel && sel.getTime() === d.getTime(); const isToday = d.getTime() === today.getTime();
              return (
                <Pressable key={i} disabled={off} testID={testID ? `${testID}-day-${n}` : undefined} accessibilityRole="button" accessibilityLabel={t('dateField.dayA11y', { day: n, month: MONTHS[view.m], year: view.y })}
                  onPress={() => { onChange(`${pad(n)}/${pad(view.m + 1)}/${view.y}`); setOpen(false); }}
                  style={{ width: `${100 / 7}%`, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: isSel ? colors.primary : 'transparent', borderWidth: isToday && !isSel ? 1 : 0, borderColor: colors.primary }}>
                    <Text style={{ color: isSel ? colors.onPrimary : off ? colors.subtle : colors.text, fontWeight: isSel ? '700' : '400' }}>{n}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}
