// The furniture of the cathedral, and the little renderer that draws it (and the walls) as pixel art.
// A thing is a list of shapes in its own footprint (x, y in cells; z in screen pixels upward):
//   a box      [x0, y0, z0, x1, y1, z1, material]
//   a cylinder ['C', cx, cy, r, z0, z1, material, rTop]   (rTop: the radius at z1, for tapers; default r)
// Every pixel of a cell's sprite casts its view ray through the shapes and keeps the nearest hit. Its light comes
// from the face (the top brightest, the south face less, the east face least; round things in between, catching a
// rim of light on the left), and is turned into one of the material's own colours — a ramp from a cool, violet
// shadow to a warm highlight — with a little ordered dither between them, then outlined in the material's darkest
// colour where it meets the air. That is what makes it read as pixel art.
// A thing several cells wide is drawn cell by cell (each cell a sprite sorted with the characters).
// Rotation: 0 as defined (the front looks south, +y), 1 front west, 2 front north, 3 front east.

import { GY, DH, ZS, thinUp } from './view.js?v=78777f9';

const clamp8 = v => v < 0 ? 0 : v > 255 ? 255 : v | 0;
const hash = (a, b, c = 0) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1440662683); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16 - .5);

// ---------------------------------------------------------------- colour ramps
// n colours from a cool dark (the base deep in shadow, pulled toward violet) through the base to a warm light.
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
export function ramp(base, n = 6, warm = [255, 232, 196]) {
  const dark = mix(base.map(v => v * .26), [26, 14, 40], .45), light = mix(base.map(v => Math.min(255, v * 1.32)), warm, .22);
  return Array.from({ length: n }, (_, i) => { const t = i / (n - 1); return (t < .62 ? mix(dark, base, t / .62) : mix(base, light, (t - .62) / .38)).map(v => clamp8(v)); });
}
// Pick a colour of the ramp for a brightness v (about 0.3 dark … 1.2 lit), dithered by the pixel's place.
export function shade(R, v, x, y, dith = .7) {
  const p = (v - .32) / .86 * (R.length - 1) + BAYER[(y & 3) * 4 + (x & 3)] * dith;
  return R[Math.max(0, Math.min(R.length - 1, Math.round(p)))];
}

