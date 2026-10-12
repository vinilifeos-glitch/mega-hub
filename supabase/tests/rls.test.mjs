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
await db.exec(`insert into services (id,title,date,start_time,end_time,status) values ('${id(102)}','Rascunho','2099-11-01','16:00','21:00','draft');
  insert into service_slots values ('${id(102)}','d-music','Keys',1); insert into assignments (service_id, department_id, role, idx, user_id) values ('${id(102)}','d-music','Keys',0,'${U.miguel}');`);
await ok('existing services default to published', async () => (await db.query(`select status from services where id=$1`, [id(100)])).rows[0].status === 'published');
await ok('volunteer cannot select draft service/slots/assignments', async () => (await as('miguel', `select * from services where id=$1`, [id(102)])).rows.length === 0 && (await as('miguel', `select * from service_slots where service_id=$1`, [id(102)])).rows.length === 0 && (await as('miguel', `select * from assignments where service_id=$1`, [id(102)])).rows.length === 0);
await ok('volunteer still sees published services', async () => (await as('miguel', `select * from services where id=$1`, [id(100)])).rows.length === 1);
await ok('owner and admin see draft + its assignment', async () => (await as('owner', `select * from assignments where service_id=$1`, [id(102)])).rows.length === 1 && (await as('lucas', `select * from services where id=$1`, [id(102)])).rows.length === 1);
await ok('admin cannot publish', async () => { await as('lucas', `update services set status='published' where id=$1`, [id(102)]); return (await db.query(`select status from services where id=$1`, [id(102)])).rows[0].status === 'draft'; });
await ok('owner publishes -> volunteer sees it', async () => (await allowed('owner', `update services set status='published' where id='${id(102)}'`)) && (await as('miguel', `select * from assignments where service_id=$1`, [id(102)])).rows.length === 1);
await ok('anon sees nothing', async () => { await db.exec(`select set_config('request.jwt.claim.sub','',false); set role anon`); try { await db.query('select * from profiles'); return false; } catch { return true; } finally { await db.exec('reset role'); } });
console.log(`${n} passed, ${fails} failed`); process.exit(fails ? 1 : 0);
