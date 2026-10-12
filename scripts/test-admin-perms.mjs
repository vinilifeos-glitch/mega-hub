// Run: node scripts/test-admin-perms.mjs  — compiles src/state/permissions.ts and checks the rules
// mirrored from AppContext.adminSaveMember / resetPassword.
import ts from 'typescript'; import fs from 'fs'; import assert from 'assert';
const src = fs.readFileSync(new URL('../src/state/permissions.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { canEditPersonal, changedProtected, canEditMemberRule, pickPref, visibleServiceData, isDraft, canEditSetlistRule, canSeeSetlistRule, visibleSetlists, canEditDeptRule, visibleSongs, cleanUrl } = await import('data:text/javascript,' + encodeURIComponent(js));
const owner = { id: 'o', role: 'owner' }, admin = { id: 'a', role: 'admin', adminOf: ['music'] }, vol = { id: 'v', role: 'volunteer' };
const tgt = { id: 'x', firstName: 'Miguel', middleNames: '', lastName: 'S', contact: '123', email: 'miguel@x.com', departmentIds: ['music'], positions: { music: ['keys'] } };
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
ok(save(admin, tgt, { email: 'new@x.com' }) === 'rejected', 'admin cannot change other email');
ok(save(admin, { ...tgt, email: undefined }, { email: 'a@b.co' }) === 'rejected', 'admin cannot add email to user lacking one');
ok(save(admin, tgt, { email: ' MIGUEL@X.COM ' }) === 'ok', 'email case/whitespace resubmit not a change');
ok(save(admin, { ...tgt, email: undefined }, {}) === 'ok', 'legacy user without email + admin role edit ok');
ok(save(owner, tgt, { email: 'o@x.com' }) === 'ok', 'owner edits email');
ok(save(vol, { ...tgt, id: 'v' }, { email: 'me@x.com' }) === 'ok', 'self edits own email');
const ownerT = { id: 'o', role: 'owner', departmentIds: ['music'] };
ok(!canEditMemberRule(admin, ownerT), 'admin cannot edit owner (even in own dept)');
ok(canEditMemberRule(owner, ownerT), 'owner can edit self');
ok(canEditMemberRule(admin, { id: 'x', role: 'volunteer', departmentIds: ['music'] }), 'admin edits member of own dept');
ok(!canEditMemberRule(admin, { id: 'x', role: 'volunteer', departmentIds: ['kids'] }), 'admin cannot edit other-dept member');
ok(!canEditMemberRule(admin, { id: 'a2', role: 'admin', departmentIds: [] }), 'admin cannot edit unassigned admin');
ok(!canEditMemberRule(vol, { id: 'x', role: 'volunteer', departmentIds: [] }), 'volunteer cannot edit others');
ok(pickPref(true, undefined, 'dark', 'light') === 'light', 'signed-in user without theme ignores device dark (no leak)');
ok(pickPref(true, 'dark', 'light', 'light') === 'dark', 'signed-in user theme used');
ok(pickPref(false, undefined, 'dark', 'light') === 'dark', 'sign-in screen uses device theme');
ok(pickPref(true, undefined, 'en', 'pt') === 'pt', 'signed-in user without language defaults pt (no leak)');
console.log(`${n}/${n} passed`);

// Drafts visibility
const D = { services: [{ id: 's1' }, { id: 's2', status: 'published' }, { id: 'd1', status: 'draft' }], assignments: [{ serviceId: 's1', userId: 'v' }, { serviceId: 'd1', userId: 'v' }] };
ok(visibleServiceData(owner, D) === D, 'owner sees drafts');
ok(visibleServiceData(admin, D).services.length === 3, 'admin sees drafts');
const V = visibleServiceData(vol, D);
ok(V.services.map(x => x.id).join() === 's1,s2', 'volunteer never receives draft services');
ok(V.assignments.length === 1 && V.assignments[0].serviceId === 's1', 'volunteer never receives draft assignments');
ok(visibleServiceData(null, D).services.length === 2, 'signed-out gets no drafts');
ok(!isDraft({}) && !isDraft({ status: 'published' }) && isDraft({ status: 'draft' }), 'missing status = published');
const L = { services: [{ id: 's1' }], assignments: [] }; ok(visibleServiceData(vol, L) === L, 'legacy data passed through unchanged');

// Setlist
const kidsAdmin = { id: 'k', role: 'admin', adminOf: ['d-kids'] }, musicAdmin = { id: 'm', role: 'admin', adminOf: ['d-music'] };
ok(canEditSetlistRule(owner) && canEditSetlistRule(musicAdmin), 'owner + Music admin edit setlist');
ok(!canEditSetlistRule(kidsAdmin) && !canEditSetlistRule(vol) && !canEditSetlistRule(null), 'Kids admin / volunteer / signed-out cannot edit setlist');
const S = { services: [{ id: 's1', setlist: [{ id: 'x', title: 'Song' }] }, { id: 's2' }], assignments: [{ serviceId: 's1', userId: 'v1' }] };
ok(canSeeSetlistRule({ id: 'v1', role: 'volunteer', departmentIds: ['d-kids'] }, 's1', S.assignments), 'assigned volunteer sees setlist');
ok(canSeeSetlistRule({ id: 'v2', role: 'volunteer', departmentIds: ['d-music'] }, 's1', S.assignments), 'Music member sees setlist');
ok(canSeeSetlistRule(kidsAdmin, 's1', []), 'any admin sees setlist');
const VS = visibleSetlists({ id: 'v3', role: 'volunteer', departmentIds: ['d-kids'] }, S);
ok(!('setlist' in VS.services[0]) && VS.services.length === 2, 'unassigned non-Music volunteer gets no setlist');
ok(visibleSetlists(owner, S) === S, 'owner data untouched');
// drafts + setlist: volunteer assigned on a draft still gets nothing
const DS = { services: [{ id: 'd', status: 'draft', setlist: [{ id: 'x', title: 'S' }] }], assignments: [{ serviceId: 'd', userId: 'v1' }] };
ok(visibleSetlists({ id: 'v1', role: 'volunteer' }, visibleServiceData({ id: 'v1', role: 'volunteer' }, DS)).services.length === 0, 'draft setlist hidden from assigned volunteer');

// Dept pages + song library
ok(canEditDeptRule(owner, 'd-kids') && canEditDeptRule(kidsAdmin, 'd-kids'), 'owner + dept admin edit dept page');
ok(!canEditDeptRule(musicAdmin, 'd-kids') && !canEditDeptRule(vol, 'd-kids') && !canEditDeptRule(null, 'd-kids'), 'other admin / volunteer cannot edit dept page');
ok(cleanUrl('example.com/x') === 'https://example.com/x' && cleanUrl('http://a.org') === 'http://a.org/', 'url normalised');
ok(cleanUrl('javascript:alert(1)') === null && cleanUrl('notaurl') === null && cleanUrl('') === null && cleanUrl('ftp://a.org') === null, 'bad urls rejected');
const SD = { songs: [{ id: 'g1' }, { id: 'g2' }], services: [{ setlist: [{ songId: 'g2' }] }] };
ok(visibleSongs(musicAdmin, SD) === SD && visibleSongs({ role: 'volunteer', departmentIds: ['d-music'] }, SD) === SD, 'staff + Music members see library');
ok(visibleSongs({ role: 'volunteer', departmentIds: ['d-kids'] }, SD).songs.map(x => x.id).join() === 'g2', 'others only see songs in visible setlists');
ok(visibleSongs(null, SD).songs.length === 0, 'signed-out no songs');
const NS = { services: [] }; ok(visibleSongs(vol, NS) === NS, 'legacy data (no songs) untouched');
