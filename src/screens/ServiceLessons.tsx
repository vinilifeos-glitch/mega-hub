/** Kids "Lessons" section on a service (form, service page, My Rota): picked only from the Kids lesson catalog. */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useMe } from '../state/AppContext';
import { Badge, Card, CardHeader, GhostButton, Icon, IconButton, SearchField, useColors, useStyles } from '../components/ui';
import { downloadLesson, fmtSize, Lesson, openLesson, useLessons } from '../data/files';
import { KIDS_DEPT, canSeeServiceLessonsRule } from '../state/permissions';
import { Service } from '../types';

export function ServiceLessonsCard({ service, list, onChange, editable, startEditing, readOnly }: { service?: Service; list: string[]; onChange?: (l: string[]) => void; editable?: boolean; startEditing?: boolean; readOnly?: boolean }) {
  const colors = useColors(); const s = useStyles(); const { data, t, currentUser } = useMe();
  const catalog = useLessons(KIDS_DEPT);
  const [editing, setEditing] = useState(!!startEditing && !!editable);
  const [pick, setPick] = useState<string | null>(null);
  if (!canSeeServiceLessonsRule(currentUser)) return null;
  if (!editable && !list.length) return null;
  const byId = new Map(catalog.map(l => [l.id, l]));
  const edit = editing && editable && !readOnly;
  const set = (l: string[]) => onChange?.(l);
  const move = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= list.length) return; const n = [...list]; [n[i], n[j]] = [n[j], n[i]]; set(n); };
  const q = (pick ?? '').trim().toLowerCase();
  const offer = catalog.filter(l => !list.includes(l.id) && (!q || l.title.toLowerCase().includes(q) || l.name.toLowerCase().includes(q)));
  const accent = data.departments.find(d => d.id === KIDS_DEPT)?.color ?? colors.primary;
  return (
    <View testID="lessons-card"><Card style={{ borderLeftWidth: 3, borderLeftColor: accent }}>
      <View style={[s.row, { justifyContent: 'space-between', flexWrap: 'nowrap' }]}>
        <View style={[s.row, { flexWrap: 'nowrap', flex: 1 }]}>
          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
            <Icon name="book-outline" size={18} color={colors.primaryText} />
          </View>
          <Text style={[s.h2, { marginRight: 8 }]}>{t('svcLessons.title')}</Text>
          <Badge label={t('svcLessons.count', { n: list.length })} testID="lessons-count" />
        </View>
        {editable && !readOnly && !editing && <Pressable testID="lessons-edit" accessibilityRole="button" onPress={() => setEditing(true)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 8 }}>
          <Icon name="create-outline" size={16} color={colors.primaryText} style={{ marginRight: 4 }} />
          <Text style={{ color: colors.primaryText, fontWeight: '700' }}>{t('svcLessons.edit')}</Text>
        </Pressable>}
      </View>
      {list.length === 0 && <Text style={[s.small, { textAlign: 'center', paddingVertical: 16 }]} testID="lessons-empty">{t('svcLessons.empty')}</Text>}
      <View style={{ marginTop: 8 }}>
        {list.map((id, i) => { const l: Lesson | undefined = byId.get(id); const title = l?.title ?? t('svcLessons.removed'); return (
          <View key={id} testID={`svl-row-${id}`} style={[s.row, { flexWrap: 'nowrap', alignItems: 'center', borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, paddingVertical: 10 }]}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Text style={{ color: colors.muted, fontWeight: '700', fontSize: 13 }}>{i + 1}</Text>
            </View>
            <Pressable style={{ flex: 1, marginRight: 8 }} disabled={!l} onPress={() => l && openLesson(l)} accessibilityRole={l ? 'link' : undefined} testID={`svl-open-${id}`}>
              <Text style={{ color: l ? colors.text : colors.muted, fontWeight: '700', fontSize: 15, fontStyle: l ? 'normal' : 'italic' }} testID={`svl-title-${id}`}>{title}</Text>
              {l ? <Text style={s.small} numberOfLines={1}>{l.name} · {fmtSize(l.size)}</Text> : null}
            </Pressable>
            {l && !edit && <IconButton testID={`svl-dl-${id}`} icon="download-outline" color={colors.primaryText} label={t('svcLessons.download')} onPress={() => downloadLesson(l)} />}
            {edit && <View style={[s.row, { flexWrap: 'nowrap' }]}>
              <IconButton testID={`svl-up-${id}`} icon="chevron-up" color={colors.muted} label={t('svcLessons.up', { title })} onPress={() => move(i, -1)} />
              <IconButton testID={`svl-down-${id}`} icon="chevron-down" color={colors.muted} label={t('svcLessons.down', { title })} onPress={() => move(i, 1)} />
              <IconButton testID={`svl-rm-${id}`} icon="remove-circle-outline" color={colors.red} label={t('svcLessons.remove', { title })} onPress={() => set(list.filter(x => x !== id))} />
            </View>}
          </View>); })}
      </View>
      {edit && <View style={[s.row, { justifyContent: 'flex-end', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 4 }]}>
        <Pressable testID="lessons-done" accessibilityRole="button" onPress={() => { setEditing(false); setPick(null); }} style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 18, borderRadius: 999, backgroundColor: colors.primary, justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
          <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>{t('svcLessons.done')}</Text>
        </Pressable>
      </View>}
      {edit && (pick === null ? <GhostButton icon="add" label={t('svcLessons.add')} onPress={() => setPick('')} testID="lessons-add" /> :
        <View style={{ marginTop: 10, padding: 12, borderRadius: 14, backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.border }} testID="lessons-picker">
          <CardHeader icon="book-outline" title={t('svcLessons.add')} />
          <SearchField value={pick} onChangeText={setPick} placeholder={t('svcLessons.search')} testID="lessons-search" />
          {catalog.length === 0 ? <Text style={s.small} testID="lessons-catalog-empty">{t('svcLessons.noneInCatalog')}</Text>
            : offer.length === 0 ? <Text style={s.small} testID="lessons-none-left">{q ? t('svcLessons.empty') : t('svcLessons.allPicked')}</Text> : null}
          {offer.map(l => <Pressable key={l.id} testID={`lpick-${l.id}`} onPress={() => { set([...list, l.id]); setPick(null); }} style={({ pressed }) => ({ paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: pressed ? colors.border : 'transparent' })}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{l.title}</Text><Text style={s.small}>{l.name}</Text>
          </Pressable>)}
        </View>)}
    </Card></View>
  );
}