// ---------------------------------------------------------------- materials
// r: the ramp; tex(face, U, V, seed): a brightness multiplier for the surface's own pattern (planks, joints, carving)
// or { c: colour } to set a colour outright; emit: gives its own light (drawn as is); metal: a sharp highlight.
const R = {
  oak: ramp([126, 80, 50], 7), dark: ramp([84, 52, 38], 7), red: ramp([150, 28, 40], 6), stone: ramp([128, 114, 136], 7), pale: ramp([170, 158, 174], 7),
  marble: ramp([208, 200, 200], 6, [255, 250, 240]), linen: ramp([224, 216, 200], 5, [255, 250, 236]), gold: ramp([212, 160, 60], 7, [255, 240, 170]),
  iron: ramp([70, 64, 78], 6), wax: ramp([232, 222, 200], 4, [255, 248, 230]), paper: ramp([226, 214, 186], 4), leather: ramp([116, 64, 40], 6),
  purple: ramp([104, 46, 120], 6), green: ramp([58, 92, 50], 6, [200, 230, 150]), bark: ramp([88, 62, 44], 5), water: ramp([50, 80, 120], 5, [170, 210, 255]),
  straw: ramp([182, 150, 88], 5), sack: ramp([158, 132, 92], 5), soot: ramp([40, 34, 38], 4), copper: ramp([168, 96, 56], 6), bronze: ramp([140, 106, 64], 6),
  blue: ramp([56, 78, 140], 6), pipe: ramp([176, 176, 190], 7, [255, 255, 255]),
};
const T = (f, g) => g;                                   // (for readability below)
const planks = (step = 5, dark = .72) => (f, U, V, s) => {     // boards with dark seams; their grain
  const seam = f === 'T' ? (V | 0) % step === 0 : (U | 0) % 7 === 0 && f !== 'T' ? false : (V | 0) % (step + 1) === 0;
  return seam ? dark : .96 + .06 * Math.sin(U * .41 + V * 2.3 + s * 5) + (hash(U >> 3, V >> 2, s) - .5) * .06;
};
const coursed = (bh = 6, bl = 10) => (f, U, V, s) => {         // ashlar: blocks and their joints
  if (f === 'T') return 1;
  const row = Math.floor(V / bh), sh = (row & 1) * (bl >> 1), x = (Math.floor(U) + sh) % bl, y = Math.floor(V) % bh;
  if (x === 0 || y === 0) return .62; return (y === 1 ? 1.08 : 1) * (.94 + hash(Math.floor((U + sh) / bl), row, s * 31) * .12);
};
export const MAT = {
  oak: { r: R.oak, tex: planks(5) }, darkwood: { r: R.dark, tex: planks(5) }, redwood: { r: R.leather, tex: planks(4) },
  stone: { r: R.stone, tex: coursed() }, pale: { r: R.pale, tex: (f, U, V, s) => .97 + hash(U | 0, V | 0, s) * .06 },
  marble: { r: R.marble, tex: (f, U, V, s) => { const w = Math.sin(U * .21 + V * .37 + s * 9) + Math.sin(U * .5 - V * .13); return Math.abs(w) < .1 ? .82 : 1; } },
  linen: { r: R.linen }, purple: { r: R.purple }, red: { r: R.red, tex: (f, U) => .94 + .08 * Math.sin(U * .9) },
  gold: { r: R.gold, metal: 1 }, brass: { r: R.gold, metal: 1 }, iron: { r: R.iron, metal: .6 }, wax: { r: R.wax },
  flame: { emit: (f, U, V) => V < 1.5 ? [255, 250, 214] : [255, 198, 92] }, fire: { emit: (f, U, V, s) => hash(U | 0, V | 0, s) < .5 ? [255, 150, 40] : [255, 214, 96] },
  lantern: { emit: (f, U, V) => (U | 0) % 6 === 0 ? [120, 90, 50] : [255, 214, 140] },
  paper: { r: R.paper, tex: (f, U, V) => (V | 0) % 3 === 0 && f === 'T' ? .86 : 1 }, leather: { r: R.leather }, cushion: { r: R.red, tex: () => 1 },
  pipe: { r: R.pipe, metal: 1 }, leaf: { r: R.green, tex: (f, U, V, s) => { const n = hash(U >> 1, V >> 1, s * 5); return n < .25 ? .72 : n > .8 ? 1.16 : 1; } },
  bark: { r: R.bark }, water: { r: R.water, tex: (f, U, V) => f === 'T' ? 1 + .1 * Math.sin(U * .7 + V * .5) : 1 }, straw: { r: R.straw }, sack: { r: R.sack, tex: (f, U, V) => .95 + .08 * Math.sin(U * 1.3) },
  blanket: { r: R.red, tex: (f, U, V) => (Math.floor(U / 4) + Math.floor(V / 4)) & 1 ? 1 : .82 }, soot: { r: R.soot }, copper: { r: R.copper, metal: .8 }, bronze: { r: R.bronze, metal: .7 },
  globe: { r: R.blue, tex: (f, U, V) => (Math.sin(U * .5) + Math.cos(V * .6)) > .4 ? { c: [84, 120, 72] } : 1 },
  // Books on their shelves: spines of many colours, the shelf boards between.
  books: { r: R.dark, tex: (f, U, V, s) => {
    if (f === 'T') return .9; const sh = Math.floor(V) % 13; if (sh < 2) return sh ? .7 : 1.05;
    const b = Math.floor(U / 2.6), h = hash(b, Math.floor(V / 13), s * 7), top = 2 + Math.floor(hash(b, 9, s) * 3);
    if (sh < top) return .45;                                                         // the gap above a short book
    const C = [[132, 34, 40], [52, 70, 120], [150, 120, 60], [58, 96, 58], [110, 70, 46], [86, 48, 104], [170, 150, 120]][Math.floor(h * 7)];
    const k = (Math.floor(U * 10 / 2.6) % 10 === 0 ? .6 : 1) * (sh === top ? 1.2 : 1); return { c: C.map(v => v * k) }; } },
  // The end of a pew, a cross carved into it (shows on the face toward the camera).
  pewend: { r: R.dark, tex: (f, U, V) => {
    if (f === 'T') return 1.1; const u = U % 20;
    const cross = (Math.abs(u - 10) < 1.2 && V > 6 && V < 20) || (Math.abs(V - 10) < 1.1 && Math.abs(u - 10) < 4.4);
    const rim = (Math.abs(u - 10) < 2.3 && V > 5 && V < 21) || (Math.abs(V - 10) < 2.2 && Math.abs(u - 10) < 5.5);
    return cross ? .55 : rim ? 1.16 : 1; } },
  rug: { r: R.red, tex: (f, U, V) => { const u = (U % 60 + 60) % 60, v = (V % 40 + 40) % 40, e = Math.min(u, v, 60 - u, 40 - v);
    return e < 2 ? { c: [168, 128, 60] } : e < 5 ? .62 : (Math.abs(u - 30) + Math.abs(v - 20)) % 10 < 2 ? { c: [168, 128, 60] } : 1; } },
};
// A banner's cloth: red or violet, a gold cross on the face toward the camera.
const bannerCloth = r => ({ r, tex: (f, U, V) => {
  if (f === 'T') return .8; const u = (U % 20 + 20) % 20;
  if ((Math.abs(u - 10) < 1.2 && V > 6 && V < 26) || (Math.abs(V - 12) < 1.1 && Math.abs(u - 10) < 4.5)) return { c: [214, 170, 72] };
  if (V < 2 || (V > 28 && V < 30)) return { c: [176, 138, 60] }; return .9 + .12 * Math.sin(u * .9); } });
MAT.bannerred = bannerCloth(R.red); MAT.bannerpurple = bannerCloth(R.purple);

