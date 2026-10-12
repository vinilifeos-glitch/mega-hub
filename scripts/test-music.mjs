// Run: node scripts/test-music.mjs — transposition / key / bar parsing
import ts from 'typescript'; import fs from 'fs'; import assert from 'assert';
const js = ts.transpileModule(fs.readFileSync(new URL('../src/data/music.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const M = await import('data:text/javascript,' + encodeURIComponent(js));
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('PASS', m); };
const tr = (bars, from, to) => { const a = M.parseKey(from), b = M.parseKey(to); return bars.map(x => M.transposeBar(x, M.semitonesBetween(a, b), M.prefersFlats(b))); };
// The reference sheet "Em Teus Braços" C -> D
ok(tr(['FM7', '', 'CM7', '', 'FM7', '', 'CM7', ''], 'C', 'D').join() === 'GM7,,DM7,,GM7,,DM7,', 'example intro C->D');
ok(tr(['Am7', '', 'FM7', 'Gsus2', 'Em7', '', 'FM7', ''], 'C', 'D').join() === 'Bm7,,GM7,Asus2,F#m7,,GM7,', 'example pre-chorus C->D (F#m7)');
ok(tr(['C', 'G/B', 'Am7', 'Fmaj7'], 'C', 'F').join() === 'F,C/E,Dm7,Bbmaj7', 'C->F uses flats + slash bass');
ok(tr(['C', 'G/B', 'Am'], 'C', 'Eb').join() === 'Eb,Bb/D,Cm', 'C->Eb flats');
ok(tr(['C', 'E7', 'F#dim'], 'C', 'E').join() === 'E,G#7,A#dim', 'C->E sharps');
ok(tr(['Am', 'Dm7', 'E7sus4'], 'Am', 'Dm').join() === 'Dm,Gm7,A7sus4', 'minor key Am->Dm (flat-side)');
ok(tr(['Em', 'C', 'D', 'B7'], 'Em', 'F#m').join() === 'F#m,D,E,C#7', 'minor key Em->F#m sharps');
ok(tr(['G', 'D/F#'], 'G', 'G').join() === 'G,D/F#', 'same key unchanged');
ok(tr(['Bb', 'F/A'], 'Bb', 'B').join() === 'B,F#/A#', 'Bb->B');
ok(M.transposeChord('N.C.', 3, false) === 'N.C.' && M.transposeChord('%', 2, false) === '%', 'non-chords pass through');
ok(M.transposeBar('C G/B', 2, false) === 'D A/C#', 'two chords in one bar');
ok(JSON.stringify(M.parseKey('Am')) === '{"root":"A","minor":true}' && M.parseKey('Bb').root === 'Bb' && !M.parseKey('Bb').minor && M.parseKey('H') === null, 'parseKey');
ok(M.keyLabel(M.parseKey({ root: 'F#', minor: true })) === 'F#m', 'keyLabel from object');
ok(M.prefersFlats(M.parseKey('F')) && M.prefersFlats(M.parseKey('Gm')) && !M.prefersFlats(M.parseKey('D')) && !M.prefersFlats(M.parseKey('Em')), 'flat/sharp preference');
ok(JSON.stringify(M.parseBars('| FM7 | | CM7 | |')) === '["FM7","","CM7",""]', "parseBars '| FM7 | | CM7 | |'");
ok(JSON.stringify(M.parseBars('C G Am F')) === '["C","G","Am","F"]', 'parseBars without pipes');
ok(JSON.stringify(M.parseBars(M.barsToText(['FM7', '', 'C G/B']))) === '["FM7","","C G/B"]', 'barsToText round trip');
const cv = M.convertLegacy('Intro:\nC G Am F\nVerse:\n| C | | G | |');
ok(cv && cv.length === 2 && cv[1].name === 'Verse' && cv[1].bars.join() === 'C,,G,', 'convert trivial legacy text');
ok(M.convertLegacy('G D Em\nGrande é o Senhor') === null, 'legacy with lyrics not auto-converted');
console.log(`${n}/${n} passed`);
