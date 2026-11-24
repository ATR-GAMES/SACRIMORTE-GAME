// The world the priest walks in. A grid of cells (src/cathedral.js), each a 40×20 diamond on screen:
// - the floor, painted pixel by pixel from the world position under it, into cached 256-pixel chunks;
// - the blood, in chunks of its own over the floor, so it stays wherever it falls;
// - walls, all of them tall: ashlar with pilasters, banners, candles in brackets, stained-glass windows, the great
//   window behind the altar, arched doorways to walk through. The walls in front of the room the priest is in turn
//   see-through while he is in it; anything else tall in front of him fades smoothly (walls to their coping);
// - furniture (src/props.js) and the piers, sorted with the characters;
// - the dark: a light map multiplied over everything (moonlight through the glass, candles, chandeliers, fire, the
//   priest's own small light);
// - collision: circles against the solid cells.
// Screen space here is the map's own (no camera): corner (i, j) of a cell sits at (20(i−j), GY(i+j)) — see src/view.js.
// Interior walls in front of the room the priest is in are cut down to a stub, the way Diablo shows a room.
import { CELL, F, B, OUTDOOR } from './cathedral.js?v=f76c404';
import { PROPS, propCell, propLights, propFlames, renderShapes, footprint, propHeight } from './props.js?v=f76c404';
import { buildExterior } from './exterior.js?v=f76c404';
import { floraArt } from './flora.js?v=f76c404';
import { GY, DH, V, ZS, STEP_PX, toScreen, fadeUp, thinUp } from './view.js?v=f76c404';

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
    case F.GRAVEL: {                                                                   // the walks: cobbles in a dark joint, a kerb of long stones by the grass
      const gr = (ii, jj) => ii >= 0 && jj >= 0 && ii < M.W && jj < M.H && M.floor[jj * M.W + ii] === F.GRASS;
      const ku = u < .17 && gr(i - 1, j) ? u : u > .83 && gr(i + 1, j) ? 1 - u : -1, kv = v < .17 && gr(i, j - 1) ? v : v > .83 && gr(i, j + 1) ? 1 - v : -1;
      if (ku >= 0 || kv >= 0) {
        const along = ku >= 0 ? fy : fx, seg = Math.floor(along * 1.6), d = Math.max(ku, kv);
        if (d < .03 || frac(along * 1.6) < .06) { set(o, [36, 30, 36]); break; }
        set(o, [140, 126, 130], (.86 + hash(seg, ku >= 0 ? i : j, 41) * .16) * (d < .07 ? 1.12 : 1)); break; }
      const sx = fx * 2.7, sy = fy * 2.7, gx = Math.floor(sx), gy = Math.floor(sy); let d1 = 9, d2 = 9, id = 0;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const cx = gx + a, cy = gy + b, dx = sx - (cx + .2 + hash(cx, cy, 31) * .6), dy = sy - (cy + .2 + hash(cx, cy, 32) * .6), d = Math.hypot(dx, dy);
        if (d < d1) { d2 = d1; d1 = d; id = hash(cx, cy, 33); } else if (d < d2) d2 = d; }
      if (d2 - d1 < .1) { set(o, [38, 30, 38]); break; }
      const warm = vnoise(fx * .3, fy * .3, 17);
      set(o, [116 + warm * 14, 98 + warm * 6, 104], (.74 + id * .34) * (1.08 - d1 * .3) * (d2 - d1 < .18 ? .86 : 1)); break; }
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
  // (walls are thin slabs on one edge of their cell: SL holds which; S 1, N 2, E 4, W 8)
  const W = M.W, SL = M._slab, at = (ii, jj, bit) => { const kk = jj * W + ii, b = M.block[kk]; return b === B.COLUMN || (SL ? (SL[kk] & bit) !== 0 : b === B.WALL); };
  let ao = 1; const r = .34, me = j * W + i, own = SL ? SL[me] : 0, TH = WALL_T;
  const near = (dd, k0) => { if (dd < r && dd > -.01) ao = Math.min(ao, k0 + (1 - k0) * Math.max(0, dd) / r); };
  if (at(i - 1, j, 4)) near(u, .58); if (at(i, j - 1, 1)) near(v, .58); if (at(i + 1, j, 8)) near(1 - u, .7); if (at(i, j + 1, 2)) near(1 - v, .7);
  if (own & 1) near(1 - TH - v, .7); if (own & 2) near(v - TH, .58); if (own & 4) near(1 - TH - u, .7); if (own & 8) near(u - TH, .58);
  const LV = M.level; if (LV && M.block[j * W + i] !== B.WALL && M.block[j * W + i] !== B.DOOR) { const me = LV[j * W + i];   // (a wall cell's floor is the room's beside it: no step down to it)
    if (v < .3 && LV[(j - 1) * W + i] > me) ao = Math.min(ao, .62 + .38 * v / .3); if (u < .3 && LV[j * W + i - 1] > me) ao = Math.min(ao, .62 + .38 * u / .3); }
  const k = ao * (.98 + hash(X, Y, 1) * .04);
  o[0] = clamp8(o[0] * k); o[1] = clamp8(o[1] * k); o[2] = clamp8(o[2] * k);
}

