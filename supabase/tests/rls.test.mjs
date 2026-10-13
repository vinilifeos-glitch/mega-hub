// RLS tests per role using PGlite (real Postgres in WASM). Run: node supabase/tests/rls.test.mjs
// Needs @electric-sql/pglite resolvable (e.g. NODE_PATH=/workspace/sbtest/node_modules).
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs'; import path from 'path'; import assert from 'assert';
const dir = path.dirname(new URL(import.meta.url).pathname);
const db = new PGlite();
// Minimal Supabase stand-ins: auth schema, auth.uid(), roles.
await db.exec(`
  create role authenticated nologin; create role anon nologin;
  create schema auth; create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
for (const f of fs.readdirSync(path.join(dir, '../migrations')).sort()) await db.exec(fs.readFileSync(path.join(dir, '../migrations', f), 'utf8'));
const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const U = { owner: id(1), lucas: id(2), camila: id(3), ana: id(4), miguel: id(5), tiago: id(6) };
const tiers = { owner: 'owner', lucas: 'admin', camila: 'admin', ana: 'volunteer', miguel: 'volunteer', tiago: 'volunteer' };
for (const [k, v] of Object.entries(U)) {
  await db.query(`insert into auth.users values ($1, $2)`, [v, `${k}@megahub.local`]);
  await db.query(`insert into profiles (id, username, tier, must_change_password) values ($1,$2,$3,false)`, [v, k[0].toUpperCase() + k.slice(1), tiers[k]]);
  await db.query(`insert into profile_private (user_id, first_name, contact, email) values ($1,$2,'123',$3)`, [v, k, `${k}@x.com`]);
}
await db.exec(`insert into admin_of values ('${U.lucas}','d-music'), ('${U.camila}','d-kids');
  insert into user_departments values ('${U.ana}','d-kids'), ('${U.ana}','d-music'), ('${U.miguel}','d-music'), ('${U.owner}','d-kids');
  insert into user_positions values ('${U.ana}','d-kids','Teacher'), ('${U.ana}','d-music','Lead Singer'), ('${U.miguel}','d-music','Keys');
  insert into services (id, title, date, start_time, end_time) values ('${id(100)}','Culto','2099-10-18','16:00','21:00');
  insert into unavailability values ('${U.ana}','2099-10-25','Dentista');`);
const as = async (who, sql, params = []) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${U[who]}', false); set role authenticated;`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
};
let n = 0, fails = 0;
const ok = async (name, fn) => { try { const r = await fn(); assert.ok(r !== false); n++; console.log('PASS', name); } catch (e) { fails++; console.log('FAIL', name, '-', e.message); } };
const denied = async (who, sql, params) => { try { const r = await as(who, sql, params); return r.affectedRows === 0; } catch { return true; } };
const allowed = async (who, sql, params) => (await as(who, sql, params)).affectedRows > 0;
const rows = async (who, sql) => (await as(who, sql)).rows;

