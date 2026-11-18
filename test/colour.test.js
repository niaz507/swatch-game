const assert = require("node:assert/strict");
const C = require("../colour.js");

const ids = new Set(C.PIGMENTS.map((p) => p.id));

assert.equal(C.PIGMENTS.length, 5);
assert.equal(C.ROUNDS.length, 8);
assert.equal(C.ROUND_MAX * C.ROUNDS.length, 1000);

for (const round of C.ROUNDS) {
  assert.ok(round.name && round.lede && round.id);
  const keys = Object.keys(round.recipe);
  assert.ok(keys.length >= 2, round.name + " uses more than one pigment");
  for (const key of keys) {
    assert.ok(ids.has(key), round.name + " has an unknown pigment " + key);
    assert.ok(round.recipe[key] > 0);
  }
}

const names = C.ROUNDS.map((r) => r.name);
assert.equal(new Set(names).size, names.length);

assert.deepEqual(C.mix({}), C.GROUND.slice());
assert.deepEqual(C.mix({ white: 0, black: 0, ochre: 0 }), C.GROUND.slice());
assert.equal(C.totalDrops({}), 0);
assert.equal(C.totalDrops({ white: 150, madder: -4, ochre: 2.2 }), 100 + 0 + 2);

assert.deepEqual(C.mix({ ochre: 1 }), C.mix({ ochre: 100 }));
assert.deepEqual(C.mix({ white: 70, madder: 30 }), C.mix({ white: 7, madder: 3 }));
assert.ok(C.distance(C.mix({ white: 70, madder: 30 }), C.mix({ white: 30, madder: 70 })) > 10);

const ochre = C.mix({ ochre: 100 });
const ochreWhite = C.mix({ ochre: 50, white: 50 });
const ochreBlack = C.mix({ ochre: 50, black: 50 });
assert.ok(C.rgbToLab(ochreWhite)[0] > C.rgbToLab(ochre)[0] + 5, "lead white lightens ochre");
assert.ok(C.rgbToLab(ochreBlack)[0] < C.rgbToLab(ochre)[0] - 5, "lamp black darkens ochre");

const madder = C.mix({ madder: 100 });
const verdigris = C.mix({ verdigris: 100 });
const mud = C.mix({ madder: 100, verdigris: 100 });
const average = madder.map((channel, i) => Math.round((channel + verdigris[i]) / 2));
assert.ok(
  C.rgbToLab(mud)[0] < C.rgbToLab(average)[0] - 3,
  "madder and verdigris mix darker than their average, got " +
    C.rgbToLab(mud)[0].toFixed(2) + " vs " + C.rgbToLab(average)[0].toFixed(2)
);

const base = C.mix({ white: 50, ochre: 50 });
const withBlack = C.mix({ white: 50, ochre: 50, black: 8 });
const withMadder = C.mix({ white: 50, ochre: 50, madder: 8 });
assert.ok(C.rgbToLab(withBlack)[0] < C.rgbToLab(withMadder)[0] - 2, "lamp black out-tints madder");

const whiteLab = C.rgbToLab([255, 255, 255]);
assert.ok(Math.abs(whiteLab[0] - 100) < 0.05, "white L* " + whiteLab[0]);
assert.ok(Math.abs(whiteLab[1]) < 0.05 && Math.abs(whiteLab[2]) < 0.05);

const redLab = C.rgbToLab([255, 0, 0]);
assert.ok(Math.abs(redLab[0] - 53.24) < 0.2, "red L* " + redLab[0]);
assert.ok(Math.abs(redLab[1] - 80.09) < 0.3, "red a* " + redLab[1]);
assert.ok(Math.abs(redLab[2] - 67.2) < 0.3, "red b* " + redLab[2]);

const sharma = C.deltaE00([50, 2.6772, -79.7751], [50, 0, -82.7485]);
assert.ok(Math.abs(sharma - 2.0425) < 0.001, "CIEDE2000 sample " + sharma);

const rose = C.mix({ white: 70, madder: 30 });
const leaf = C.mix({ verdigris: 60, ochre: 40 });
assert.ok(C.distance(rose, rose) < 1e-9);
assert.ok(Math.abs(C.distance(rose, leaf) - C.distance(leaf, rose)) < 1e-9);

assert.equal(C.scoreRound(0), 125);
assert.equal(C.scoreRound(-3), 0);
assert.equal(C.scoreRound(Number.NaN), 0);
let previous = 126;
for (const dE of [0, 1, 2, 5, 8, 12, 20, 40, 80]) {
  const score = C.scoreRound(dE);
  assert.ok(score <= previous, "score should fall as distance grows: " + dE);
  assert.ok(score >= 0 && score <= 125);
  previous = score;
}
assert.ok(C.scoreRound(80) <= 2, "a wild miss is worth almost nothing");

let perfect = 0;
const colours = [];
for (const round of C.ROUNDS) {
  const target = C.mix(round.recipe);
  const judged = C.judge(target, target);
  assert.equal(judged.score, 125, round.name);
  assert.equal(judged.dE, 0);
  assert.match(judged.text, /near match/i);
  perfect += judged.score;
  colours.push({ name: round.name, hex: C.hex(target), lab: C.rgbToLab(target).map((n) => +n.toFixed(1)) });
}
assert.equal(perfect, 1000);

for (let i = 0; i < colours.length; i++) {
  const target = C.mix(C.ROUNDS[i].recipe);
  const fromGround = C.distance(target, C.GROUND);
  assert.ok(fromGround > 12, C.ROUNDS[i].name + " is too close to the bare bench: " + fromGround.toFixed(1));
  for (let j = i + 1; j < colours.length; j++) {
    const other = C.mix(C.ROUNDS[j].recipe);
    const dE = C.distance(target, other);
    assert.ok(dE > 14, colours[i].name + " vs " + colours[j].name + " is only " + dE.toFixed(1));
  }
}

const pale = C.judge([30, 30, 30], [230, 230, 230]);
assert.match(pale.text, /lighter/);
const dusk = C.judge([230, 220, 210], [20, 20, 20]);
assert.match(dusk.text, /darker/);

assert.equal(C.rankFor(1000), "Principal colourist");
assert.equal(C.rankFor(920), "Principal colourist");
assert.equal(C.rankFor(919), "Palette hand");
assert.equal(C.rankFor(780), "Palette hand");
assert.equal(C.rankFor(779), "Studio mixer");
assert.equal(C.rankFor(600), "Studio mixer");
assert.equal(C.rankFor(599), "Ground layer");
assert.equal(C.rankFor(400), "Ground layer");
assert.equal(C.rankFor(399), "Raw canvas");
assert.equal(C.rankFor(0), "Raw canvas");
assert.equal(C.shareLine(848), "Swatch 848/1000 · Palette hand");

assert.equal(C.hex([0, 15, 255]), "#000FFF");

console.log("colour tests passed");
console.log(JSON.stringify(colours, null, 2));
console.log("score curve", [0, 2, 5, 8, 12, 20, 30].map((d) => [d, C.scoreRound(d)]));
