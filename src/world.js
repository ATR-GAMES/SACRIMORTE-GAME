// The world the priest walks in. A grid of cells (src/cathedral.js), each a 40×20 diamond on screen:
// - the floor, painted pixel by pixel from the world position under it, into cached 256-pixel chunks;
// - the blood, in chunks of its own over the floor, so it stays wherever it falls;
// - walls, all of them tall: ashlar with pilasters, banners, candles in brackets, stained-glass windows, the great
//   window behind the altar, arched doorways to walk through. The walls in front of the room the priest is in turn
//   see-through while he is in it; anything else tall in front of him opens a hole around him;
// - furniture (src/props.js) and the piers, sorted with the characters;
// - the dark: a light map multiplied over everything (moonlight through the glass, candles, chandeliers, fire, the
//   priest's own small light);
// - collision: circles against the solid cells.
// Screen space here is the map's own (no camera): corner (i, j) of a cell sits at (20(i−j), GY(i+j)) — see src/view.js.
// Interior walls in front of the room the priest is in are cut down to a stub, the way Diablo shows a room.
import { CELL, F, B, OUTDOOR } from './cathedral.js?v=7fc74c5';
import { PROPS, propCell, propLights, propFlames } from './props.js?v=7fc74c5';
import { GY, DH, V, ZS, STEP_PX, toScreen, fadeUp, thinUp } from './view.js?v=7fc74c5';

const CS = 256;
const hash = (a, b, c = 0) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1440662683); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const clamp8 = v => v < 0 ? 0 : v > 255 ? 255 : v | 0;
const frac = v => v - Math.floor(v);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
const toScr = toScreen;
// Smooth noise in 0..1, for grime and wear.
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }

// ---------------------------------------------------------------- the floor
// Clean, square-cut stone laid on the grid: each kind its own pattern, a bevel catching the light from the upper left,
// a darker joint, a little difference from stone to stone; nothing noisy.
const set = (o, c, k = 1) => { o[0] = c[0] * k; o[1] = c[1] * k; o[2] = c[2] * k; };
function slabAt(fx, fy, sw, sh, o, base, salt, inlay) {
  const a = Math.floor(fx / sw), b = Math.floor(fy / sh), du = fx - a * sw, dv = fy - b * sh;
  let k = .88 + hash(a, b, salt) * .16;
  if (du < .045 || dv < .045) { set(o, base, .52); return; }
  if (du < .1 || dv < .1) k *= 1.1; else if (sw - du < .08 || sh - dv < .08) k *= .86;
  if (inlay) {                                                                         // a small dark diamond where four slabs meet
    const cu = Math.min(du, sw - du), cv = Math.min(dv, sh - dv);
    if (cu + cv < .32) { set(o, inlay, cu + cv < .06 ? .7 : 1); return; }
  }
  if (hash(a, b, salt + 9) < .12) {                                                    // a crack, now and then
    const t = hash(a, b, 3) * Math.PI, d = Math.abs((du - sw / 2) * Math.sin(t) - (dv - sh / 2) * Math.cos(t));
    if (d < .02 && Math.abs(du - sw / 2) < sw * .35) k *= .62;
  }
  set(o, base, k);
}
function floorColor(M, t, i, j, u, v, X, Y, o) {
  const fx = i + u, fy = j + v, e = Math.min(u, v, 1 - u, 1 - v), cv = hash(i, j, 7);
  if (M.block[j * M.W + i] === B.ARCH) {                                            // the threshold of a doorway: one worn pale stone
    set(o, [134, 126, 120], .9 + hash(i, j, 3) * .1 - Math.max(0, .5 - Math.abs(u - .5) - Math.abs(v - .5)) * .12);
    if (e < .05) set(o, [62, 56, 58]); else if (e < .1) set(o, [150, 142, 136]);
    o[0] = clamp8(o[0]); o[1] = clamp8(o[1]); o[2] = clamp8(o[2]); return;
  }
  switch (t) {
    case F.STONE: slabAt(fx, fy, 2, 2, o, [104, 94, 108], 1, [52, 44, 58]); break;
    case F.CHECKER: {                                                                // great squares of black and white marble, worn and grimy
      const a = Math.floor(fx / 2), b = Math.floor(fy / 2), du = fx - a * 2, dv = fy - b * 2, white = (a + b) & 1;
      let c = white ? [178, 168, 180] : [40, 34, 48], k = .9 + hash(a, b, 13) * .12;
      const w = Math.sin(fx * 2.3 + fy * 4.1 + hash(a, b) * 9) + Math.sin(fx * 5.2 - fy * 1.7);
      if (hash(a, b, 21) < .35 && Math.abs(w + (vnoise(fx * 3, fy * 3, 2) - .5) * 1.4) < .06) c = white ? [146, 136, 150] : [66, 56, 76];   // veins, in some slabs
      if (hash(Math.floor(fx * 9), Math.floor(fy * 9), 6) < .012) c = c.map(v => v * .8);                                  // chips and scratches
      if (du < .04 || dv < .04) { c = white ? [96, 86, 100] : [24, 20, 30]; k = 1; }
      else if (du < .09 || dv < .09) k *= 1.08; else if (2 - du < .07 || 2 - dv < .07) k *= .88;
      k *= .82 + vnoise(fx * .7, fy * .7, 5) * .26;                                   // grime in wide patches
      set(o, c, k); break;
    }
    case F.AISLE: {
      if (M.vari[j * M.W + i] < 2) {                                                   // a burial slab
        const eng = (e < .12 && e > .08) || (Math.abs(u - .5) < .04 && v > .22 && v < .8) || (Math.abs(v - .37) < .04 && u > .3 && u < .7);
        set(o, eng ? [72, 66, 70] : [132, 124, 120], .94 + cv * .1); if (e < .045) set(o, [52, 48, 52]);
      } else slabAt(fx, fy, 1, 2, o, [92, 84, 98], 2);
      break;
    }
    case F.STEP: slabAt(fx, fy, 2, 1, o, [106, 96, 112], 5); break;
    case F.CHAPEL: {
      const a = Math.floor(fx * 2), c = Math.floor(fy * 2), ue = frac(fx * 2), ve = frac(fy * 2);
      set(o, (a + c) & 1 ? [116, 60, 48] : [146, 120, 86], .9 + hash(a, c) * .12);
      if (Math.min(ue, ve) < .07) set(o, [60, 46, 42]);
      break;
    }
    case F.CARPET: {
      const up = M.floor[j * M.W + i - 1] !== F.CARPET, dn = M.floor[j * M.W + i + 1] !== F.CARPET;   // the runner goes north–south
      let c = [104, 18, 26];
      const pv = frac(fy * 1.2), pu = frac(fx), dd = Math.abs(pu - .5) * 1.4 + Math.abs(pv - .5);
      if (dd < .3 && dd > .22) c = [140, 104, 50]; else if (dd < .1) c = [76, 12, 18];
      if ((up && u < .18) || (dn && u > .82)) c = [160, 120, 54];
      if ((up && u < .12 && u > .08) || (dn && u > .88 && u < .92)) c = [80, 14, 18];
      if ((up && u < .04) || (dn && u > .96)) c = [56, 10, 14];
      set(o, c);
      break;
    }
    case F.MARBLE: {
      const black = (i + j) & 1, w = Math.sin((u * 3.1 + v * 5.7 + cv * 9) * 3) + Math.sin((u * 7 - v * 2.3) * 2.2 + cv * 5);
      let c = black ? [38, 32, 46] : [180, 170, 182];
      if (Math.abs(w) < .1) c = black ? [72, 66, 80] : [150, 144, 140];
      if (e < .03) c = black ? [26, 24, 30] : [120, 114, 112]; else if (u < .07 || v < .07) c = c.map(x => x * 1.07);
      set(o, c);
      break;
    }
    case F.MOSAIC: {
      const x = fx - M.crossing[0], y = fy - M.crossing[1], d = Math.hypot(x, y), a = Math.atan2(y, x);
      if (d > 7.7) { slabAt(fx, fy, 2, 2, o, [104, 94, 108], 1, [52, 44, 58]); break; }
      const ring = Math.floor(d * 1.25), star = d < 3.2 + 1.6 * Math.abs(Math.cos(a * 4)) && d > 1.3;
      const pal = [[120, 32, 32], [150, 120, 64], [40, 50, 84], [94, 86, 82]];
      let c = d < 1.3 ? [176, 146, 82] : star ? [150, 120, 64] : pal[ring % 4];
      if (Math.abs(d - Math.round(d * 1.25) / 1.25) < .03) c = [52, 46, 50];
      set(o, c, .93 + hash(Math.floor(fx * 6), Math.floor(fy * 6)) * .1);
      break;
    }
    case F.WOOD: {
      const p = Math.floor(fy * 4), L = 2.5, off = hash(p, 3) * L, q = Math.floor((fx + off) / L), end = (fx + off) - q * L < .04, seam = frac(fy * 4) < .1;
      set(o, [100, 64, 42], .82 + hash(q, p, 6) * .2 + Math.sin(fx * 21 + p * 3.7) * .03);
      if (seam || end) set(o, [50, 32, 24]);
      break;
    }
    case F.GRASS: {
      const n = hash(X >> 1, Y, 2); set(o, n < .03 ? [64, 86, 50] : n > .97 ? [24, 34, 24] : [40, 56, 36], .86 + vnoise(fx * 1.2, fy * 1.2, 9) * .22);   // grass: tufts, darker patches
      if (hash(X >> 1, Y >> 1, 13) < .0015) set(o, [150, 140, 164]);
      break;
    }
    case F.GRAVEL: { const n = hash(X, Y); set(o, n < .3 ? [120, 112, 100] : n > .8 ? [70, 64, 58] : [96, 90, 82]); break; }
    case F.TILE: {
      const a = Math.floor(fx * 2), c = Math.floor(fy * 2), ue = frac(fx * 2), ve = frac(fy * 2);
      set(o, [124, 72, 50], .86 + hash(a, c, 3) * .18 * (ue < .14 || ve < .14 ? 1.1 : 1));
      if (Math.min(ue, ve) < .07) set(o, [66, 48, 42]);
      break;
    }
    case F.DIRT: { const n = hash(X, Y), a = Math.floor(fx * 3), b = Math.floor(fy * 3); set(o, (a + b) % 3 ? [82, 74, 84] : [70, 62, 72], .84 + n * .1 + hash(a, b, 8) * .14);   // the street's cobbles
      if (frac(fx * 3) < .1 || frac(fy * 3) < .1) set(o, [44, 38, 46]); break; }
    case F.PLAZA: {                                                                  // great flags out under the sky, moss in the joints
      slabAt(fx, fy, 2, 2, o, [100, 92, 108], 7);
      const a = fx / 2, b = fy / 2, ju = Math.min(frac(a), 1 - frac(a)) * 2, jv = Math.min(frac(b), 1 - frac(b)) * 2;
      if (Math.min(ju, jv) < .07 && vnoise(fx * 1.5, fy * 1.5, 3) > .45) set(o, [44, 60, 40]);
      break; }
    default: set(o, [20, 18, 20]);
  }
  // Shade where the floor meets a wall or a pier.
  const W = M.W, tall = (ii, jj) => { const b = M.block[jj * W + ii]; return b === B.WALL || b === B.DOOR || b === B.GREAT || b === B.COLUMN || b === B.LOW; };
  let ao = 1; const r = .34;
  if (u < r && tall(i - 1, j)) ao = Math.min(ao, .58 + .42 * u / r);
  if (v < r && tall(i, j - 1)) ao = Math.min(ao, .58 + .42 * v / r);
  if (1 - u < r && tall(i + 1, j)) ao = Math.min(ao, .7 + .3 * (1 - u) / r);
  if (1 - v < r && tall(i, j + 1)) ao = Math.min(ao, .7 + .3 * (1 - v) / r);
  const LV = M.level; if (LV) { const me = LV[j * W + i];
    if (v < .3 && LV[(j - 1) * W + i] > me) ao = Math.min(ao, .62 + .38 * v / .3); if (u < .3 && LV[j * W + i - 1] > me) ao = Math.min(ao, .62 + .38 * u / .3); }
  const k = ao * (.98 + hash(X, Y, 1) * .04);
  o[0] = clamp8(o[0] * k); o[1] = clamp8(o[1] * k); o[2] = clamp8(o[2] * k);
}

