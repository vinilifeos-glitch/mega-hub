import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMe } from '../state/AppContext';
import { goBack } from './DeptPage';
import { SongSheet, SheetPalette } from './SongSheet';
import { Ionicons } from '@expo/vector-icons';
import { stageColors } from '../components/ui';

// Fixed high-contrast stage palette (independent of theme), from the central tokens.
const P: SheetPalette & { bg: string; btn: string } = stageColors;

/** Keep the screen on: Web Wake Lock API when present; silently no-op elsewhere / if unsupported. */
function useKeepAwake() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let lock: any = null; let gone = false;
    const nav: any = globalThis.navigator;
    const req = async () => { try { if (nav?.wakeLock?.request && document.visibilityState === 'visible') lock = await nav.wakeLock.request('screen'); } catch { /* unsupported / denied */ } };
    const vis = () => { if (!gone && document.visibilityState === 'visible') req(); };
    req(); document.addEventListener?.('visibilitychange', vis);
    return () => { gone = true; document.removeEventListener?.('visibilitychange', vis); try { lock?.release?.(); } catch { /* ignore */ } };
  }, []);
}

export function LiveMode({ serviceId }: { serviceId: string }) {
  const { data, t, canLive } = useMe(); const insets = useSafeAreaInsets();
  useKeepAwake();
  const sv = data.services.find(x => x.id === serviceId);
  const list = sv?.setlist ?? [];
  const [i, setI] = useState(0);
  const [size, setSize] = useState(24);
  const idx = Math.min(i, Math.max(0, list.length - 1));
  const go = (d: number) => setI(x => Math.max(0, Math.min(list.length - 1, x + d)));
  const goRef = useRef(go); goRef.current = go;
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 30 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderRelease: (_, g) => { if (g.dx < -60) goRef.current(1); else if (g.dx > 60) goRef.current(-1); },
  }), []);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const k = (e: KeyboardEvent) => { if (e.key === 'ArrowRight' || e.key === 'PageDown') goRef.current(1); if (e.key === 'ArrowLeft' || e.key === 'PageUp') goRef.current(-1); };
    globalThis.addEventListener?.('keydown', k); return () => globalThis.removeEventListener?.('keydown', k);
  }, []);
  const exit = () => goBack('/');
  const Shell = ({ children }: { children: React.ReactNode }) => <View style={{ flex: 1, backgroundColor: P.bg, paddingTop: insets.top + 8, paddingHorizontal: 16 }}>{children}</View>;
  const ExitBtn = <Pressable testID="live-exit" accessibilityRole="button" accessibilityLabel={t('live.exit')} onPress={exit} style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: P.btn }}><View style={{ flexDirection: 'row', alignItems: 'center' }}><Ionicons name="close" size={18} color={P.text} style={{ marginRight: 4 }} /><Text style={{ color: P.text, fontWeight: '800', fontSize: 16 }}>{t('live.exit')}</Text></View></Pressable>;
  if (!sv || !canLive(serviceId)) return <Shell><View style={{ alignItems: 'flex-end' }}>{ExitBtn}</View><Text testID="live-denied" style={{ color: P.text, fontSize: 18, marginTop: 24 }}>{t('live.noAccess')}</Text></Shell>;
  if (!list.length) return <Shell><View style={{ alignItems: 'flex-end' }}>{ExitBtn}</View><Text testID="live-empty" style={{ color: P.text, fontSize: 18, marginTop: 24 }}>{t('live.empty')}</Text></Shell>;
  const item = list[idx]; const song = item.songId ? (data.songs ?? []).find(z => z.id === item.songId) : undefined;
  const key = item.key || song?.key; const next = list[idx + 1];
  return (
    <View testID="live-screen" style={{ flex: 1, backgroundColor: P.bg, paddingTop: insets.top + 8 }} {...pan.panHandlers}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 }}>
        <Text testID="live-position" style={{ color: P.chord, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 }}>{t('live.position', { n: idx + 1, total: list.length })}</Text>
        <View style={{ flexDirection: 'row' }}>
          <Pressable testID="live-smaller" accessibilityRole="button" accessibilityLabel={t('ui.textSmaller')} onPress={() => setSize(z => Math.max(16, z - 3))} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: P.btn, marginRight: 8 }}><Text style={{ color: P.text, fontWeight: '800' }}>A−</Text></Pressable>
          <Pressable testID="live-bigger" accessibilityRole="button" accessibilityLabel={t('ui.textBigger')} onPress={() => setSize(z => Math.min(48, z + 3))} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: P.btn, marginRight: 8 }}><Text style={{ color: P.text, fontWeight: '800' }}>A+</Text></Pressable>
          {ExitBtn}
        </View>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text testID="live-title" style={{ color: P.text, fontSize: size * 1.3, fontWeight: '900' }}>{item.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
          {key ? <Text testID="live-key" style={{ color: P.bg, backgroundColor: P.chord, fontWeight: '900', fontSize: size * 0.8, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' }}>{t('live.key', { key })}</Text> : null}
          {song?.bpm || song?.timeSignature ? <Text style={{ color: P.muted, fontSize: size * 0.7, marginLeft: 12 }}>{[song.timeSignature, song.bpm ? `${song.bpm} BPM` : ''].filter(Boolean).join(' · ')}</Text> : null}
        </View>
        {item.notes ? <Text testID="live-notes" style={{ color: P.muted, fontSize: size * 0.75, marginBottom: 8 }}>{item.notes}</Text> : null}
        {song ? <SongSheet song={song} toKey={key} size={size} pal={P} /> : null}
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: P.border }}>
        <Text testID="live-next-title" style={{ color: P.muted, fontSize: 16, fontWeight: '600', marginBottom: 10, letterSpacing: 0.2 }} numberOfLines={1}>{next ? t('live.nextUp', { title: next.title }) : t('live.last')}</Text>
        <View style={{ flexDirection: 'row' }}>
          <Pressable testID="live-prev" disabled={idx === 0} onPress={() => go(-1)} accessibilityRole="button" style={{ flex: 1, minHeight: 64, borderRadius: 14, backgroundColor: P.btn, alignItems: 'center', justifyContent: 'center', marginRight: 8, opacity: idx === 0 ? 0.4 : 1 }}><View style={{ flexDirection: 'row', alignItems: 'center' }}><Ionicons name="chevron-back" size={22} color={P.text} /><Text style={{ color: P.text, fontSize: 20, fontWeight: '900', marginLeft: 4 }}>{t('live.prev')}</Text></View></Pressable>
          <Pressable testID="live-next" disabled={!next} onPress={() => go(1)} accessibilityRole="button" style={{ flex: 1, minHeight: 64, borderRadius: 14, backgroundColor: next ? P.chord : P.btn, alignItems: 'center', justifyContent: 'center', opacity: next ? 1 : 0.4 }}><View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={{ color: next ? P.bg : P.text, fontSize: 20, fontWeight: '900', marginRight: 4 }}>{t('live.next')}</Text><Ionicons name="chevron-forward" size={22} color={next ? P.bg : P.text} /></View></Pressable>
        </View>
      </View>
    </View>
  );
}
