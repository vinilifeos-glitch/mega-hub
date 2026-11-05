// Sends Web Push OS notifications for unacknowledged rota assignments.
// Called by GitHub Actions every 4 hours (free) or manually.
// Secrets: NOTIFY_CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
// Uses service role (auto) to read pending acks + subscriptions; never expose that key to the client.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import webpush from 'npm:web-push@3.6.7';

const FOUR_H_MS = 4 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  try {
    const secret = Deno.env.get('NOTIFY_CRON_SECRET') ?? '';
    const got = req.headers.get('x-cron-secret') ?? '';
    if (!secret || got !== secret) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });

    const pub = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
    const priv = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
    const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@megahub.local';
    if (!pub || !priv) return new Response(JSON.stringify({ error: 'vapid-not-configured' }), { status: 500 });
    webpush.setVapidDetails(subject, pub, priv);

    const url = Deno.env.get('SUPABASE_URL')!;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(url, key);

    const today = new Date().toISOString().slice(0, 10);
    const { data: services, error: se } = await sb.from('services').select('id,title,date,start_time,status').gte('date', today).neq('status', 'draft');
    if (se) throw se;
    const svcMap = new Map((services ?? []).map(s => [s.id, s]));

    const { data: asg, error: ae } = await sb.from('assignments').select('service_id,user_id').in('service_id', [...svcMap.keys()]);
    if (ae) throw ae;
    const pairs = new Map<string, { service_id: string; user_id: string }>();
    for (const a of asg ?? []) pairs.set(`${a.service_id}:${a.user_id}`, a);

    const { data: acks, error: ke } = await sb.from('rota_acks').select('*').in('service_id', [...svcMap.keys()]);
    if (ke) throw ke;
    const ackMap = new Map((acks ?? []).map(a => [`${a.service_id}:${a.user_id}`, a]));

    const now = Date.now();
    const due: { service_id: string; user_id: string }[] = [];
    for (const [k, p] of pairs) {
      const ack = ackMap.get(k);
      if (ack && (ack.status === 'acknowledged' || ack.status === 'unavailable')) continue;
      const last = ack?.last_notified_at ? Date.parse(ack.last_notified_at) : 0;
      if (now - last < FOUR_H_MS) continue;
      due.push(p);
    }

    let sent = 0, gone = 0;
    for (const p of due) {
      const sv = svcMap.get(p.service_id); if (!sv) continue;
      const { data: subs } = await sb.from('push_subscriptions').select('*').eq('user_id', p.user_id);
      if (!subs?.length) continue;
      const payload = JSON.stringify({
        title: 'Mega Hub',
        body: `${sv.title} · ${sv.date} — please acknowledge your rota`,
        tag: `rota-${sv.id}`,
        url: './',
      });
      for (const sub of subs) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
          sent++;
        } catch (e: any) {
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            gone++;
          }
        }
      }
      await sb.from('rota_acks').upsert({
        service_id: p.service_id, user_id: p.user_id,
        status: ackMap.get(`${p.service_id}:${p.user_id}`)?.status ?? 'pending',
        last_notified_at: new Date().toISOString(),
      }, { onConflict: 'service_id,user_id' });
    }

    return new Response(JSON.stringify({ ok: true, due: due.length, sent, gone }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