// ---------------------------------------------------------------- walls
// feat: 1 window, 2 candle in a bracket, 3 pilaster, 4 banner, 5 crucifix. A cell paints one face (1 L, 2 R) into a room.
const WALL_H = Math.round(132 * ZS), GREAT_H = Math.round(176 * ZS), CUT_H = 13, WALL_EXT = Math.round(150 * ZS), LOW_H = 15;
// Walls seen from outside rise against the night: they sink into the dark only far higher up.
const fadeExt = (col, z) => { if (z <= 104) return col; const t = Math.min(1, (z - 104) / 90), e = t * t * (3 - 2 * t); return [col[0] + (14 - col[0]) * e, col[1] + (11 - col[1]) * e, col[2] + (18 - col[2]) * e]; };
// The coloured light the windows threw on the floor: off (the windows still glow).
const COLOURED_RAYS = false;
const GLASS = [[64, 96, 190], [180, 40, 44], [214, 170, 70], [60, 140, 90], [130, 70, 170]];
const LIT = { T: 1, L: .84, R: .62 };
function ashlar(c, r, i, j, h) {
  if (r < 6) return r === 5 ? [40, 32, 46] : r === 0 ? [152, 140, 156] : [120, 108, 126];     // cornice and its shadow
  if (r >= h - 10) return r === h - 10 ? [138, 126, 142] : (c % 10 === 0 ? [44, 36, 50] : [78, 68, 86]);  // plinth
  if (r === Math.floor(h * .45) || r === Math.floor(h * .45) + 1) return r === Math.floor(h * .45) ? [142, 130, 148] : [48, 40, 54];   // string course
  const bh = 8, rr = r - 6, row = Math.floor(rr / bh), sh = (row & 1) * 5, col = Math.floor((c + sh) / 10), y = rr % bh, x = (c + sh) % 10;
  if (y === 0 || x === 0) return [46, 38, 52];
  let k = .82 + hash(i * 4 + col, j * 3 + row, 5) * .22;
  if (y === 1) k *= 1.12; else if (y === bh - 1) k *= .85; if (x === 1) k *= 1.05;
  return [104 * k, 92 * k, 112 * k];
}
// A window two cells wide (gx 0..39 across both, r in the 132-row frame): a pointed arch in a deep stone frame, two
// lancets under a rose, leaded glass in violets, reds, blues and gold.
const WGLASS = [[118, 56, 168], [156, 70, 172], [92, 48, 150], [196, 64, 86], [220, 164, 72], [66, 82, 176]];
function archHW(r, hw, spring) { if (r >= spring) return hw; const Rr = hw * 1.6, c = Rr - hw, dy = spring - r; return Math.sqrt(Math.max(0, Rr * Rr - dy * dy)) - c; }
function windowPx(gx, r, i, j) {
  const x = gx + .5 - 20, ax = Math.abs(x), bot = 104, hwo = archHW(r, 17, 46);
  if (r > bot + 3 || hwo <= 0 || ax >= hwo) return null;
  if (r > bot) return ax < 18 ? (r === bot + 1 ? [168, 156, 172] : [96, 84, 104]) : null;   // the sill
  if (ax >= hwo - 2.5) return x < 0 ? [158, 146, 164] : [118, 106, 126];                     // the moulded frame
  if (ax >= hwo - 4.5) return x < 0 ? [132, 120, 140] : [44, 34, 52];                        // its deep reveal, lit on one side
  const glass = col => { const g = col.slice(); g.glow = 1; return g; };
  const rose = Math.hypot(x, r - 32);
  if (r < 46 && rose < 9) {                                                                    // the rose
    if (rose > 8 || rose < 1.6 || Math.abs(Math.sin(Math.atan2(r - 32, x) * 4)) < .16) return [118, 106, 126];
    return glass(WGLASS[(Math.floor(rose / 3) + Math.floor((Math.atan2(r - 32, x) + 4) * 1.3)) % 6]);
  }
  const lx = Math.abs(ax - 6.2), lhw = archHW(r, 5, 58);                                      // the two lancets
  if (lhw <= 0 || lx >= lhw || ax < 1.2) return r < 46 && rose < 11 ? [100, 88, 108] : [118, 106, 126];   // tracery between them
  if ((r - 50) % 7 === 0 || (gx + Math.floor(r / 7) * 2) % 5 === 0) return [34, 26, 40];      // lead
  return glass(WGLASS[Math.floor(hash(Math.floor(gx / 5) + i * 3 + j * 7, Math.floor(r / 7), 9) * 6)]);
}
function wallPaint(face, c, r0, h0, i, j, wface, feat, part = 0) {
  const facing = (face === 'L' ? 1 : 2) === wface;
  if (h0 < 40) return ashlar(c, r0, i, j, h0);                                       // a wall cut down: just stone
  const r = Math.floor(r0 * 132 / h0), h = 132;                                     // features are laid out for a 132-row wall
  if (facing && feat === 1 && r > 6 && r < h - 10) { const w = windowPx(part * 20 + c, r, i, j); if (w) return w; }   // a two-cell window
  if (facing && feat === 4 && r >= 18 && r < 78 && c >= 4 && c < 16) {                 // a hanging banner
    const tip = r > 68 && Math.abs(c - 9.5) > (78 - r) * .6;
    if (!tip) {
      if (r < 20) return r === 18 ? [220, 176, 80] : [150, 116, 52];                          // the rod it hangs from
      if ((Math.abs(c - 9.5) < 1 && r > 28 && r < 58) || (Math.abs(r - 38) < 1 && c > 6 && c < 13)) return [214, 170, 70];   // the gold cross
      if (r > 20 && r < 23 || (r > 64 && r < 66)) return [176, 138, 60];                     // gold bands
      return (c === 4 || c === 15) ? [64, 10, 18] : [118, 18, 28].map(v => v * (.9 + .1 * Math.sin(c * .9)));
    }
  }
  if (facing && feat === 5 && r >= 40 && r < 60 && Math.abs(c - 9.5) < 4) {            // a small wooden crucifix
    if (Math.abs(c - 9.5) < 1 || (r >= 45 && r < 47)) return [92, 60, 40];
  }
  if (facing && feat === 3 && r0 >= 6) {                                              // a pilaster, from the floor up into the dark
    const base = r0 >= h0 - 12, w0 = base ? 3 : 5, w1 = base ? 17 : 15;              // its base is wider, and sits on the floor
    if (c >= w0 && c < w1) {
      const t = (c - w0) / (w1 - w0); let k = 1.16 - t * .55; if (c === w0) k = 1.28; if (c === w1 - 1) k = .5;
      if (base && (r0 === h0 - 12 || r0 === h0 - 6)) k *= 1.2; if (base && r0 === h0 - 11) k *= .7;
      if (!base && r % 44 < 2) k *= .82;
      return [116 * k, 104 * k, 124 * k];
    }
  }
  return ashlar(c, r0, i, j, h0);
}
// The great window behind the altar: one tall pointed arch across the wall, three lancets and a rose.
function greatGlass(gx, r0, h0, n) {
  const r = Math.floor(r0 * 132 / h0), h = 132, Wd = n * 20, cx = Wd / 2, top = 10, bot = h - 18, x = gx - cx, span = Wd / 2 - 16;
  const hw = r < top + 70 ? span * Math.sqrt(Math.max(0, 1 - Math.pow((top + 70 - r) / 70, 2))) - (top + 70 - r) * .4 : span;
  if (r < top || r > bot || Math.abs(x) > hw + 3) return null;
  if (Math.abs(x) > hw - 1 || r > bot - 2) return [164, 152, 168];                    // the stone frame
  const rose = Math.hypot(x, r - 46);
  if (rose < 30) {                                                                      // the rose
    if (rose > 28 || rose < 4 || Math.abs(Math.sin(Math.atan2(r - 46, x) * 6)) < .12) return [30, 26, 34];
    return WGLASS[(Math.floor(rose / 8) + Math.floor((Math.atan2(r - 46, x) + 4) * 1.9)) % 6];
  }
  if (r > 80) for (const m of [-span / 3, span / 3]) if (Math.abs(x - m) < 2.5) return [160, 152, 148];   // mullions between the lancets
  if (r > 80 && Math.abs(x) < 26 && r > 96 && r < h - 22) {                            // a robed saint in the middle light
    const fy = r - 96, fw = 5 + fy * .1;
    if (fy < 12 && Math.hypot(x, fy - 6) < 7.5 && Math.hypot(x, fy - 6) > 6) return [240, 210, 110];   // halo
    if (fy < 12 && Math.hypot(x, fy - 6) < 5) return [214, 186, 140];
    if (fy >= 12 && Math.abs(x) < fw) return Math.abs(x) < 1 ? [30, 26, 34] : fy < 26 ? [80, 66, 170] : [46, 46, 130];
  }
  // Leaded panes, each lancet in its own colours: blues, golds and violets about the saint, reds.
  const lane = x < -span / 3 ? 0 : x > span / 3 ? 2 : 1, pr = r - 80, pc = gx;
  if ((pr % 12 === 0 && r > 80) || pc % 9 === 0) return [30, 26, 34];
  const SCHEME = [[[96, 52, 160], [132, 72, 182], [70, 40, 130], [220, 160, 80]], [[206, 150, 82], [150, 80, 182], [110, 58, 160], [238, 198, 128]], [[180, 50, 92], [212, 92, 124], [140, 36, 72], [220, 160, 80]]][lane];
  const hh = hash(Math.floor(pc / 9), Math.floor(pr / 12), 4); return SCHEME[hh < .45 ? 0 : hh < .75 ? 1 : hh < .93 ? 2 : 3];
}

