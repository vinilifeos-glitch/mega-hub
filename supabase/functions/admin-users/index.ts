// Edge function (Deno): owner-only account admin. Deploy: supabase functions deploy admin-users
// The service-role key is injected by Supabase as an env secret and never reaches the app.
import { createClient } from 'npm:@supabase/supabase-js@2';

const URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const authEmail = (u: string) => `${u.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()}@megahub.local`;
const ddmmToIso = (v?: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v ?? ''); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return json({});
  // who is calling? (verify JWT with the anon client, then check tier with service role)
  const caller = createClient(URL, ANON, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: me } = await caller.auth.getUser();
  if (!me.user) return json({ error: 'not signed in' }, 401);
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
  const { data: prof } = await admin.from('profiles').select('tier, active').eq('id', me.user.id).single();
  if (prof?.tier !== 'owner' || !prof.active) return json({ error: 'owner only' }, 403);

  const body = await req.json();
  if (body.action === 'reset-password') {
    if (typeof body.tempPassword !== 'string' || body.tempPassword.length < 6) return json({ error: 'password too short' }, 400);
    const { data: tgt } = await admin.from('profiles').select('id').eq('id', body.userId).single();
    if (!tgt) return json({ error: 'not found' }, 404);
    const { error } = await admin.auth.admin.updateUserById(body.userId, { password: body.tempPassword });
    if (error) return json({ error: error.message }, 400);
    await admin.from('profiles').update({ must_change_password: true }).eq('id', body.userId);
    return json({ ok: true });
  }
  if (body.action === 'set-username') {
    // sign-in is by username: keep the synthetic Auth email in step with profiles.username
    const username = String(body.username ?? '').trim();
    if (!/^[A-Za-z0-9._-]{2,30}$/.test(username)) return json({ error: 'invalid username' }, 400);
    const { data: tgt } = await admin.from('profiles').select('id').eq('id', body.userId).single();
    if (!tgt) return json({ error: 'not found' }, 404);
    const { data: clash } = await admin.from('profiles').select('id').ilike('username', username).neq('id', body.userId).maybeSingle();
    if (clash) return json({ error: 'username taken' }, 409);
    const { error } = await admin.auth.admin.updateUserById(body.userId, { email: authEmail(username), email_confirm: true });
    if (error) return json({ error: error.message }, 400);
    const { error: e2 } = await admin.from('profiles').update({ username }).eq('id', body.userId);
    if (e2) return json({ error: e2.message }, 400);
    return json({ ok: true });
  }
  if (body.action === 'set-active') {
    // deactivated accounts are also banned in Auth so existing sessions/refresh tokens stop working
    const { data: tgt } = await admin.from('profiles').select('id, tier').eq('id', body.userId).single();
    if (!tgt) return json({ error: 'not found' }, 404);
    if (tgt.tier === 'owner' || body.userId === me.user.id) return json({ error: 'cannot deactivate the owner' }, 400);
    const active = !!body.active;
    const { error } = await admin.auth.admin.updateUserById(body.userId, { ban_duration: active ? 'none' : '876000h' });
    if (error) return json({ error: error.message }, 400);
    const { error: e2 } = await admin.from('profiles').update({ active }).eq('id', body.userId);
    if (e2) return json({ error: e2.message }, 400);
    return json({ ok: true });
  }
  if (body.action === 'create') {
    const username = String(body.username ?? '').trim();
    if (!/^[A-Za-z0-9._-]{2,30}$/.test(username)) return json({ error: 'invalid username' }, 400);
    if (!['admin', 'volunteer'].includes(body.role)) return json({ error: 'invalid tier' }, 400);
    if (typeof body.tempPassword !== 'string' || body.tempPassword.length < 6) return json({ error: 'password too short' }, 400);
    const { data: created, error } = await admin.auth.admin.createUser({ email: authEmail(username), password: body.tempPassword, email_confirm: true });
    if (error || !created.user) return json({ error: error?.message ?? 'create failed' }, 400);
    const id = created.user.id;
    const steps = [
      admin.from('profiles').insert({ id, username, tier: body.role, must_change_password: body.mustChange ?? true }),
      admin.from('profile_private').insert({ user_id: id, first_name: body.firstName ?? '', middle_names: body.middleNames ?? '', last_name: body.lastName ?? '',
        dob: ddmmToIso(body.dob), contact: body.contact?.trim() || null, email: body.email?.trim().toLowerCase() || null }),
    ];
    for (const s of steps) { const { error: e } = await s; if (e) { await admin.auth.admin.deleteUser(id); return json({ error: e.message }, 400); } }
    const deps: string[] = body.departmentIds ?? [];
    if (deps.length) await admin.from('user_departments').insert(deps.map(d => ({ user_id: id, department_id: d })));
    const pos = Object.entries(body.positions ?? {}).flatMap(([d, rs]) => (rs as string[]).map(role => ({ user_id: id, department_id: d, role })));
    if (pos.length) await admin.from('user_positions').insert(pos);
    if (body.role === 'admin' && body.adminOf?.length) await admin.from('admin_of').insert(body.adminOf.map((d: string) => ({ user_id: id, department_id: d })));
    return json({ id });
  }
  return json({ error: 'unknown action' }, 400);
});