// ---------------------------------------------------------------- the furniture
// fp: footprint [w, h] in cells; shapes; solid: blocks the way (default true); lights: [x, y, z(px), colour, radius];
// hang: up in the air (never blocks); statue: a statue stands on it at this height.
const C = (cx, cy, r, z0, z1, m, r1) => ['C', cx, cy, r, z0, z1, m, r1 ?? r];
const candle = (x, y, z, h = 10, w = .045) => [C(x, y, w, z, z + h, 'wax'), C(x, y, w * .6, z + h, z + h + 3, 'flame', .01)];
const rows = (n, f) => Array.from({ length: n }, (_, i) => f(i)).flat();
// A turned stem: base, knops, a cup on top.
const stem = (x, y, z0, z1, r, m) => [C(x, y, r * 2.4, z0, z0 + 2, m, r * 2), C(x, y, r, z0 + 2, z1, m), C(x, y, r * 1.8, z0 + (z1 - z0) * .3, z0 + (z1 - z0) * .3 + 2, m), C(x, y, r * 1.6, z0 + (z1 - z0) * .7, z0 + (z1 - z0) * .7 + 2, m)];
export const PROPS = {
  // A pew: seat, backrest with its rail, carved ends rounded at the top; a kneeler bar in front.
  pew: { fp: [6, 1], shapes: [
    [.12, .2, 8, 5.88, .7, 11, 'oak'], [.12, .22, 0, 5.88, .3, 8, 'darkwood'],
    [.12, .7, 8, 5.88, .82, 25, 'oak'], [.1, .66, 25, 5.9, .86, 27, 'darkwood'],
    [.12, .04, 2, 5.88, .12, 4, 'darkwood'],
    ...[0, 5.86].flatMap(x => [[x, .1, 0, x + .14, .9, 24, 'pewend'], [x, .16, 24, x + .14, .84, 27, 'pewend'], [x, .28, 27, x + .14, .72, 29, 'pewend']])] },
  // The high altar: a marble table on a moulded plinth, white cloth hanging down the front, a red frontal with gold
  // edging, the tabernacle, the crucifix, six candlesticks.
  altar: { fp: [6, 2], shapes: [
    [.2, .25, 0, 5.8, 1.75, 4, 'marble'], [.35, .4, 4, 5.65, 1.6, 24, 'marble'], [.15, .2, 24, 5.85, 1.8, 29, 'marble'], [.12, .18, 29, 5.88, 1.82, 30, 'linen'],
    [.12, 1.82, 22, 5.88, 1.86, 30, 'linen'], [.45, 1.6, 5, 5.55, 1.66, 24, 'red'], [.45, 1.6, 22, 5.55, 1.68, 24, 'gold'], [.45, 1.6, 5, 5.55, 1.68, 7, 'gold'],
    [2.8, 1.6, 9, 3.2, 1.68, 20, 'gold'], [2.6, 1.6, 13, 3.4, 1.68, 15, 'gold'],
    [2.5, .45, 30, 3.5, 1.1, 46, 'gold'], [2.6, .5, 46, 3.4, 1.05, 48, 'gold'], [2.88, 1.1, 34, 3.12, 1.12, 44, 'red'],
    C(3, .7, .05, 48, 86, 'gold'), [2.7, .66, 72, 3.3, .74, 75, 'gold'],
    ...[.7, 1.4, 2.1, 3.9, 4.6, 5.3].flatMap(x => [...stem(x, .75, 30, 40, .035, 'brass'), ...candle(x, .75, 40, 16)])],
    lights: [[1.4, .8, 58, [255, 170, 80], 70], [4.6, .8, 58, [255, 170, 80], 70], [3, .8, 60, [255, 190, 110], 60]] },
  // The bishop's chair behind the altar: tall back with a gold finial, red cushions.
  cathedra: { fp: [1, 1], shapes: [[.15, .25, 0, .85, .85, 14, 'darkwood'], [.2, .3, 14, .8, .8, 17, 'cushion'], [.13, .1, 14, .87, .25, 58, 'darkwood'], [.2, .2, 20, .8, .26, 54, 'cushion'],
    [.1, .25, 14, .2, .85, 27, 'darkwood'], [.8, .25, 14, .9, .85, 27, 'darkwood'], [.1, .08, 58, .9, .27, 61, 'darkwood'], C(.5, .17, .07, 61, 68, 'gold', .02)] },
  chair: { fp: [1, 1], shapes: [C(.3, .34, .04, 0, 12, 'darkwood'), C(.7, .34, .04, 0, 12, 'darkwood'), C(.3, .76, .04, 0, 12, 'darkwood'), C(.7, .76, .04, 0, 12, 'darkwood'),
    [.22, .28, 12, .78, .82, 15, 'oak'], C(.27, .32, .035, 15, 38, 'darkwood'), C(.73, .32, .035, 15, 38, 'darkwood'), [.24, .29, 28, .76, .35, 36, 'oak'], [.24, .29, 20, .76, .35, 22, 'oak']] },
  // A credence table, a desk, a long refectory table and its bench.
  credence: { fp: [2, 1], shapes: [[.15, .2, 0, 1.85, .8, 22, 'darkwood'], [.1, .15, 22, 1.9, .85, 24, 'linen'], [.1, .85, 16, 1.9, .87, 24, 'linen'],
    ...stem(.6, .5, 24, 32, .03, 'gold'), C(.6, .5, .09, 32, 36, 'gold', .12), [1.25, .35, 24, 1.65, .65, 27, 'brass'], C(1.45, .5, .08, 27, 33, 'brass', .04)] },
  desk: { fp: [2, 1], shapes: [C(.18, .2, .05, 0, 18, 'darkwood'), C(1.82, .2, .05, 0, 18, 'darkwood'), C(.18, .8, .05, 0, 18, 'darkwood'), C(1.82, .8, .05, 0, 18, 'darkwood'),
    [.1, .14, 13, 1.9, .86, 18, 'darkwood'], [.05, .1, 18, 1.95, .9, 21, 'oak'], [.3, .3, 21, .9, .72, 22, 'paper'], [.34, .34, 22, .62, .68, 23, 'paper'], C(1.1, .4, .06, 21, 26, 'iron', .04),
    ...stem(1.5, .45, 21, 28, .03, 'brass'), ...candle(1.5, .45, 28, 6)], lights: [[1.5, .45, 38, [255, 160, 70], 42]] },
  table: { fp: [6, 1], shapes: [[.3, .25, 0, .45, .75, 17, 'darkwood'], [5.55, .25, 0, 5.7, .75, 17, 'darkwood'], [2.92, .25, 0, 3.08, .75, 17, 'darkwood'], [.3, .45, 4, 5.7, .55, 7, 'darkwood'],
    [.05, .1, 17, 5.95, .9, 21, 'oak'], ...[.8, 1.9, 3.4, 4.8].flatMap((x, i) => [C(x + .15, .5, .16, 21, 22, i & 1 ? 'pale' : 'copper'), C(x + .15, .5, .1, 22, 23, i & 1 ? 'pale' : 'copper')]), C(2.5, .45, .06, 21, 29, 'copper', .05)] },
  bench: { fp: [6, 1], shapes: [[.25, .32, 0, .4, .68, 10, 'darkwood'], [5.6, .32, 0, 5.75, .68, 10, 'darkwood'], [.05, .25, 10, 5.95, .75, 13, 'oak']] },
  // Choir stalls: a row of seats with a tall panelled back and a canopy.
  stall: { fp: [6, 1], shapes: [[0, .3, 0, 6, .9, 14, 'darkwood'], [0, .35, 14, 6, .9, 16, 'oak'], [0, .05, 0, 6, .3, 52, 'darkwood'], [0, 0, 52, 6, .45, 56, 'oak'],
    ...rows(7, i => [[i - .03, .3, 14, i + .06, .95, 27, 'oak'], [i - .04, .04, 0, i + .06, .32, 52, 'oak']])] },
  // The organ: a carved case and a wall of shining pipes, the tallest in the middle; the console in front.
  organ: { fp: [8, 2], shapes: [[.4, .2, 0, 7.6, 1.4, 34, 'darkwood'], [.3, .1, 34, 7.7, 1.5, 38, 'oak'],
    ...rows(26, i => { const x = .65 + i * .26, h = 84 + 40 * Math.sin(i / 25 * Math.PI) + (i % 2) * 5; return [C(x, .55, .11, 38, h, 'pipe'), C(x, .55, .11, h, h + 4, 'pipe', .02)]; }),
    [3.2, 1.4, 0, 4.8, 1.95, 22, 'darkwood'], [3.3, 1.4, 22, 4.7, 1.62, 27, 'darkwood'], [3.35, 1.62, 22, 4.65, 1.75, 23, 'linen'], [3.5, 1.65, 0, 4.5, 1.98, 10, 'oak']] },
  // A pulpit on a stone stem, a sounding board above.
  pulpit: { fp: [2, 2], shapes: [C(1, 1, .3, 0, 30, 'stone', .22), C(1, 1, .72, 30, 54, 'darkwood'), C(1, 1, .78, 54, 58, 'oak'), C(1, 1, .7, 30, 33, 'oak'),
    [.88, .2, 30, 1.12, .3, 112, 'darkwood'], C(1, 1, .92, 106, 112, 'darkwood', .84), C(1, 1, .1, 112, 122, 'gold', .02)] },
  // Lectern with the book open on it, its red ribbon hanging.
  lectern: { fp: [1, 1], shapes: [C(.5, .5, .22, 0, 3, 'stone'), ...stem(.5, .5, 3, 26, .045, 'brass'), [.16, .22, 26, .84, .78, 29, 'darkwood'],
    [.2, .28, 29, .48, .72, 32, 'paper'], [.52, .28, 29, .8, .72, 32, 'paper'], [.48, .28, 29, .52, .72, 31, 'leather'], [.49, .7, 18, .51, .8, 30, 'red']] },
  // A tall candlestick, a rack of votive candles, a hanging iron chandelier.
  candlestick: { fp: [1, 1], shapes: [C(.5, .5, .2, 0, 3, 'brass', .14), ...stem(.5, .5, 3, 44, .05, 'brass'), C(.5, .5, .13, 44, 47, 'brass', .17), ...candle(.5, .5, 47, 14, .055)],
    lights: [[.5, .5, 62, [255, 160, 70], 66]] },
  votives: { fp: [2, 1], shapes: [[.1, .3, 0, 1.9, .7, 16, 'iron'], [.1, .25, 16, 1.9, .5, 18, 'iron'], [.1, .5, 20, 1.9, .75, 22, 'iron'],
    ...rows(9, i => [C(.2 + i * .2, .38, .06, 18, 19, 'red'), ...candle(.2 + i * .2, .38, 19, 3)]), ...rows(9, i => [C(.25 + i * .19, .62, .06, 22, 23, 'red'), ...candle(.25 + i * .19, .62, 23, 3)])],
    lights: [[1, .5, 30, [255, 150, 60], 54]] },
  chandelier: { fp: [1, 1], solid: false, hang: true, shapes: [C(.5, .5, .03, 82, 160, 'iron'), C(.5, .5, .36, 78, 81, 'iron', .38), C(.5, .5, .1, 74, 82, 'iron', .04),
    ...[[.2, .2], [.8, .2], [.2, .8], [.8, .8], [.5, .14], [.5, .86], [.14, .5], [.86, .5]].flatMap(([x, y]) => [C(x, y, .05, 81, 82, 'iron'), ...candle(x, y, 82, 6)])],
    lights: [[.5, .5, 62, [255, 170, 90], 100]] },
  // A candelabrum of five candles on a stone pedestal.
  candelabrum: { fp: [1, 1], shapes: [[.2, .2, 0, .8, .8, 3, 'stone'], [.25, .25, 3, .75, .75, 16, 'pale'], [.18, .18, 16, .82, .82, 19, 'stone'], C(.5, .5, .14, 19, 22, 'brass', .08),
    ...stem(.5, .5, 22, 48, .035, 'brass'), [.18, .47, 48, .82, .53, 50, 'brass'], [.47, .18, 48, .53, .82, 50, 'brass'],
    ...[[.18, .5], [.82, .5], [.5, .18], [.5, .82]].flatMap(([x, y]) => [C(x, y, .06, 50, 53, 'brass', .08), ...candle(x, y, 53, 9)]),
    C(.5, .5, .07, 50, 54, 'brass', .09), ...candle(.5, .5, 54, 13)],
    lights: [[.5, .5, 70, [255, 165, 80], 88]] },
  // The great chandelier: two iron rings of candles hung by chains that vanish in the dark.
  chandelier2: { fp: [2, 2], solid: false, hang: true, shapes: [
    C(1, 1, .04, 74, 170, 'iron'), C(1, 1, .14, 66, 76, 'iron', .06), C(1, 1, .08, 60, 66, 'iron', .02),
    ...rows(20, i => { const a = i / 20 * Math.PI * 2, x = 1 + Math.cos(a) * .82, y = 1 + Math.sin(a) * .82; return [C(x, y, .09, 74, 77, 'iron')]; }),
    ...rows(12, i => { const a = i / 12 * Math.PI * 2, x = 1 + Math.cos(a) * .82, y = 1 + Math.sin(a) * .82; return [C(x, y, .06, 77, 78, 'brass'), ...candle(x, y, 78, 7)]; }),
    ...rows(8, i => { const a = (i + .5) / 8 * Math.PI * 2, x = 1 + Math.cos(a) * .42, y = 1 + Math.sin(a) * .42; return [C(x, y, .07, 90, 92, 'iron'), ...candle(x, y, 92, 7)]; }),
    ...rows(4, i => { const a = (i + .5) / 4 * Math.PI * 2, x = 1 + Math.cos(a) * .82, y = 1 + Math.sin(a) * .82; return [C(x, y, .02, 77, 170, 'iron')]; })],
    lights: [[1, 1, 64, [255, 170, 90], 150]] },
  // Kneeler; confessional; bookshelf.
  kneeler: { fp: [1, 1], shapes: [[.2, .55, 0, .8, .82, 5, 'cushion'], [.2, .12, 0, .8, .3, 22, 'darkwood'], [.14, .08, 22, .86, .36, 25, 'oak'], [.2, .3, 2, .8, .55, 4, 'darkwood']] },
  confessional: { fp: [2, 1], shapes: [[0, .1, 0, 2, .9, 70, 'darkwood'], [-.03, .05, 70, 2.03, .95, 75, 'oak'], [.2, .2, 75, 1.8, .8, 80, 'darkwood'], C(1, .5, .07, 80, 88, 'gold', .02),
    [.75, .9, 0, 1.25, .94, 70, 'oak'], [.1, .9, 6, .7, .93, 62, 'red'], [1.3, .9, 6, 1.9, .93, 62, 'red'], [.88, .9, 36, 1.12, .95, 50, 'iron']] },
  bookshelf: { fp: [2, 1], shapes: [[0, 0, 0, 2, .5, 80, 'books'], [-.03, -.02, 80, 2.03, .56, 85, 'oak'], [0, 0, 0, .07, .55, 80, 'darkwood'], [1.93, 0, 0, 2, .55, 80, 'darkwood'], [0, 0, 0, 2, .55, 3, 'darkwood']] },
  wardrobe: { fp: [2, 1], shapes: [[0, .05, 0, 2, .6, 66, 'darkwood'], [-.03, 0, 66, 2.03, .66, 71, 'oak'], [0, .03, 0, 2, .62, 4, 'oak'],
    [.08, .6, 8, .94, .62, 60, 'oak'], [1.06, .6, 8, 1.92, .62, 60, 'oak'], [.16, .62, 14, .86, .63, 54, 'darkwood'], [1.14, .62, 14, 1.84, .63, 54, 'darkwood'],
    C(.88, .64, .03, 34, 38, 'brass'), C(1.12, .64, .03, 34, 38, 'brass')] },
  chest: { fp: [1, 1], shapes: [[.1, .2, 0, .9, .8, 13, 'leather'], [.08, .18, 13, .92, .82, 18, 'darkwood'], [.1, .2, 5, .9, .82, 7, 'iron'], [.22, .19, 0, .3, .83, 18, 'iron'], [.7, .19, 0, .78, .83, 18, 'iron'], [.45, .82, 7, .55, .85, 13, 'brass']] },
  reliquary: { fp: [1, 1], shapes: [[.2, .2, 0, .8, .8, 24, 'stone'], [.16, .16, 24, .84, .84, 27, 'pale'], [.26, .3, 27, .74, .7, 40, 'gold'], [.22, .26, 40, .78, .74, 43, 'gold'], C(.5, .5, .05, 43, 52, 'gold', .01)] },
  bed: { fp: [1, 2], shapes: [[.1, .1, 0, .9, 1.9, 12, 'darkwood'], [.15, .15, 12, .85, 1.85, 16, 'straw'], [.15, .5, 16, .85, 1.85, 18, 'blanket'], [.2, .18, 16, .8, .48, 21, 'linen'], [.1, .05, 0, .9, .15, 30, 'darkwood']] },
  // Kitchen and stores.
  hearth: { fp: [3, 1], shapes: [[0, 0, 0, 3, .6, 70, 'stone'], [.4, .55, 0, 2.6, .62, 40, 'soot'], [.6, .4, 2, 2.4, .62, 12, 'fire'], [-.05, -.05, 40, 3.05, .7, 46, 'stone'], [1.3, .52, 14, 1.7, .64, 26, 'iron']],
    lights: [[1.5, .9, 16, [255, 130, 40], 110]] },
  barrel: { fp: [1, 1], shapes: [C(.5, .5, .3, 0, 3, 'oak', .33), C(.5, .5, .34, 3, 21, 'oak'), C(.5, .5, .33, 21, 24, 'oak', .3), C(.5, .5, .35, 4, 6, 'iron'), C(.5, .5, .35, 18, 20, 'iron'), C(.5, .5, .27, 24, 25, 'darkwood')] },
  sacks: { fp: [1, 1], shapes: [C(.33, .42, .2, 0, 11, 'sack', .16), C(.66, .55, .22, 0, 13, 'sack', .17), C(.46, .56, .18, 11, 19, 'sack', .12), C(.66, .55, .08, 13, 16, 'sack', .04)] },
  crate: { fp: [1, 1], shapes: [[.12, .12, 0, .88, .88, 22, 'oak'], [.1, .1, 20, .9, .9, 23, 'darkwood'], [.1, .1, 0, .9, .9, 2, 'darkwood'], [.11, .87, 2, .89, .9, 20, 'darkwood'], [.87, .11, 2, .9, .89, 20, 'darkwood']] },
  // Stone things: a side altar, a tomb, the baptismal font, a pedestal for a statue.
  sidealtar: { fp: [2, 1], shapes: [[.15, .2, 0, 1.85, .8, 3, 'stone'], [.2, .25, 3, 1.8, .75, 23, 'stone'], [.1, .15, 23, 1.9, .85, 27, 'marble'], [.12, .17, 27, 1.88, .83, 28, 'linen'],
    [.3, .75, 5, 1.7, .8, 22, 'purple'], [.3, .75, 20, 1.7, .81, 22, 'gold'], C(1, .35, .04, 28, 52, 'gold'), [.84, .3, 44, 1.16, .4, 46, 'gold'],
    ...stem(.35, .4, 28, 34, .025, 'brass'), ...candle(.35, .4, 34, 8), ...stem(1.65, .4, 28, 34, .025, 'brass'), ...candle(1.65, .4, 34, 8)],
    lights: [[1, .5, 42, [255, 160, 70], 50]] },
  tomb: { fp: [2, 1], shapes: [[.1, .15, 0, 1.9, .85, 4, 'stone'], [.15, .2, 4, 1.85, .8, 19, 'stone'], [.05, .1, 19, 1.95, .9, 24, 'pale'], [.4, .35, 24, 1.6, .65, 28, 'pale'], [.25, .38, 24, .45, .62, 31, 'pale']] },
  font: { fp: [2, 2], shapes: [C(1, 1, .3, 0, 3, 'stone', .26), C(1, 1, .18, 3, 14, 'pale', .22), C(1, 1, .7, 14, 26, 'pale', .76), C(1, 1, .62, 25, 26.5, 'water')] },
  pedestal: { fp: [1, 1], shapes: [[.15, .15, 0, .85, .85, 4, 'stone'], [.22, .22, 4, .78, .78, 24, 'pale'], [.15, .15, 24, .85, .85, 28, 'stone']], statue: 28 },
  // The garden: a cypress, a bush, a stone bench, a low wall.
  cypress: { fp: [1, 1], shapes: [C(.5, .5, .06, 0, 10, 'bark'), C(.5, .5, .3, 10, 42, 'leaf', .34), C(.5, .5, .34, 42, 74, 'leaf', .24), C(.5, .5, .24, 74, 98, 'leaf', .04)] },
  bush: { fp: [1, 1], shapes: [C(.45, .5, .32, 0, 12, 'leaf', .3), C(.58, .45, .22, 8, 18, 'leaf', .1), C(.36, .58, .18, 6, 15, 'leaf', .08)] },
  parapet: { fp: [1, 1], shapes: [[0, .3, 0, 1, .7, 3, 'stone'], ...[.25, .75].map(x => C(x, .5, .09, 3, 13, 'pale', .07)), [0, .25, 13, 1, .75, 17, 'pale']] },
  stonebench: { fp: [2, 1], shapes: [[.2, .3, 0, .4, .7, 9, 'stone'], [1.6, .3, 0, 1.8, .7, 9, 'stone'], [.1, .25, 9, 1.9, .75, 12, 'pale']] },
  vase: { fp: [1, 1], shapes: [C(.5, .5, .1, 0, 3, 'bronze', .14), C(.5, .5, .15, 3, 12, 'bronze', .1), C(.5, .5, .12, 12, 14, 'bronze', .16), C(.5, .5, .2, 14, 24, 'leaf', .14), C(.45, .45, .05, 24, 29, 'linen', .03)] },
  grate: { fp: [2, 2], shapes: [[.1, .1, 0, 1.9, 1.9, 2, 'iron'], ...rows(6, i => [[.2 + i * .28, .1, 2, .28 + i * .28, 1.9, 4, 'iron']])] },
  // Outside: an iron lamppost, a banner on a pole, an iron railing, the courtyard's fountain.
  lamppost: { fp: [1, 1], shapes: [C(.5, .5, .16, 0, 5, 'stone', .12), C(.5, .5, .045, 5, 70, 'iron'), C(.5, .5, .09, 30, 33, 'iron'),
    C(.5, .5, .15, 70, 72, 'iron', .12), C(.5, .5, .12, 72, 84, 'lantern', .14), C(.5, .5, .17, 84, 87, 'iron', .1), C(.5, .5, .06, 87, 92, 'iron', .01)],
    lights: [[.5, .5, 80, [255, 182, 104], 96]] },
  bannerpole: { fp: [1, 1], shapes: [C(.5, .5, .14, 0, 4, 'stone'), C(.5, .5, .04, 4, 96, 'iron'), [.12, .45, 88, .88, .55, 90, 'iron'],
    [.15, .47, 50, .85, .53, 88, 'bannerpurple'], C(.5, .5, .06, 96, 102, 'gold', .01)] },
  railing: { fp: [1, 1], shapes: [[0, .46, 3, 1, .54, 5, 'iron'], [0, .46, 25, 1, .54, 27, 'iron'],
    ...[.1, .3, .5, .7, .9].flatMap(x => [C(x, .5, .03, 0, 30, 'iron'), C(x, .5, .045, 30, 35, 'iron', .005)])] },
  fountain: { fp: [3, 3], shapes: [
    C(1.5, 1.5, 1.38, 0, 3, 'stone'), C(1.5, 1.5, 1.32, 3, 12, 'stone'), C(1.5, 1.5, 1.4, 12, 15, 'pale'), C(1.5, 1.5, 1.16, 14.5, 15.5, 'water'),
    C(1.5, 1.5, .2, 15, 32, 'pale', .14), C(1.5, 1.5, .6, 32, 35, 'pale', .68), C(1.5, 1.5, .52, 34.5, 35.5, 'water'),
    C(1.5, 1.5, .1, 35, 44, 'pale', .07), C(1.5, 1.5, .18, 44, 47, 'pale', .2), C(1.5, 1.5, .07, 47, 52, 'pale', .01)] },
  // In the library: a rug on the boards, a globe on its stand.
  rug: { fp: [3, 2], solid: false, shapes: [[.05, .05, 0, 2.95, 1.95, .8, 'rug']] },
  globe: { fp: [1, 1], shapes: [C(.5, .5, .16, 0, 3, 'darkwood', .1), C(.5, .5, .03, 3, 16, 'darkwood'), C(.5, .5, .16, 16, 20, 'globe', .26), C(.5, .5, .27, 20, 28, 'globe'), C(.5, .5, .26, 28, 32, 'globe', .12), [.2, .47, 23, .8, .53, 25, 'brass']] },
  stairs: { fp: [3, 3], shapes: rows(10, i => { const a = i / 10 * Math.PI * 2; const x = 1.5 + Math.cos(a) * .8, y = 1.5 + Math.sin(a) * .8; return [[x - .45, y - .45, 0, x + .45, y + .45, 6 + i * 9, 'stone']]; }).concat([C(1.5, 1.5, .22, 0, 100, 'stone')]) },
};

