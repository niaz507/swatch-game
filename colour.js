/* Swatch colour model.
   Subtractive mixing is a single-constant Kubelka–Munk mix on sRGB
   reflectances: paints darken each other instead of averaging toward grey.
   Scoring is CIEDE2000, so the points follow the eye rather than RGB distance.
   No DOM in this file. The page and the tests both call it. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SwatchColour = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var EPSILON = 216 / 24389;
  var KAPPA = 24389 / 27;
  var XN = 0.95047;
  var YN = 1;
  var ZN = 1.08883;
  var ROUND_MAX = 125;
  var SCORE_TAU = 18;

  var PIGMENTS = [
    {
      id: "white",
      name: "Lead white",
      index: "PW1",
      note: "Flake white. Opaque, and the way a tint gets pale.",
      strength: 1.35,
      rgb: [244, 240, 228]
    },
    {
      id: "ochre",
      name: "Ochre",
      index: "PY43",
      note: "Yellow earth. The middle of the bench.",
      strength: 0.95,
      rgb: [196, 132, 42]
    },
    {
      id: "madder",
      name: "Madder",
      index: "NR9",
      note: "A red lake from the root. It stains.",
      strength: 0.5,
      rgb: [158, 42, 52]
    },
    {
      id: "verdigris",
      name: "Verdigris",
      index: "Copper acetate",
      note: "Copper green. It cools ochre into olive.",
      strength: 0.8,
      rgb: [30, 122, 96]
    },
    {
      id: "black",
      name: "Lamp black",
      index: "PBk6",
      note: "Soot. A little goes a long way.",
      strength: 0.28,
      rgb: [22, 21, 19]
    }
  ].map(freezePigment);

  /* Bare wood of the bench. Not a pigment, so leaving the sliders at zero
     is never a secret way to hit a target. */
  var GROUND = Object.freeze([168, 166, 160]);

  var ROUNDS = [
    {
      id: "chalk-rose",
      name: "Chalk rose",
      lede: "Madder, thinned hard with lead white. The red should only whisper.",
      recipe: { white: 88, madder: 12 }
    },
    {
      id: "kitchen-ochre",
      name: "Kitchen ochre",
      lede: "Yellow earth, enough white to soften it, and a little lamp black to kill the glare.",
      recipe: { ochre: 72, white: 26, black: 2 }
    },
    {
      id: "copper-leaf",
      name: "Copper leaf",
      lede: "Verdigris and a little ochre, lifted with white. It should read green, not mustard.",
      recipe: { verdigris: 48, white: 44, ochre: 8 }
    },
    {
      id: "lamp-rose",
      name: "Lamp rose",
      lede: "Madder pushed toward dusk with lamp black, then brought back with lead white.",
      recipe: { madder: 48, black: 14, white: 38 }
    },
    {
      id: "olive-ground",
      name: "Olive ground",
      lede: "Ochre and verdigris, with enough black to sit under the leaf. Yellower than copper, and darker.",
      recipe: { verdigris: 28, ochre: 46, black: 8, white: 18 }
    },
    {
      id: "madder-clay",
      name: "Madder clay",
      lede: "Lead white and ochre, with enough madder to turn the tint toward clay.",
      recipe: { white: 58, ochre: 14, madder: 26, black: 2 }
    },
    {
      id: "night-lake",
      name: "Night lake",
      lede: "Lamp black with a body of verdigris. Dark green, not a dead black.",
      recipe: { black: 44, verdigris: 42, white: 10, madder: 4 }
    },
    {
      id: "studio-grey",
      name: "Studio grey",
      lede: "White and lamp black, warmed with ochre and a speck of madder. It should stay grey.",
      recipe: { white: 55, black: 28, ochre: 9, madder: 8 }
    }
  ].map(function (round) {
    return Object.freeze({
      id: round.id,
      name: round.name,
      lede: round.lede,
      recipe: Object.freeze(Object.assign({}, round.recipe))
    });
  });

  function freezePigment(p) {
    return Object.freeze({
      id: p.id,
      name: p.name,
      index: p.index,
      note: p.note,
      strength: p.strength,
      rgb: Object.freeze(p.rgb.slice())
    });
  }

  function emptyAmounts() {
    var out = {};
    for (var i = 0; i < PIGMENTS.length; i++) out[PIGMENTS[i].id] = 0;
    return out;
  }

  function clampAmount(n) {
    if (!Number.isFinite(n)) return 0;
    return Math.min(100, Math.max(0, Math.round(n)));
  }

  function reflectance(channel) {
    return Math.min(0.999, Math.max(0.001, channel / 255));
  }

  function ks(r) {
    return ((1 - r) * (1 - r)) / (2 * r);
  }

  function fromKs(k) {
    return 1 + k - Math.sqrt(k * k + 2 * k);
  }

  function mix(raw) {
    var weight = 0;
    var sum = [0, 0, 0];
    for (var i = 0; i < PIGMENTS.length; i++) {
      var pigment = PIGMENTS[i];
      var drops = clampAmount(raw && raw[pigment.id]);
      var w = drops * pigment.strength;
      if (w <= 0) continue;
      weight += w;
      for (var c = 0; c < 3; c++) sum[c] += w * ks(reflectance(pigment.rgb[c]));
    }
    if (weight <= 0) return GROUND.slice();
    var rgb = [0, 0, 0];
    for (var ch = 0; ch < 3; ch++) {
      var r = fromKs(sum[ch] / weight);
      rgb[ch] = Math.round(Math.min(255, Math.max(0, r * 255)));
    }
    return rgb;
  }

  function totalDrops(raw) {
    var n = 0;
    for (var i = 0; i < PIGMENTS.length; i++) n += clampAmount(raw && raw[PIGMENTS[i].id]);
    return n;
  }

  function linearize(channel) {
    var c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function fLab(t) {
    return t > EPSILON ? Math.cbrt(t) : (KAPPA * t + 16) / 116;
  }

  function rgbToLab(rgb) {
    var r = linearize(rgb[0]);
    var g = linearize(rgb[1]);
    var b = linearize(rgb[2]);
    var x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
    var y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
    var z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
    var fx = fLab(x / XN);
    var fy = fLab(y / YN);
    var fz = fLab(z / ZN);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }

  function hue(h) {
    return h >= 0 ? h : h + 360;
  }

  /* CIEDE2000, Sharma / Wu / Dalal 2004. kL = kC = kH = 1. */
  function deltaE00(lab1, lab2) {
    var L1 = lab1[0], a1 = lab1[1], b1 = lab1[2];
    var L2 = lab2[0], a2 = lab2[1], b2 = lab2[2];
    var C1 = Math.sqrt(a1 * a1 + b1 * b1);
    var C2 = Math.sqrt(a2 * a2 + b2 * b2);
    var Cbar = (C1 + C2) / 2;
    var Cbar7 = Math.pow(Cbar, 7);
    var G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));
    var a1p = (1 + G) * a1;
    var a2p = (1 + G) * a2;
    var C1p = Math.sqrt(a1p * a1p + b1 * b1);
    var C2p = Math.sqrt(a2p * a2p + b2 * b2);
    var h1 = hue(Math.atan2(b1, a1p) * 180 / Math.PI);
    var h2 = hue(Math.atan2(b2, a2p) * 180 / Math.PI);
    var dLp = L2 - L1;
    var dCp = C2p - C1p;
    var dhp = 0;
    if (C1p * C2p !== 0) {
      dhp = h2 - h1;
      if (dhp > 180) dhp -= 360;
      else if (dhp < -180) dhp += 360;
    }
    var dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI / 180) / 2);
    var Lbarp = (L1 + L2) / 2;
    var Cbarp = (C1p + C2p) / 2;
    var Hbarp;
    if (C1p * C2p === 0) Hbarp = h1 + h2;
    else if (Math.abs(h1 - h2) <= 180) Hbarp = (h1 + h2) / 2;
    else if (h1 + h2 < 360) Hbarp = (h1 + h2 + 360) / 2;
    else Hbarp = (h1 + h2 - 360) / 2;
    var T = 1
      - 0.17 * Math.cos((Hbarp - 30) * Math.PI / 180)
      + 0.24 * Math.cos((2 * Hbarp) * Math.PI / 180)
      + 0.32 * Math.cos((3 * Hbarp + 6) * Math.PI / 180)
      - 0.20 * Math.cos((4 * Hbarp - 63) * Math.PI / 180);
    var dTheta = 30 * Math.exp(-Math.pow((Hbarp - 275) / 25, 2));
    var Cbarp7 = Math.pow(Cbarp, 7);
    var Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + Math.pow(25, 7)));
    var Sl = 1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2));
    var Sc = 1 + 0.045 * Cbarp;
    var Sh = 1 + 0.015 * Cbarp * T;
    var Rt = -Math.sin(2 * dTheta * Math.PI / 180) * Rc;
    return Math.sqrt(
      Math.pow(dLp / Sl, 2) +
      Math.pow(dCp / Sc, 2) +
      Math.pow(dHp / Sh, 2) +
      Rt * (dCp / Sc) * (dHp / Sh)
    );
  }

  function distance(rgb1, rgb2) {
    return deltaE00(rgbToLab(rgb1), rgbToLab(rgb2));
  }

  function scoreRound(dE) {
    if (!Number.isFinite(dE) || dE < 0) return 0;
    var raw = ROUND_MAX * Math.exp(-dE / SCORE_TAU);
    if (raw < 0.5) return 0;
    return Math.round(Math.min(ROUND_MAX, raw));
  }

  function describeMiss(targetRgb, mixRgb, dE) {
    if (dE < 1.2) return "A near match.";
    var target = rgbToLab(targetRgb);
    var mixLab = rgbToLab(mixRgb);
    var axes = [
      { v: mixLab[0] - target[0], pos: "lighter", neg: "darker" },
      { v: mixLab[1] - target[1], pos: "redder", neg: "greener" },
      { v: mixLab[2] - target[2], pos: "yellower", neg: "bluer" }
    ];
    var notable = [];
    for (var i = 0; i < axes.length; i++) {
      if (Math.abs(axes[i].v) >= 2) notable.push(axes[i]);
    }
    notable.sort(function (a, b) { return Math.abs(b.v) - Math.abs(a.v); });
    notable = notable.slice(0, 2);
    if (!notable.length) return "Close, and a little off in every direction at once.";
    var words = [];
    for (var j = 0; j < notable.length; j++) words.push(notable[j].v > 0 ? notable[j].pos : notable[j].neg);
    if (words.length === 1) return "Your mix sits " + words[0] + ".";
    return "Your mix sits " + words[0] + " and " + words[1] + ".";
  }

  function judge(targetRgb, mixRgb) {
    var dE = distance(targetRgb, mixRgb);
    return {
      dE: dE,
      score: scoreRound(dE),
      text: describeMiss(targetRgb, mixRgb, dE)
    };
  }

  function rankFor(total) {
    if (total >= 920) return "Principal colourist";
    if (total >= 780) return "Palette hand";
    if (total >= 600) return "Studio mixer";
    if (total >= 400) return "Ground layer";
    return "Raw canvas";
  }

  function shareLine(total) {
    return "Swatch " + total + "/1000 · " + rankFor(total);
  }

  function hex(rgb) {
    var s = "#";
    for (var i = 0; i < 3; i++) s += rgb[i].toString(16).padStart(2, "0");
    return s.toUpperCase();
  }

  return {
    PIGMENTS: Object.freeze(PIGMENTS),
    GROUND: GROUND,
    ROUNDS: Object.freeze(ROUNDS),
    ROUND_MAX: ROUND_MAX,
    emptyAmounts: emptyAmounts,
    mix: mix,
    totalDrops: totalDrops,
    rgbToLab: rgbToLab,
    deltaE00: deltaE00,
    distance: distance,
    scoreRound: scoreRound,
    judge: judge,
    rankFor: rankFor,
    shareLine: shareLine,
    hex: hex
  };
});
