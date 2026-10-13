// Supabase-mode rehearsal against LOCAL Supabase: fresh DB + import per device, then owner/admin/volunteer flows (iPhone 13 WebKit, Pixel 7).
const { webkit, chromium, devices } = require('playwright'); const { execSync } = require('child_process'); const fs = require('fs');
const REPO = '/workspace/mega-hub-perms', EXP = '/workspace/rehearsal/megahub-export-2026-10-13.json';
const env = Object.fromEntries(fs.readFileSync('/workspace/.sblocal.env', 'utf8').trim().split('\n').map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const { createClient } = require(REPO + '/node_modules/@supabase/supabase-js'); const WS = require(REPO + '/node_modules/ws');
const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false }, realtime: { transport: WS } });
const q = async (t, f = x => x) => { const r = await f(admin.from(t).select('*')); if (r.error) throw r.error; return r.data; };
const URL = process.env.URL || 'http://localhost:8822/mega-hub/'; const ONLY = process.env.ONLY;
function resetAndImport() {
  execSync('supabase db reset --local >/tmp/dbreset.log 2>&1', { cwd: REPO });
  execSync(`node scripts/supabase-import.mjs ${EXP} >/tmp/import.log 2>&1 && mv -f megahub-temp-passwords.csv /workspace/rehearsal/`, { cwd: REPO, env: { ...process.env, SUPABASE_URL: env.API_URL, SUPABASE_SERVICE_ROLE_KEY: env.SERVICE_ROLE_KEY } });
  return Object.fromEntries(fs.readFileSync('/workspace/rehearsal/megahub-temp-passwords.csv', 'utf8').trim().split('\n').slice(1).map(l => { const [u, , p] = l.split(','); return [u, p]; }));
}
(async () => { let P = 0, F = 0;
for (const [name, bt, dev] of [['iPhone', webkit, devices['iPhone 13']], ['Pixel', chromium, devices['Pixel 7']]].filter(x => !ONLY || x[0] === ONLY)) {
  const pw = resetAndImport(); console.log(name, 'import:', fs.readFileSync('/tmp/import.log', 'utf8').match(/import rows: .*/)?.[0]);
  const b = await bt.launch();
  for (const who of ['Vini', 'Lucas', 'Camila', 'Tiago']) {
    const ctx = await b.newContext({ ...dev, acceptDownloads: true }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept().catch(() => {})); pg.on('response', async r => { if (r.status() >= 400 && /54321/.test(r.url())) console.log('HTTP', r.status(), r.request().method(), r.url().replace(/^.*54321/, '').slice(0, 140), (await r.text().catch(() => '')).slice(0, 200)); });
    const W = ms => pg.waitForTimeout(ms); const vis = id => pg.locator(`[data-testid="${id}"]:visible`).last();
    const tap = async id => { const l = vis(id); await l.waitFor({ timeout: 10000 }); await l.scrollIntoViewIfNeeded(); await l.tap(); await W(400); };
    const fill = async (id, v) => { const l = vis(id); await l.waitFor({ timeout: 10000 }); await l.fill(v); await W(150); };
    const has = async id => (await pg.locator(`[data-testid="${id}"]:visible`).count()) > 0;
    const until = async (fn, ms = 10000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch {} await W(400); } return false; };
    const ck = async (n, fn) => { let r; try { r = await fn(); } catch (e) { r = false; n += ' - ' + e.message.split('\n')[0]; } console.log(r ? 'PASS' : 'FAIL', name, who, n); if (r) P++; else { F++; await pg.screenshot({ path: `/tmp/sbr-${name}-${who}-${F}.png`, fullPage: true }).catch(() => {}); } };
    const NEW = 'Nova-' + who + '1';
    // sign in with temp password -> forced change
    await pg.goto(URL); await W(2500);
    await ck('wrong password rejected', async () => { await fill('username', who); await fill('password', 'nope123456'); await tap('signin'); await W(1500); return !(await has('newpw')) && await has('signin'); });
    await fill('password', pw[who]); await tap('signin');
    await ck('temp password signs in -> forced password change', () => until(() => has('newpw')));
    if (await has('oldpw')) await fill('oldpw', pw[who]);
    await fill('newpw', NEW); await fill('confirmpw', NEW); await tap('savepw');
    await ck('password changed -> app home (header avatar)', () => until(() => has('header-profile'), 15000));
    await ck('must_change_password cleared in DB', () => until(async () => (await q('profiles', s => s.eq('username', who)))[0].must_change_password === false));
    await W(1500);
    // re-sign-in with the new password
    await tap('header-profile'); await until(() => has('signout') || pg.locator('text=/^(Sair|Sign out)$/').count());
    await pg.locator('text=/^(Sair|Sign out)$/').last().tap(); await W(1500);
    await fill('username', who); await fill('password', NEW); await tap('signin');
    await ck('new password signs in (no forced change)', async () => (await until(() => has('header-profile'), 15000)) && !(await has('newpw')));
    if (who === 'Vini') {
      // services: create with setlist, then assign
      await tap('new-service'); await fill('sv-date', '13/12/2099'); await fill('sv-title', 'Ensaio Supabase');
      await tap('pick-library'); await fill('pick-search', 'Oceans'); await tap('pick-sg-2'); await tap('sv-save'); await W(2500);
      const svc = async () => (await q('services', s => s.eq('title', 'Ensaio Supabase')))[0];
      await ck('owner: service created in DB', async () => !!(await until(svc)));
      const S = await svc();
      await ck('owner: setlist saved (library song)', async () => until(async () => (await q('setlist_items', s => s.eq('service_id', S.id))).some(x => x.song_id === 'sg-2')));
      await pg.goto(URL); await W(2500); await tap('svc-2099-12-13'); await tap('slot-d-music-Keys-0'); await tap('pick-free-Miguel'); await tap('svd-save'); await W(2500);
      const miguel = (await q('profiles', s => s.eq('username', 'Miguel')))[0];
      await ck('owner: assignment saved in DB', () => until(async () => (await q('assignments', s => s.eq('service_id', S.id))).some(a => a.user_id === miguel.id && a.role === 'Keys')));
      // songs
      await pg.goto(URL + 'dept/d-music/songs'); await W(2500);
      await ck('owner: imported songs listed', async () => (await has('song-row-sg-1')) && has('song-row-sg-2'));
      await tap('lib-add-song'); await fill('song-f-title', 'Way Maker'); await fill('song-f-composer', 'Sinach'); await tap('song-save'); await W(2500);
      await ck('owner: new song in DB', () => until(async () => (await q('songs', s => s.eq('title', 'Way Maker'))).length === 1));
      // accounts: edge function create + reset
      await pg.goto(URL + 'accounts'); await W(2500);
      await ck('owner: Accounts opens with imported users', async () => /Camila/.test(await pg.evaluate(() => document.body.innerText)));
      // export button present on profile
      await pg.goto(URL + 'profile'); await W(2000); await ck('owner: Export data button', () => has('export-data'));
      // lessons: imported file listed + opens
      await pg.goto(URL + 'dept/d-kids/lessons'); await W(3000);
      await ck('owner: imported lesson listed, no device-only note', async () => /Arca de Noé/.test(await pg.evaluate(() => document.body.innerText)) && !(await has('lessons-local-note')));
      await ck('owner: imported lesson downloads (Storage)', async () => { const L = (await q('lessons'))[0]; const [d] = await Promise.all([pg.waitForEvent('download', { timeout: 10000 }), tap(`lesson-dl-${L.id}`)]); const p = await d.path(); return fs.readFileSync(p, 'utf8').startsWith('%PDF'); });
    }
    if (who === 'Lucas') {
      const S = (await q('services', s => s.eq('title', 'Ensaio Supabase')))[0];
      await pg.goto(URL); await W(2500); await tap('svc-2099-12-13'); await tap('slot-d-music-Keys-0'); await tap('pick-free-Antony'); await tap('svd-save'); await W(2500);
      const ant = (await q('profiles', s => s.eq('username', 'Antony')))[0];
      await ck('Music admin: reassign saved in DB', () => until(async () => (await q('assignments', s => s.eq('service_id', S.id))).some(a => a.user_id === ant.id)));
      await pg.goto(URL + 'dept/d-music/songs'); await W(2500);
      await ck('Music admin: can add songs', () => has('lib-add-song'));
      await pg.goto(URL + 'dept/d-kids/lessons'); await W(2500);
      await ck('Music admin: no Kids lessons upload', async () => !(await has('lesson-upload')));
    }
    if (who === 'Camila') {
      await pg.goto(URL + 'dept/d-kids/lessons'); await W(3000);
      await ck('Kids admin: upload form, no device-only note', async () => (await has('lesson-upload')) && !(await has('lessons-local-note')));
      await pg.locator('[data-testid="lesson-file"]').setInputFiles({ name: 'Plano aula.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') }); await W(800);
      await fill('lesson-title', 'Plano de Aula'); await tap('lesson-upload');
      const row = async () => (await q('lessons', s => s.eq('title', 'Plano de Aula')))[0];
      await ck('Kids admin: upload -> lessons row + Storage object', async () => { if (!(await until(row))) return false; const r = await row(); const { data } = await admin.storage.from('lessons').download(r.storage_path); return !!data && (await data.text()).startsWith('%PDF'); });
      const L = await row();
      await ck('Kids admin: listed after upload', () => until(() => has(`lesson-row-${L.id}`)));
      await tap(`lesson-ren-${L.id}`); await fill('lesson-rename-input', 'Plano Renomeado'); await tap('lesson-rename-save');
      await ck('Kids admin: rename saved in DB', () => until(async () => (await row()) === undefined && (await q('lessons', s => s.eq('id', L.id)))[0]?.title === 'Plano Renomeado'));
      await tap(`lesson-del-${L.id}`); if (await has('confirm-ok')) await tap('confirm-ok');
      await ck('Kids admin: delete removes row + file', () => until(async () => (await q('lessons', s => s.eq('id', L.id))).length === 0 && !((await admin.storage.from('lessons').list(`d-kids/${L.id}`)).data ?? []).length));
      await pg.locator('[data-testid="lesson-file"]').setInputFiles({ name: 'big.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(5 * 1024 * 1024 + 5, 65) }); await W(800);
      await ck('Kids admin: >5MB rejected', async () => has('lesson-error'));
    }
    if (who === 'Tiago') {
      await pg.goto(URL + 'availability'); await W(2500);
      await fill('unav-from', '20/12/2099'); if (await has('unav-note')) await fill('unav-note', 'Viagem'); await tap('unav-add'); await W(2000);
      const me2 = (await q('profiles', s => s.eq('username', 'Tiago')))[0];
      await ck('volunteer: availability saved in DB', () => until(async () => (await q('unavailability', s => s.eq('user_id', me2.id))).some(x => x.date === '2099-12-20')));
      await pg.goto(URL + 'dept/d-kids/lessons'); await W(3000);
      await ck('volunteer (Kids): sees lesson, read-only', async () => /Arca de Noé/.test(await pg.evaluate(() => document.body.innerText)) && !(await has('lesson-upload')) && !(await pg.locator('[data-testid^="lesson-del-"]:visible').count()));
      await pg.goto(URL); await W(2500);
      await ck('volunteer: no new-service button', async () => !(await has('new-service')));
      await pg.goto(URL + 'dept/d-music/songs'); await W(2000);
      await ck('volunteer: cannot add songs', async () => !(await has('lib-add-song')));
    }
    console.log(name, who, 'errors', errs); if (errs.length) F++; await ctx.close();
  }
  await b.close(); }
console.log(`${P} passed, ${F} failed`); })();