// reads / privacy
await ok('everyone reads directory usernames', async () => (await rows('miguel', 'select username from profiles')).length === 6);
await ok('volunteer reads only own private row', async () => { const r = await rows('miguel', 'select user_id from profile_private'); return r.length === 1 && r[0].user_id === U.miguel; });
await ok('admin reads private rows (names/contact)', async () => (await rows('lucas', 'select * from profile_private')).length === 6);
await ok('volunteer cannot read others\' notes', async () => (await rows('miguel', 'select * from unavailability')).length === 0);
await ok('volunteer sees note-free unavailable_days', async () => { const r = await rows('miguel', 'select * from unavailable_days'); return r.length === 1 && !('note' in r[0]); });
await ok('admin reads notes', async () => (await rows('camila', 'select note from unavailability'))[0]?.note === 'Dentista');
await ok('self reads own note', async () => (await rows('ana', 'select note from unavailability'))[0]?.note === 'Dentista');
// self edits
await ok('volunteer edits own names/contact/email', () => allowed('ana', `update profile_private set first_name='Ana', contact='999', email=' ANA@X.COM ' where user_id=$1`, [U.ana]));
await ok('email normalized lowercase/trim', async () => (await db.query(`select email from profile_private where user_id=$1`, [U.ana])).rows[0].email === 'ana@x.com');
await ok('volunteer sets own theme/language', () => allowed('ana', `update profiles set theme='dark', language='en' where id=$1`, [U.ana]));
await ok('volunteer cannot change own tier', () => denied('ana', `update profiles set tier='owner' where id=$1`, [U.ana]));
await ok('volunteer cannot edit others\' private', () => denied('ana', `update profile_private set first_name='X' where user_id=$1`, [U.miguel]));
await ok('volunteer adds/removes own unavailability', async () => (await allowed('ana', `insert into unavailability values ($1,'2099-11-01','x')`, [U.ana])) && allowed('ana', `delete from unavailability where user_id=$1 and date='2099-11-01'`, [U.ana]));
await ok('volunteer cannot add unavailability for others', () => denied('ana', `insert into unavailability values ($1,'2099-11-01',null)`, [U.miguel]));
await ok('volunteer cannot assign', () => denied('miguel', `insert into assignments (service_id, department_id, role, idx, user_id) values ($1,'d-music','Keys',0,$2)`, [id(100), U.miguel]));
await ok('volunteer cannot create service', () => denied('miguel', `insert into services (title,date,start_time,end_time) values ('x','2099-01-01','16:00','21:00')`));
await ok('volunteer cannot change own positions', () => denied('miguel', `insert into user_positions values ($1,'d-music','Bass')`, [U.miguel]));
// admin rules
await ok('admin cannot change member name', () => denied('camila', `update profile_private set first_name='Hacked' where user_id=$1`, [U.ana]));
await ok('admin cannot change member contact', () => denied('camila', `update profile_private set contact='0' where user_id=$1`, [U.ana]));
await ok('admin cannot change member email', () => denied('camila', `update profile_private set email='h@x.com' where user_id=$1`, [U.ana]));
await ok('admin can change member dob', () => allowed('camila', `update profile_private set dob='2000-01-01' where user_id=$1`, [U.ana]));
await ok('admin cannot edit the owner (even in own dept)', () => denied('camila', `update profile_private set dob='2000-01-01' where user_id=$1`, [U.owner]));
await ok('admin cannot change owner positions', () => denied('camila', `insert into user_positions values ($1,'d-kids','Teacher')`, [U.owner]));
await ok('admin cannot change tiers', () => denied('camila', `update profiles set tier='admin' where id=$1`, [U.ana]));
await ok('admin edits roles in own dept', () => allowed('camila', `insert into user_positions values ($1,'d-kids','Assistant')`, [U.ana]));
await ok('admin cannot edit roles in other dept', () => denied('camila', `insert into user_positions values ($1,'d-music','Bass')`, [U.ana]));
await ok('admin cannot edit member outside depts', () => denied('camila', `insert into user_departments values ($1,'d-kids')`, [U.miguel]));
await ok('admin can add unassigned volunteer to own dept', () => allowed('camila', `insert into user_departments values ($1,'d-kids')`, [U.tiago]));
await ok('admin cannot grant admin_of', () => denied('camila', `insert into admin_of values ($1,'d-kids')`, [U.ana]));
await ok('admin assigns in own dept (role holder, available)', () => allowed('lucas', `insert into assignments (service_id, department_id, role, idx, user_id) values ($1,'d-music','Keys',0,$2)`, [id(100), U.miguel]));
await ok('admin cannot assign in other dept', () => denied('lucas', `insert into assignments (service_id, department_id, role, idx, user_id) values ($1,'d-kids','Teacher',0,$2)`, [id(100), U.ana]));
await ok('assign rejects non-role-holder', () => denied('lucas', `insert into assignments (service_id, department_id, role, idx, user_id) values ($1,'d-music','Drums',0,$2)`, [id(100), U.miguel]));
await ok('admin cannot create/delete services', async () => (await denied('lucas', `insert into services (title,date,start_time,end_time) values ('x','2099-01-01','16:00','21:00')`)) && denied('lucas', `delete from services`));
await ok('unavailable person cannot be assigned', async () => { await db.query(`insert into unavailability values ($1,'2099-10-18',null)`, [U.ana]); return denied('lucas', `insert into assignments (service_id, department_id, role, idx, user_id) values ($1,'d-music','Lead Singer',0,$2)`, [id(100), U.ana]); });
await ok('marking unavailable drops own assignment that day', async () => { await as('miguel', `insert into unavailability values ($1,'2099-10-18',null)`, [U.miguel]); return (await db.query(`select * from assignments where user_id=$1`, [U.miguel])).rows.length === 0; });
await ok('admin cannot write private via insert (no insert grant)', () => denied('lucas', `insert into profile_private (user_id) values ($1)`, [U.lucas]));
// owner
await ok('owner edits anyone\'s names/contact/email', () => allowed('owner', `update profile_private set first_name='Ana2', contact='5', email='a2@x.com' where user_id=$1`, [U.ana]));
await ok('owner changes tiers + admin_of', async () => (await allowed('owner', `update profiles set tier='admin' where id=$1`, [U.tiago])) && allowed('owner', `insert into admin_of values ($1,'d-obreiros')`, [U.tiago]));
await ok('owner cannot demote self', () => denied('owner', `update profiles set tier='admin' where id=$1`, [U.owner]));
await ok('owner creates/edits/deletes services', async () => (await allowed('owner', `insert into services (id,title,date,start_time,end_time) values ('${id(101)}','x','2099-01-01','16:00','21:00')`)) && (await allowed('owner', `update services set title='y' where id='${id(101)}'`)) && allowed('owner', `delete from services where id='${id(101)}'`));
// Drafts
await db.exec(`insert into services (id,title,date,start_time,end_time,status) values ('${id(150)}','Rascunho','2099-11-01','16:00','21:00','draft');
  insert into service_slots values ('${id(150)}','d-music','Keys',1); insert into assignments (service_id, department_id, role, idx, user_id) values ('${id(150)}','d-music','Keys',0,'${U.miguel}');`);
