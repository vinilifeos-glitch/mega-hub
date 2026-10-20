import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useMe } from '../state/AppContext';
import { Card, Icon, useColors, useStyles } from '../components/ui';
import { ASSEMBLY_NOTE_MAX } from '../state/permissions';

/** Collapsible 'Assembly note' (collapsed by default; tap the header). Editable = multiline box; otherwise read-only text. */
export function AssemblyNoteCard({ value, onChange, editable }: { value: string; onChange?: (v: string) => void; editable?: boolean }) {
  const c = useColors(); const s = useStyles(); const { t } = useMe();
  const [open, setOpen] = useState(false);
  const has = value.trim().length > 0;
  return (
    <Card style={{ paddingVertical: 10 }}>
      <View testID="asm-card">
        <Pressable testID="asm-toggle" accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={open ? t('assemblyNote.hide') : t('assemblyNote.show')}
          onPress={() => setOpen(o => !o)} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 40 }}>
          <Icon name="construct-outline" size={18} color={c.primaryText} style={{ marginRight: 8 }} />
          <Text style={[s.h2, { flex: 1, fontSize: 16 }]}>{t('assemblyNote.title')}</Text>
          {!open && has ? <View testID="asm-has" style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary, marginRight: 8 }} /> : null}
          <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={c.subtle} />
        </Pressable>
        {open && (editable
          ? <TextInput testID="asm-input" value={value} onChangeText={v => onChange?.(v)} multiline maxLength={ASSEMBLY_NOTE_MAX} placeholder={t('assemblyNote.placeholder')} placeholderTextColor={c.subtle}
              accessibilityLabel={t('assemblyNote.title')} style={[s.input, { minHeight: 96, paddingTop: 10, paddingBottom: 10, textAlignVertical: 'top', marginTop: 6 }]} />
          : <Text testID="asm-text" selectable style={{ marginTop: 6, fontSize: 15, lineHeight: 22, color: has ? c.text : c.muted }}>{has ? value : t('assemblyNote.empty')}</Text>)}
      </View>
    </Card>
  );
}
