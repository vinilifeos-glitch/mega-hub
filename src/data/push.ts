/**
 * Web Push helpers for the GitHub Pages PWA.
 * Real OS banners use the browser Notification + Push APIs (service worker).
 * Requires: HTTPS, user permission, VAPID public key (EXPO_PUBLIC_VAPID_PUBLIC_KEY),
 * and (for background every-4h) the notify-rota edge function + cron.
 * iOS: only after Add to Home Screen (Safari 16.4+). Android Chrome: works in browser/PWA.
 */
import { repository } from './repository';
import type { SupabaseRepository } from './supabaseRepository';

const VAPID = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const BASE = (process.env.EXPO_PUBLIC_BASE_URL || '/mega-hub').replace(/\/?$/, '/');
const SW_PATH = `${BASE}sw.js`;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64); const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function ensurePushSubscription(): Promise<'ok' | 'denied' | 'unsupported' | 'no-vapid' | 'error'> {
  if (!pushSupported()) return 'unsupported';
  if (!VAPID) return 'no-vapid';
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return 'denied';
    const reg = await navigator.serviceWorker.register(SW_PATH, { scope: SW_PATH.replace(/sw\.js$/, '') });
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) });
    const json = sub.toJSON();
    const endpoint = json.endpoint, p256dh = json.keys?.p256dh, auth = json.keys?.auth;
    if (!endpoint || !p256dh || !auth) return 'error';
    const sb = (repository as SupabaseRepository).sb;
    if (!sb) return 'ok'; // local mode: SW registered; no server store
    const { data: sess } = await sb.auth.getSession();
    const uid = sess.session?.user.id; if (!uid) return 'error';
    const { error } = await sb.from('push_subscriptions').upsert(
      { user_id: uid, endpoint, p256dh, auth, user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 240) : null },
      { onConflict: 'endpoint' });
    return error ? 'error' : 'ok';
  } catch { return 'error'; }
}

/** Show an OS notification from the page (when open / focused). Fallback if push event isn't available yet. */
export function showLocalOsNotification(title: string, body: string, tag?: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  try { new Notification(title, { body, tag }); return true; } catch { return false; }
}