// ---------------------------------------------------------------- turning
export function footprint(type, rot) { const [w, h] = PROPS[type].fp; return rot & 1 ? [h, w] : [w, h]; }
function turned(type, rot) {
  const P = PROPS[type], [w, h] = P.fp;
  const tf = ([x, y]) => rot === 0 ? [x, y] : rot === 1 ? [h - y, x] : rot === 2 ? [w - x, h - y] : [y, w - x];
  const shapes = P.shapes.map(s => {
    if (s[0] === 'C') { const [cx, cy] = tf([s[1], s[2]]); return ['C', cx, cy, s[3], s[4] * ZS, s[5] * ZS, s[6], s[7]]; }
    const [x0, y0, z0, x1, y1, z1, m] = s, a = tf([x0, y0]), b = tf([x1, y1]);
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), z0 * ZS, Math.max(a[0], b[0]), Math.max(a[1], b[1]), z1 * ZS, m];
  });
  const lights = (P.lights || []).map(([x, y, z, col, r]) => { const [a, b] = tf([x, y]); return [a, b, z * ZS, col, r]; });
  return { shapes, lights };
}
export const propLights = (type, rot) => turned(type, rot).lights;
// Where its flames are ([x, y, z] in its footprint, z in pixels), for the glow drawn round each.
export const propFlames = (type, rot) => turned(type, rot).shapes.filter(s => s[s[0] === 'C' ? 6 : 6] === 'flame').map(s => s[0] === 'C' ? [s[1], s[2], s[5]] : [(s[0] + s[3]) / 2, (s[1] + s[4]) / 2, s[5]]);
const zTop = s => s[0] === 'C' ? s[5] : s[5];
export const propHeight = type => Math.ceil(Math.max(...PROPS[type].shapes.map(zTop)) * ZS) + (PROPS[type].statue ? 66 : 0);

