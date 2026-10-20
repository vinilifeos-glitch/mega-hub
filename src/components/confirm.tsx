/**
 * Cross-platform destructive confirm.
 * Web: window.confirm; if the browser blocks/suppresses dialogs (confirm missing, throws, or returns instantly
 * without user interaction), falls back to an in-app modal. Native: Alert.alert.
 */
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, Text, View } from 'react-native';
import { Button, useColors } from './ui';

type Req = { title: string; msg: string; ok: string; cancel: string; go: () => void };
let show: ((r: Req) => void) | null = null;

export function confirmAsk(title: string, msg: string, ok: string, cancel: string, go: () => void) {
  if (Platform.OS !== 'web') { Alert.alert(title, msg, [{ text: cancel, style: 'cancel' }, { text: ok, style: 'destructive', onPress: go }]); return; }
  const fallback = () => { if (show) show({ title, msg, ok, cancel, go }); };
  const fn = (globalThis as any).confirm;
  if (typeof fn !== 'function') return fallback();
  const t0 = Date.now(); let r: boolean;
  try { r = !!fn.call(globalThis, msg); } catch { return fallback(); }
  if (r) go();
  else if (Date.now() - t0 < 30) fallback(); // suppressed dialog (no time for a human answer)
}

/** Mount once at the root. */
export function ConfirmHost() {
  const c = useColors(); const [req, setReq] = useState<Req | null>(null);
  useEffect(() => { show = setReq; return () => { show = null; }; }, []);
  return (
    <Modal visible={!!req} transparent animationType="fade" onRequestClose={() => setReq(null)}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: c.scrim }}>
        {req && <View testID="confirm-sheet" accessibilityRole="alert" style={{ backgroundColor: c.card, borderRadius: 16, padding: 20, maxWidth: 420, width: '100%', alignSelf: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: c.text, marginBottom: 8 }}>{req.title}</Text>
          <Text style={{ fontSize: 15, color: c.muted, marginBottom: 12 }}>{req.msg}</Text>
          <Button label={req.ok} danger onPress={() => { const g = req.go; setReq(null); g(); }} testID="confirm-ok" />
          <Button label={req.cancel} outline onPress={() => setReq(null)} testID="confirm-cancel" />
        </View>}
      </View>
    </Modal>
  );
}