// A pointed doorway n cells wide: is the point gx pixels along it, z pixels up, inside the opening (grown by `grow`)?
function openAt(gx, z, n, grow = 0) {
  const halfW = n * 10 - 3, R = halfW * 1.4, rise = Math.sqrt(R * R - (R - halfW) ** 2), zs = Math.max(26, Math.min(WALL_H - 12, 86) - rise);
  const x = Math.abs(gx + .5 - n * 10), hw = halfW + grow;
  if (x >= hw) return false; if (z < zs) return true;
  const c = halfW - R, Rg = R + grow; return z - zs < Math.sqrt(Math.max(0, Rg * Rg - (x - c) ** 2));
}
// A pair of oak doors in that opening, swung open by p (0 shut, 1 against the jambs).
function doorPx(gx, z, n, p) {
  const halfW = n * 10 - 3, zs = Math.max(26, Math.min(WALL_H - 12, 86) - halfW * 1.342), x = gx + .5 - n * 10, ax = Math.abs(x);
  const reach = halfW * (1 - p) + 2 * p, from = halfW - ax;               // each leaf reaches this far from its jamb
  if (from > reach) return null;
  if (p > .04 && from > reach - 1.6) return [104, 70, 46];                // its edge, seen as it turns
  const local = from / Math.max(1, reach) * halfW, plank = Math.floor(local / 5), side = x < 0 ? 0 : 1;
  const k = (.84 + hash(plank, side, 7) * .16) * (1 - .45 * p);
  if (Math.floor(local) % 5 === 0) return [40 * k, 26 * k, 18 * k];       // the joints between planks
  if ((z >= 14 && z < 17) || (z >= zs - 8 && z < zs - 5)) return (Math.floor(local) % 4 === 1) ? [150, 140, 118] : [38, 36, 40];   // iron straps and their nails
  if (p < .5 && local > halfW - 4 && local < halfW - 1 && z > 32 && z < 40 && !(local > halfW - 3 && z > 33 && z < 39)) return [70, 64, 56];   // the ring handles
  return [82 * k, 52 * k, 34 * k];
}
// Paints a block: fn(face, c, r) for the two faces ('L', 'R': c across 0..19, r down 0..h−1) and the top ('T').
const inTop = (x, y) => Math.abs(x + .5 - 20) < 20 * (1 - Math.abs(y + .5 - GY) / GY);
// The lowest top-face row of each column (the two edge columns hold no whole pixel of the diamond: use where its edge passes).
const BOT = Array.from({ length: 40 }, (_, x) => { let b = -1; for (let y = 0; y < DH; y++) if (inTop(x, y)) b = y; return b >= 0 ? b : GY - 1; });
// opt.hL, opt.hR: how far each face reaches down (a face over lower ground reaches down to it); opt.pb: rows kept
// above the top for a pinnacle; opt.fade: how it sinks into the dark with height. The canvas's hTop is how far its top
// stands above the wall's foot.
function paint(h, fn, opt = {}) {
  const hL = opt.hL ?? h, hR = opt.hR ?? h, pb = opt.pb || 0, fade = opt.fade || fadeUp, HH = pb + DH + Math.max(hL, hR);
  const [c, g] = canvas(40, HH), im = g.createImageData(40, HH), d = im.data;
  const put = (x, y, col, k) => { if (!col || y < 0 || y >= HH) return; const o = (y * 40 + x) * 4; d[o] = clamp8(col[0] * k); d[o + 1] = clamp8(col[1] * k); d[o + 2] = clamp8(col[2] * k); d[o + 3] = 255; };
  for (let x = 0; x < 40; x++) {
    const left = x < 20, cc = left ? x : 39 - x, f = left ? 'L' : 'R', top = pb + BOT[x] + 1, hf = left ? hL : hR;
    for (let r = 0; r < hf; r++) { let col = fn(f, cc, r, hf); if (!col) continue; let k = col.glow ? 1 : LIT[f]; if (r >= hf - 2) k *= .8;
      if (!col.glow) col = fade(col.map(c => c * k), h - r), k = 1;              // rising into the dark
      put(x, top + r, col, k); }
  }
  for (let y = 0; y < DH; y++) for (let x = 0; x < 40; x++) if (inTop(x, y)) {
    const rim = !inTop(x - 1, y) || !inTop(x + 1, y) || !inTop(x, y - 1) || !inTop(x, y + 1);
    put(x, pb + y, fade(fn('T', x, y, rim), h), 1);
  }
  c.hTop = h + pb;
  return [c, g, im, put];
}

// ---------------------------------------------------------------- piers
function columnSprite(h, low, candle, banner) {
  const [c, g] = canvas(40, DH + h), im = g.createImageData(40, DH + h), d = im.data;
  const put = (x, y, col, a = 1) => { if (a < .03) return; const o = (y * 40 + x) * 4; d[o] = clamp8(col[0]); d[o + 1] = clamp8(col[1]); d[o + 2] = clamp8(col[2]); d[o + 3] = 255 * a; };
  const base = [112, 100, 120], cx = 20, ground = h + GY - 1;
  for (let y = 0; y < DH + h; y++) for (let x = 0; x < 40; x++) {
    const dx = x + .5 - cx; let w = low ? 5.5 : 8.5, k;
    const capTop = low ? 0 : 6, capBot = low ? 8 : 20;
    if (y < capTop) continue;                                                       // (no cap: the shaft is lost in the dark before it ends)
    if (y < capBot) w = (low ? 8.5 : 12.5) - (y - capTop) / (capBot - capTop) * (low ? 3 : 4);
    else if (y > ground - 7) w = low ? 7.5 : 11;
    if (Math.abs(dx) >= w || y > ground + 4 - Math.abs(dx) * GY / 20) continue;
    if (y < capBot) { k = 1.05 - (dx + w) / (2 * w) * .5; if ((x * 3 + y * 5) % 7 === 0) k *= .75; if (y === capBot - 1) k *= .6; if (y === capTop) k *= 1.2; }
    else if (y > ground - 7) { k = 1 - (dx + w) / (2 * w) * .45; if (y === ground - 6) k *= 1.2; }
    else { const t = (dx + w) / (2 * w); k = 1.12 - t * .6; if (!low) { const sub = Math.abs(dx) % 4.25; if (sub < .8) k *= .72; else if (sub < 1.6) k *= 1.08; } }
    put(x, y, [base[0] * k, base[1] * k, base[2] * k], low ? 1 : thinUp(ground - y));   // the shaft rises and thins into the dark
  }
  if (banner) {                                                                        // a banner hung on it: red, a gold cross, a pointed foot
    for (let y = h - 92; y < h - 26; y++) for (let x = 13; x < 27; x++) {
      const fy = y - (h - 92), tip = fy > 56 && Math.abs(x + .5 - 20) > (66 - fy) * .7; if (tip) continue;
      let col = (x === 13 || x === 26) ? [64, 10, 18] : [120, 18, 28].map(v => v * (.88 + .12 * Math.sin(x * .9)));
      if (fy < 2) col = [214, 170, 72]; else if (fy === 4 || fy === 52) col = [176, 138, 60];
      if ((Math.abs(x + .5 - 20) < 1 && fy > 12 && fy < 40) || (Math.abs(fy - 21) < 1 && Math.abs(x + .5 - 20) < 5)) col = [214, 170, 72];
      put(x, y, col, thinUp(ground - y + 14));
    }
    for (let x = 11; x < 29; x++) put(x, h - 93, [70, 60, 50], thinUp(ground - (h - 93) + 14));
  }
  if (candle) { const x = 12, y = h - 40; for (let k = 0; k < 3; k++) put(x - k, y, [34, 32, 36]); put(x - 2, y - 1, [34, 32, 36]);
    for (let k = 2; k < 6; k++) put(x - 2, y - k, [224, 216, 198]); put(x - 2, y - 6, [255, 196, 90]); put(x - 2, y - 7, [255, 246, 200]); }
  g.putImageData(im, 0, 0); return c;
}
const COLH = Math.round(150 * ZS), COLH_LOW = Math.round(44 * ZS);

