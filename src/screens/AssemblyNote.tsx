import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useMe } from '../state/AppContext';
import { CollapsibleCard, useColors, useStyles } from '../components/ui';
import { ASSEMBLY_NOTE_MAX } from '../state/permissions';

/** Collapsible 'Assembly note' (collapsed by default; tap the header). Editable = multiline box; otherwise read-only text.
 *  `nested` renders it as a card-within-a-card (inside the Music card). Pass open/onToggle to keep its state on the screen. */
export function AssemblyNoteCard({ value, onChange, editable, nested, open: openP, onToggle }: { value: string; onChange?: (v: string) => void; editable?: boolean; nested?: boolean; open?: boolean; onToggle?: (o: boolean) => void }) {
  const c = useColors(); const s = useStyles(); const { t } = useMe();
  const [own, setOwn] = useState(false);
  const open = openP ?? own;
  const has = value.trim().length > 0;
  return (
    <CollapsibleCard toggleID="asm-toggle" testID="asm-card" nested={nested} icon="construct-outline" title={t('assemblyNote.title')} open={open}
      onToggle={o => { setOwn(o); onToggle?.(o); }} a11yLabel={open ? t('assemblyNote.hide') : t('assemblyNote.show')}
      badge={!open && has ? <View testID="asm-has" style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} /> : null}>
      {editable
        ? <TextInput testID="asm-input" value={value} onChangeText={v => onChange?.(v)} multiline maxLength={ASSEMBLY_NOTE_MAX} placeholder={t('assemblyNote.placeholder')} placeholderTextColor={c.subtle}
            accessibilityLabel={t('assemblyNote.title')} style={[s.input, { minHeight: 96, paddingTop: 10, paddingBottom: 10, textAlignVertical: 'top' }]} />
        : <Text testID="asm-text" selectable style={{ fontSize: 15, lineHeight: 22, color: has ? c.text : c.muted }}>{has ? value : t('assemblyNote.empty')}</Text>}
    </CollapsibleCard>
  );
}