await ok('existing services default to published', async () => (await db.query(`select status from services where id=$1`, [id(100)])).rows[0].status === 'published');
await ok('volunteer cannot select draft service/slots/assignments', async () => (await as('miguel', `select * from services where id=$1`, [id(150)])).rows.length === 0 && (await as('miguel', `select * from service_slots where service_id=$1`, [id(150)])).rows.length === 0 && (await as('miguel', `select * from assignments where service_id=$1`, [id(150)])).rows.length === 0);
await ok('volunteer still sees published services', async () => (await as('miguel', `select * from services where id=$1`, [id(100)])).rows.length === 1);
await ok('owner and admin see draft + its assignment', async () => (await as('owner', `select * from assignments where service_id=$1`, [id(150)])).rows.length === 1 && (await as('lucas', `select * from services where id=$1`, [id(150)])).rows.length === 1);
await ok('admin cannot publish', async () => { await as('lucas', `update services set status='published' where id=$1`, [id(150)]); return (await db.query(`select status from services where id=$1`, [id(150)])).rows[0].status === 'draft'; });
await ok('owner publishes -> volunteer sees it', async () => (await allowed('owner', `update services set status='published' where id='${id(150)}'`)) && (await as('miguel', `select * from assignments where service_id=$1`, [id(150)])).rows.length === 1);
// Setlist
U.pedro = id(7); await db.query(`insert into auth.users values ($1,'pedro@megahub.local')`, [U.pedro]); await db.query(`insert into profiles (id, username, tier, must_change_password) values ($1,'Pedro','volunteer',false)`, [U.pedro]); // plain non-Music volunteer
await db.query(`insert into songs (id, department_id, title) values ('sg0','d-music','Seed') on conflict do nothing`);
await ok('owner adds setlist item', () => allowed('owner', `insert into setlist_items (id, service_id, position, title, key, song_id) values ('so1','${id(100)}',0,'Song','G','sg0')`));
await ok('Music admin edits setlist', async () => (await allowed('lucas', `insert into setlist_items (id, service_id, position, title, song_id) values ('so2','${id(100)}',1,'Two','sg0')`)) && allowed('lucas', `update setlist_items set position=0 where id='so2'`));
await ok('Kids admin cannot edit setlist', async () => { await as('camila', `update setlist_items set title='x' where id='so1'`).catch(() => {}); return (await denied('camila', `insert into setlist_items (id, service_id, position, title, song_id) values ('so3','${id(100)}',2,'X','sg0')`)) && (await db.query(`select title from setlist_items where id='so1'`)).rows[0].title === 'Song'; });
await ok('volunteer cannot edit setlist', () => denied('miguel', `insert into setlist_items (id, service_id, position, title, song_id) values ('so4','${id(100)}',2,'X','sg0')`));
await ok('STRICT: Music member + Music admin see setlist; Kids admin does not', async () => (await as('miguel', `select * from setlist_items`)).rows.length === 2 && (await as('lucas', `select * from setlist_items`)).rows.length === 2 && (await as('camila', `select * from setlist_items`)).rows.length === 0);
await ok('unassigned non-Music volunteer cannot see setlist', async () => (await as('pedro', `select * from setlist_items`)).rows.length === 0);
await ok('STRICT: assigned non-Music volunteer cannot see setlist', async () => { await db.query(`insert into assignments (service_id, department_id, role, idx, user_id) values ($1,'d-obreiros','Atalaia',0,$2) on conflict do nothing`, [id(100), U.pedro]); return (await as('pedro', `select * from setlist_items`)).rows.length === 0; });
await ok('draft setlist hidden from Music volunteer', async () => { await db.query(`update services set status='draft' where id=$1`, [id(100)]); const r = (await as('miguel', `select * from setlist_items`)).rows.length === 0; await db.query(`update services set status='published' where id=$1`, [id(100)]); return r; });
// Dept pages + songs
await ok('Kids admin edits Kids description (department_pages)', async () => (await allowed('camila', `insert into department_pages values ('d-kids','Kids!') on conflict (department_id) do update set description = excluded.description`)) && (await db.query(`select description from department_pages where department_id='d-kids'`)).rows[0].description === 'Kids!');
await ok('Kids admin cannot rename Kids or edit Music description', async () => { await as('camila', `update departments set name='X' where id='d-kids'`).catch(() => {}); await as('camila', `insert into department_pages values ('d-music','hack')`).catch(() => {});
  const r = (await db.query(`select name from departments where id='d-kids'`)).rows; const m = (await db.query(`select * from department_pages where department_id='d-music'`)).rows; return r[0].name !== 'X' && m.length === 0; });