// ---------------------------------------------------------------- the renderer
// Pixel (px, py) of a cell sprite whose ground diamond's top corner is at (20, top): ground point (u, v) lands on
// (20 + 20(u − v), top + GY(u + v)); a point z pixels up, z pixels higher. Along a pixel's ray u and v grow with z
// (S pixels of height per cell). Shapes are in the cell's own coordinates; only what lies inside the cell's column
// (0 ≤ u, v < 1) counts. Returns the hits, nearest first: [shape, face, u, v, z, nx, ny].
const S = 2 * GY;
function hits(shapes, px, py, top, all) {
  const A = (px + .5 - 20) / 20, B = (py + .5 - top) / GY, u0 = (A + B) / 2, v0 = (B - A) / 2;
  const cLo = all ? -1e9 : Math.max(-S * u0, -S * v0), cHi = all ? 1e9 : Math.min(S * (1 - u0), S * (1 - v0));
  const out = [];
  for (const s of shapes) {
    let lo, hi, f, nx = 0, ny = 0;
    if (s[0] === 'C') {
      const [, cx, cy, r0_, z0, z1, m_, r1_] = s, thin = m_ === 'flame' ? 0 : .06, r0 = Math.max(thin, r0_), r1 = Math.max(thin * .5, r1_), k = (r1 - r0) / ((z1 - z0) || 1), c0 = r0 - k * z0, a = u0 - cx, b = v0 - cy;
      const qa = 2 / (S * S) - k * k, qb = 2 * (a + b) / S - 2 * c0 * k, qc = a * a + b * b - c0 * c0;
      if (qa <= 0) continue;
      const disc = qb * qb - 4 * qa * qc; if (disc < 0) continue;
      const sq = Math.sqrt(disc), za = (-qb - sq) / (2 * qa), zb = (-qb + sq) / (2 * qa);
      lo = Math.max(z0, za, cLo); hi = Math.min(z1, zb, cHi); if (lo > hi) continue;
      if (hi === z1 && z1 < zb) f = 'T'; else if (hi === cHi && cHi < zb && cHi < z1) f = 'X';
      else { f = 'C'; const u = u0 + hi / S - cx, v = v0 + hi / S - cy, l = Math.hypot(u, v) || 1; nx = u / l; ny = v / l; }
    } else {
      const [x0, y0, z0, x1, y1, z1] = s, ux = S * (x1 - u0), vy = S * (y1 - v0);
      lo = Math.max(z0, S * (x0 - u0), S * (y0 - v0), cLo); hi = Math.min(z1, ux, vy, cHi);
      if (lo > hi) continue;
      f = hi === z1 ? 'T' : hi === ux ? 'R' : hi === vy ? 'L' : 'X';
    }
    out.push([s, f, u0 + hi / S, v0 + hi / S, hi, nx, ny]);
  }
  return out.sort((p, q) => q[4] - p[4]);
}
// The light a face gets: the top most, the south face less, the east face least; a round side by its normal, with a
// rim of light on its left (where the light comes from) and a dark core on its right.
function faceLight(f, nx, ny) {
  if (f === 'T') return 1.06;
  if (f === 'L') return .8; if (f === 'R' || f === 'X') return .56;
  const d = (ny - nx) * Math.SQRT1_2;                                   // 1 facing the light, −1 away from it
  return .66 + .26 * d + (d > .86 ? .12 : 0);
}
// Renders shapes into a 40 × (DH + H − lo) sprite. opt.color(hit, x, y) → [r, g, b] | null (skip this shape here,
// look further) | undefined (paint it the usual way). opt.open: under the sky (nothing thins into the dark above).
// opt.outline: neighbours' shapes too, so the outline is drawn only against the air (not along cut cell edges).
export function renderShapes(shapes, H, opt = {}) {
  const lo = Math.min(0, opt.lo ?? 0), Hc = DH + H - lo;
  const c = document.createElement('canvas'); c.width = 40; c.height = Hc; const g = c.getContext('2d'), im = g.createImageData(40, Hc), d = im.data;
  const mats = new Uint16Array(40 * Hc), matIdx = [];
  for (let y = 0; y < Hc; y++) for (let x = 0; x < 40; x++) {
    const hs = hits(shapes, x, y, H); let col = null, mat = null, alpha = 1;
    for (const h of hs) {
      const [s, f, u, v, z, nx, ny] = h, m = s[6], M = MAT[m] || MAT.stone;
      if (opt.color) { const o = opt.color(h, x, y); if (o === null) continue; if (o) { col = o; mat = M; break; } }
      if (M.emit) { col = M.emit(f, (f === 'R' ? v : u) * 20, f === 'T' ? v * 20 : s[5] - z, opt.seed || 0); mat = M; break; }
      const U = (f === 'R' || (f === 'C' && nx > ny)) ? v * 20 : u * 20, V = f === 'T' ? v * 20 : (s[0] === 'C' ? s[5] : s[5]) - z;
      let t = M.tex ? M.tex(f, U, V, opt.seed || 0) : 1, L = faceLight(f, nx, ny);
      if (f !== 'T' && z - (s[0] === 'C' ? s[4] : s[2]) < 2 && (s[0] === 'C' ? s[4] : s[2]) <= .5) L *= .72;   // contact shadow at the floor
      if (f === 'T' && s[0] !== 'C' && (u - s[0] < .05 || v - s[1] < .05)) L *= 1.1;              // a lit edge
      if (M.metal && L > .9) L += .22 * M.metal;
      if (t && t.c) col = mix(t.c, [26, 14, 40], Math.max(0, .9 - L) * .7);
      else col = shade(M.r, L * t, x, y);
      if (!opt.open) alpha = thinUp(z);
      mat = M; break;
    }
    if (!col || alpha < .03) continue;
    const o = (y * 40 + x) * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255 * alpha;
    let mi = matIdx.indexOf(mat); if (mi < 0) { matIdx.push(mat); mi = matIdx.length - 1; } mats[y * 40 + x] = mi + 1;
  }
  // The outline: where it meets the air, the material's darkest colour.
  if (opt.outline !== false) {
    const near = opt.outline || shapes, edge = [];
    for (let y = 0; y < Hc; y++) for (let x = 0; x < 40; x++) {
      const k = y * 40 + x; if (!mats[k] || d[k * 4 + 3] < 200) continue;
      const M = matIdx[mats[k] - 1]; if (!M.r) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < 40 && yy < Hc && mats[yy * 40 + xx]) continue;
        if (!hits(near, xx, yy, H, true).length) { edge.push([k, M.r[0]]); break; }
      }
    }
    for (const [k, col] of edge) { d[k * 4] = col[0]; d[k * 4 + 1] = col[1]; d[k * 4 + 2] = col[2]; }
  }
  g.putImageData(im, 0, 0);
  return c;
}

// ---------------------------------------------------------------- one cell of a prop
// ci, cj: which cell of the prop; seed: a little variety. Returns { canvas, h } (h: pixels above the ground).
export function propCell(type, rot, ci, cj, seed, statue, open = false) {
  const { shapes } = turned(type, rot), H = propHeight(type);
  const local = shapes.map(s => s[0] === 'C' ? ['C', s[1] - ci, s[2] - cj, ...s.slice(3)] : [s[0] - ci, s[1] - cj, s[2], s[3] - ci, s[4] - cj, s[5], s[6]]);
  const c = renderShapes(local, H, { open, seed, outline: local });
  if (statue && PROPS[type].statue) c.getContext('2d').drawImage(statue, 0, 0, statue.width, statue.height, Math.round(20 - statue.width / 2), Math.round(H - PROPS[type].statue * ZS + GY - 1 - statue.height + 2), statue.width, statue.height);
  return { canvas: c, h: H };
}
