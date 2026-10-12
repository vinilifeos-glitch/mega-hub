import { useEffect, useRef } from 'react';
/** Fired on every bottom-tab press so screens drop nested detail/edit state and show their root. */
const subs = new Set<() => void>();
export const emitTabReset = () => subs.forEach(f => f());
export function useTabReset(fn: () => void) {
  const ref = useRef(fn); ref.current = fn;
  useEffect(() => { const f = () => ref.current(); subs.add(f); return () => { subs.delete(f); }; }, []);
}