await ok('PRIVATE: departments has no description column', async () => (await db.query(`select column_name from information_schema.columns where table_name='departments' and column_name='description'`)).rows.length === 0);
await ok('PRIVATE: Music admin cannot read Kids description', async () => (await rows('lucas', `select * from department_pages where department_id='d-kids'`)).length === 0);
await ok('PRIVATE: Kids member + owner read Kids description', async () => (await rows('ana', `select * from department_pages where department_id='d-kids'`)).length === 1 && (await rows('owner', `select * from department_pages`)).length === 1);
await ok('PRIVATE: plain volunteer outside Kids cannot read it', async () => (await rows('miguel', `select * from department_pages where department_id='d-kids'`)).length === 0);
await ok('dept admin adds link resource', () => allowed('camila', `insert into department_resources (id, department_id, position, title, url) values ('rs1','d-kids',0,'Lições','https://drive.google.com/x')`));
await ok('resource needs http(s) url for links', () => denied('camila', `insert into department_resources (id, department_id, position, title, url) values ('rs2','d-kids',1,'Bad','javascript:x')`));
await ok('file resource needs file_ref (reserved)', () => denied('owner', `insert into department_resources (id, department_id, position, title, kind) values ('rs3','d-kids',1,'F','file')`));
await ok('other admin cannot add resource', () => denied('lucas', `insert into department_resources (id, department_id, position, title, url) values ('rs4','d-kids',1,'X','https://a.org')`));
await ok('member reads resources, non-member cannot', async () => (await as('ana', `select * from department_resources`)).rows.length === 1 && (await as('pedro', `select * from department_resources`)).rows.length === 0);
await ok('Music admin adds song', () => allowed('lucas', `insert into songs (id, title, key, chords) values ('sg1','Grande é o Senhor','G','G D Em')`));
await ok('Kids admin / volunteer cannot add song', async () => (await denied('camila', `insert into songs (id, title) values ('sg2','X')`)) && denied('miguel', `insert into songs (id, title) values ('sg3','X')`));
await ok('Music member reads library; outsider cannot', async () => (await as('miguel', `select * from songs where id <> 'sg0'`)).rows.length === 1 && (await as('pedro', `select * from songs`)).rows.length === 0);
await ok('STRICT: song in setlist not readable by assigned outsider; Kids admin cannot read songs', async () => { await db.query(`update setlist_items set song_id='sg1' where id='so1'`); return (await as('pedro', `select * from songs`)).rows.length === 0 && (await as('camila', `select * from songs`)).rows.length === 0; });
await ok('deleting song nulls setlist song_id', async () => { await allowed('lucas', `delete from songs where id='sg1'`); return (await db.query(`select song_id from setlist_items where id='so1'`)).rows[0].song_id === null; });
// Songs v2 + live
await ok('songs v2 columns + sections jsonb', async () => (await allowed('lucas', `insert into songs (id, title, composer, key, time_signature, bpm, sections) values ('sg9','Em Teus Braços','Laura','C','4/4',72,'[{"id":"s1","name":"Intro","bars":["FM7","","CM7",""]}]')`)) && (await db.query(`select sections->0->'bars'->>0 as b from songs where id='sg9'`)).rows[0].b === 'FM7');
await ok('bad key / bpm rejected', async () => (await denied('lucas', `insert into songs (id, title, key) values ('sgx','X','H#')`)) && denied('lucas', `insert into songs (id, title, bpm) values ('sgy','X',0)`));
await ok('can_live: owner, Music admin, assigned Music member', async () => (await as('owner', `select can_live($1) v`, [id(100)])).rows[0].v && (await as('lucas', `select can_live($1) v`, [id(100)])).rows[0].v && (await db.query(`insert into assignments (service_id, department_id, role, idx, user_id) values ($1,'d-music','Keys',0,$2) on conflict do nothing`, [id(100), U.miguel]), (await as('miguel', `select can_live($1) v`, [id(100)])).rows[0].v));
await ok('can_live denied: Kids admin, assigned non-Music volunteer', async () => !(await as('camila', `select can_live($1) v`, [id(100)])).rows[0].v && !(await as('pedro', `select can_live($1) v`, [id(100)])).rows[0].v);
// Ranges
await ok('range: date_to < date rejected', () => denied('ana', `insert into unavailability (user_id, date, date_to) values ($1,'2099-12-10','2099-12-01')`, [U.ana]));
await ok('range clears assignments inside range on insert', async () => {
  await db.exec(`insert into services (id,title,date,start_time,end_time) values ('${id(110)}','R','2099-12-03','16:00','21:00');`);
  await db.query(`insert into assignments (service_id, department_id, role, idx, user_id) values ($1,'d-kids','Teacher',0,$2)`, [id(110), U.ana]);
  await as('ana', `insert into unavailability (user_id, date, date_to) values ($1,'2099-12-01','2099-12-05')`, [U.ana]);
  return (await db.query(`select * from assignments where service_id=$1`, [id(110)])).rows.length === 0; });
