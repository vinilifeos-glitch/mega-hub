// Run: node scripts/test-admin-perms.mjs  — compiles src/state/permissions.ts and checks the rules
// mirrored from AppContext.adminSaveMember / resetPassword.
import ts from 'typescript'; import fs from 'fs'; import assert from 'assert';
const src = fs.readFileSync(new URL('../src/state/permissions.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { canEditPersonal, changedProtected } = await import('data:text/javascript,' + encodeURIComponent(js));
const owner = { id: 'o', role: 'owner' }, admin = { id: 'a', role: 'admin', adminOf: ['music'] }, vol = { id: 'v', role: 'volunteer' };
const tgt = { id: 'x', firstName: 'Miguel', middleNames: '', lastName: 'S', contact: '123', departmentIds: ['music'], positions: { music: ['keys'] } };
// Same gate order as adminSaveMember (scope check already passed for these actors)
const save = (actor, target, p) => (!canEditPersonal(actor, target.id) && changedProtected(target, { ...target, ...p }).length) ? 'rejected' : 'ok';
const reset = (actor, id) => actor.role === 'owner' && canEditPersonal(actor, id) ? 'ok' : 'rejected';
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('PASS', m); };
ok(save(admin, tgt, { firstName: 'Mike' }) === 'rejected', 'admin cannot change other first name');
ok(save(admin, tgt, { middleNames: 'X' }) === 'rejected', 'admin cannot change other middle names');
ok(save(admin, tgt, { lastName: 'Y' }) === 'rejected', 'admin cannot change other surname');
ok(save(admin, tgt, { contact: '999' }) === 'rejected', 'admin cannot change other contact');
ok(reset(admin, 'x') === 'rejected', 'admin cannot reset other password');
ok(save(admin, tgt, { departments: { music: ['keys', 'bass'] } }) === 'ok', 'admin dept/role edit (names unchanged) allowed');
ok(save(admin, tgt, { firstName: ' Miguel ' }) === 'ok', 'whitespace-only resubmit not treated as change');
ok(save(owner, tgt, { firstName: 'Mike', lastName: 'Z', contact: '1' }) === 'ok', 'owner edits all personal fields');
ok(reset(owner, 'x') === 'ok', 'owner can reset password');
ok(save(admin, { ...tgt, id: 'a' }, { firstName: 'Lucas2', contact: '5' }) === 'ok', 'admin self-edit allowed');
ok(save(vol, { ...tgt, id: 'v' }, { firstName: 'V2' }) === 'ok', 'volunteer self-edit allowed');
ok(!canEditPersonal(null, 'x'), 'signed-out actor denied');
console.log(`${n}/${n} passed`);