// ---------------------------------------------------------------- walls
// feat: 1 window, 2 candle in a bracket, 3 pilaster, 4 banner, 5 crucifix. A cell paints one face (1 L, 2 R) into a room.
// Walls are slabs WALL_T of a cell thick along the edge of their cell that meets the floor.
const WALL_T = .3;
// (tall enough for the great arch between the nave and the narthex to stand whole under its coping)
const WALL_H = Math.round(200 * ZS), GREAT_H = Math.round(244 * ZS), CUT_H = 17, WALL_EXT = Math.round(218 * ZS), LOW_H = 15;
// Seen from out in the open, the building's outer face stands this high, its roofs above it.
const FACADE_H = WALL_EXT;
// Walls seen from outside rise against the night: they sink into the dark only far higher up.
const fadeExt = (col, z) => { if (z <= 104) return col; const t = Math.min(1, (z - 104) / 90), e = t * t * (3 - 2 * t); return [col[0] + (14 - col[0]) * e, col[1] + (11 - col[1]) * e, col[2] + (18 - col[2]) * e]; };
// Inside, a wall sinks into the dark higher up than other things do, so its doorways' arches show whole.
const fadeWall = (col, z) => {                                                     // from well up the wall, fully dark at its top
  const z0 = 88, z1 = WALL_H - 2; if (z <= z0) return col;
  const t = Math.min(1, (z - z0) / (z1 - z0)), e = t * t * (3 - 2 * t);
  return [col[0] + (11 - col[0]) * e, col[1] + (9 - col[1]) * e, col[2] + (10 - col[2]) * e];
};
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
function greatGlass(gx, r0, h0, n, broken) {
  const r = Math.floor(r0 * 132 / h0), h = 132, Wd = n * 20, cx = Wd / 2, top = 10, bot = h - 18, x = gx - cx, span = Wd / 2 - 16;
  const hw = r < top + 70 ? span * Math.sqrt(Math.max(0, 1 - Math.pow((top + 70 - r) / 70, 2))) - (top + 70 - r) * .4 : span;
  if (r < top || r > bot || Math.abs(x) > hw + 3) return null;
  if (Math.abs(x) > hw - 1 || r > bot - 2) return [164, 152, 168];                    // the stone frame
  if (broken) {                                                                       // smashed through: a jagged hole onto the night
    const a = Math.atan2(r - 66, x), d = Math.hypot(x * .85, r - 66), edge = 54 + 14 * Math.sin(a * 7 + 1) + 9 * hash(Math.floor(a * 9), 3) - 4;
    if (d < edge) return 'HOLE'; if (d < edge + 1.5) return [30, 26, 34];
  }
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
    if (Math.abs(dx) >= w || y > ground + 4 - Math.abs(dx) * GY / 20) continue;
    if (y < capBot) { k = 1.05 - (dx + w) / (2 * w) * .5; if ((x * 3 + y * 5) % 7 === 0) k *= .75; if (y === capBot - 1) k *= .6; if (y === capTop) k *= 1.2; }
    else { const t = (dx + w) / (2 * w); k = 1.12 - t * .6; if (!low) { const sub = Math.abs(dx) % 4.25; if (sub < .8) k *= .72; else if (sub < 1.6) k *= 1.08; } }
    put(x, y, [base[0] * k, base[1] * k, base[2] * k], low ? 1 : thinUp(ground - y));   // the shaft rises and thins into the dark
  }
  // The foot: a round moulding on a square plinth set square to the floor (as a classical column stands).
  { const cy0 = h + GY, sc = low ? .72 : 1, hw = 13.5 * sc, hh = hw * GY / 20, pH = Math.round(4 * sc), rr = 10 * sc, tH = Math.round(2 * sc);
    for (let y = 0; y < DH + h; y++) for (let x = 0; x < 40; x++) {
      const dx = x + .5 - cx, yy = y + .5;
      const inD = z => Math.abs(dx) / hw + Math.abs(yy + z - cy0) / hh <= 1;
      // the moulding: a short round drum on the plinth, rounded in its shading
      if (Math.abs(dx) < rr) { const e = Math.sqrt(rr * rr - dx * dx) * GY / 20, top = cy0 - pH - tH;
        if (yy <= cy0 - pH + e && yy >= top - e && yy >= top + e - 1.5 - 99 * 0) {
          if (yy < top + e - .5) continue;                                             // its top lies under the shaft
          const t = (dx + rr) / (2 * rr), v = (yy - (top + e)) / (tH + .01);
          let k = (1.18 - t * .62) * (1.05 - Math.abs(v - .45) * .5); if (yy > cy0 - pH + e - 1) k *= .72;
          put(x, y, base.map(c => c * k)); continue; } }
      if (inD(pH)) {                                                                   // the plinth's top
        const edge = Math.abs(dx) / hw + Math.abs(yy + pH - cy0) / hh > .86;
        put(x, y, base.map(v => v * (edge ? 1.32 : 1.18 - (dx + hw) / (4 * hw) * .3))); continue; }
      let face = false; for (let z = 0; z < pH; z++) if (inD(z)) { face = true; break; }
      if (face) { const left = dx < 0, bot = !inD(-1) && inD(0) && !inD(1);
        let k = left ? .98 : .7; if (Math.abs(dx) < .6) k = .6; if (bot) k *= .8;
        put(x, y, base.map(v => v * k)); continue; }
    } }
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
  const extSolid = new Uint8Array(W * Hh);                                             // (the buttresses and the porch outside)
  const solid = (i, j) => i < 0 || j < 0 || i >= W || j >= Hh || (M.floor[j * W + i] === F.VOID && M.block[j * W + i] !== B.ARCH) || blocksWay(j * W + i) || extSolid[j * W + i] === 1;
  const floorChunks = new Map(), bloodChunks = new Map(), sprites = new Map(), px = [0, 0, 0];
  // ---- heights: floor cells a few steps up (the dais); everything standing on them is lifted with them
  const LV = M.level || new Uint8Array(W * Hh), lift = k => LV[k] * STEP_PX;
  // where he stands: a wall cell's open part is the floor running up to its slab, at that floor's height
  let standLv = LV;
  const heightAt = (x, y) => { const i = Math.floor(x / CELL), j = Math.floor(y / CELL); return i >= 0 && j >= 0 && i < W && j < Hh ? standLv[j * W + i] * STEP_PX : 0; };
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
  // ---- slabs. A wall cell holds a thin slab along each edge that meets floor (south before north, east before west, so a
  // wall between two rooms stands on its south or east side), or a post in the corner that meets a floor diagonally.
  // The rest of the cell carries on the floor of the side away from the slab, so the floor runs right up to it.
  const slab = new Uint8Array(W * Hh), post = new Uint8Array(W * Hh), pFloor = new Uint8Array(M.floor), pLv = new Uint8Array(LV), wBase = new Uint8Array(W * Hh), wLo = new Int16Array(W * Hh);
  M._slab = slab; const pFrom = new Int32Array(W * Hh).fill(-1);
  const walky = (i, j) => i >= 0 && j >= 0 && i < W && j < Hh && M.floor[j * W + i] !== F.VOID && M.block[j * W + i] !== B.ARCH;
  const wallish0 = b => b === B.WALL || b === B.DOOR || b === B.ARCH || b === B.GREAT || b === B.LOW;
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i; if (!wallish0(M.block[k])) continue;
    const fS = walky(i, j + 1), fN = walky(i, j - 1), fE = walky(i + 1, j), fWw = walky(i - 1, j);
    let b = 0;
    if (M.block[k] === B.ARCH) { b = arch[k].along === 1 ? 1 : 4; }
    else { if (fS) b |= 1; else if (fN) b |= 2; if (fE) b |= 4; else if (fWw) b |= 8; }
    if (!b) { if (walky(i + 1, j + 1)) post[k] = 1; else if (walky(i - 1, j + 1)) post[k] = 2; else if (walky(i + 1, j - 1)) post[k] = 3; else if (walky(i - 1, j - 1)) post[k] = 4; }
    slab[k] = b;
    // the floor the rest of the cell carries, and the level the slab stands on
    const lvOf = (ii, jj) => LV[jj * W + ii] * STEP_PX;
    let base = 0;
    if (b & 1) base = Math.max(base, lvOf(i, j + 1)); if (b & 2) base = Math.max(base, lvOf(i, j - 1)); if (b & 4) base = Math.max(base, lvOf(i + 1, j)); if (b & 8) base = Math.max(base, lvOf(i - 1, j));
    if (M.block[k] === B.ARCH) base = lift(k);
    if (post[k]) { const [di, dj] = [[1, 1], [-1, 1], [1, -1], [-1, -1]][post[k] - 1]; base = lvOf(i + di, j + dj); }
    if (!b && !post[k]) base = wLift[k];
    wBase[k] = base;
    let lo = 0; if (fS) lo = Math.min(lo, lvOf(i, j + 1) - base); if (fE) lo = Math.min(lo, lvOf(i + 1, j) - base); wLo[k] = lo;
    if (M.block[k] !== B.ARCH) {
      const from = (b & 1) && fN ? [i, j - 1] : (b & 2) && fS ? [i, j + 1] : (b & 4) && fWw ? [i - 1, j] : (b & 8) && fE ? [i + 1, j] : null;
      if (from) { const n = from[1] * W + from[0]; pFloor[k] = M.floor[n]; pLv[k] = LV[n]; pFrom[k] = n; }
    }
  }
  // Where a cross wall meets a long wall, the meeting cell would put its slab on the other face; keep it in line with
  // the wall it belongs to (the floor carries on up to it as everywhere else along the line).
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i; if (M.block[k] !== B.WALL && M.block[k] !== B.DOOR) continue;
    const b = slab[k], at2 = (ii, jj) => ii >= 0 && jj >= 0 && ii < W && jj < Hh ? slab[jj * W + ii] : 0;
    let nb = b, src = null;
    if (b === 8 && (at2(i, j - 1) & 4 || at2(i, j + 1) & 4)) { nb = 4; src = [i - 1, j]; }
    else if (b === 4 && (at2(i, j - 1) & 8 || at2(i, j + 1) & 8) && !(at2(i, j - 1) & 4 || at2(i, j + 1) & 4)) { nb = 8; src = [i + 1, j]; }
    else if (b === 2 && (at2(i - 1, j) & 1 || at2(i + 1, j) & 1)) { nb = 1; src = [i, j - 1]; }
    else if (b === 1 && (at2(i - 1, j) & 2 || at2(i + 1, j) & 2) && !(at2(i - 1, j) & 1 || at2(i + 1, j) & 1)) { nb = 2; src = [i, j + 1]; }
    if (nb !== b) { slab[k] = nb; const n = src[1] * W + src[0]; pFloor[k] = M.floor[n]; pLv[k] = LV[n]; pFrom[k] = n; }
  }
  // One straight run of wall keeps to one edge: where part of it stands between two floors (on its south or east edge),
  // the rest of it, with floor on one side only, moves over to that edge too, so the wall doesn't step out halfway.
  { const plain = k => M.block[k] === B.WALL || M.block[k] === B.DOOR;
    for (const vert of [true, false]) {
      const far = vert ? 4 : 1, near = vert ? 8 : 2, step = vert ? W : 1, seen = new Uint8Array(W * Hh);
      for (let k = 0; k < W * Hh; k++) {
        if (seen[k] || !plain(k) || !(slab[k] & (far | near))) continue;
        const run = []; let n = k;
        while (n < W * Hh && plain(n) && slab[n] & (far | near)) { run.push(n); seen[n] = 1; if (!vert && (n + 1) % W === 0) break; n += step; }
        if (!run.some(c => slab[c] & far)) continue;
        for (const c of run) if (slab[c] === near) {
          const i = c % W, j = (c / W) | 0, src = vert ? (j * W + i - 1) : ((j - 1) * W + i);
          slab[c] = far; pFloor[c] = M.floor[src]; pLv[c] = LV[src]; pFrom[c] = src;
        } else if ((slab[c] & near) && !(slab[c] & far)) slab[c] = (slab[c] & ~near) | far;   // a corner on the run: its band too
      }
    } }
  // A wall cut down stands on the floor beside it; along one straight run of wall its coping keeps one height (the top
  // of the highest floor along it), so the cut wall reads as one straight line even where the floor steps.
  const cutH = new Int16Array(W * Hh).fill(CUT_H), runLow = new Int16Array(W * Hh).fill(-1);   // runLow: its foot, the lowest floor along the run
  { const wallLine = k => (M.block[k] === B.WALL || M.block[k] === B.DOOR) && pFrom[k] >= 0;
    const seen = new Uint8Array(W * Hh);
    for (let k = 0; k < W * Hh; k++) if (!seen[k] && wallLine(k) && slab[k]) {
      const vert = slab[k] & 12, step = vert ? W : 1, run = [];
      let s0 = k; while (s0 - step >= 0 && wallLine(s0 - step) && (slab[s0 - step] & (vert ? 12 : 3)) === (slab[k] & (vert ? 12 : 3))) s0 -= step;
      for (let n = s0; n < W * Hh && wallLine(n) && (slab[n] & (vert ? 12 : 3)) === (slab[k] & (vert ? 12 : 3)); n += step) { run.push(n); seen[n] = 1; if (!vert && (n + 1) % W === 0) break; }
      const top = Math.max(...run.map(n => pLv[n])) * STEP_PX + CUT_H, low = Math.min(...run.map(n => pLv[n])) * STEP_PX;
      const foot = Math.min(low, ...run.map(n => wBase[n] + wLo[n]));                // (and the lowest ground any of it looks onto)
      for (const n of run) runLow[n] = foot;
      for (const n of run) cutH[n] = top - pLv[n] * STEP_PX;
    }
    // a corner (no run of its own) reaches down as far as the runs meeting in it
    for (let k = 0; k < W * Hh; k++) if (runLow[k] < 0 && wallish0(M.block[k])) { let lo = -1; const i = k % W, j = (k / W) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= Hh) continue;
        const n = jj * W + ii; if (runLow[n] >= 0) lo = lo < 0 ? runLow[n] : Math.min(lo, runLow[n]); }
      if (lo >= 0) runLow[k] = lo; }
  }
  standLv = pLv;
  // ---- joints. A slab sits on one edge of its cell, so where two walls meet with their slabs on different edges (a wall
  // between two rooms stands on its south or east side, a room's own wall on the room's side) they would stop short of
  // each other. Every slab that ends against another wall cell carries on into it as an arm, out to the nearest slab or
  // arm crossing it there; an arm meeting a slab on the other edge of the same line steps across to it.
  const joint = new Array(W * Hh), noPost = new Uint8Array(W * Hh);
  { const T = WALL_T, hB = b => b & 1 ? [1 - T, 1] : b & 2 ? [0, T] : null, vB = b => b & 4 ? [1 - T, 1] : b & 8 ? [0, T] : null;
    const postR = p => [null, [1 - T, 1 - T, 1, 1], [0, 1 - T, T, 1], [1 - T, 0, 1, T], [0, 0, T, T]][p];
    const R = (h, a0, a1, b0, b1, t = h ? 'h' : 'v') => { const r = h ? [a0, b0, a1, b1] : [b0, a0, b1, a1]; r.t = t; return r; };   // a: along the arm, b: across it
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i; if (!wallish0(M.block[k]) || M.block[k] === B.ARCH) continue;
      const oh = hB(slab[k]), ov = vB(slab[k]), arms = [];
      for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= Hh) continue;
        const n = jj * W + ii; if (!wallish0(M.block[n])) continue;
        const h = di !== 0, band = h ? hB(slab[n]) : vB(slab[n]); if (!band) continue;
        const same = h ? oh : ov; if (same && same[0] === band[0]) continue;     // the line runs straight on
        arms.push({ h, s: h ? di : dj, band, n });
      }
      if (!arms.length) continue;
      const out = [], P = post[k] ? postR(post[k]) : null; let usedPost = false;
      for (const a of arms) {
        const [b0, b1] = a.band, perp = [], op = a.h ? ov : oh;
        if (op) perp.push(op);
        for (const c of arms) if (c.h !== a.h) perp.push(c.band);
        if (perp.length) {                                                         // out to the nearest wall across it
          const reach = a.s < 0 ? Math.min(...perp.map(p => p[1])) : Math.max(...perp.map(p => p[0]));
          const r = a.s < 0 ? R(a.h, 0, reach, b0, b1) : R(a.h, reach, 1, b0, b1); r.arm = a; out.push(r); continue;
        }
        const opp = arms.find(c => c.h === a.h && c.s === -a.s), other = (a.h ? oh : ov) || (opp && opp.band);
        if (other && other[0] === b0) { out.push(R(a.h, 0, 1, b0, b1)); continue; }   // straight through
        if (other) {                                                               // a step across to the other edge
          if (other === (a.h ? oh : ov) && a.s < 0 && M.block[a.n] !== B.ARCH) continue;   // (made once, by the cell before the step)
          const lo = Math.min(b0, other[0]), hi = Math.max(b1, other[1]);
          out.push(a.s < 0 ? R(a.h, 0, T, lo, hi, 'c') : R(a.h, 1 - T, 1, lo, hi, 'c')); continue;
        }
        if (P) {                                                                   // a dead end at a corner post: round to it
          const [p0, p1] = a.h ? [P[0], P[2]] : [P[1], P[3]], [q0, q1] = a.h ? [P[1], P[3]] : [P[0], P[2]];
          out.push(a.s < 0 ? R(a.h, 0, p1, b0, b1) : R(a.h, p0, 1, b0, b1));
          out.push(R(a.h, p0, p1, Math.min(b0, q0), Math.max(b1, q1), 'c')); usedPost = true;
        }
      }
      // an arm runs on to every wall across it that it meets, not only the nearest (they may stand on different edges)
      const own = [oh && R(true, 0, 1, oh[0], oh[1]), ov && R(false, 0, 1, ov[0], ov[1])].filter(Boolean);
      for (let pass = 0; pass < 2; pass++) for (const r of out) { const a = r.arm; if (!a) continue;
        for (const q of [...out, ...own]) { if (q === r || q.t !== (a.h ? 'v' : 'h')) continue;
          if (a.h ? !(q[1] < r[3] && q[3] > r[1]) : !(q[0] < r[2] && q[2] > r[0])) continue;
          if (a.h) { if (a.s < 0) r[2] = Math.max(r[2], q[2]); else r[0] = Math.min(r[0], q[0]); }
          else { if (a.s < 0) r[3] = Math.max(r[3], q[3]); else r[1] = Math.min(r[1], q[1]); } } }
      // a corner post standing apart from the arms that now close the corner is left out
      if (P && !usedPost) { const hit = out.some(r => r[0] < P[2] && r[2] > P[0] && r[1] < P[3] && r[3] > P[1]); if (!hit) noPost[k] = 1; }
      if (out.length) joint[k] = out;
    } }
  // The slab's rectangles in its cell (for drawing).
  const T_ = WALL_T, slabRects = k => {
    const b = slab[k], out = [], p = noPost[k] ? 0 : post[k];
    const tag = (r, t) => (r.t = t, r);
    if (b & 1) out.push(tag([0, 1 - T_, 1, 1], 'h')); if (b & 2) out.push(tag([0, 0, 1, T_], 'h')); if (b & 4) out.push(tag([1 - T_, 0, 1, 1], 'v')); if (b & 8) out.push(tag([0, 0, T_, 1], 'v'));
    // a corner holding both bands: neither runs on past the other where no wall carries on beyond the cell (it would stick
    // out across the floor there)
    if ((b & 3) && (b & 12)) { const ci = k % W, cj = (k / W) | 0, wl = (ii, jj) => ii >= 0 && jj >= 0 && ii < W && jj < Hh && wallish0(M.block[jj * W + ii]);
      const vx = b & 4 ? [1 - T_, 1] : [0, T_], hy = b & 1 ? [1 - T_, 1] : [0, T_];
      for (const r of out) { if (r.t === 'h') { if (!wl(ci - 1, cj)) r[0] = Math.max(r[0], vx[0]); if (!wl(ci + 1, cj)) r[2] = Math.min(r[2], vx[1]); }
        else if (r.t === 'v') { if (!wl(ci, cj - 1)) r[1] = Math.max(r[1], hy[0]); if (!wl(ci, cj + 1)) r[3] = Math.min(r[3], hy[1]); } } }
    if (p === 1) out.push([1 - T_, 1 - T_, 1, 1]); if (p === 2) out.push([0, 1 - T_, T_, 1]); if (p === 3) out.push([1 - T_, 0, 1, T_]); if (p === 4) out.push([0, 0, T_, T_]);
    if (joint[k]) out.push(...joint[k]);
    return out;
  };
  // A corner where walls of rooms at different heights meet: seen from the upper room it rises with that room's walls
  // (cornerUp: how much higher, cornerR: that room); from anywhere else it keeps to the lower walls it joins.
  // a doorway cut down reaches down as far as the wall either side of it, and the floor beyond it
  // the lowest floor of each room: a wall cut down for it reaches no further down than that, as in a room on the ground
  let roomLow = null;                                                                   // (filled once the rooms are known)
  const archLow = (k, sb) => { const A = arch[k], d = A.along === 1 ? 1 : W, s0 = k - A.idx * d;
    let lo = 0; for (const e of [s0 - d, s0 + A.n * d]) if (e >= 0 && e < W * Hh && runLow[e] >= 0) lo = Math.min(lo, runLow[e] - sb);
    const fd = A.along === 1 ? W : 1; for (let n = k + fd, m = 0; m < 8 && n < W * Hh && M.floor[n] && !wallish0(M.block[n]); n += fd, m++) lo = Math.min(lo, LV[n] * STEP_PX - sb);
    return lo; };
  let lastRoom = -1;                                                                    // (the room he was last in)
  const cornerUp = new Int16Array(W * Hh), cornerR = new Int16Array(W * Hh).fill(-1);
  for (let j = 1; j < Hh - 1; j++) for (let i = 1; i < W - 1; i++) { const k = j * W + i; if (!(joint[k] || (slab[k] & 3) && (slab[k] & 12)) || M.block[k] !== B.WALL) continue;   // (a joint, or a corner holding both its bands)
    let m = 0, q = null; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const n = k + dj * W + di; if (M.floor[n] && !OUTDOOR.has(M.floor[n]) && !wallish0(M.block[n]) && LV[n] * STEP_PX > m) { m = LV[n] * STEP_PX; q = [di, dj]; } }
    if (m > wBase[k]) { cornerUp[k] = m - wBase[k]; cornerR[k] = k + q[1] * W + q[0]; } }   // (the upper room's cell beside it)
  const jointKey = k => joint[k] ? '.j' + joint[k].map(r => r.map(v => Math.round(v * 10)).join('')).join('/') + (noPost[k] ? 'n' : '') : '';
  // A corner of the outer walls with no floor beside it, only across a corner: the open ground there runs on under it
  // (else a dark notch shows at the foot of the wall).
  for (let j = 1; j < Hh - 1; j++) for (let i = 1; i < W - 1; i++) { const k = j * W + i; if (pFloor[k] || !wallish0(M.block[k])) continue;
    for (const [di, dj] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = (j + dj) * W + i + di;
      if (OUTDOOR.has(M.floor[n]) && !wallish0(M.block[n])) { pFloor[k] = M.floor[n]; pLv[k] = LV[n]; break; } } }
  // Where a ray can find no floor (far outside the walls), the floor painter needn't look.
  const nearFloor = new Uint8Array(W * Hh), flat = new Uint8Array(W * Hh);
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    let any = false, same = !!pFloor[j * W + i];
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= Hh) continue; const n = jj * W + ii;
      if (pFloor[n]) { any = true; if (pLv[n] !== pLv[j * W + i]) same = false; } else if (M.block[n] && Math.abs(di) <= 1 && Math.abs(dj) <= 1) same = false; }
    nearFloor[j * W + i] = any; flat[j * W + i] = same;
  }

  // ---- rooms: floor flooded through open ground, stopping at doorways and where one named place meets another
  // (the presbytery and the nave are one hall).
  const zoneOf = new Int16Array(W * Hh).fill(-1);
  // (the clock tower opens straight off the stores, no wall between: one room too)
  { const Z = M.zones || [], ix = name => Z.findIndex(z => z.name === name), one = { 'Presbiterio': ix('Nave central'), 'Torre del reloj': ix('Almacén'), 'Patio de la fuente': ix('Atrio'), 'Calle de los Penitentes': ix('Atrio'), 'Jardines de la catedral': ix('Atrio') };   // (and all the open ground is one place)
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) { const n = Z.findIndex(z => i >= z.r[0] && i < z.r[2] && j >= z.r[1] && j < z.r[3]);
      zoneOf[j * W + i] = n >= 0 && one[Z[n].name] >= 0 ? one[Z[n].name] : n; } }
  const room = new Int16Array(W * Hh).fill(-1); let rooms = 0;
  for (let k = 0; k < W * Hh; k++) {
    if (room[k] >= 0 || !M.floor[k] || M.block[k] === B.ARCH) continue;
    const q = [k]; room[k] = rooms;
    while (q.length) { const c = q.pop(), i = c % W, j = (c / W) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= Hh) continue;
        const n = jj * W + ii; if (room[n] >= 0 || !M.floor[n] || M.block[n] === B.ARCH || zoneOf[n] !== zoneOf[c]) continue; room[n] = rooms; q.push(n); } }
    rooms++;
  }
  // ---- only the room he is in is shown (like Diablo): everything else stays black, but its doorways show.
  // adj[k]: the rooms a cell belongs to — its own, or for a wall or a doorway, the rooms right beside it.
  const adj = new Array(W * Hh);
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i; if (room[k] >= 0) { adj[k] = [room[k]]; continue; }
    if (!M.block[k]) continue;
    const s2 = new Set(); for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < W && jj < Hh && room[jj * W + ii] >= 0) s2.add(room[jj * W + ii]); }
    adj[k] = [...s2];
  }