await ok('cannot assign inside a range (can_fill)', () => denied('camila', `insert into assignments (service_id, department_id, role, idx, user_id) values ($1,'d-kids','Teacher',0,$2)`, [id(110), U.ana]));
await ok('can assign after range ends', async () => { await db.exec(`insert into services (id,title,date,start_time,end_time) values ('${id(111)}','R2','2099-12-06','16:00','21:00');`); return allowed('camila', `insert into assignments (service_id, department_id, role, idx, user_id) values ($1,'d-kids','Teacher',0,$2)`, [id(111), U.ana]); });
await ok('range view exposes date_to (no note)', async () => { const r = (await as('pedro', `select * from unavailable_days where user_id=$1 and date='2099-12-01'`, [U.ana])).rows[0]; return r && String(r.date_to).length > 0 && !('note' in r); });
// Strict dept scoping
await ok('STRICT: Lucas cannot read Kids resources', async () => (await as('lucas', `select * from department_resources where department_id='d-kids'`)).rows.length === 0);
await ok('STRICT: Camila reads Kids resources', async () => (await as('camila', `select * from department_resources where department_id='d-kids'`)).rows.length === 1);
await ok('anon sees nothing', async () => { await db.exec(`select set_config('request.jwt.claim.sub','',false); set role anon`); try { await db.query('select * from profiles'); return false; } catch { return true; } finally { await db.exec('reset role'); } });
// Double booking + swap RPC
await db.exec(`insert into user_departments values ('${U.tiago}','d-kids') on conflict do nothing; insert into user_positions values ('${U.tiago}','d-kids','Teacher');
  insert into services (id, title, date, start_time, end_time) values ('${id(101)}','Culto 2','2099-11-15','16:00','21:00');`);