// ---------------------------------------------------------------- light
function lightSprite(col, R) {
  const [c, g] = canvas(R * 2, R * 2), gr = g.createRadialGradient(R, R, 0, R, R, R), rgb = k => `rgb(${col[0] * k | 0},${col[1] * k | 0},${col[2] * k | 0})`;
  gr.addColorStop(0, rgb(1)); gr.addColorStop(.25, rgb(.78)); gr.addColorStop(.5, rgb(.42)); gr.addColorStop(.75, rgb(.14)); gr.addColorStop(1, rgb(0));
  g.fillStyle = gr; g.fillRect(0, 0, R * 2, R * 2); return c;
}

// ---------------------------------------------------------------- the world
// extra.statue(seed): a canvas with a stone statue standing on its feet at the bottom, or nothing.
export function makeWorld(M, extra = {}) {
  const W = M.W, Hh = M.H, isFloor = (i, j) => i >= 0 && j >= 0 && i < W && j < Hh && M.floor[j * W + i] !== F.VOID;
  const isWall = t => t === B.WALL || t === B.DOOR || t === B.ARCH || t === B.GREAT;
  // ---- doorways: runs of arch cells under one arch; along 1: the wall runs west–east (the opening faces south), 2: north–south
  const arch = new Array(W * Hh), doors = (M.doors || []).map(d => ({ cells: d.cells, open: false, p: 0 }));
  {
    const wallish = (i, j) => { if (i < 0 || j < 0 || i >= W || j >= Hh) return false; const b = M.block[j * W + i]; return b === B.WALL || b === B.ARCH || b === B.DOOR || b === B.GREAT; };
    const isArch = (i, j) => i >= 0 && j >= 0 && i < W && j < Hh && M.block[j * W + i] === B.ARCH;
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i; if (M.block[k] !== B.ARCH || arch[k]) continue;
      const along = wallish(i - 1, j) && wallish(i + 1, j) ? 1 : wallish(i, j - 1) && wallish(i, j + 1) ? 2 : (isFloor(i, j - 1) || isFloor(i, j + 1)) ? 1 : 2;
      let a = i, b = j; while (along === 1 ? isArch(a - 1, b) : isArch(a, b - 1)) along === 1 ? a-- : b--;
      const run = []; while (isArch(a, b)) { run.push(b * W + a); along === 1 ? a++ : b++; }
      run.forEach((c, idx) => arch[c] = { along, idx, n: run.length, door: -1 });
    }
    doors.forEach((d, n) => { for (const c of d.cells) if (arch[c]) arch[c].door = n; });
  }
  const shut = k => { const A = arch[k]; return !!A && A.door >= 0 && !(doors[A.door].open && doors[A.door].p > .55); };
  const blocksWay = k => { const b = M.block[k]; if (!b) return false; if (b === B.ARCH) return shut(k); if (b === B.PROP) return PROPS[M.props[M.pi[k]].type].solid !== false; return true; };
  const solid = (i, j) => i < 0 || j < 0 || i >= W || j >= Hh || (M.floor[j * W + i] === F.VOID && M.block[j * W + i] !== B.ARCH) || blocksWay(j * W + i);
  const floorChunks = new Map(), bloodChunks = new Map(), sprites = new Map(), px = [0, 0, 0];
  // ---- heights: floor cells a few steps up (the dais); everything standing on them is lifted with them
  const LV = M.level || new Uint8Array(W * Hh), lift = k => LV[k] * STEP_PX;
  const heightAt = (x, y) => { const i = Math.floor(x / CELL), j = Math.floor(y / CELL); return i >= 0 && j >= 0 && i < W && j < Hh ? lift(j * W + i) : 0; };
  // A wall stands on the highest floor beside it, so its foot meets the dais.
  const wLift = new Uint8Array(W * Hh), wMin = new Uint8Array(W * Hh);
  let LMAX = 0, rb = null;
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i; if (LV[k]) { LMAX = Math.max(LMAX, lift(k)); const x0 = 20 * (i - j) - 22, y0 = GY * (i + j) - lift(k) - 2;
      rb = rb ? { x0: Math.min(rb.x0, x0), x1: Math.max(rb.x1, x0 + 44), y0: Math.min(rb.y0, y0), y1: Math.max(rb.y1, y0 + DH + lift(k) + 4) } : { x0, x1: x0 + 44, y0, y1: y0 + DH + lift(k) + 4 }; }
    if (M.block[k] && !M.floor[k]) { let lo = 255;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < W && jj < Hh && M.floor[jj * W + ii]) { wLift[k] = Math.max(wLift[k], lift(jj * W + ii)); lo = Math.min(lo, lift(jj * W + ii)); } }
      wMin[k] = lo === 255 ? wLift[k] : lo; }
  }
  const liftOf = (k, cut) => M.floor[k] ? lift(k) : cut ? wMin[k] : wLift[k];
  // How far a wall's face reaches below its foot, down to the lower floor it looks onto (face 0: south, 1: east).
  const extDown = (k, face) => { const i = k % W, j = (k / W) | 0, n = face ? j * W + i + 1 : (j + 1) * W + i; return M.floor[n] ? Math.max(0, wLift[k] - lift(n)) : 0; };
  // Where a ray can find no floor (far outside the walls), the floor painter needn't look.
  const nearFloor = new Uint8Array(W * Hh), flat = new Uint8Array(W * Hh);
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    let any = false, same = !!M.floor[j * W + i];
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= Hh) continue; const n = jj * W + ii;
      if (M.floor[n]) { any = true; if (LV[n] !== LV[j * W + i]) same = false; } else if (M.block[n] && Math.abs(di) <= 1 && Math.abs(dj) <= 1) same = false; }
    nearFloor[j * W + i] = any; flat[j * W + i] = same;
  }

  // ---- rooms: floor flooded through open ground, stopping at doorways
  const room = new Int16Array(W * Hh).fill(-1); let rooms = 0;
  for (let k = 0; k < W * Hh; k++) {
    if (room[k] >= 0 || !M.floor[k] || M.block[k] === B.ARCH) continue;
    const q = [k]; room[k] = rooms;
    while (q.length) { const c = q.pop(), i = c % W, j = (c / W) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= Hh) continue;
        const n = jj * W + ii; if (room[n] >= 0 || !M.floor[n] || M.block[n] === B.ARCH) continue; room[n] = rooms; q.push(n); } }
    rooms++;
  }
  // Each wall knows which rooms it stands in front of (their floor lies behind it, to the west or north).
  const frontOf = new Map();
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i; if (!isWall(M.block[k])) continue;
    // Only what lies straight behind it along the camera's line of sight (the same screen column, further up the
    // screen), up to three cells deep, since walls are often two or three cells thick where rooms meet. Rooms off to
    // the side are not hidden by it.
    const s = new Set();
    for (let d = 1; d <= 3; d++) for (const [di, dj] of [[-d, -d], [-d, 1 - d], [1 - d, -d]]) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < W && jj < Hh && room[jj * W + ii] >= 0) s.add(room[jj * W + ii]); }
    if (s.size) frontOf.set(k, s);
  }

  // ---- what each wall shows into its room, and the lights that come with it
  const wFace = new Uint8Array(W * Hh), wFeat = new Uint8Array(W * Hh);
  const lights = [], beams = [], MOON = [.62, .78];
  let great = null;
  const wPart = new Uint8Array(W * Hh), flames = [];
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, t = M.block[k]; if (!isWall(t)) continue;
    const backL = isFloor(i, j + 1) && M.block[(j + 1) * W + i] !== B.ARCH, backR = isFloor(i + 1, j) && M.block[j * W + i + 1] !== B.ARCH;
    wFace[k] = t === B.ARCH ? arch[k].along : backL ? 1 : backR ? 2 : 0;
  }
  const outsideOf = (i, j, f) => f === 1 ? !isFloor(i, j - 1) && !isFloor(i, j - 2) : !isFloor(i - 1, j) && !isFloor(i - 2, j);
  // A wall seen from outside: the floor it looks onto is open ground, or there is none (the building's outer face).
  const wExt = new Uint8Array(W * Hh);
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) { const k = j * W + i; if (M.block[k] !== B.WALL) continue;
    const f = wFace[k], n = f === 1 ? (j + 1) * W + i : f === 2 ? j * W + i + 1 : -1;
    wExt[k] = n >= 0 ? OUTDOOR.has(M.floor[n]) : (isFloor(i, j - 1) || isFloor(i - 1, j)); }
  const winOK = (i, j, f) => outsideOf(i, j, f) || wExt[j * W + i];
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, t = M.block[k]; if (!isWall(t)) continue;
    if (t === B.GREAT) { if (!great) great = { i0: i, j, n: 0 }; great.n++; continue; }
    if (t !== B.WALL || !wFace[k] || wFeat[k]) continue;
    const along = wFace[k] === 1 ? i : j, outside = winOK(i, j, wFace[k]);
    const [fx, fy] = wFace[k] === 1 ? [i + .5, j + 1] : [i + 1, j + .5];
    const [ni, nj] = wFace[k] === 1 ? [i + 1, j] : [i, j + 1], nk = nj * W + ni;
    if (outside && along % 7 === 2 && ni < W && nj < Hh && M.block[nk] === B.WALL && wFace[nk] === wFace[k] && winOK(ni, nj, wFace[k]) && !wFeat[nk]) {
      wFeat[k] = 1; wFeat[nk] = 1; wPart[nk] = 1;
      const [gx, gy] = wFace[k] === 1 ? [i + 1, j + 1] : [i + 1, j + 1];
      lights.push({ x: gx * CELL, y: gy * CELL, z: (WALL_H - 50 + wLift[k]) / V, col: [96, 70, 150], r: 40 });
      const g0 = GLASS[Math.floor(hash(i, j, 21) * 5)], g1 = GLASS[Math.floor(hash(i, j, 22) * 5)];
      const L = 4.4, quad = (a, b) => wFace[k] === 1
        ? [[i + .2 + a * .6, j + 1], [i + .2 + b * .6, j + 1], [i + .2 + b * .6 + MOON[0] * L, j + 1 + MOON[1] * L], [i + .2 + a * .6 + MOON[0] * L, j + 1 + MOON[1] * L]]
        : [[i + 1, j + .2 + a * .6], [i + 1, j + .2 + b * .6], [i + 1 + MOON[1] * L, j + .2 + b * .6 + MOON[0] * L], [i + 1 + MOON[1] * L, j + .2 + a * .6 + MOON[0] * L]];
      if (COLOURED_RAYS) beams.push({ parts: [[quad(0, .33), g0], [quad(.33, .67), [120, 130, 170]], [quad(.67, 1), g1]], seed: hash(i, j, 5), k: .42 });
    } else if (along % 7 === 5) wFeat[k] = 3;
    else if ((!outside || wExt[k]) && hash(i, j, 41) < .16) wFeat[k] = 4;
    else if (hash(i, j, 43) < .14) {
      wFeat[k] = 2;
      lights.push({ x: fx * CELL, y: fy * CELL, z: (WALL_H - Math.floor(WALL_H * .47) + 4 + wLift[k]) / V, col: [255, 150, 70], r: 52, flicker: hash(i, j) * 9 });
      { const x = wFace[k] === 1 ? 9 : 30; flames.push([20 * (i - j) - 20 + x, GY * (i + j) - WALL_H + BOT[x] + 1 + Math.floor(WALL_H * .47) - 5 - wLift[k], hash(i, j) * 9]); }
    } else if (hash(i, j, 47) < .06) wFeat[k] = 5;
  }
  // The great window: glow along it, and its colours thrown far across the sanctuary.
  if (great) {
    const { i0, j, n } = great;
    for (let s = 0; s < n; s += 2) lights.push({ x: (i0 + s + 1) * CELL, y: (j + 1) * CELL, z: (54 + wLift[j * W + i0]) / V, col: [110, 80, 170], r: 50 });
    const L = 9, parts = [];
    for (let s = 0; s < 7; s++) { const a = s / 7, b = (s + 1) / 7, x0 = i0 + .5 + a * (n - 1), x1 = i0 + .5 + b * (n - 1);
      parts.push([[[x0, j + 1], [x1, j + 1], [x1 + MOON[0] * L * .6, j + 1 + L], [x0 + MOON[0] * L * .6, j + 1 + L]], GLASS[s % 5]]); }
    if (COLOURED_RAYS) beams.push({ parts, seed: .3, k: .5 });
  }
  // The moon over open ground: every garden and gravel cell lit from the sky.
  const openRoom = new Uint8Array(rooms);
  for (let k = 0; k < W * Hh; k++) if (room[k] >= 0 && OUTDOOR.has(M.floor[k])) openRoom[room[k]] = 1;
  const sky = (i, j) => { const k = j * W + i; return !!M.floor[k] && (OUTDOOR.has(M.floor[k]) || (room[k] >= 0 && openRoom[room[k]])); };
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i; if (!sky(i, j) || (i > 0 && sky(i - 1, j) && LV[k - 1] === LV[k])) continue;      // one strip per run of open cells
    let e = i; while (e < W && sky(e, j) && LV[j * W + e] === LV[k]) e++;
    beams.push({ parts: [[[[i, j], [e, j], [e, j + 1], [i, j + 1]], [86, 100, 150]]], seed: hash(i, j, 3), k: 1, sky: 1, up: lift(k) }); }
  // Light from furniture and piers.
  for (const P of M.props) {
    const up = lift(P.y * W + P.x);
    for (const [x, y, z, col, r] of propLights(P.type, P.rot)) lights.push({ x: (P.x + x) * CELL, y: (P.y + y) * CELL, z: (z + up) / V, col, r, flicker: hash(P.x, P.y) * 9 });
    for (const [x, y, z] of propFlames(P.type, P.rot)) { const [sx, sy] = toScr((P.x + x) * CELL, (P.y + y) * CELL, (z + up) / V); flames.push([sx, sy - 1, hash(P.x * 7 + x * 13, P.y + y * 11) * 9, PROPS[P.type].hang]); }
  }
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) if (M.block[j * W + i] === B.COLUMN && M.vari[j * W + i] === 2) {
    const up = lift(j * W + i);
    lights.push({ sx: 20 * (i - j) - 20 + 10, sy: GY * (i + j) - 46 - up, col: [255, 150, 70], r: 54, flicker: hash(i, j) * 9, screen: 1 });
    flames.push([20 * (i - j) - 20 + 10, GY * (i + j) - 47 - up, hash(i, j) * 9]);
  }
  for (const L of lights) { if (!L.screen) { const [sx, sy] = toScr(L.x, L.y, L.z); L.sx = sx; L.sy = sy; } L.spr = lightSprite(L.col, L.r); }
  for (const b of beams) { b.scr = b.parts.map(([q, col]) => [q.map(([x, y]) => { const [sx, sy] = toScr(x * CELL, y * CELL); return [sx, sy - (b.up || 0)]; }), col]);
    const all = b.scr.flatMap(p => p[0]); b.x0 = Math.min(...all.map(p => p[0])); b.x1 = Math.max(...all.map(p => p[0])); b.y0 = Math.min(...all.map(p => p[1])); b.y1 = Math.max(...all.map(p => p[1])); }

  // ---- floor and blood
  function genFloor(cx, cy) {
    const [c, g] = canvas(CS, CS), im = g.createImageData(CS, CS), d = im.data;
    const cellAt = (X, Y) => { const fi = ((Y + .5) / GY + (X + .5) / 20) / 2, fj = ((Y + .5) / GY - (X + .5) / 20) / 2; return [fi, fj, Math.floor(fi), Math.floor(fj)]; };
    for (let y = 0; y < CS; y++) for (let x = 0; x < CS; x++) {
      const X = cx * CS + x, Y = cy * CS + y, o = (y * CS + x) * 4;
      if (rb && X >= rb.x0 && X <= rb.x1 && Y >= rb.y0 && Y <= rb.y1) {
        // On level ground, the floor under this pixel is found in a guess or two.
        let z = 0, done = false, far = true;
        for (let it = 0; it < 3; it++) {
          const [fi, fj, i, j] = cellAt(X, Y + z); if (i < 0 || j < 0 || i >= W || j >= Hh) break;
          const k = j * W + i; if (nearFloor[k]) far = false; if (!M.floor[k]) break;
          const lp = lift(k); if (lp === z) { if (flat[k]) { floorColor(M, M.floor[k], i, j, fi - i, fj - j, X, Y, px); d[o] = px[0]; d[o + 1] = px[1]; d[o + 2] = px[2]; d[o + 3] = 255; done = true; } break; }
          z = lp;
        }
        if (done) continue;
        if (far) { const [, , i, j] = cellAt(X, Y + LMAX); if (i < 0 || j < 0 || i >= W || j >= Hh || !nearFloor[j * W + i]) continue; }
        // Otherwise follow the view ray down from the highest floor; the first floor it meets is what shows,
        // a top or, if it came in through the side, the face of a step or a drop.
        let prev = null;
        for (let z = LMAX; z >= 0; z--) {
          const [fi, fj, i, j] = cellAt(X, Y + z); if (i < 0 || j < 0 || i >= W || j >= Hh) { prev = null; continue; }
          const k = j * W + i, lp = M.floor[k] ? lift(k) : 0; if (lp < z) { prev = [i, j]; continue; }
          const t = M.floor[k]; if (!t) break;
          if (lp === z || !prev || (prev[0] === i && prev[1] === j)) floorColor(M, t, i, j, fi - i, fj - j, X, Y, px);
          else {                                                                     // a riser: stone, or the runner going up it
            const south = prev[1] > j, along = south ? fi - i : fj - j, down = lp - z, carpet = t === F.CARPET;
            const pk = prev[1] * W + prev[0], drop = lp - (M.floor[pk] ? lift(pk) : 0);
            let c = carpet ? (along < .12 || along > .88 ? [150, 112, 50] : [98, 16, 24]) : [116, 104, 122];
            let kk = down < 1 ? 1.3 : down >= STEP_PX - 1 && drop <= STEP_PX ? .7 : 1; if (!carpet && along < .04) kk *= .6;
            if (drop > STEP_PX && !carpet && down >= 1) {                                // a tall drop: ashlar, like a wall
              const row = Math.floor((down - 1) / 6), u = along * 20 + (row & 1) * 5;
              c = (down - 1) % 6 === 0 || Math.floor(u) % 10 === 0 ? [48, 40, 54] : [104, 92, 112].map(v => v * (.86 + hash(Math.floor(u / 10) + i * 3, row + j * 5, 2) * .2));
              kk = 1; if (down >= drop - 2) kk = .7;
            }
            kk *= south ? .84 : .62;
            px[0] = clamp8(c[0] * kk); px[1] = clamp8(c[1] * kk); px[2] = clamp8(c[2] * kk);
          }
          d[o] = px[0]; d[o + 1] = px[1]; d[o + 2] = px[2]; d[o + 3] = 255; break;
        }
        continue;
      }
      const [fi, fj, i, j] = cellAt(X, Y);
      if (i < 0 || j < 0 || i >= W || j >= Hh) continue;
      const t = M.floor[j * W + i]; if (!t) continue;
      floorColor(M, t, i, j, fi - i, fj - j, X, Y, px);
      d[o] = px[0]; d[o + 1] = px[1]; d[o + 2] = px[2]; d[o + 3] = 255;
    }
    g.putImageData(im, 0, 0); return c;
  }
  const eachChunk = (ox, oy, vw, vh, fn) => { for (let cy = Math.floor(-oy / CS); cy <= Math.floor((-oy + vh) / CS); cy++) for (let cx = Math.floor(-ox / CS); cx <= Math.floor((-ox + vw) / CS); cx++) fn(cx, cy, cx + ',' + cy); };
  function drawFloor(g, ox, oy, vw, vh, budget = 2, keep = true) {
    eachChunk(ox, oy, vw, vh, (cx, cy, k) => { let c = floorChunks.get(k); if (!c && budget-- > 0) { c = genFloor(cx, cy); if (keep) floorChunks.set(k, c); } if (c) g.drawImage(c, cx * CS + ox, cy * CS + oy); });
    eachChunk(ox, oy, vw, vh, (cx, cy, k) => { const c = bloodChunks.get(k); if (c) g.drawImage(c[0], cx * CS + ox, cy * CS + oy); });
  }
  const blood = { fillStyle: '#000', fillRect(x, y, w, h) { const cx = Math.floor(x / CS), cy = Math.floor(y / CS), k = cx + ',' + cy; let c = bloodChunks.get(k); if (!c) { c = canvas(CS, CS); bloodChunks.set(k, c); } c[1].fillStyle = this.fillStyle; c[1].fillRect(x - cx * CS, y - cy * CS, w, h); } };
  const clearBlood = () => bloodChunks.clear();

  // ---- sprites for each kind of cell
  function wallSprite(t, i, j, k, cutDown, p = 0) {
    const ext = !cutDown && t === B.WALL && wExt[k], fa = wFace[k], fe = cutDown ? 0 : wFeat[k], run = fa === 1;   // an arch opens on the face that looks along its wall
    const h = cutDown ? CUT_H : t === B.GREAT ? GREAT_H : ext ? WALL_EXT : WALL_H, pb = ext && (i + j) % 3 === 0 ? 36 : 0;
    const eL = cutDown ? 0 : extDown(k, 0), eR = cutDown ? 0 : extDown(k, 1);
    const [c, g, im, put] = paint(h, (f, cc, r, hf) => {
      if (f === 'T') return cutDown ? (hf ? [64, 58, 62] : [112, 104, 104]) : ext ? (hf ? [70, 60, 76] : [96, 86, 102]) : [32, 28, 32];   // a cut wall: a pale capstone, its joint darker
      if (hf > h) { if (r >= h) return ashlar(cc, r, i, j, hf); }                       // the face reaching down to lower ground
      if (t === B.ARCH) {
        const A = arch[k];
        if ((f === 'L') !== (A.along === 1)) return null;                              // the passage's inner side: never seen
        const gx = A.idx * 20 + cc, z = h - r;
        if (openAt(gx, z, A.n)) return A.door >= 0 ? doorPx(gx, z, A.n, p) : null;    // the opening, and its doors
        if (openAt(gx, z, A.n, 2.5)) { const kst = Math.abs(gx + .5 - A.n * 10) < 2.5 && z > 40; const col = kst ? [168, 160, 154] : [146, 138, 134]; return col; }   // its moulding, the keystone
      }
      if (t === B.DOOR && f === 'L') {
        const dx = Math.abs(cc - 9.5), top = h - 66;
        if (r >= top - 2) { if (dx > 8.5 || r < top) return [150, 142, 140]; if (r === top + 24 || r === top + 54) return [40, 36, 40]; if ((cc === 4 || cc === 15) && r % 6 === 3) return [150, 140, 120]; const kk = r % 5 === 0 ? .7 : .9; return [74 * kk, 46 * kk, 32 * kk]; }
      }
      if (t === B.GREAT && f === 'L' && !cutDown) { const gl = greatGlass((i - great.i0) * 20 + cc, r, h, great.n); if (gl) { const o = gl.slice(); o.glow = 1; return o; } }
      return wallPaint(f, cc, r, h, i, j, fa, fe, wPart[k]);
    }, { hL: h + eL, hR: h + eR, pb, fade: ext ? fadeExt : fadeUp });
    if (pb) {                                                                          // a pinnacle on the parapet, its crockets catching the light
      for (let dy = 0; dy < pb + GY - 2; dy++) { const y = pb + GY - dy, w = dy < 7 ? 5.5 : Math.max(.6, 4.6 * (1 - (dy - 7) / (pb + GY - 9))) + (dy % 7 === 3 ? 1 : 0);
        for (let x = 13; x < 27; x++) { const dx = x + .5 - 20; if (Math.abs(dx) >= w) continue;
          const kk = dy === 6 ? 1.2 : dy < 7 && dy % 3 === 0 ? .8 : 1; put(x, y, fadeExt((dx < 0 ? [142, 130, 150] : [86, 74, 96]).map(v => v * kk), h + dy), 1); } } }
    if (fe === 2) { const x = fa === 1 ? 9 : 30, top = pb + BOT[x] + 1, y = top + Math.floor(h * .47);
      for (let q = 0; q < 3; q++) put(x - 1 + q, y, [36, 34, 38], 1); put(x, y - 1, [36, 34, 38], 1);
      for (let q = 2; q < 5; q++) put(x, y - q, [222, 214, 196], 1); put(x, y - 5, [255, 196, 90], 1); put(x, y - 6, [255, 246, 200], 1); }
    g.putImageData(im, 0, 0); return c;
  }
  // A low wall round open ground: coursed stone under a pale coping, down to the lower side.
  function lowSprite(k, i, j) {
    const h = LOW_H, [c, g, im] = paint(h, (f, cc, r, hf) => {
      if (f === 'T') return hf ? [76, 66, 82] : [140, 128, 146];
      if (r < 2) return r ? [96, 84, 104] : [158, 146, 162];
      const row = Math.floor((r - 2) / 5), u = cc + (row & 1) * 5;
      if ((r - 2) % 5 === 0 || u % 10 === 0) return [46, 38, 52];
      return [100, 88, 108].map(v => v * (.85 + hash(Math.floor(u / 10) + i * 7, row + j * 3, 4) * .2));
    }, { hL: h + extDown(k, 0), hR: h + extDown(k, 1), fade: col => col });
    g.putImageData(im, 0, 0); return c;
  }
  function sprite(t, i, j, k, cutDown) {
    let key, make;
    if (isWall(t)) {
      const A = t === B.ARCH ? arch[k] : null, q = A && A.door >= 0 ? Math.round(doors[A.door].p * 8) : 0;
      key = (cutDown ? 'c' : 'w') + t + wFace[k] + (cutDown ? 0 : wFeat[k] + '.' + wPart[k] + '.' + wExt[k] + '.' + (wExt[k] && (i + j) % 3 === 0 ? 1 : 0) + '.' + extDown(k, 0) + ',' + extDown(k, 1)) + ':' + (t === B.GREAT && !cutDown ? i : (i * 7 + j * 3) % 5) + (A ? ':a' + A.n + ',' + A.idx + ',' + A.door + ',' + q : '');
      make = () => wallSprite(t, i, j, k, cutDown, q / 8);
    }
    else if (t === B.LOW) { key = 'low' + ((i * 7 + j * 3) % 4) + ':' + extDown(k, 0) + ',' + extDown(k, 1); make = () => lowSprite(k, i, j); }
    else if (t === B.COLUMN) { const v = M.vari[k]; key = 'col' + v; make = () => columnSprite(v === 1 ? COLH_LOW : COLH, v === 1, v === 2, v === 4); }
    else { const P = M.props[M.pi[k]], ci = i - P.x, cj = j - P.y, st = PROPS[P.type].statue; key = P.type + P.rot + ':' + ci + ',' + cj + ':' + (st ? P.seed % 3 : P.seed % 4);
      const open = sky(i, j);                                                            // under the sky nothing fades: there is no vault
      key += open ? ':o' : '';
      make = () => propCell(P.type, P.rot, ci, cj, P.seed % 4, st && extra.statue ? extra.statue(P.seed % 3) : null, open).canvas; }
    let s = sprites.get(key); if (!s) { s = make(); sprites.set(key, s); } return s;
  }
  // The hole a tall thing opens around the priest: an upright oval, its rim dithered.
  const HRX = 20, HRY = 34, [hole, hg] = canvas(HRX * 2, HRY * 2);
  { const im = hg.createImageData(HRX * 2, HRY * 2); for (let y = 0; y < HRY * 2; y++) for (let x = 0; x < HRX * 2; x++) {
      const t = Math.hypot((x + .5 - HRX) / HRX, (y + .5 - HRY) / HRY); if (t > 1) continue; if (t > .72 && (t - .72) / .28 > bayer(x, y)) continue; im.data[(y * HRX * 2 + x) * 4 + 3] = 255; }
    hg.putImageData(im, 0, 0); }
  const [cut, cg] = canvas(40, 400);
  function drawCut(g, s, x, y, hx, hy) {
    cg.clearRect(0, 0, 40, s.height); cg.globalCompositeOperation = 'source-over'; cg.drawImage(s, 0, 0);
    cg.globalCompositeOperation = 'destination-out'; cg.drawImage(hole, Math.round(hx - x - HRX), Math.round(hy - y - HRY)); cg.globalCompositeOperation = 'source-over';
    g.drawImage(cut, 0, 0, 40, s.height, x, y, 40, s.height);
  }
  const roomAt = (x, y) => { const i = Math.floor(x / CELL), j = Math.floor(y / CELL); return i >= 0 && j >= 0 && i < W && j < Hh ? room[j * W + i] : -1; };
  let lastRoom = -1;
  // Everything standing in view, as { d: depth, draw(g) } to sort with the characters.
  // pX, pY: the priest's middle on screen; pD: his depth; wx, wy: where he stands in the world.
  // diorama: the whole building at once, every wall standing in front of a room cut down (the map's model).
  function blocks(ox, oy, vw, vh, pX, pY, pD, wx, wy, diorama = false) {
    const r = diorama ? -1 : roomAt(wx, wy); if (r >= 0) lastRoom = r;
    const hi = doorNear(wx, wy, 5);                                                  // the door near enough to notice
    const out = [], X0 = -ox - 40, X1 = -ox + vw + 40, Y0 = -oy - DH, Y1 = -oy + vh + 200;
    const ij = (X, Y) => [(Y / GY + X / 20) / 2, (Y / GY - X / 20) / 2];
    const cs = [ij(X0, Y0), ij(X1, Y0), ij(X0, Y1), ij(X1, Y1)];
    const i0 = Math.max(0, Math.floor(Math.min(...cs.map(c => c[0])))), i1 = Math.min(W - 1, Math.ceil(Math.max(...cs.map(c => c[0]))));
    const j0 = Math.max(0, Math.floor(Math.min(...cs.map(c => c[1])))), j1 = Math.min(Hh - 1, Math.ceil(Math.max(...cs.map(c => c[1]))));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * W + i, t = M.block[k]; if (!t) continue;
      let d = (i + j + 1) * CELL;
      // A wall in front of the room he is in is cut down to a stub, so the room shows whole. A doorway in it stays
      // whole but see-through, so you can still tell there is a way out there, and a door.
      const inFront = isWall(t) && (diorama ? frontOf.has(k) : lastRoom >= 0 && frontOf.get(k)?.has(lastRoom));     // every near-side wall of his room, as Diablo does
      // Any other wall standing between the camera and him, within reach of him, is cut down too: everything on the
      // near side of him is low, the way Diablo opens a building around its hero.
      const near = !diorama && isWall(t) && !inFront && d > pD + CELL * .5 && Math.hypot(i + .5 - wx / CELL, j + .5 - wy / CELL) < 14;
      const A = t === B.ARCH ? arch[k] : null, cutDown = (inFront || near) && (!A || diorama), faint = (inFront || near) && !!A, lit = A && A.door >= 0 && A.door === hi;
      const veil = 1;
      const s = sprite(t, i, j, k, cutDown), h = s.hTop ?? (s.height - DH), x = 20 * (i - j) - 20 + ox, y = GY * (i + j) - h + oy - liftOf(k, cutDown);
      if (x > vw || x < -40 || y > vh || y + s.height < 0) continue;
      if (t === B.PROP && PROPS[M.props[M.pi[k]].type].hang) d += CELL * .9;           // hanging things are drawn over whoever walks beneath
      const over = !cutDown && veil === 1 && h > 30 && d > pD + 4 && pX > x - HRX && pX < x + 40 + HRX && pY > y - HRY && pY < y + s.height + HRY;
      out.push({ d, draw: g => {
        if (faint) g.globalAlpha = .62; else if (veil < 1) g.globalAlpha = veil;
        if (over) drawCut(g, s, x, y, pX, pY); else g.drawImage(s, x, y);
        if (lit) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = .2 + .08 * Math.sin(performance.now() / 260); g.drawImage(s, x, y); g.globalCompositeOperation = 'source-over'; }
        g.globalAlpha = 1;
      } });
    }
    return out;
  }

  // ---- the dark
  const AMB = 'rgb(60,44,78)', [lb, lg] = canvas(8, 8), dynSprites = new Map();
  // The halo round a flame, added on top of the dark.
  const [halo, hctx] = canvas(26, 26);
  { const gr = hctx.createRadialGradient(13, 13, 0, 13, 13, 13); gr.addColorStop(0, 'rgba(255,214,140,.9)'); gr.addColorStop(.2, 'rgba(255,170,80,.5)'); gr.addColorStop(.55, 'rgba(255,120,40,.14)'); gr.addColorStop(1, 'rgba(255,100,30,0)');
    hctx.fillStyle = gr; hctx.fillRect(0, 0, 26, 26); }
  // Low mist drifting over the floor: a few soft clouds anchored in the world, slowly sliding. Drawn before the dark, so
  // it glows where the candles are and vanishes where they aren't.
  const [fogC, fogG] = canvas(220, 90);
  { const im = fogG.createImageData(220, 90);
    for (let y = 0; y < 90; y++) for (let x = 0; x < 220; x++) {
      const nx = x / 220 - .5, ny = y / 90 - .5, e = Math.max(0, 1 - (nx * nx * 4 + ny * ny * 4));
      let n = 0, amp = .5, f = 1 / 40; for (let o = 0; o < 4; o++) { n += amp * (hash(Math.floor(x * f), Math.floor(y * f * 2), o) * (1 - frac(x * f)) + hash(Math.floor(x * f) + 1, Math.floor(y * f * 2), o) * frac(x * f)); amp *= .5; f *= 2; }
      const a = Math.max(0, n - .35) * e * 1.6; const o4 = (y * 220 + x) * 4; im.data[o4] = 200; im.data[o4 + 1] = 196; im.data[o4 + 2] = 214; im.data[o4 + 3] = Math.min(255, a * 120);
    }
    fogG.putImageData(im, 0, 0); }
  function fog(g, ox, oy, vw, vh, t) {
    const step = 260, x0 = Math.floor((-ox - 220) / step), x1 = Math.ceil((-ox + vw) / step), y0 = Math.floor((-oy - 90) / 120), y1 = Math.ceil((-oy + vh) / 120);
    g.save(); g.globalAlpha = .55;
    for (let b = y0; b <= y1; b++) for (let a = x0; a <= x1; a++) {
      const sx = a * step + ((b & 1) * 130) + Math.sin(t * .05 + a * 1.7 + b) * 40 + t * 3 % step, sy = b * 120 + Math.sin(t * .07 + a + b * 2.3) * 14;
      g.drawImage(fogC, Math.round(sx + ox), Math.round(sy + oy));
    }
    g.restore();
  }
  function lightUp(g, ox, oy, vw, vh, dyn, t, opt = {}) {
    if (!opt.noFog) fog(g, ox, oy, vw, vh, t);
    const w = Math.ceil(vw / 2) + 1, h = Math.ceil(vh / 2) + 1;
    if (lb.width !== w || lb.height !== h) { lb.width = w; lb.height = h; }
    lg.globalCompositeOperation = 'source-over'; lg.globalAlpha = 1; lg.fillStyle = opt.amb || AMB; lg.fillRect(0, 0, w, h);
    lg.globalCompositeOperation = 'lighter';
    for (const b of beams) {
      if (b.x1 + ox < 0 || b.x0 + ox > vw || b.y1 + oy < 0 || b.y0 + oy > vh) continue;
      for (const [q, col] of b.scr) {
        lg.fillStyle = `rgb(${col[0] * b.k | 0},${col[1] * b.k | 0},${col[2] * b.k | 0})`;
        lg.beginPath(); q.forEach(([x, y], n) => n ? lg.lineTo((x + ox) / 2, (y + oy) / 2) : lg.moveTo((x + ox) / 2, (y + oy) / 2)); lg.closePath(); lg.fill();
      }
    }
    const one = (L, sx, sy, spr) => {
      if (sx + ox < -L.r * 2 || sx + ox > vw + L.r * 2 || sy + oy < -L.r * 2 || sy + oy > vh + L.r * 2) return;
      lg.globalAlpha = L.flicker === undefined ? 1 : .82 + .18 * Math.sin(t * 11 + L.flicker) * Math.sin(t * 6.7 + L.flicker * 2.3);
      lg.drawImage(spr, (sx + ox) / 2 - L.r, (sy + oy) / 2 - L.r);
    };
    for (const L of lights) one(L, L.sx, L.sy, L.spr);
    for (const L of dyn) { const key = L.col.join() + ':' + L.r; let s = dynSprites.get(key); if (!s) { s = lightSprite(L.col, L.r); dynSprites.set(key, s); } const [sx, sy] = toScr(L.x, L.y, L.z || 0); one(L, sx, sy, s); }
    lg.globalAlpha = 1; lg.globalCompositeOperation = 'source-over';
    g.save(); g.globalCompositeOperation = 'multiply'; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(lb, 0, 0, w, h, 0, 0, w * 2, h * 2); g.restore();
    if (!extra.lowFx) {                                                                // every flame in view glows
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const [fx, fy, ph] of flames) { const x = fx + ox, y = fy + oy; if (x < -14 || x > vw + 14 || y < -14 || y > vh + 14) continue;
        g.globalAlpha = .55 + .2 * Math.sin(t * 9 + ph) * Math.sin(t * 5.3 + ph * 1.7); g.drawImage(halo, Math.round(x - 13), Math.round(y - 13)); }
      g.restore();
    }
    if (!opt.noFog) for (const L of lights) {                                          // motes drifting in the candlelight
      if (L.col[0] < 200 || L.sx + ox < -20 || L.sx + ox > vw + 20 || L.sy + oy < -20 || L.sy + oy > vh + 20) continue;
      for (let m = 0; m < 3; m++) {
        const ph = (L.flicker || 0) + m * 2.1, u = frac(t * .05 * (1 + m * .3) + ph * .37), x = L.sx + Math.sin(t * .6 + ph) * (10 + m * 5), y = L.sy - u * 40 + 14;
        g.fillStyle = `rgba(255,200,130,${(1 - u) * .55})`; g.fillRect(Math.round(x + ox), Math.round(y + oy), 1, 1);
      }
    }
    for (const b of beams) {                                                            // dust turning in the moonlight
      if (b.sky) continue;
      const q = b.scr[Math.floor(b.scr.length / 2)][0], [ax, ay] = q[0]; if (ax + ox < -100 || ax + ox > vw + 100 || ay + oy < -100 || ay + oy > vh + 100) continue;
      for (let m = 0; m < (b.scr.length > 3 ? 14 : 5); m++) {
        const u = frac(b.seed * 7 + m * .37 + t * .025 * (1 + m * .2)), s = .5 + .45 * Math.sin(t * .4 + m * 2.1 + b.seed * 9), z = 8 + 40 * frac(m * .61 + b.seed);
        const x = q[0][0] + (q[1][0] - q[0][0]) * s + (q[3][0] - q[0][0]) * u, y = q[0][1] + (q[1][1] - q[0][1]) * s + (q[3][1] - q[0][1]) * u - z;
        g.fillStyle = `rgba(210,214,240,${.3 + .3 * Math.sin(t * 2 + m)})`; g.fillRect(Math.round(x + ox), Math.round(y + oy), 1, 1);
      }
    }
  }

  // ---- collision
  function collide(o, r) {
    for (let pass = 0; pass < 2; pass++) {
      const i0 = Math.floor((o.x - r) / CELL), i1 = Math.floor((o.x + r) / CELL), j0 = Math.floor((o.y - r) / CELL), j1 = Math.floor((o.y + r) / CELL);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        if (!solid(i, j)) continue;
        const ax = i * CELL, ay = j * CELL, nx = Math.max(ax, Math.min(o.x, ax + CELL)), ny = Math.max(ay, Math.min(o.y, ay + CELL));
        const dx = o.x - nx, dy = o.y - ny, d = Math.hypot(dx, dy);
        if (d >= r) continue;
        if (d < 1e-4) { const l = o.x - ax, rr = ax + CELL - o.x, tt = o.y - ay, bt = ay + CELL - o.y, m = Math.min(l, rr, tt, bt);
          if (m === l) o.x = ax - r; else if (m === rr) o.x = ax + CELL + r; else if (m === tt) o.y = ay - r; else o.y = ay + CELL + r; continue; }
        o.x += dx / d * (r - d); o.y += dy / d * (r - d);
      }
    }
  }
  const solidAt = (x, y) => solid(Math.floor(x / CELL), Math.floor(y / CELL));
  function freeNear(x, y, min, max) {
    for (let k = 0; k < 80; k++) {
      const a = Math.random() * Math.PI * 2, r = min + Math.random() * (max - min), px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      const i = Math.floor(px / CELL), j = Math.floor(py / CELL);
      if (!solid(i, j) && !solid(i + 1, j) && !solid(i - 1, j) && !solid(i, j + 1) && !solid(i, j - 1)) return [px, py];
    }
    return [x, y];
  }
  // Paint ahead: sprites and floor around (x, y) not painted yet, for at most `ms` milliseconds — so nothing has to be
  // painted on the spot when it walks into view.
  let ring = 0, ringAt = '';
  function prefetch(x, y, ms = 2) {
    const t0 = performance.now(), ci = Math.floor(x / CELL), cj = Math.floor(y / CELL), here = ci + ',' + cj;
    if (here !== ringAt) { ringAt = here; ring = 0; }
    for (; ring < 26 && performance.now() - t0 < ms; ring++) {
      for (let dj = -ring; dj <= ring; dj++) for (let di = -ring; di <= ring; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
        const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= W || j >= Hh) continue;
        const k = j * W + i, t = M.block[k]; if (t) sprite(t, i, j, k);
      }
      if (ring % 4 === 0) { const [sx, sy] = toScr((ci + .5) * CELL, (cj + .5) * CELL); const cx = Math.floor(sx / CS), cy = Math.floor(sy / CS);
        for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const key = (cx + a) + ',' + (cy + b); if (!floorChunks.has(key) && performance.now() - t0 < ms) floorChunks.set(key, genFloor(cx + a, cy + b)); } }
    }
  }
  // What he stands on, for the sound of his steps.
  const floorAt = (x, y) => { const i = Math.floor(x / CELL), j = Math.floor(y / CELL); if (i < 0 || j < 0 || i >= W || j >= Hh) return 'stone'; const f = M.floor[j * W + i];
    return f === F.WOOD ? 'wood' : f === F.CARPET ? 'carpet' : f === F.GRASS ? 'grass' : f === F.GRAVEL || f === F.DIRT ? 'gravel' : 'stone'; };
  // ---- doors: the nearest one within reach of (x, y); open or shut it (not shut on anyone standing in it); let them swing.
  const cellMid = k => [((k % W) + .5) * CELL, (((k / W) | 0) + .5) * CELL];
  function doorNear(x, y, reach = 2.7) {
    let best = -1, bd = reach * CELL;
    doors.forEach((d, n) => { for (const k of d.cells) { const [cx, cy] = cellMid(k), dd = Math.hypot(cx - x, cy - y); if (dd < bd) { bd = dd; best = n; } } });
    return best;
  }
  function toggleDoor(x, y, bodies = []) {
    const n = doorNear(x, y); if (n < 0) return null;
    const d = doors[n];
    if (d.open) for (const b of bodies) for (const k of d.cells) { const [cx, cy] = cellMid(k); if (Math.abs(b.x - cx) < CELL * .75 && Math.abs(b.y - cy) < CELL * .75) return null; }
    d.open = !d.open;
    const mid = d.cells.map(cellMid).reduce((a, c) => [a[0] + c[0] / d.cells.length, a[1] + c[1] / d.cells.length], [0, 0]);
    return { open: d.open, x: mid[0], y: mid[1] };
  }
  function tick(dt) { for (const d of doors) { const t = d.open ? 1 : 0; if (d.p !== t) d.p = d.p < t ? Math.min(t, d.p + dt * 2.4) : Math.max(t, d.p - dt * 2.4); } }
  const doorOpen = n => doors[n]?.open;
  // The whole cathedral as a lit model, fitted into maxW × maxH: { canvas, map(x, y) → [px, py] on it }.
  function diorama(maxW, maxH) {
    let X0 = 1e9, X1 = -1e9, Y0 = 1e9, Y1 = -1e9;
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) { const k = j * W + i; if (!M.floor[k] && !M.block[k]) continue;
      const x = 20 * (i - j), y = GY * (i + j) - liftOf(k); X0 = Math.min(X0, x - 24); X1 = Math.max(X1, x + 24); Y0 = Math.min(Y0, y - WALL_EXT - 50); Y1 = Math.max(Y1, y + DH + 30); }
    const vw = X1 - X0, vh = Y1 - Y0, sc = Math.min(maxW / vw, maxH / vh), ox = -X0, oy = -Y0;
    const [c, g] = canvas(Math.ceil(vw * sc), Math.ceil(vh * sc));
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.setTransform(sc, 0, 0, sc, 0, 0);
    drawFloor(g, ox, oy, vw, vh, 1e9, false);
    blocks(ox, oy, vw, vh, -1e9, -1e9, -1e9, -1e9, -1e9, true).sort((p, q) => p.d - q.d).forEach(o => o.draw(g));
    const [mask, mg] = canvas(c.width, c.height); mg.drawImage(c, 0, 0);                // only where there is something: the model floats in the dark
    lightUp(g, ox, oy, vw, vh, [], 0, { noFog: true, amb: 'rgb(118,100,138)' });
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-in'; g.drawImage(mask, 0, 0); g.globalCompositeOperation = 'source-over';
    return { canvas: c, map: (x, y) => { const [sx, sy] = toScr(x, y); return [(sx + ox) * sc, (sy - heightAt(x, y) + oy) * sc]; } };
  }
  return { diorama, drawFloor, blood, clearBlood, blocks, lightUp, collide, solidAt, freeNear, prefetch, floorAt, doorNear, toggleDoor, doorOpen, tick, heightAt, rooms: () => rooms,
    _debug: { sprite: (i, j, cut) => sprite(M.block[j * W + i], i, j, j * W + i, cut), feat: (i, j) => wFeat[j * W + i], face: (i, j) => wFace[j * W + i] } };
}