roomLow = new Int16Array(rooms).fill(32767); for (let k = 0; k < W * Hh; k++) if (room[k] >= 0) roomLow[room[k]] = Math.min(roomLow[room[k]], LV[k] * STEP_PX);
  let cur = -1, showAll = false;
  // Out in the open the building's whole outer face stands in view, whichever room each stretch of it belongs to.
  const shown = k => showAll || cur < 0 || (adj[k] ? adj[k].includes(cur) : false) || (openRoom[cur] === 1 && wExt[k] === 1);
  const roomsAt = (x, y) => { const i = Math.floor(x / CELL), j = Math.floor(y / CELL); return i >= 0 && j >= 0 && i < W && j < Hh ? adj[j * W + i] || [] : []; };
  const shownAt = (x, y) => showAll || cur < 0 || roomsAt(x, y).includes(cur);
  function focus(x, y) { const i = Math.floor(x / CELL), j = Math.floor(y / CELL); if (i >= 0 && j >= 0 && i < W && j < Hh && room[j * W + i] >= 0) cur = room[j * W + i]; }
  // Each wall knows which rooms it stands in front of (their floor lies behind it, to the west or north).
  const frontOf = new Map();
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i; if (!isWall(M.block[k])) continue;
    // Only what lies straight behind it along the camera's line of sight (the same screen column, further up the
    // screen), up to three cells deep, since walls are often two or three cells thick where rooms meet. Rooms off to
    // the side are not hidden by it.
    const s = new Set();
    for (let d = 1; d <= 3; d++) for (const [di, dj] of [[-d, -d], [-d, 1 - d], [1 - d, -d]]) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < W && jj < Hh && room[jj * W + ii] >= 0) s.add(room[jj * W + ii]); }
    // a corner where a room's back wall meets its front wall: the room lies diagonally beside it
    if (M.block[k] !== B.ARCH) for (const [di, dj] of [[-1, 1], [1, -1]]) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= Hh) continue;
      const r = room[jj * W + ii], at = (a, b) => a >= 0 && b >= 0 && a < W && b < Hh && room[b * W + a] === r;
      if (r >= 0 && !at(i + di, j) && !at(i, j + dj) && !OUTDOOR.has(M.floor[jj * W + ii])) s.add(r); }   // (open ground has no front wall to cut down)   // (only a true corner: not a wall that faces that room straight on)
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
    // (no face of its own: the building's outer face, unless it is a junction inside, walls running on south and east)
    const inner = () => { const w = (ii, jj) => ii < W && jj < Hh && wallish0(M.block[jj * W + ii]); return w(i + 1, j) && w(i, j + 1); };
    wExt[k] = n >= 0 ? OUTDOOR.has(M.floor[n]) : (isFloor(i, j - 1) || isFloor(i - 1, j)) && !inner(); }
  // the corner at the end of an outer wall (no face of its own) stands as tall as the wall it ends
  for (let j = 1; j < Hh; j++) for (let i = 1; i < W; i++) { const k = j * W + i; if (M.block[k] === B.WALL && !wFace[k] && !wExt[k] && (wExt[k - W] && wFace[k - W] === 2 || wExt[k - 1] && wFace[k - 1] === 1 || j + 1 < Hh && wExt[k + W] && wFace[k + W] === 2 || i + 1 < W && wExt[k + 1] && wFace[k + 1] === 1)) wExt[k] = 1; }
  // a doorway out into open ground stands as tall as the outer wall it is cut in
  for (let k = 0; k < W * Hh; k++) if (arch[k]) { const i = k % W, j = (k / W) | 0, o = (ii, jj) => ii >= 0 && jj >= 0 && ii < W && jj < Hh && OUTDOOR.has(M.floor[jj * W + ii]);
    wExt[k] = arch[k].along === 1 ? o(i, j - 1) || o(i, j + 1) : o(i - 1, j) || o(i + 1, j); }
  const winOK = (i, j, f) => outsideOf(i, j, f) || wExt[j * W + i];
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, t = M.block[k]; if (!isWall(t)) continue;
    if (t === B.GREAT) { if (!great) great = { i0: i, j, n: 0 }; great.n++; continue; }
    if (t !== B.WALL || !wFace[k] || wFeat[k]) continue;
    const along = wFace[k] === 1 ? i : j, outside = winOK(i, j, wFace[k]);
    const [fx, fy] = wFace[k] === 1 ? [i + .5, j + 1] : [i + 1, j + .5];
    const [ni, nj] = wFace[k] === 1 ? [i + 1, j] : [i, j + 1], nk = nj * W + ni;
    // either side of a doorway raised on a step (the stairs' arches) a candle, so both walls show alike
    const besideStair = [-1, 1].some(s => { const ii = wFace[k] === 1 ? i + s : i, jj = wFace[k] === 1 ? j : j + s, n = jj * W + ii;
      return ii >= 0 && jj >= 0 && ii < W && jj < Hh && M.block[n] === B.ARCH && LV[n] > LV[(j + (wFace[k] === 1 ? 1 : 0)) * W + i + (wFace[k] === 1 ? 0 : 1)]; });
    const sameRun = (ii, jj) => ii >= 0 && jj >= 0 && ii < W && jj < Hh && M.block[jj * W + ii] === B.WALL && wFace[jj * W + ii] === wFace[k];
    const straight = wFace[k] === 1 ? sameRun(i - 1, j) && sameRun(ni + 1, nj) : sameRun(i, j - 1) && sameRun(ni, nj + 1);
    if (!besideStair && outside && straight && along % 7 === 2 && ni < W && nj < Hh && M.block[nk] === B.WALL && wFace[nk] === wFace[k] && winOK(ni, nj, wFace[k]) && !wFeat[nk]) {
      wFeat[k] = 1; wFeat[nk] = 1; wPart[nk] = 1;
      const [gx, gy] = wFace[k] === 1 ? [i + 1, j + 1] : [i + 1, j + 1];
      lights.push({ x: gx * CELL, y: gy * CELL, z: (WALL_H - 50 + wLift[k]) / V, col: [96, 70, 150], r: 40, cellK: k, side: wFace[k] === 1 ? (j + 1) * W + i : j * W + i + 1 });   // (it glows on the side it faces)
      const g0 = GLASS[Math.floor(hash(i, j, 21) * 5)], g1 = GLASS[Math.floor(hash(i, j, 22) * 5)];
      const L = 4.4, quad = (a, b) => wFace[k] === 1
        ? [[i + .2 + a * .6, j + 1], [i + .2 + b * .6, j + 1], [i + .2 + b * .6 + MOON[0] * L, j + 1 + MOON[1] * L], [i + .2 + a * .6 + MOON[0] * L, j + 1 + MOON[1] * L]]
        : [[i + 1, j + .2 + a * .6], [i + 1, j + .2 + b * .6], [i + 1 + MOON[1] * L, j + .2 + b * .6 + MOON[0] * L], [i + 1 + MOON[1] * L, j + .2 + a * .6 + MOON[0] * L]];
      if (COLOURED_RAYS) beams.push({ parts: [[quad(0, .33), g0], [quad(.33, .67), [120, 130, 170]], [quad(.67, 1), g1]], seed: hash(i, j, 5), k: .42 });
    } else if (!besideStair && along % 7 === 5) wFeat[k] = 3;
    else if (!besideStair && (!outside || wExt[k]) && hash(i, j, 41) < .16) wFeat[k] = 4;
    else if (besideStair || hash(i, j, 43) < .14) {
      wFeat[k] = 2;
      lights.push({ x: fx * CELL, y: fy * CELL, z: (WALL_H - Math.floor(WALL_H * .47) + 4 + wLift[k]) / V, col: [255, 150, 70], r: 52, flicker: hash(i, j) * 9, cellK: k });
      { const x = wFace[k] === 1 ? 9 : 30, fl = [20 * (i - j) - 20 + x, GY * (i + j) - WALL_H + BOT[x] + 1 + Math.floor(WALL_H * .47) - 5 - wLift[k], hash(i, j) * 9]; fl.cellK = k; flames.push(fl); }
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
  // a doorway onto open ground (whatever its paving: the runner too) is part of the outer face
  for (let k = 0; k < W * Hh; k++) if (arch[k]) { const i = k % W, j = (k / W) | 0, o = (ii, jj) => ii >= 0 && jj >= 0 && ii < W && jj < Hh && room[jj * W + ii] >= 0 && openRoom[room[jj * W + ii]] === 1;
    if (arch[k].along === 1 ? o(i, j - 1) || o(i, j + 1) : o(i - 1, j) || o(i + 1, j)) wExt[k] = 1; }
  // ---- the church seen from outside (src/exterior.js): above the eaves one sprite, at its feet buttresses and the porch
  let roofs = null;
  const PXC = CELL * V;                                                                // pixels of height per cell of run
  function buildRoofs() {
    let outRoom = -1; for (let k = 0; k < W * Hh && outRoom < 0; k++) if (room[k] >= 0 && openRoom[room[k]]) outRoom = room[k];
    const X = buildExterior({ O: M.OX, E: 2 * STEP_PX + WALL_EXT, G: 2 * STEP_PX, PXC, CELL, V });
    roofs = X.objects;
    for (const [i, j] of X.solids) if (i >= 0 && j >= 0 && i < W && j < Hh) extSolid[j * W + i] = 1;
    for (const L of X.lights) { L.rooms = [outRoom]; const [sx, sy] = toScr(L.x, L.y, L.z); L.sx = sx; L.sy = sy; L.spr = lightSprite(L.col, L.r); lights.push(L); }
    for (const f of X.flames) { f[4] = [outRoom]; flames.push(f); }
  }
  // (built just after the game starts, when the browser is idle: not in the way of loading, nor the first step outside)
  setTimeout(() => (window.requestIdleCallback || (f => f()))(() => { if (!roofs) buildRoofs(); }, { timeout: 3000 }), 400);
  const sky = (i, j) => { const k = j * W + i; return !!M.floor[k] && (OUTDOOR.has(M.floor[k]) || (room[k] >= 0 && openRoom[room[k]])); };
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i; if (!sky(i, j) || (i > 0 && sky(i - 1, j) && LV[k - 1] === LV[k])) continue;      // one strip per run of open cells
    let e = i; while (e < W && sky(e, j) && LV[j * W + e] === LV[k]) e++;
    // (where nothing of the church stands behind it, the moonlight reaches up too: the trees there are lit to their tops)
    let tall = 14; for (let d = 1; d <= 14 && tall === 14; d++) for (let x = i; x < e; x++) { const ii = x - d, jj = j - d; if (ii >= 0 && jj >= 0 && (M.block[jj * W + ii] && M.block[jj * W + ii] !== B.PROP && M.block[jj * W + ii] !== B.LOW || (M.floor[jj * W + ii] && !sky(ii, jj)))) { tall = d - 1; break; } }
    tall = Math.min(260, tall * 2 * GY);                                              // (up to where the church begins behind it)
    beams.push({ parts: [[[[i, j], [e, j], [e, j + 1], [i, j + 1]], [86, 100, 150]]], seed: hash(i, j, 3), k: 1, sky: 1, up: lift(k), tall }); }
  // Light from furniture and piers.
  for (const P of M.props) {
    const up = lift(P.y * W + P.x);
    for (const [x, y, z, col, r] of propLights(P.type, P.rot)) lights.push({ x: (P.x + x) * CELL, y: (P.y + y) * CELL, z: (z + up) / V, col, r, flicker: hash(P.x, P.y) * 9, cellK: P.y * W + P.x });
    for (const [x, y, z] of propFlames(P.type, P.rot)) { const [sx, sy] = toScr((P.x + x) * CELL, (P.y + y) * CELL, (z + up) / V), fl = [sx, sy - 1, hash(P.x * 7 + x * 13, P.y + y * 11) * 9, PROPS[P.type].hang]; fl.cellK = P.y * W + P.x; flames.push(fl); }
  }
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) if (M.block[j * W + i] === B.COLUMN && M.vari[j * W + i] === 2) {
    const up = lift(j * W + i);
    lights.push({ sx: 20 * (i - j) - 20 + 10, sy: GY * (i + j) - 46 - up, col: [255, 150, 70], r: 54, flicker: hash(i, j) * 9, screen: 1, cellK: j * W + i });
    { const fl = [20 * (i - j) - 20 + 10, GY * (i + j) - 47 - up, hash(i, j) * 9]; fl.cellK = j * W + i; flames.push(fl); }
  }
  // (the rooms each light belongs to: by the cell it shines from; a wall candle's own cell is its wall)
  for (const L of lights) if (!L.rooms) L.rooms = L.side !== undefined && room[L.side] >= 0 ? [room[L.side]] : L.cellK !== undefined ? adj[L.cellK] : roomsAt(L.x, L.y);
  for (const f of flames) if (!f[4]) f[4] = f.cellK !== undefined ? adj[f.cellK] : null;
  for (const b of beams) if (!b.rooms && b.parts[0]) { const [[x, y]] = b.parts[0][0]; b.rooms = adj[Math.floor(y + .5) * W + Math.floor(x + .5)] || null; }
  for (const L of lights) { if (!L.screen) { const [sx, sy] = toScr(L.x, L.y, L.z); L.sx = sx; L.sy = sy; } L.spr = lightSprite(L.col, L.r); }
  for (const b of beams) { b.scr = b.parts.map(([q, col]) => [q.map(([x, y]) => { const [sx, sy] = toScr(x * CELL, y * CELL); return [sx, sy - (b.up || 0)]; }), col]);
    if (b.tall) { const [[a, c, e2, f2], col] = b.scr[0]; b.scr[0] = [[[a[0], a[1] - b.tall], [c[0], c[1] - b.tall], c, e2, f2, a], col]; }
    const all = b.scr.flatMap(p => p[0]); b.x0 = Math.min(...all.map(p => p[0])); b.x1 = Math.max(...all.map(p => p[0])); b.y0 = Math.min(...all.map(p => p[1])); b.y1 = Math.max(...all.map(p => p[1])); }

  // ---- floor and blood
  function genFloor(cx, cy) {
    const [c, g] = canvas(CS, CS), im = g.createImageData(CS, CS), d = im.data, FL = pFloor, lp = k => pLv[k] * STEP_PX;
    const cellAt = (X, Y) => { const fi = ((Y + .5) / GY + (X + .5) / 20) / 2, fj = ((Y + .5) / GY - (X + .5) / 20) / 2; return [fi, fj, Math.floor(fi), Math.floor(fj)]; };
    for (let y = 0; y < CS; y++) for (let x = 0; x < CS; x++) {
      const X = cx * CS + x, Y = cy * CS + y, o = (y * CS + x) * 4;
      if (rb && X >= rb.x0 && X <= rb.x1 && Y >= rb.y0 && Y <= rb.y1) {
        // On level ground, the floor under this pixel is found in a guess or two.
        let z = 0, done = false, far = true;
        for (let it = 0; it < 3; it++) {
          const [fi, fj, i, j] = cellAt(X, Y + z); if (i < 0 || j < 0 || i >= W || j >= Hh) break;
          const k = j * W + i; if (nearFloor[k]) far = false; if (!FL[k]) break;
          const l = lp(k); if (l === z) { if (flat[k]) { floorColor(M, FL[k], i, j, fi - i, fj - j, X, Y, px); d[o] = px[0]; d[o + 1] = px[1]; d[o + 2] = px[2]; d[o + 3] = 255; done = true; } break; }
          z = l;
        }
        if (done) continue;
        if (far) { const [, , i, j] = cellAt(X, Y + LMAX); if (i < 0 || j < 0 || i >= W || j >= Hh || !nearFloor[j * W + i]) continue; }
        // Otherwise follow the view ray down from the highest floor; the first floor it meets is what shows,
        // a top or, if it came in through the side, the face of a step or a drop.
        let prev = null;
        for (let z = LMAX; z >= 0; z--) {
          const [fi, fj, i, j] = cellAt(X, Y + z); if (i < 0 || j < 0 || i >= W || j >= Hh) { prev = null; continue; }
          const k = j * W + i, l = FL[k] ? lp(k) : 0; if (l < z) { prev = [i, j]; continue; }
          const t = FL[k]; if (!t) break;
          if (l === z || !prev || (prev[0] === i && prev[1] === j)) floorColor(M, t, i, j, fi - i, fj - j, X, Y, px);
          else if (t === F.WOOD) { const [ai, aj] = cellAt(X, Y + l); floorColor(M, t, i, j, ai - i, aj - j, X, Y, px); }   // a wooden floor's edge: the boards running on as the floor, unbroken   // a wooden floor's edge: its boards, as the floor (not in the shade of a wall's foot)
          else {                                                                     // a riser: stone, or the runner going up it
            const south = prev[1] > j, along = south ? fi - i : fj - j, down = l - z, carpet = t === F.CARPET;
            const pk = prev[1] * W + prev[0], drop = l - (FL[pk] ? lp(pk) : 0);
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
      const t = FL[j * W + i]; if (!t) continue;
      floorColor(M, t, i, j, fi - i, fj - j, X, Y, px);
      d[o] = px[0]; d[o + 1] = px[1]; d[o + 2] = px[2]; d[o + 3] = 255;
    }
    g.putImageData(im, 0, 0); return c;
  }
  const eachChunk = (ox, oy, vw, vh, fn) => { for (let cy = Math.floor(-oy / CS); cy <= Math.floor((-oy + vh) / CS); cy++) for (let cx = Math.floor(-ox / CS); cx <= Math.floor((-ox + vw) / CS); cx++) fn(cx, cy, cx + ',' + cy); };
  // A room's mask in map screen space: every floor cell of it (and the floor under its walls and doorways), each from its
  // raised top down to the ground so steps are covered too.
  const masks = new Map();
  function roomMask(r) {
    let m = masks.get(r); if (m) return m;
    const cells = []; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    // A cell of the room: all of it. A wall or doorway beside it: a doorway whole; a wall only the half on this room's
    // side (the other half is the next room's floor, which stays dark).
    for (let k = 0; k < W * Hh; k++) if (pFloor[k] && adj[k] && adj[k].includes(r)) {
      const i = k % W, j = (k / W) | 0, X = 20 * (i - j), Y = GY * (i + j), up = pLv[k] * STEP_PX;
      const parts = [];
      if (room[k] === r || M.block[k] === B.ARCH || (pFrom[k] < 0 && openRoom[r] && OUTDOOR.has(pFloor[k]))) parts.push([0, 0, 1, 1]);   // (a corner the open ground runs under: all of it)
      // (or a corner the open ground runs under)
      else if ((pFrom[k] >= 0 && room[pFrom[k]] === r) || (pFrom[k] < 0 && openRoom[r] && OUTDOOR.has(pFloor[k]))) { const b = slab[k], T = WALL_T; parts.push([b & 8 ? T : 0, b & 2 ? T : 0, b & 4 ? 1 - T : 1, b & 1 ? 1 - T : 1]); }   // this room's floor, up to the slab
      // a riser shows only where this room's own floor drops to more of this room
      const mine = n => room[n] === r || (M.block[n] === B.ARCH && adj[n] && adj[n].includes(r)) || (pFrom[n] >= 0 && room[pFrom[n]] === r);   // (a doorway's threshold too: the floor's edge down to it shows)
      const drop = (ii, jj) => { const n = jj * W + ii; return mine(k) && ii < W && jj < Hh && mine(n) && pLv[n] < pLv[k] ? pLv[n] * STEP_PX : -1; };   // down to the floor below it
      for (const q of parts) cells.push([X, Y, [drop(i, j + 1), drop(i + 1, j)], q, up]);
      x0 = Math.min(x0, X - 21); x1 = Math.max(x1, X + 21); y0 = Math.min(y0, Y - up - 1); y1 = Math.max(y1, Y + DH + 1);
    }
    const [c, g] = canvas(Math.max(1, x1 - x0), Math.max(1, y1 - y0)); g.fillStyle = '#fff'; g.beginPath();
    const P = (x, y, u, v, up) => [x + 20 * (u - v), y + GY * (u + v) - up];
    for (const [X, Y, side, [u0, v0, u1, v1], up] of cells) { const x = X - x0, y = Y - y0;
      for (const h of [up]) {                                                         // the top (its front faces below, unless under a wall)
        const pts = [P(x, y, u0, v0, h), P(x, y, u1, v0, h), P(x, y, u1, v1, h), P(x, y, u0, v1, h)];
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1] - .5); g.lineTo(pts[1][0] + .5, pts[1][1]); g.lineTo(pts[2][0], pts[2][1] + .5); g.lineTo(pts[3][0] - .5, pts[3][1]); g.fill(); }
      const a = P(x, y, u0, v1, up), b = P(x, y, u1, v1, up);
      if (side[0] >= 0) { const c2 = P(x, y, u1, v1, side[0]), d = P(x, y, u0, v1, side[0]); g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c2); g.lineTo(...d); g.fill(); }
      if (side[1] >= 0) { const c2 = P(x, y, u1, v1, side[1]), e = P(x, y, u1, v0, up), f = P(x, y, u1, v0, side[1]); g.beginPath(); g.moveTo(...e); g.lineTo(...b); g.lineTo(...c2); g.lineTo(...f); g.fill(); }
    } m = { c, x0, y0 }; masks.set(r, m); return m;
  }
  const [fbuf, fb] = canvas(8, 8);
  function drawFloor(g, ox, oy, vw, vh, budget = 2, keep = true) {
    const masked = !showAll && cur >= 0, t = masked ? fb : g;
    if (masked) { if (fbuf.width !== Math.ceil(vw) || fbuf.height !== Math.ceil(vh)) { fbuf.width = Math.ceil(vw); fbuf.height = Math.ceil(vh); } fb.globalCompositeOperation = 'source-over'; fb.clearRect(0, 0, fbuf.width, fbuf.height); }
    eachChunk(ox, oy, vw, vh, (cx, cy, k) => { let c = floorChunks.get(k); if (!c && budget-- > 0) { c = genFloor(cx, cy); if (keep) floorChunks.set(k, c); } if (c) t.drawImage(c, cx * CS + ox, cy * CS + oy); });
    eachChunk(ox, oy, vw, vh, (cx, cy, k) => { const c = bloodChunks.get(k); if (c) t.drawImage(c[0], cx * CS + ox, cy * CS + oy); });
    if (masked) { const m = roomMask(cur); fb.globalCompositeOperation = 'destination-in'; { const mx = m.x0 + ox, my = m.y0 + oy, sx = Math.max(0, -mx), sy = Math.max(0, -my), sw = Math.min(m.c.width - sx, fbuf.width - mx - sx), sh = Math.min(m.c.height - sy, fbuf.height - my - sy);   // (only what is on screen of it)
        if (sw > 0 && sh > 0) fb.drawImage(m.c, sx, sy, sw, sh, mx + sx, my + sy, sw, sh); else fb.clearRect(0, 0, fbuf.width, fbuf.height); } fb.globalCompositeOperation = 'source-over'; g.drawImage(fbuf, 0, 0); }
  }
  const blood = { fillStyle: '#000', fillRect(x, y, w, h) { const cx = Math.floor(x / CS), cy = Math.floor(y / CS), k = cx + ',' + cy; let c = bloodChunks.get(k); if (!c) { c = canvas(CS, CS); bloodChunks.set(k, c); } c[1].fillStyle = this.fillStyle; c[1].fillRect(x - cx * CS, y - cy * CS, w, h); } };
  const clearBlood = () => bloodChunks.clear();

  // ---- sprites for each kind of cell
  // The row on a cell sprite where a wall face meets the top of its slab, column x (for things fixed to the face).
  const faceTop = x => x < 20 ? GY * (x / 20 + 1) : GY * (1 + (40 - x) / 20);
  // Beside a doorway raised on a step (the stairs' arches), the wall sinks into the dark as high up as the doorway does,
  // easing back to its own over a few cells, so the two read as one wall.
  const fadeLift = new Int16Array(W * Hh);
  for (let k = 0; k < W * Hh; k++) { const A = arch[k]; if (!A || A.idx !== 0) continue;
    const d = A.along === 1 ? 1 : W, ends = [k - d, k + A.n * d];
    ends.forEach((e, side) => { const dir = side ? d : -d;
      for (let n = e, m = 0; m < 4 && n >= 0 && n < W * Hh && (M.block[n] === B.WALL || M.block[n] === B.DOOR); n += dir, m++) {
        const off = wBase[k] - wBase[n]; if (off <= 0) break; fadeLift[n] = Math.max(fadeLift[n], Math.round(off * (1 - m / 4))); } }); }
  // ... and the doorway itself is no taller than that wall: its top in line with the wall's, however high its step
  const archDrop = new Int16Array(W * Hh);
  for (let k = 0; k < W * Hh; k++) { const A = arch[k]; if (!A || A.idx !== 0) continue;
    const d = A.along === 1 ? 1 : W, ns = [k - d, k + A.n * d].filter(n => n >= 0 && n < W * Hh && (M.block[n] === B.WALL || M.block[n] === B.DOOR));
    const drop = ns.length ? Math.max(0, wBase[k] - Math.min(...ns.map(n => wBase[n]))) : 0;
    for (let c = 0; c < A.n; c++) archDrop[k + c * d] = drop; }
  // Of a wall cut down for room r, the parts that are that room's back wall (a band running west–east with the room to
  // its south, or north–south with the room to its east) stay standing: bit n for slabRects(k)[n].
  const inRoom = (ii, jj, r) => ii >= 0 && jj >= 0 && ii < W && jj < Hh && room[jj * W + ii] === r;
  function keepMask(k, r) {
    const i = k % W, j = (k / W) | 0; let m = 0;
    slabRects(k).forEach((q, n) => {
      const back = q.t === 'h' ? [-1, 0, 1].some(d => inRoom(i + d, j + 1, r)) && ![-1, 0, 1].some(d => inRoom(i + d, j - 1, r))
        : q.t === 'v' ? [-1, 0, 1].some(d => inRoom(i + 1, j + d, r)) && ![-1, 0, 1].some(d => inRoom(i - 1, j + d, r)) : false;
      if (back) m |= 1 << n;
    });
    // the side of an opening through the back wall (a stair coming up through it): a jamb, left whole
    const rs = slabRects(k);
    if (rs.some((q, n) => m >> n & 1 && q.t === 'h') && inRoom(i - 1, j, r)) m = (1 << rs.length) - 1;
    if (rs.some((q, n) => m >> n & 1 && q.t === 'v') && inRoom(i, j - 1, r)) m = (1 << rs.length) - 1;
    return m;
  }
  // Cut down for room r lying on one side of it only, a cell keeps to that side of its own wall there: [x0, y0, x1, y1].
  function clipFor(k, r) {
    const i = k % W, j = (k / W) | 0, rs = slabRects(k), side = (di, dj) => [-1, 0, 1].some(d => di ? inRoom(i + di, j + d, r) : inRoom(i + d, j + dj, r));
    const v = rs.filter(q => q.t === 'v'), h = rs.filter(q => q.t === 'h'), c = [0, 0, 1, 1];
    if (v.length && side(-1, 0) && !side(1, 0)) c[2] = Math.max(...v.map(q => q[2]));
    if (v.length && side(1, 0) && !side(-1, 0)) c[0] = Math.min(...v.map(q => q[0]));
    if (h.length && side(0, -1) && !side(0, 1)) c[3] = Math.max(...h.map(q => q[3]));
    if (h.length && side(0, 1) && !side(0, -1)) c[1] = Math.min(...h.map(q => q[1]));
    return c[0] || c[1] || c[2] < 1 || c[3] < 1 ? c : null;
  }
  // The floor a cut-down corner (a cell with no floor of its own to carry) stands on: the room's, beside it.
  function stubLevel(k, r) {
    const i = k % W, j = (k / W) | 0; let lv = -1;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (inRoom(i + di, j + dj, r)) lv = Math.max(lv, pLv[(j + dj) * W + i + di]);
    return lv;
  }
  function wallSprite(t, i, j, k, cutDown, p = 0, keep = 0, tallH = 0, stubLo = 0, sb = 0, clip = null, out = false) {
    const upC = !cutDown && !out && cornerUp[k] > 0 && cornerR[k] >= 0 && room[cornerR[k]] === lastRoom;
    const ext = !cutDown && (t === B.WALL || t === B.ARCH) && wExt[k], fa = wFace[k], fe = cutDown ? 0 : wFeat[k];
    const h = cutDown ? cutH[k] : t === B.GREAT ? GREAT_H : ext && out ? FACADE_H : WALL_H - (t === B.ARCH ? archDrop[k] : 0), lo = cutDown ? stubLo : upC ? Math.min(wLo[k], -cornerUp[k]) : wLo[k];
    // what is cut down never reaches behind the back wall left standing (it belongs to the next room)
    let rs = slabRects(k).map((q, n) => { const r = [...q]; r.keep = keep >> n & 1; return r; });
    if (keep) {
      let yMin = 0, xMin = 0;
      for (const [n, q] of slabRects(k).entries()) if (keep >> n & 1) { if (q.t === 'h') yMin = Math.max(yMin, q[1]); if (q.t === 'v') xMin = Math.max(xMin, q[0]); }
      rs = rs.map(r => r.keep ? r : Object.assign([Math.max(r[0], xMin), Math.max(r[1], yMin), r[2], r[3]], { keep: 0 })).filter(r => r[2] - r[0] > .01 && r[3] - r[1] > .01);
    }
    // cut down for a room on one side of it only: nothing of it reaches past its own wall on the far side
    if (clip) rs = rs.map(r => r.keep ? r : Object.assign([Math.max(r[0], clip[0]), Math.max(r[1], clip[1]), Math.min(r[2], clip[2]), Math.min(r[3], clip[3])], { keep: 0 })).filter(r => r[2] - r[0] > .01 && r[3] - r[1] > .01);
    // what is cut down inside a part left standing is gone (its coping would show through the corner)
    if (keep) { const kept = rs.filter(r => r.keep); rs = rs.filter(r => r.keep || !kept.some(q => r[0] >= q[0] && r[1] >= q[1] && r[2] <= q[2] && r[3] <= q[3])); }
    const shapes = [];
    for (const [n, r] of rs.entries()) { const [x0, y0, x1, y1] = r;
      if (r.keep) { shapes.push([x0, y0, lo, x1, y1, tallH, 'keep']); continue; }
      shapes.push([x0, y0, lo, x1, y1, h, 'wall']);
    }
    if (cutDown) rs.forEach(([x0, y0, x1, y1], n) => { if (!rs[n].keep) shapes.push([Math.max(0, x0 - .05), Math.max(0, y0 - .05), h, Math.min(1, x1 + .05), Math.min(1, y1 + .05), h + 3, 'cap']); });   // (never past its own cell)   // a coping on the cut wall
    const H = keep ? Math.max(h + 3, tallH) : h;
    if (ext && (i + j) % 3 === 0 && !clip && !out) for (const [x0, y0, x1, y1] of rs.slice(0, 1)) shapes.push(['C', (x0 + x1) / 2, (y0 + y1) / 2, .14, h, h + 36, 'pale', .015]);   // a pinnacle (none on a wall stopped short)
    // (an outer wall seen from inside sinks into the dark as every other wall does)
    const fade0 = ext && out ? col => col : fadeWall, A = t === B.ARCH ? arch[k] : null, fl = t === B.ARCH ? -archDrop[k] : 0, fade = fl ? (col, z) => fade0(col, z - fl) : fade0;   // (a doorway raised on a step sinks into the dark at the same height as the wall it stands in)
    // below its foot a face shows only where it looks onto lower floor (not down past a stair beside it)
    const footAt = cutDown ? sb : wBase[k] + (upC ? cornerUp[k] : 0);
    const dropTo = (ii, jj) => ii < W && jj < Hh && M.floor[jj * W + ii] ? Math.max(0, footAt - pLv[jj * W + ii] * STEP_PX) : 0;
    const dropS = dropTo(i, j + 1), dropE = dropTo(i + 1, j);
    const stairE = i + 1 < W && j + 1 < Hh && M.floor[(j + 1) * W + i + 1] === F.STEP && !wallish0(M.block[(j + 1) * W + i + 1]);   // (a stair rising beside it, to its south-east)
    let rise = -1;                                                                    // the highest floor just in front of it
    for (let dj = 0; dj <= 3; dj++) for (let di = 0; di <= 3; di++) { const ii = i + di, jj = j + dj; if (ii >= W || jj >= Hh) continue;
      const q = jj * W + ii; if (M.floor[q] === F.STEP && !wallish0(M.block[q])) rise = Math.max(rise, pLv[q] * STEP_PX); }
    const c = renderShapes(shapes, H, { lo, open: true, outline: false, color: (hit) => {
      const [sh, f, u, v, z] = hit, m = sh[6];
      if (z < -.5 && f !== 'T' && !cutDown && -z > (f === 'R' ? dropE : dropS) + .5) return null;
      // nor where higher floor in front of it (a stair beside it) hides it: floors are painted first, so the wall
      // would show over the steps
      if (false) {                                                                       // (replaced: the steps are drawn over the walls behind them, in blocks())                // (not a doorway's own face: the stair's top step is its riser)                                // (only a face turned to the camera's left can stand behind the steps)                                            // (cut down, it is seen from the room above: the stair isn't drawn there)
        const Pz = footAt + z;
        for (let d = .05; d < 4; d += .1) { const qi = Math.floor(i + u + d / 2), qj = Math.floor(j + v + d / 2); if (qi >= W || qj >= Hh) break;
          const q = qj * W + qi; if (qi <= i || M.floor[q] !== F.STEP || wallish0(M.block[q])) continue;   // (a stair off to its east, in front of it)   // only a stair's steps (drawn in the room)
          if (pLv[q] * STEP_PX >= Pz + d * GY) return null; }
      }
      // a doorway cut down: its opening is clear, only the jambs stand (shut doors still show, half faded, over it)
      if (cutDown && A && (m === 'cap' || m === 'wall') && z > -.5) {   // (below the threshold its face stays: stone down to the floor beyond)
        const cc = Math.min(19, Math.max(0, Math.floor((A.along === 1 ? u : v) * 20))); if (openAt(A.idx * 20 + cc, 0, A.n, 1)) return null; }
      if (m === 'cap') {
        return fade(f === 'T' ? [150, 138, 156] : [92, 80, 100], z);
      }
      if (m === 'keep') {                                                              // a back wall left standing: plain stone
        // (it stands on lower ground than the room it closes: it sinks into the dark as high up as that room's walls do)
        const ko = Math.max(0, tallH - WALL_H);
        if (f === 'T') return fade([34, 28, 36], tallH - ko);
        const cc = Math.min(19, Math.max(0, Math.floor((f === 'R' ? v : u) * 20)));
        return fade(wallPaint(f, cc, tallH - z, WALL_H, i, j, fa, 0, 0).map(x => x * LIT[f === 'R' ? 'R' : 'L']), z - ko);
      }
      if (m !== 'wall') return undefined;
      if (f === 'T') return fade(cutDown ? [70, 60, 76] : [34, 28, 36], h);
      const cc = Math.min(19, Math.max(0, Math.floor((f === 'R' ? v : u) * 20)));
      const hh = ext && out ? WALL_EXT : h, r = hh - z;
      if (r >= hh) { const col = ashlar(cc, r, i, j, h - lo); return fade(col.map(x => x * LIT[f === 'R' ? 'R' : 'L']), z); }   // reaching down to lower ground
      let col;
      if (A) {
        const facing = (f === 'L') === (A.along === 1);
        // the slab's end faces between the cells of one doorway stand in its opening, like bars: not there
        if (!facing && f !== 'T' && openAt(A.idx * 20 + 19, z, A.n)) return null;
        if (facing) {
          const gx = A.idx * 20 + cc;
          if (openAt(gx, z, A.n)) { if (A.door < 0) return null; col = doorPx(gx, z, A.n, p); if (!col) return null; return fade(col.map(x => x * LIT[f]), z); }
          if (openAt(gx, z, A.n, 2.5)) { const kst = Math.abs(gx + .5 - A.n * 10) < 2.5 && z > 40; col = kst ? [168, 160, 154] : [146, 138, 134]; return fade(col.map(x => x * LIT[f]), z); }
        }
      }
      // the end faces between the great window's cells stand in its glass, like bars: where the glass (or its broken hole) is, not there
      if (t === B.GREAT && f !== 'L' && f !== 'T' && !cutDown) { const g2 = greatGlass((i - great.i0) * 20 + 19, r, h, great.n, broken); if (g2 && (g2 === 'HOLE' || g2[0] !== 164 || g2[1] !== 152)) return null; }   // (but its stone frame stays)
      if (t === B.GREAT && f === 'L' && !cutDown) { const gl = greatGlass((i - great.i0) * 20 + cc, r, h, great.n, broken); if (gl === 'HOLE') return null; if (gl) return gl; }
      col = wallPaint(f, cc, r, hh, i, j, fa, fe, wPart[k]);
      if (col.glow) return col;
      return fade(col.map(x => x * LIT[f === 'R' ? 'R' : 'L']), z);
    } });
    if (fe === 2) {                                                                    // a candle on an iron bracket
      const g = c.getContext('2d'), x = fa === 1 ? 9 : 30, y = Math.round(faceTop(x) + Math.floor(h * .47));
      const put = (xx, yy, col) => { g.fillStyle = `rgb(${col})`; g.fillRect(xx, yy, 1, 1); };
      for (let q = 0; q < 3; q++) put(x - 1 + q, y, [36, 34, 38]); put(x, y - 1, [36, 34, 38]);
      for (let q = 2; q < 5; q++) put(x, y - q, [222, 214, 196]); put(x, y - 5, [255, 196, 90]); put(x, y - 6, [255, 246, 200]);
    }
    c.hTop = H; return c;
  }
  // A low wall round open ground: coursed stone under a pale coping.
  // The wall round the grounds: a stone plinth under a coping, iron railings on it, a stone pier every eight cells and at
  // every corner, capped and with a ball on top.
  const lowPier = k => { const i = k % W, j = (k / W) | 0, b = slab[k]; return (b & 3) && (b & 12) || post[k] || (i + j) % 8 === 0; };
  function lowSprite(k, i, j) {
    const h0 = 12, pier = lowPier(k), h = pier ? 46 : 32, lo = wLo[k], rs = slabRects(k), shapes = rs.map(([x0, y0, x1, y1]) => [x0, y0, lo, x1, y1, h0 - 3, 'wall']);
    for (const [x0, y0, x1, y1] of rs) shapes.push([x0 - .05, y0 - .05, h0 - 3, x1 + .05, y1 + .05, h0, 'cap']);
    for (const [x0, y0, x1, y1] of rs) { const along = x1 - x0 > y1 - y0, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      for (let t = .1; t < 1; t += .2) shapes.push(along ? ['C', x0 + (x1 - x0) * t, my, .028, h0, 29, 'iron', .02] : ['C', mx, y0 + (y1 - y0) * t, .028, h0, 29, 'iron', .02]);
      shapes.push(along ? [x0, my - .03, 26, x1, my + .03, 28, 'iron'] : [mx - .03, y0, 26, mx + .03, y1, 28, 'iron']);
      shapes.push(along ? [x0, my - .03, 15, x1, my + .03, 16.5, 'iron'] : [mx - .03, y0, 15, mx + .03, y1, 16.5, 'iron']); }
    if (pier) { const [x0, y0, x1, y1] = rs[0] || [.35, .35, .65, .65], cx = rs.length > 1 ? (rs[0][0] + rs[0][2]) / 2 : (x0 + x1) / 2, cy = rs.length > 1 ? (rs[1] ? (rs[1][1] + rs[1][3]) / 2 : (y0 + y1) / 2) : (y0 + y1) / 2;
      const px = Math.max(.25, Math.min(.75, cx)), py = Math.max(.25, Math.min(.75, cy));
      shapes.push([px - .24, py - .24, lo, px + .24, py + .24, 36, 'wall'], [px - .29, py - .29, 36, px + .29, py + .29, 39, 'cap'], ['C', px, py, .13, 39, 46, 'cap', .03]); }
    const c = renderShapes(shapes, h, { lo, open: true, outline: false, color: hit => {
      const [sh, f, u, v, z] = hit;
      if (sh[6] === 'iron') return undefined;
      if (sh[6] === 'cap') return f === 'T' ? [150, 138, 156] : f === 'L' ? [118, 106, 126] : f === 'C' ? [126, 114, 134] : [92, 80, 100];
      if (f === 'T') return [76, 66, 82];
      const cc = Math.floor((f === 'R' ? v : u) * 20), r = Math.floor(h0 - 3 - z + 40), row = Math.floor(r / 5), uu = cc + (row & 1) * 5, kk = LIT[f === 'R' ? 'R' : 'L'];
      if (r % 5 === 0 || uu % 10 === 0) return [46 * kk, 38 * kk, 52 * kk];
      return [100, 88, 108].map(x => x * kk * (.85 + hash(Math.floor(uu / 10) + i * 7, row + j * 3, 4) * .2));
    } });
    c.hTop = h; return c;
  }
  // What a cell shows depends on a few numbers (a door's swing, how it is cut down, where he is): remembered per cell, so
  // the sprite's key is only built again when one of them changes (not for every cell, every frame).
  const memo = new Array(W * Hh * 2); let memoGen = 0;
  function sprite(t, i, j, k, cutDown, keep = 0, tallH = 0, stubLo = 0, sb = 0, clip = null) {
    const out = !cutDown && !showAll && cur >= 0 && openRoom[cur] === 1 && wExt[k] === 1;
    const A0 = t === B.ARCH ? arch[k] : null, q0 = A0 && A0.door >= 0 ? Math.round(doors[A0.door].p * 8) : 0, up0 = cornerUp[k] && cornerR[k] >= 0 && room[cornerR[k]] === lastRoom ? 1 : 0;
    const c0 = clip ? clip[0] + clip[1] * 3 + clip[2] * 9 + clip[3] * 27 : -1, m = memo[k * 2 + (cutDown ? 1 : 0)];
    if (m && m.g === memoGen && m.t === t && m.keep === keep && m.tallH === tallH && m.stubLo === stubLo && m.sb === sb && m.c === c0 && m.q === q0 && m.out === out && m.up === up0) return m.s;
    const res = spriteBuild(t, i, j, k, cutDown, keep, tallH, stubLo, sb, clip, out);
    memo[k * 2 + (cutDown ? 1 : 0)] = { g: memoGen, t, keep, tallH, stubLo, sb, c: c0, q: q0, out, up: up0, s: res }; return res;
  }
  function spriteBuild(t, i, j, k, cutDown, keep, tallH, stubLo, sb, clip, out) {
    let key, make;
    if (isWall(t)) {
      const A = t === B.ARCH ? arch[k] : null, q = A && A.door >= 0 ? Math.round(doors[A.door].p * 8) : 0;
      key = (cutDown ? 'c' + cutH[k] : 'w') + t + '.' + slab[k] + '.' + post[k] + '.' + wFace[k] + (cutDown ? 0 : wFeat[k] + '.' + wPart[k] + '.' + wExt[k] + '.' + (wExt[k] && (i + j) % 3 === 0 ? 1 : 0) + '.' + wLo[k]) + ':' + (t === B.GREAT && !cutDown ? i : (i * 7 + j * 3) % 5) + (A ? ':a' + A.n + ',' + A.idx + ',' + A.door + ',' + q : '') + jointKey(k) + (cornerUp[k] && cornerR[k] >= 0 && room[cornerR[k]] === lastRoom && !cutDown ? ':u' + cornerUp[k] : '') + (keep ? ':k' + keep + ',' + tallH : '') + (stubLo ? ':l' + stubLo : '') + (fadeLift[k] ? ':f' + fadeLift[k] : '') + (cutDown ? ':b' + sb : '') + (clip ? ':c' + clip.map(c => Math.round(c * 10)).join('') : '') + (out ? ':out' : '');
      make = () => wallSprite(t, i, j, k, cutDown, q / 8, keep, tallH, stubLo, sb, clip, out);
    }
    else if (t === B.LOW) { key = 'low' + ((i * 7 + j * 3) % 4) + ':' + slab[k] + '.' + post[k] + '.' + wLo[k] + jointKey(k) + (lowPier(k) ? 'p' : ''); make = () => lowSprite(k, i, j); }
    else if (t === B.COLUMN) { const v = M.vari[k]; key = 'col' + v; make = () => columnSprite(v === 1 ? COLH_LOW : COLH, v === 1, v === 2, v === 4); }
    else { const P = M.props[M.pi[k]], ci = i - P.x, cj = j - P.y, st = PROPS[P.type].statue; key = P.type + P.rot + ':' + ci + ',' + cj + ':' + (st ? P.seed % 3 : P.seed % 4);
      const open = sky(i, j);                                                            // under the sky nothing fades: there is no vault
      key += open ? ':o' : '';
      make = () => propCell(P.type, P.rot, ci, cj, P.seed % 4, st && extra.statue ? extra.statue(P.seed % 3) : null, open).canvas; }
    let s = sprites.get(key); if (!s) { s = make(); sprites.set(key, s); } return s;
  }
  const roomAt = (x, y) => { const i = Math.floor(x / CELL), j = Math.floor(y / CELL); return i >= 0 && j >= 0 && i < W && j < Hh ? room[j * W + i] : -1; };
  // Everything standing in view, as { d: depth, draw(g) } to sort with the characters.
  // pX, pY: the priest's middle on screen; pD: his depth; wx, wy: where he stands in the world.
  // diorama: the whole building at once, every wall standing in front of a room cut down (the map's model).
  // How see-through each cell's thing is now (1 solid … 0 gone): eased toward its target every frame, so nothing pops.
  const fadeA = new Float32Array(W * Hh).fill(1); let lastT = 0;
  // Out in the open the church stands whole (no wall cut down, no roof faded): when it hides him, his shape is drawn over it.
  let hiddenNow = false;
  const [holeC, holeG] = canvas(8, 8), [maskC, maskG] = canvas(8, 8);
  // ---- the wind. Trees sway (each drawn whole, leaning from its foot), and the tufts of tall grass bend with the wind and
  // away from whoever walks through them, springing back after.
  const SWAY = { has: t => !!PROPS[t]?.flora };                                         // (every tree and plant of the grounds)
  const treeArt = new Map();
  function treeSprite(n) {
    let T = treeArt.get(n); if (T) return T;
    { const P = M.props[n], A = floraArt(P.type, P.seed), k = P.y * W + P.x, fx = 20 * (P.x - P.y), fy = GY * (P.x + P.y) + GY - liftOf(k);   // its cell's middle
      T = { c: A.c, x: fx - A.ax, y: fy - A.ay, foot: A.ay, cut: A.cut, d: (P.x + P.y + 1) * CELL, amp: A.amp, ph: hash(P.x, P.y, 3) * 6.3 };
      treeArt.set(n, T); return T; }
    const P = M.props[n], [fw, fh] = footprint(P.type, P.rot), parts = []; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let cj = 0; cj < fh; cj++) for (let ci = 0; ci < fw; ci++) { const i = P.x + ci, j = P.y + cj, k = j * W + i;
      const sp = sprite(B.PROP, i, j, k, false), h = sp.hTop ?? (sp.height - DH), x = 20 * (i - j) - 20, y = GY * (i + j) - h - liftOf(k);
      parts.push([sp, x, y]); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + sp.width); y1 = Math.max(y1, y + sp.height); }
    const [c, g] = canvas(x1 - x0, y1 - y0); for (const [sp, x, y] of parts) g.drawImage(sp, x - x0, y - y0);
    const foot = GY * (P.x + P.y + (fw + fh) / 2) - liftOf(P.y * W + P.x) - y0;      // the row of its trunk's foot
    const leaves = { tree: 80, pine: 22, bigoak: 112, cypress: 10, birch: 50, willow: 16, poplar: 16 }[P.type] || 30, cut = Math.max(1, Math.round(foot - leaves * ZS));   // the row where its leaves begin
    T = { c, x: x0, y: y0, foot, cut, d: (P.x + fw - 1 + P.y + fh - 1 + 1) * CELL, amp: { cypress: 1.2, pine: 2, poplar: 1.8, birch: 2.2, willow: 3.4 }[P.type] || 2.6, ph: hash(P.x, P.y, 3) * 6.3 };
    treeArt.set(n, T); return T;
  }
  const wind = (t, x, y) => Math.sin(t * 1.3 + x * .011 + y * .007) * .7 + Math.sin(t * .47 + x * .004) * .5 + Math.sin(t * 3.1 + y * .02) * .12;
  // tufts of grass: frames of a few clumps, each leaning from -1 to 1
  const TUFT_F = 9, tuftArt = [];
  for (let v = 0; v < 3; v++) { const fr = []; for (let f = 0; f < TUFT_F; f++) {
    const lean = (f / (TUFT_F - 1) * 2 - 1) * 5, [c, g] = canvas(24, 20);
    for (let b = 0; b < 7; b++) { const bx = 6 + hash(v, b, 1) * 12, h = 7 + hash(v, b, 2) * 9, sh = .85 + hash(v, b, 3) * .3;
      for (let k = 0; k < h; k++) { const t = k / h, x = Math.round(bx + lean * t * t * (h / 14)), y = 19 - k;
        g.fillStyle = `rgb(${(40 + 50 * t) * sh | 0},${(58 + 64 * t) * sh | 0},${(34 + 24 * t) * sh | 0})`; g.fillRect(x, y, 1, 1); } }
    fr.push(c); } tuftArt.push(fr); }
  const tufts = (M.grass || []).map(([gx, gy, v]) => ({ gx, gy, v, b: 0, k: Math.floor(gy) * W + Math.floor(gx) }));
  function blocks(ox, oy, vw, vh, pX, pY, pD, wx, wy, diorama = false) {
    hiddenNow = false;
    const r = diorama ? -1 : roomAt(wx, wy); if (r >= 0) lastRoom = r;
    const inDoor = !diorama && (() => { const i = Math.floor(wx / CELL), j = Math.floor(wy / CELL); return i >= 0 && j >= 0 && i < W && j < Hh && M.block[j * W + i] === B.ARCH; })();
    if (diorama) showAll = true;
    const now = performance.now(), dt = Math.min(.1, (now - (lastT || now)) / 1000), ease = diorama ? 1 : Math.min(1, dt * 7); lastT = now;
    const hi = doorNear(wx, wy, 5);                                                  // the door near enough to notice
    const out = [], swaying = new Set(), X0 = -ox - 40, X1 = -ox + vw + 40, Y0 = -oy - DH, Y1 = -oy + vh + 200;
    const ij = (X, Y) => [(Y / GY + X / 20) / 2, (Y / GY - X / 20) / 2];
    const cs = [ij(X0, Y0), ij(X1, Y0), ij(X0, Y1), ij(X1, Y1)];
    const i0 = Math.max(0, Math.floor(Math.min(...cs.map(c => c[0])))), i1 = Math.min(W - 1, Math.ceil(Math.max(...cs.map(c => c[0]))));
    const j0 = Math.max(0, Math.floor(Math.min(...cs.map(c => c[1])))), j1 = Math.min(Hh - 1, Math.ceil(Math.max(...cs.map(c => c[1]))));
    // the priest, on screen
    const PX0 = pX - 13, PX1 = pX + 13, PY0 = pY - 30, PY1 = pY + 26;
    // A piece of furniture fades whole when any of its cells covers him.
    const coverAt = (i, j, k) => { const s = sprite(M.block[k], i, j, k, false), h = s.hTop ?? (s.height - DH), x = 20 * (i - j) - 20 + ox, y = GY * (i + j) - h + oy - liftOf(k);
      return h > 24 && (i + j + 1) * CELL > pD + CELL * .3 && x < PX1 && x + 40 > PX0 && y < pY - 6 && y + s.height > PY0; };   // only what rises over his chest
    const covered = new Set();
    if (!diorama) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * W + i; if (M.block[k] === B.PROP && !covered.has(M.pi[k]) && coverAt(i, j, k)) covered.add(M.pi[k]); }
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * W + i, t = M.block[k]; if (!t || !shown(k)) continue;
      if (!diorama && t === B.PROP && SWAY.has(M.props[M.pi[k]].type)) { swaying.add(M.pi[k]); continue; }   // (drawn whole, below)
      if (!diorama && cur >= 0 && openRoom[cur] === 1 && isWall(t) && !wExt[k]) continue;   // from outside, a wall showing only its inside face
      let d = (i + j + 1) * CELL;
      const wall = isWall(t), A = t === B.ARCH ? arch[k] : null, lit = A && A.door >= 0 && A.door === hi;
      // seen from open ground, a wall whose run carries on into a room not shown stops at the low wall it meets
      let endClip = null;
      if (wall && !A && !diorama && cur >= 0 && openRoom[cur]) { const sh = n => n >= 0 && n < W * Hh && shown(n), rs = slabRects(k);
        const hy = rs.filter(r => r.t === 'h'), vx = rs.filter(r => r.t === 'v');
        if (wallish0(M.block[k - W]) && !sh(k - W) && hy.length) endClip = [0, Math.min(...hy.map(r => r[1])), 1, 1];
        else if (wallish0(M.block[k - 1]) && !sh(k - 1) && vx.length && rs.some(r => r.t === 'h')) endClip = [Math.min(...vx.map(r => r[0])), 0, 1, 1]; }
      const full = endClip ? sprite(t, i, j, k, false, 0, 0, 0, 0, endClip) : sprite(t, i, j, k, false), h = full.hTop ?? (full.height - DH), base = wall || t === B.LOW ? wBase[k] + (wall && cornerUp[k] && cornerR[k] >= 0 && room[cornerR[k]] === lastRoom && !(cur >= 0 && openRoom[cur]) ? cornerUp[k] : 0) : liftOf(k);
      const x = 20 * (i - j) - 20 + ox, y = GY * (i + j) - h + oy - base;
      if (x > vw || x < -40 || y > vh || y + full.height < 0) continue;
      if (t === B.PROP && PROPS[M.props[M.pi[k]].type].hang) d += CELL * .9;           // hanging things are drawn over whoever walks beneath
      // What it should be: a wall in front of the room he is in sinks to its coping, as in Diablo; anything tall that
      // stands between the camera and him fades (a wall to its coping, a thing to a ghost of itself).
      const outside = !diorama && cur >= 0 && openRoom[cur] === 1 && wall;
      let inFront = !outside && wall && (diorama ? frontOf.has(k) : lastRoom >= 0 && frontOf.get(k)?.has(lastRoom));
      // cut down for the room he is in: what of it is that room's back wall stays up, and a corner stands on its floor
      // (standing in a doorway he is framed by it: the walls round it don't sink for him)
      const covers = !diorama && !inDoor && h > 24 && d > pD + CELL * .3 && x < PX1 && x + 40 > PX0 && y < PY1 && y + full.height > PY0;
      let keep = 0, sb = pFrom[k] >= 0 && !A ? pLv[k] * STEP_PX : base;
      if (inFront && !diorama && !A) {
        keep = keepMask(k, lastRoom);
        if (wall && covers && keep !== (1 << slabRects(k).length) - 1) keep = 0;
        if (keep && keep === (1 << slabRects(k).length) - 1) { inFront = false; keep = 0; }
        if (pFrom[k] < 0) { const lv = stubLevel(k, lastRoom); if (lv >= 0) sb = lv * STEP_PX; }
        if (keep) sb = Math.max(sb, roomLow[lastRoom]);                               // (a corner left standing stands on this room's floor, not below it)
      }
      let target = 1;
      if (outside && covers) hiddenNow = true;
      if (inFront || (wall && covers && !outside)) target = A && A.door >= 0 && !doors[A.door].open ? .5 : 0;
      else if (t === B.PROP ? covered.has(M.pi[k]) : covers) target = .42;
      const a = fadeA[k] += (target - fadeA[k]) * ease;
      // a cut wall still reaches down to the lowest floor before it, as the whole one does
      const tallH = keep ? Math.max(base + h, Math.max(0, stubLevel(k, lastRoom)) * STEP_PX + h) - sb : 0,   // (as tall as the back wall it carries on, standing on this room's floor)
       stubLo = Math.min(0, Math.max(A ? archLow(k, sb) : Math.min(0, wBase[k] + wLo[k] - sb, runLow[k] >= 0 ? runLow[k] - sb : 0), lastRoom >= 0 ? roomLow[lastRoom] - sb : -1e9)), stub = wall && a < .98 ? sprite(t, i, j, k, true, keep, tallH, stubLo, sb, inFront && !diorama && !A ? clipFor(k, lastRoom) : null) : null;
      out.push({ d, draw: g => {
        if (stub) { const hs = stub.hTop ?? (stub.height - DH); g.drawImage(stub, x, GY * (i + j) - hs + oy - sb); }
        if (t === B.COLUMN && a < .98) {                                              // a pier only fades above: its foot stays solid
          const keep = Math.min(full.height, DH + 46), cut = full.height - keep;
          g.drawImage(full, 0, cut, full.width, keep, x, y + cut, full.width, keep);
          for (let r = 0; r < cut; r += 4) { const n = Math.min(4, cut - r), f = Math.min(1, (cut - r) / 40); g.globalAlpha = 1 - (1 - a) * f; g.drawImage(full, 0, r, full.width, n, x, y + r, full.width, n); }
          g.globalAlpha = 1;
        }
        else if (a > .02) { if (a < .98) g.globalAlpha = a; g.drawImage(full, x, y); g.globalAlpha = 1; }
        if (lit) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = (.2 + .08 * Math.sin(now / 260)) * Math.max(.4, a); g.drawImage(full, x, y); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
      } });
    }
    // The steps of a stair in this room are drawn again over what stands behind them (the walls either side of its top),
    // one cell at a time in depth order, so whoever climbs it is still drawn over them.
    // the trees, swaying: the trunk stands still, the leaves lean (a shear from where they begin)
    const tw = now / 1000;
    for (const n of swaying) { const T = treeSprite(n), x = T.x + ox, y = T.y + oy, a = covered.has(n) ? .45 : 1;
      if (x > vw + 8 || y > vh || x + T.c.width < -8 || y + T.c.height < 0) continue;            // (off screen: not drawn)
      const s = T.amp ? (wind(tw + T.ph * .1, T.x, T.y) * T.amp + Math.sin(tw * 2.3 + T.ph) * .25 * T.amp / 2.4) / Math.max(30, T.cut) : 0, w = T.c.width, hc = T.c.height, cut = T.cut;
      out.push({ d: T.d, draw: g => { g.save(); if (a < 1) g.globalAlpha = a;
        g.drawImage(T.c, 0, cut, w, hc - cut, Math.round(x), Math.round(y) + cut, w, hc - cut);                    // the trunk, still
        g.setTransform(1, 0, -s, 1, Math.round(x + s * cut), Math.round(y)); g.drawImage(T.c, 0, 0, w, cut, 0, 0, w, cut);   // the leaves, swaying
        g.restore(); } }); }
    // the grass, bending
    if (!diorama && tufts.length) { const pi = wx / CELL, pj = wy / CELL;
      for (const G of tufts) { const i = Math.floor(G.gx), j = Math.floor(G.gy); if (i < i0 || i > i1 || j < j0 || j > j1 || !shown(G.k)) continue;
        const sx = 20 * (G.gx - G.gy), sy = GY * (G.gx + G.gy) - liftOf(G.k); if (sx + ox < -30 || sx + ox > vw + 30 || sy + oy < -30 || sy + oy > vh + 30) continue;
        const di = G.gx - pi, dj = G.gy - pj, dd = Math.hypot(di, dj);
        const push = dd < 1.1 ? (1 - dd / 1.1) * Math.sign((di - dj) || 1) * 1.6 : 0;    // away from him, across the screen
        G.b += (push - G.b) * Math.min(1, (Math.abs(push) > Math.abs(G.b) ? 18 : 3) * Math.min(.1, ease / 7 + .016));
        const lean = Math.max(-1, Math.min(1, wind(tw, sx, sy) * .55 + G.b)), f = Math.round((lean + 1) / 2 * (TUFT_F - 1));
        const spr = tuftArt[G.v][f], X = Math.round(sx + ox - 12), Y = Math.round(sy + oy - 19);
        out.push({ d: (G.gx + G.gy) * CELL, draw: g => g.drawImage(spr, X, Y) }); } }
    if (!diorama && cur >= 0) for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * W + i; if (M.floor[k] !== F.STEP || M.block[k] || room[k] !== cur) continue;
      const up = LV[k] * STEP_PX, lvAt = n => M.floor[n] && !wallish0(M.block[n]) ? LV[n] * STEP_PX : up;
      const dS = Math.max(0, up - lvAt(k + W)), dE = Math.max(0, up - lvAt(k + 1));
      const X = 20 * (i - j) + ox, Y = GY * (i + j) + oy - up;
      out.push({ d: (i + j) * CELL + 1, draw: g => {
        g.save(); g.beginPath(); g.moveTo(X - 20, Y + GY); g.lineTo(X, Y); g.lineTo(X + 20, Y + GY); g.lineTo(X + 20, Y + GY + dE); g.lineTo(X, Y + 2 * GY + dE);
        g.lineTo(X, Y + 2 * GY + dS); g.lineTo(X - 20, Y + GY + dS); g.closePath(); g.clip();
        const bx0 = X - 21, by0 = Y - 1, bx1 = X + 21, by1 = Y + 2 * GY + Math.max(dS, dE) + 1;
        for (let cy = Math.floor((by0 - oy) / CS); cy <= Math.floor((by1 - oy) / CS); cy++) for (let cx = Math.floor((bx0 - ox) / CS); cx <= Math.floor((bx1 - ox) / CS); cx++) {
          const c = floorChunks.get(cx + ',' + cy); if (c) g.drawImage(c, cx * CS + ox, cy * CS + oy); }
        g.restore(); } });
    }
    if (!diorama && cur >= 0 && openRoom[cur]) {                                    // out in the open: the roofs
      if (!roofs) buildRoofs();
      for (const R of roofs) { const x = R.x + ox, y = R.y + oy; if (x > vw || y > vh || x + R.c.width < 0 || y + R.c.height < 0) continue;
        // (a roof standing between the camera and him: his shape is drawn over it)
        const hit = (px, py) => { const u = Math.round(px - x), v = Math.round(py - y); return u >= 0 && v >= 0 && u < R.c.width && v < R.c.height && R.mask[v * R.c.width + u]; };
        const covers = R.d > pD && [[0, -20], [0, 0], [-8, -10], [8, -10], [0, 18]].some(([dx, dy]) => hit(pX + dx, pY + dy));
        // where it hides him, a soft round hole opens in it round him (as Diablo shows its walls), easing open and shut
        R.hole = (R.hole || 0) + ((covers ? 1 : 0) - (R.hole || 0)) * ease; const hr = R.hole;
        out.push({ d: R.d, draw: g => { const sx = Math.max(0, -x), sy = Math.max(0, -y), sw = Math.min(R.c.width - sx, vw - x - sx), sh = Math.min(R.c.height - sy, vh - y - sy);
          if (sw <= 0 || sh <= 0) return;
          if (hr < .02) { g.drawImage(R.c, sx, sy, sw, sh, x + sx, y + sy, sw, sh); return; }
          const W2 = Math.ceil(vw), H2 = Math.ceil(vh); if (holeC.width !== W2 || holeC.height !== H2) { holeC.width = W2; holeC.height = H2; }
          holeG.globalCompositeOperation = 'source-over'; holeG.clearRect(0, 0, W2, H2); holeG.drawImage(R.c, sx, sy, sw, sh, x + sx, y + sy, sw, sh);
          // the hole only over open ground (and what stands on it, up to a man's height and a tree's): never into the church,
          // not even softly at its edge (the floor under the walls there is the rooms' own)
          const cx = pX, cy = pY - 12, r1 = 380 * hr;
          if (maskC.width !== W2 || maskC.height !== H2) { maskC.width = W2; maskC.height = H2; }
          maskG.globalCompositeOperation = 'source-over'; maskG.clearRect(0, 0, W2, H2); maskG.fillStyle = '#fff';
          const ci = Math.floor(wx / CELL), cj = Math.floor(wy / CELL);
          for (let j = cj - 18; j <= cj + 18; j++) for (let i = ci - 18; i <= ci + 18; i++) { if (i < 0 || j < 0 || i >= W || j >= Hh || !sky(i, j) || M.block[j * W + i] && isWall(M.block[j * W + i])) continue;
            const X = 20 * (i - j) + ox, Y = GY * (i + j) + oy - pLv[j * W + i] * STEP_PX, up = 76;
            maskG.beginPath(); maskG.moveTo(X, Y - up); maskG.lineTo(X + 20.5, Y + GY - up); maskG.lineTo(X + 20.5, Y + GY); maskG.lineTo(X, Y + 2 * GY + .5); maskG.lineTo(X - 20.5, Y + GY); maskG.lineTo(X - 20.5, Y + GY - up); maskG.closePath(); maskG.fill(); }
          // a raised floor inside (the library, the organ loft) stands up in front of the path behind it: never shown through
          maskG.globalCompositeOperation = 'destination-out';
          for (let j = cj - 12; j <= cj + 22; j++) for (let i = ci - 12; i <= ci + 22; i++) { if (i < 0 || j < 0 || i >= W || j >= Hh || !pFloor[j * W + i] || sky(i, j)) continue;
            const up = pLv[j * W + i] * STEP_PX; if (up <= 2 * STEP_PX) continue;
            const X = 20 * (i - j) + ox, Y = GY * (i + j) + oy - up, dn = up - 2 * STEP_PX;
            maskG.beginPath(); maskG.moveTo(X, Y - 1); maskG.lineTo(X + 21, Y + GY); maskG.lineTo(X + 21, Y + GY + dn); maskG.lineTo(X, Y + 2 * GY + dn + 1); maskG.lineTo(X - 21, Y + GY + dn); maskG.lineTo(X - 21, Y + GY); maskG.closePath(); maskG.fill(); }
          maskG.globalCompositeOperation = 'source-over';
          const gr = maskG.createRadialGradient(cx, cy, r1 * .55, cx, cy, r1); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
          maskG.globalCompositeOperation = 'destination-in'; maskG.fillStyle = gr; maskG.fillRect(0, 0, W2, H2);
          holeG.globalCompositeOperation = 'destination-out'; holeG.drawImage(maskC, 0, 0); holeG.globalCompositeOperation = 'source-over';
          g.drawImage(holeC, 0, 0); } }); }
    }
    if (diorama) showAll = false;
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
    lg.globalCompositeOperation = 'source-over'; lg.globalAlpha = 1; const moon = !showAll && cur >= 0 && openRoom[cur] === 1;                          // out in the open: the moon lights everything alike
    lg.fillStyle = opt.amb || (moon ? 'rgb(140,138,208)' : AMB); lg.fillRect(0, 0, w, h);
    lg.globalCompositeOperation = 'lighter';
    for (const b of beams) {
      if ((moon && b.sky) || (b.rooms && !showAll && cur >= 0 && !b.rooms.includes(cur)) || b.x1 + ox < 0 || b.x0 + ox > vw || b.y1 + oy < 0 || b.y0 + oy > vh) continue;
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
    for (const L of lights) if (showAll || cur < 0 || !L.rooms || L.rooms.includes(cur)) one(L, L.sx, L.sy, L.spr);
    for (const L of dyn) { const key = L.col.join() + ':' + L.r; let s = dynSprites.get(key); if (!s) { s = lightSprite(L.col, L.r); dynSprites.set(key, s); } const [sx, sy] = toScr(L.x, L.y, L.z || 0); one(L, sx, sy, s); }
    lg.globalAlpha = 1; lg.globalCompositeOperation = 'source-over';
    g.save(); g.globalCompositeOperation = 'multiply'; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(lb, 0, 0, w, h, 0, 0, w * 2, h * 2); g.restore();
    if (!extra.lowFx) {                                                                // every flame in view glows
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const [fx, fy, ph, , rs] of flames) { const x = fx + ox, y = fy + oy; if (x < -14 || x > vw + 14 || y < -14 || y > vh + 14 || (rs && !showAll && cur >= 0 && !rs.includes(cur))) continue;
        g.globalAlpha = .55 + .2 * Math.sin(t * 9 + ph) * Math.sin(t * 5.3 + ph * 1.7); g.drawImage(halo, Math.round(x - 13), Math.round(y - 13)); }
      g.restore();
    }
    if (!opt.noFog) for (const L of lights) {                                          // motes drifting in the candlelight
      if ((L.rooms && !showAll && cur >= 0 && !L.rooms.includes(cur)) || L.col[0] < 200 || L.sx + ox < -20 || L.sx + ox > vw + 20 || L.sy + oy < -20 || L.sy + oy > vh + 20) continue;
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
        const k = j * W + i, b = i >= 0 && j >= 0 && i < W && j < Hh ? M.block[k] : 0;
        if (b && wallish0(b)) {
          if (b === B.ARCH && !shut(k)) continue;
        } else if (pFloor[k] && !M.floor[k] && i >= 0 && j >= 0 && i < W && j < Hh) continue;
        if (!solid(i, j)) continue;
        if (ledge[k] && ledge[k] <= (o.z || 0) + 3) continue;                         // (he is above it: on it, or over it)
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
  // ---- ledges: the low solid things one can climb onto (crates, barrels, chests, benches, tables, tombs, hedges, a
  // fountain's rim…), their tops in the priest's height units; walls, cupboards, trees and lamps are too tall.
  const ledge = new Float32Array(W * Hh);
  for (let k = 0; k < W * Hh; k++) if (M.block[k] === B.PROP) { const T = PROPS[M.props[M.pi[k]].type];
    if (T.statue || T.hang || T.solid === false || T.flora) continue;
    const h = propHeight(M.props[M.pi[k]].type); if (h <= 46) ledge[k] = h / V; }
  const ledgeAt = (x, y) => { const i = Math.floor(x / CELL), j = Math.floor(y / CELL); return i >= 0 && j >= 0 && i < W && j < Hh ? ledge[j * W + i] : 0; };
  // what he would stand on at (x, y), a body of radius r: the highest ledge under any part of him
  const supportAt = (x, y, r = 4) => Math.max(ledgeAt(x, y), ledgeAt(x - r, y), ledgeAt(x + r, y), ledgeAt(x, y - r), ledgeAt(x, y + r));
  function freeNear(x, y, min, max) {
    for (let k = 0; k < 80; k++) {
      const a = Math.random() * Math.PI * 2, r = min + Math.random() * (max - min), px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      const i = Math.floor(px / CELL), j = Math.floor(py / CELL);
      if (!solid(i, j) && !solid(i + 1, j) && !solid(i - 1, j) && !solid(i, j + 1) && !solid(i, j - 1)) return [px, py];
    }
    return [x, y];
  }
  // Paint the floor under a region of the screen now (cx0..cx1, cy0..cy1 in chunks), a slice at a time.
  function* warmFloor(x0, y0, x1, y1) { for (let cy = Math.floor(y0 / CS); cy <= Math.floor(y1 / CS); cy++) for (let cx = Math.floor(x0 / CS); cx <= Math.floor(x1 / CS); cx++) { const k = cx + ',' + cy; if (!floorChunks.has(k)) { floorChunks.set(k, genFloor(cx, cy)); yield; } } }
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
  // The great window, smashed (by the demon coming in).
  let broken = false;
  function breakWindow() { broken = true; memoGen++; for (const key of [...sprites.keys()]) if (key.startsWith('w4.') || key.startsWith('c4.')) sprites.delete(key); }
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
  return { ledgeAt, supportAt, outside: () => cur >= 0 && openRoom[cur] === 1, hidden: () => hiddenNow, focus, shownAt, warmFloor, breakWindow, diorama, drawFloor, blood, clearBlood, blocks, lightUp, collide, solidAt, freeNear, prefetch, floorAt, doorNear, toggleDoor, doorOpen, tick, heightAt, rooms: () => rooms,
    _debug: { sprite: (i, j, cut) => sprite(M.block[j * W + i], i, j, j * W + i, cut), feat: (i, j) => wFeat[j * W + i], face: (i, j) => wFace[j * W + i] } };
}
