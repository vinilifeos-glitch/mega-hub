// Run: node scripts/test-rota.mjs — My Rota helpers
import ts from 'typescript'; import fs from 'fs'; import assert from 'assert';
const src = fs.readFileSync(new URL('../src/data/rota.ts', import.meta.url), 'utf8').replace(/^import .*$/m, '');
const R = await import('data:text/javascript,' + encodeURIComponent(ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText));
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('PASS', m); };
const d = { users: [{ id: 'u1', name: 'Ana' }, { id: 'u2', name: 'Bo' }], departments: [{ id: 'd-music' }, { id: 'd-kids' }],
  services: [{ id: 's1', date: '2026-10-20', start: '10:00' }, { id: 's0', date: '2026-10-01', start: '10:00' }, { id: 's2', date: '2026-10-18', start: '19:00' }, { id: 's3', date: '2026-10-19', start: '10:00', status: 'draft' }],
  assignments: [{ id: 'a1', serviceId: 's1', departmentId: 'd-kids', position: 'T', index: 0, userId: 'u1' }, { id: 'a2', serviceId: 's1', departmentId: 'd-music', position: 'Keys', index: 0, userId: 'u2' },
    { id: 'a3', serviceId: 's0', departmentId: 'd-kids', position: 'T', index: 0, userId: 'u1' }, { id: 'a4', serviceId: 's2', departmentId: 'd-music', position: 'Keys', index: 0, userId: 'u1' },
    { id: 'a5', serviceId: 's3', departmentId: 'd-music', position: 'Keys', index: 0, userId: 'u1' }, { id: 'a6', serviceId: 's1', departmentId: 'd-gone', position: 'X', index: 0, userId: 'u1' }] };
const m = R.myAssignments(d, 'u1', '2026-10-12').map(a => a.id);
ok(m.join() === 'a4,a1', 'upcoming, published, known dept, sorted by date');
const t = R.teamFor(d, 's1');
ok(t.map(g => g.departmentId).join() === 'd-music,d-kids', 'team grouped in department order');
ok(t[0].members[0].name === 'Bo' && t[1].members[0].name === 'Ana', 'names resolved');
ok(R.teamFor(d, 'nope').length === 0, 'empty team for unknown service');
console.log(n, 'passed');
{ const A = [{ id: 's:m:Keys:0', serviceId: 's', departmentId: 'm', position: 'Keys', index: 0, userId: 'u1' }, { id: 's:k:T:0', serviceId: 's', departmentId: 'k', position: 'T', index: 0, userId: 'u2' }];
  const tgt = { serviceId: 's', departmentId: 'k', position: 'T', index: 0, userId: 'u1' };
  ok(R.planAssign(A, tgt).error === 'busy', 'busy without mode rejected');
  const dbl = R.planAssign(A, tgt, 'double').assignments;
  ok(dbl.length === 2 && dbl.filter(a => a.userId === 'u1').length === 2 && !dbl.some(a => a.userId === 'u2'), 'double book keeps both, replaces occupant');
  const sw = R.planAssign(A, tgt, 'swap').assignments;
  ok(sw.length === 1 && sw[0].id === 's:k:T:0' && sw[0].userId === 'u1', 'swap: moves in, clears other slot, occupant replaced (not traded)');
  const sw3 = R.planAssign([A[0]], { ...tgt, departmentId: 'k' }, 'swap').assignments;
  ok(sw3.length === 1 && sw3[0].id === 's:k:T:0', 'swap into empty slot = move');
  ok(R.planAssign(A, { serviceId: 's', departmentId: 'm', position: 'Keys', index: 0, userId: 'u1' }).assignments === A, 'same person no-op');
  ok(R.planAssign(A, { serviceId: 's2', departmentId: 'k', position: 'T', index: 0, userId: 'u1' }).assignments.length === 3, 'other service = free');
  ok(R.pickStatus(A, 's', 'u1', 's:k:T:0', false) === 'busy' && R.pickStatus(A, 's', 'u1', 's:m:Keys:0', false) === 'free' && R.pickStatus(A, 's', 'u3', 'x', true) === 'away', 'pickStatus');
  console.log(n, 'passed'); }