const SV = id(101); const slots = async () => Object.fromEntries((await db.query(`select department_id||':'||role k, user_id from assignments where service_id=$1`, [SV])).rows.map(r => [r.k, r.user_id]));
const reset = async () => db.query(`delete from assignments where service_id=$1`, [SV]);
await reset();
await ok('DOUBLE: owner can double book Ana in two roles (Kids Teacher + Music Lead Singer)', async () => (await allowed('owner', `insert into assignments (service_id, department_id, role, idx, user_id) values ($1,'d-kids','Teacher',0,$2), ($1,'d-music','Lead Singer',0,$2)`, [SV, U.ana])) && Object.keys(await slots()).length === 2);
await reset(); await db.query(`insert into assignments (service_id, department_id, role, idx, user_id) values ($1,'d-kids','Teacher',0,$2), ($1,'d-music','Lead Singer',0,$3)`, [SV, U.tiago, U.ana]);
await ok('SWAP: moves Ana in, clears her other slot, Tiago replaced', async () => { await as('owner', `select assign_swap($1,'d-kids','Teacher',0,$2)`, [SV, U.ana]); const s = await slots(); return s['d-kids:Teacher'] === U.ana && !s['d-music:Lead Singer']; });
await db.exec(`insert into user_departments values ('${U.tiago}','d-music') on conflict do nothing; insert into user_positions values ('${U.tiago}','d-music','Lead Singer');`);
await reset(); await db.query(`insert into assignments (service_id, department_id, role, idx, user_id) values ($1,'d-kids','Teacher',0,$2), ($1,'d-music','Lead Singer',0,$3)`, [SV, U.tiago, U.ana]);
await ok('SWAP: no trade even when occupant could take the vacated slot', async () => { await as('owner', `select assign_swap($1,'d-kids','Teacher',0,$2)`, [SV, U.ana]); const s = await slots(); return s['d-kids:Teacher'] === U.ana && !s['d-music:Lead Singer'] && Object.keys(s).length === 1; });
await db.query(`insert into assignments (service_id, department_id, role, idx, user_id) values ($1,'d-music','Lead Singer',0,$2)`, [SV, U.tiago]);
await ok('SWAP: Music admin cannot pull Ana out of a Kids slot (atomic, unchanged)', async () => { let threw = false; await as('lucas', `select assign_swap($1,'d-music','Lead Singer',0,$2)`, [SV, U.ana]).catch(() => { threw = true; }); const s = await slots(); return threw && s['d-kids:Teacher'] === U.ana && s['d-music:Lead Singer'] === U.tiago; });
await ok('SWAP: volunteer cannot call it', async () => { let threw = false; await as('miguel', `select assign_swap($1,'d-music','Keys',0,$2)`, [SV, U.miguel]).catch(() => { threw = true; }); return threw && !(await slots())['d-music:Keys']; });
await ok('SWAP: unavailable person rejected', async () => { await db.query(`insert into unavailability (user_id, date, date_to, note) values ($1,'2099-11-14','2099-11-16',null)`, [U.tiago]).catch(() => {}); let threw = false; await as('owner', `select assign_swap($1,'d-music','Lead Singer',0,$2)`, [SV, U.tiago]).catch(() => { threw = true; }); return threw || !(await slots())['d-music:Lead Singer']; });
// Assembly role + defaults
await ok('ASSEMBLY: Music has Assembly (last), default 3 slots; Backing Vocals 2', async () => { const r = (await db.query(`select role, default_count, sort from department_roles where department_id='d-music' order by sort`)).rows; const a = r[r.length - 1]; return a.role === 'Assembly' && a.default_count === 3 && r.find(x => x.role === 'Backing Vocals').default_count === 2; });
await ok('LOCATION: new services default to Farcet address; existing unchanged', async () => { const before = (await db.query(`select location from services where id=$1`, [id(100)])).rows[0].location; await db.query(`insert into services (id, title, date, start_time, end_time) values ('${id(170)}','N','2099-12-20','16:00','21:00')`); const n = (await db.query(`select location from services where id='${id(170)}'`)).rows[0].location; return n === '1 Main St, Farcet, Peterborough PE7 3AN' && (await db.query(`select location from services where id=$1`, [id(100)])).rows[0].location === before; });
await ok('ASSEMBLY: owner can give a volunteer the Assembly role and assign it', async () => { await db.query(`insert into user_positions values ($1,'d-music','Assembly')`, [U.miguel]); return allowed('owner', `insert into assignments (service_id, department_id, role, idx, user_id) values ($1,'d-music','Assembly',2,$2)`, [id(170), U.miguel]); });
// Colour-coded picker: double booking allowed, only same role twice blocked
{ const SV2 = id(180); await db.query(`insert into services (id, title, date, start_time, end_time) values ($1,'R','2099-12-27','16:00','21:00')`, [SV2]);
  await db.query(`insert into user_departments values ($1,'d-kids') on conflict do nothing`, [U.miguel]);
  for (const [dp, r] of [['d-music', 'Desk'], ['d-music', 'Assembly'], ['d-kids', 'Teacher']]) await db.query(`insert into user_positions values ($1,$2,$3) on conflict do nothing`, [U.miguel, dp, r]);
  const ins = (who, dep, role, idx) => as(who, `insert into assignments (service_id, department_id, role, idx, user_id) values ($1,$2,$3,$4,$5)`, [SV2, dep, role, idx, U.miguel]);
  await ok('SAME-ROLE: main role ok', async () => (await ins('owner', 'd-music', 'Keys', 0)).affectedRows === 1);
  await ok('DOUBLE: Desk + Assembly alongside Keys ok', async () => (await ins('owner', 'd-music', 'Desk', 0)).affectedRows === 1 && (await ins('owner', 'd-music', 'Assembly', 0)).affectedRows === 1);
  await ok('DOUBLE: second main role (Kids Teacher) allowed, no one_role trigger', async () => (await ins('owner', 'd-kids', 'Teacher', 0)).affectedRows === 1 && (await db.query(`select count(*)::int n from pg_trigger where tgname='one_role_guard'`)).rows[0].n === 0);
  await ok('SAME-ROLE: two Assembly slots rejected', async () => { try { await ins('owner', 'd-music', 'Assembly', 1); return false; } catch (e) { return /role conflict/.test(e.message); } });
  await ok('SAME-ROLE: legacy duplicate (imported) kept', async () => { await db.query(`select set_config('request.jwt.claim.sub','',false)`); await db.query(`insert into assignments (service_id, department_id, role, idx, user_id) values ($1,'d-music','Assembly',1,$2)`, [SV2, U.miguel]); return (await db.query(`select count(*)::int n from assignments where service_id=$1 and user_id=$2`, [SV2, U.miguel])).rows[0].n === 5; });
}
// Setlist: Lead Singer of THAT service; library-only; song library owner + Music admins
{ const L1 = id(190), L2 = id(191);
  for (const [sid, dt] of [[L1, '2099-12-13'], [L2, '2099-12-20']]) await db.query(`insert into services (id, title, date, start_time, end_time) values ($1,'L',$2,'16:00','21:00')`, [sid, dt]);
  await db.query(`insert into songs (id, department_id, title) values ('sgL','d-music','Lib') on conflict do nothing`);
  await db.query(`insert into assignments (service_id, department_id, role, idx, user_id) values ($1,'d-music','Lead Singer',0,$2), ($3,'d-music','Keys',0,$2)`, [L1, U.miguel, L2]);
  await ok('LEAD: lead singer can add a library song to their service setlist', () => allowed('miguel', `insert into setlist_items (id, service_id, position, title, song_id) values ('sl1',$1,0,'Lib','sgL')`, [L1]));
  await ok('LEAD: lead singer can reorder/remove in their service', async () => (await allowed('miguel', `update setlist_items set position=1 where id='sl1'`)) && (await allowed('miguel', `delete from setlist_items where id='sl1'`)));
  await ok("LEAD: lead singer cannot edit another service's setlist", () => denied('miguel', `insert into setlist_items (id, service_id, position, title, song_id) values ('sl2',$1,0,'Lib','sgL')`, [L2]));
  await ok('LEAD: lead singer cannot edit other service fields', async () => { await as('miguel', `update services set title='hack' where id=$1`, [L1]).catch(() => {}); return (await db.query(`select title from services where id=$1`, [L1])).rows[0].title === 'L'; });
  await ok("LEAD: Kids admin cannot edit that setlist", () => denied('camila', `insert into setlist_items (id, service_id, position, title, song_id) values ('sl3',$1,0,'Lib','sgL')`, [L1]));
  await ok('LIBRARY: free-text (no song_id) setlist item rejected, even for owner', () => denied('owner', `insert into setlist_items (id, service_id, position, title) values ('sl4',$1,0,'Free')`, [L1]));
  await ok('SONGS: non-admin Music member cannot create/edit songs', async () => (await denied('miguel', `insert into songs (id, department_id, title) values ('sgX','d-music','X')`)) && (await denied('miguel', `update songs set title='x' where id='sgL'`)));
  await ok('SONGS: Kids admin cannot create songs; Music admin can', async () => (await denied('camila', `insert into songs (id, department_id, title) values ('sgY','d-music','Y')`)) && (await allowed('lucas', `insert into songs (id, department_id, title) values ('sgZ','d-music','Z')`)));
}
console.log(`${n} passed, ${fails} failed`); process.exit(fails ? 1 : 0);
