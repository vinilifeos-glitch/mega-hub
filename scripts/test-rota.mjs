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
