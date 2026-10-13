/**
 * Unsaved-changes guard for the service form / service page.
 * One active guard at a time. leaveGuarded(go) runs go() directly when clean, otherwise shows the in-app
 * 'Save changes?' modal: Save (keep changes, continue) / Cancel (discard changes, continue). No 'stay' option. Works the same on web and native (no window.confirm).
 * Web extras: browser back is caught with a same-URL history sentinel; reload/close uses beforeunload.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Text, View } from 'react-native';
import { Button, useColors } from './components/ui';
import { useApp } from './state/AppContext';

export type Guard = {
  /** Persist pending changes. Return a success message (or '') to continue, or false to stay (validation error shown). */
  save: () => string | false;
  /** Leave the screen the in-app way (used for browser back). */
  back: (msg?: string) => void;
};
type Active = Guard & { dirty: boolean };
let active: { current: Active } | null = null;
let show: ((go: (msg?: string) => void) => void) | null = null;
const web = Platform.OS === 'web' && typeof window !== 'undefined';
let pushed = false; let ignorePop = false;

export const isDirty = () => !!active?.current.dirty;
/** Run `go` now if nothing is pending, else ask first. `go` receives the save message when the user chose Save. */
export function leaveGuarded(go: (msg?: string) => void) {
  if (!active || !active.current.dirty || !show) return go();
  show(go);
}

function dropSentinel() {
  if (web && pushed && (window.history.state as any)?.mhGuard) { ignorePop = true; window.history.back(); }
  pushed = false;
}
if (web) {
  window.addEventListener('popstate', () => {
    if (ignorePop) { ignorePop = false; return; }
    if (!pushed) return;
    pushed = false; // the sentinel was just popped by browser back
    const g = active?.current;
    if (!g || !g.dirty || !show) { g?.back(); return; }
    show(msg => g.back(msg));
  });
  window.addEventListener('beforeunload', e => { if (active?.current.dirty) { e.preventDefault(); (e as any).returnValue = ''; } });
}
function pushSentinel() {
  if (!web || pushed) return;
  window.history.pushState({ ...(window.history.state ?? {}), mhGuard: true }, '', window.location.href); pushed = true;
}

/** Register the screen's guard while mounted. */
export function useUnsavedGuard(dirty: boolean, g: Guard) {
  const ref = useRef<Active>({ ...g, dirty }); ref.current = { ...g, dirty };
  useEffect(() => { active = ref; return () => { if (active === ref) { active = null; dropSentinel(); } }; }, []);
  useEffect(() => { if (dirty) pushSentinel(); else dropSentinel(); }, [dirty]);
}

/** Mount once at the root. */
export function UnsavedHost() {
  const c = useColors(); const { t } = useApp();
  const [go, setGo] = useState<{ fn: (msg?: string) => void } | null>(null);
  useEffect(() => { show = fn => setGo({ fn }); return () => { show = null; }; }, []);
  const cancel = () => { if (!go) return; const f = go.fn; setGo(null); if (active) active.current.dirty = false; pushed = false; f(); }; // discard + continue (sentinel abandoned: no async history.back racing the navigation)
  return (
    <Modal visible={!!go} transparent animationType="fade" onRequestClose={cancel}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.45)' }}>
        {go && <View testID="unsaved-sheet" accessibilityRole="alert" style={{ backgroundColor: c.card, borderRadius: 16, padding: 20, maxWidth: 420, width: '100%', alignSelf: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: c.text, marginBottom: 8 }}>{t('unsaved.title')}</Text>
          <Text style={{ fontSize: 15, color: c.muted, marginBottom: 12 }}>{t('unsaved.msg')}</Text>
          <Button label={t('unsaved.save')} testID="unsaved-save" onPress={() => { const g = active?.current; const f = go.fn; setGo(null);
            const m = g ? g.save() : ''; if (m === false) { if (active?.current.dirty) pushSentinel(); return; } pushed = false; f(m || undefined); }} />
          <Button label={t('unsaved.cancel')} outline testID="unsaved-cancel" onPress={cancel} />
        </View>}
      </View>
    </Modal>
  );
}
