// The trees and plants out in the grounds, painted pixel by pixel (not built from cones and boxes like the furniture):
// leaves in clumps with ragged edges, lit from the upper left, shaded within, a dark outline; bark streaked and shaded,
// branches and roots; pine needles in drooping tiers; a willow's hanging strands; a shadow on the ground.
// Each kind is drawn from a seed, so the same seed gives the same tree every time; a few seeds per kind make the
// variations (height, width, crown, tone, density).
// floraArt(kind, seed) → { c: canvas, ax, ay: where the trunk meets the ground, cut: the row where its leaves begin
// (above it the wind moves them), amp: how far the wind moves it }.

const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const hash = (a, b, c = 0) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1440662683); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// Palettes, darkest to lightest: leaves (dark, desaturated greens toward olive), bark, pine needles, stone.
const LEAF = [[16, 24, 20], [26, 38, 30], [36, 52, 38], [50, 68, 46], [68, 86, 56], [92, 108, 68]];
const NEEDLE = [[14, 24, 22], [22, 36, 32], [32, 50, 42], [44, 66, 52], [60, 84, 62], [82, 102, 74]];
const BARK = [[26, 20, 20], [40, 30, 28], [58, 44, 38], [78, 60, 48], [100, 80, 62]];
const DEAD = [[30, 26, 28], [48, 42, 42], [70, 62, 60], [94, 86, 80], [118, 110, 100]];
const STONE = [[34, 32, 40], [52, 50, 58], [74, 72, 80], [98, 96, 104], [124, 122, 128]];

function sheet(w, h) {
  const d = new Uint8ClampedArray(w * h * 4);
  const put = (x, y, c, a = 255) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= w || y >= h) return; const o = (y * w + x) * 4;
    if (a >= 255) { d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; return; }
    const k = a / 255, ka = d[o + 3] / 255, na = k + ka * (1 - k); if (na <= 0) return;
    for (let i = 0; i < 3; i++) d[o + i] = (c[i] * k + d[o + i] * ka * (1 - k)) / na; d[o + 3] = na * 255; };
  const get = (x, y) => x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3];
  return { w, h, d, put, get };
}
const pick = (pal, v) => pal[Math.max(0, Math.min(pal.length - 1, Math.round(v)))];

// The shadow on the ground, an isometric ellipse.
function shadow(S, cx, cy, rx, a = 70) {
  const ry = rx * .42;
  for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) { const q = (x / rx) ** 2 + (y / ry) ** 2; if (q > 1) continue;
    S.put(cx + x, cy + y, [6, 8, 10], a * (1 - q * q)); }
}

// Bark: a tapering limb from (x0, y0) to (x1, y1), widths w0 → w1, lit on its left, streaked along its length.
function limb(S, x0, y0, x1, y1, w0, w1, pal = BARK, seed = 0) {
  const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.ceil(len * 1.5)), dx = (x1 - x0) / len, dy = (y1 - y0) / len;
  for (let i = 0; i <= n; i++) { const t = i / n, cx = x0 + (x1 - x0) * t, cy = y0 + (y1 - y0) * t, hw = (w0 + (w1 - w0) * t) / 2;
    for (let o = -hw; o <= hw; o += .5) { const px = cx - dy * o, py = cy + dx * o, side = o / Math.max(.5, hw);    // -1 left … 1 right
      const streak = hash(Math.round(o * 2 + seed), Math.floor(t * len / 3), 7);
      let v = 2.6 - side * 1.3 + (streak - .5) * 1.4; if (Math.abs(side) > .82) v -= 1.2;
      if (hash(Math.round(px), Math.round(py), seed + 3) < .04) v -= 1.5;                                     // knots and cracks
      S.put(px, py, pick(pal, v)); } }
}

// A clump of leaves at (cx, cy), reach r: a ragged-edged blob, lit from the upper left, darker within and below, its
// leaves in small groups; depth (0 front … 1 back) darkens it.
function clump(S, cx, cy, r, R, depth = 0, pal = LEAF, tone = 0) {
  const lobes = 9 + (R() * 6 | 0), ph = R() * 6.3, rough = .06 + R() * .04, s0 = R() * 1000 | 0;
  for (let y = Math.floor(cy - r * 1.3); y <= cy + r * 1.3; y++) for (let x = Math.floor(cx - r * 1.3); x <= cx + r * 1.3; x++) {
    const dx = x - cx, dy = (y - cy) * 1.08, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    const edge = r * (1 + rough * Math.sin(a * lobes + ph) + .07 * (hash(Math.round(a * 14), s0, 1) - .5));   // round, a little bumpy
    if (d > edge) continue;
    const nx = dx / edge, ny = dy / edge, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    const lit = (-nx * .55 - ny * .7 + nz * .45);                                                 // light from the upper left, above
    const grp = hash(Math.floor((x + s0) / 3), Math.floor(y / 3), 11), fine = hash(x + s0, y, 12);   // leaf groups, single leaves
    let v = 2.2 + lit * 2.1 + (grp - .5) * 1.3 + (fine - .5) * .7 - depth * 1.1 + tone;
    if (d > edge - 1.2) v -= 1.1;                                                                // the rim, in shadow
    S.put(x, y, pick(pal, v)); }
}

// A dark outline round everything drawn (as hand-drawn pixel art has), one pixel out.
function outline(S, col = [10, 12, 12]) {
  const { w, h, d } = S, edge = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (d[(y * w + x) * 4 + 3] > 200) continue;
    if (S.get(x + 1, y) > 200 || S.get(x - 1, y) > 200 || S.get(x, y + 1) > 200 || S.get(x, y - 1) > 200) edge.push([x, y]); }
  for (const [x, y] of edge) { const o = (y * w + x) * 4; if (d[o + 3] > 60 && d[o + 3] < 200) continue; S.put(x, y, col, 230); }
}

function toCanvas(S) {
  const c = document.createElement('canvas'); c.width = S.w; c.height = S.h;
  c.getContext('2d').putImageData(new ImageData(S.d, S.w, S.h), 0, 0); return c;
}

// ---------------------------------------------------------------- the kinds
// A broadleaf crown: clumps over an envelope (rx wide, ry tall, centred cx, cy), drawn back to front.
function crown(S, R, cx, cy, rx, ry, n, rMin, rMax, tone = 0, pal = LEAF) {
  const cl = [];
  for (let i = 0; i < n; i++) { const a = R() * 6.283, q = Math.sqrt(R()), x = cx + Math.cos(a) * rx * q * .8, y = cy + Math.sin(a) * ry * q * .8;
    cl.push([x, y, rMin + R() * (rMax - rMin)]); }
  cl.sort((p, q) => (p[1] - p[0] * .25) - (q[1] - q[0] * .25));
  const y0 = Math.min(...cl.map(c => c[1])), y1 = Math.max(...cl.map(c => c[1]));
  for (const [x, y, r] of cl) clump(S, x, y, r, R, .7 * (1 - (y - y0) / Math.max(1, y1 - y0)), pal, tone);
  return cl;
}
function roots(S, R, x, y, w, n, pal = BARK) {
  for (let i = 0; i < n; i++) { const s = i % 2 ? 1 : -1, l = w * (.7 + R() * .8), dy = 1 + R() * 3;
    limb(S, x + s * w * .2, y - 2, x + s * (w * .5 + l), y + dy, w * .45, 1.5, pal); }
}
function trunk(S, R, x, y, h, w0, w1, bend = 0, pal = BARK) {
  const pts = []; let px = x, py = y;
  const segs = 6; for (let i = 1; i <= segs; i++) { const t = i / segs, nx = x + Math.sin(t * 3.1 + bend * 2) * bend * 10 * t, ny = y - h * t;
    limb(S, px, py, nx, ny, w0 + (w1 - w0) * (t - 1 / segs), w0 + (w1 - w0) * t, pal, i * 13); pts.push([nx, ny]); px = nx; py = ny; }
  return [px, py];
}
function needles(S, R, cx, top, bottom, w, tiers, pal = NEEDLE) {
  // tiers from the bottom up, each a drooping skirt of needles; upper ones over the lower
  for (let i = tiers - 1; i >= 0; i--) {
    const t = i / tiers, yb = bottom - (bottom - top) * t, yt = bottom - (bottom - top) * (t + 1.6 / tiers), hw = w * (1 - t * .8) / 2, s0 = i * 31;
    for (let y = Math.floor(yt); y <= yb + 3; y++) { const f = Math.max(0, Math.min(1, (y - yt) / (yb - yt))), half = hw * Math.pow(f, .85);
      for (let x = Math.floor(cx - half - 3); x <= cx + half + 3; x++) { const dx = x - cx, ragged = half + (hash(x + s0, 3, 5) - .5) * 4 - (y > yb ? (y - yb) * 2.5 + hash(x, s0, 9) * 3 : 0);
        if (Math.abs(dx) > ragged) continue;
        const side = dx / Math.max(1, half), streak = hash(Math.floor((x - y * .6) / 2), s0, 4), tip = hash(x, y + s0, 6);
        let v = 2.4 - side * 1.4 - (1 - f) * .3 + (streak - .5) * 1.2 + (tip > .9 ? 1 : 0); if (y > yb) v -= .6; if (f < .15) v -= .5;
        S.put(x, y, pick(pal, v)); } } }
}

const KINDS = {
  // the classic oak: a rounded crown on a sturdy trunk
  oak: R => { const h = 64 + R() * 16, rx = 40 + R() * 10, S = sheet(132, 160), x = 66, y = 150; shadow(S, x, y, rx * .9);
    roots(S, R, x, y, 9, 4); const [tx, ty] = trunk(S, R, x, y, h * .55, 14, 9, (R() - .5) * .3);
    for (let i = 0; i < 3; i++) limb(S, tx, ty + 8, tx + (i - 1) * 18, ty - 12 - R() * 8, 4, 2);
    crown(S, R, tx, ty - h * .3, rx, h * .38, 30, 12, 18); return { S, ax: x, ay: y, cut: ty + 6 }; },
  // the great oak: a huge, many-lobed crown
  bigoak: R => { const h = 86 + R() * 14, rx = 54 + R() * 10, S = sheet(172, 196), x = 86, y = 186; shadow(S, x, y, rx);
    roots(S, R, x, y, 13, 5); const [tx, ty] = trunk(S, R, x, y, h * .5, 20, 12, (R() - .5) * .3);
    for (let i = 0; i < 4; i++) limb(S, tx, ty + 10, tx + (i - 1.5) * 20, ty - 16 - R() * 10, 5, 2);
    crown(S, R, tx, ty - h * .34, rx, h * .42, 42, 14, 22); return { S, ax: x, ay: y, cut: ty + 8 }; },
  // the ancient tree: a thick gnarled trunk, great roots, an uneven crown
  ancient: R => { const h = 80 + R() * 14, rx = 50 + R() * 8, S = sheet(168, 190), x = 84, y = 180; shadow(S, x, y, rx);
    roots(S, R, x, y, 16, 6); const [tx, ty] = trunk(S, R, x, y, h * .48, 24, 12, (R() - .5) * .5);
    for (let i = 0; i < 4; i++) limb(S, tx, ty + 10, tx + (i - 1.5) * 24, ty - 10 - R() * 16, 6, 2);
    crown(S, R, tx + (R() - .5) * 10, ty - h * .3, rx, h * .36, 26, 12, 20, -.2); return { S, ax: x, ay: y, cut: ty + 8 }; },
  // the irregular tree: its crown in two or three uneven masses
  irregular: R => { const h = 70 + R() * 14, S = sheet(140, 170), x = 70, y = 160; shadow(S, x, y, 38);
    roots(S, R, x, y, 9, 3); const [tx, ty] = trunk(S, R, x, y, h * .5, 13, 8, (R() - .5) * .6);
    const masses = 2 + (R() * 2 | 0);
    for (let i = 0; i < masses; i++) { const mx = tx + (i - (masses - 1) / 2) * 30 + (R() - .5) * 10, my = ty - 14 - R() * 24;
      limb(S, tx, ty + 6, mx, my + 6, 4, 2); }
    for (let i = 0; i < masses; i++) { const mx = tx + (i - (masses - 1) / 2) * 30 + (R() - .5) * 8, my = ty - 18 - R() * 26;
      crown(S, R, mx, my, 20 + R() * 8, 16 + R() * 6, 10, 9, 14); }
    return { S, ax: x, ay: y, cut: ty + 4 }; },
  // the tree with low branches: a short trunk parting into wide limbs, each with its own mass of leaves
  lowbranch: R => { const S = sheet(160, 160), x = 80, y = 150; shadow(S, x, y, 50);
    roots(S, R, x, y, 9, 3); const [tx, ty] = trunk(S, R, x, y, 22 + R() * 6, 13, 10, 0);
    const arms = [[-42, -30], [40, -34], [-14, -56], [16, -62]];
    for (const [ax, ay] of arms) limb(S, tx, ty + 4, tx + ax * (.9 + R() * .2), ty + ay * (.9 + R() * .2), 6, 2.5);
    for (const [ax, ay] of arms) crown(S, R, tx + ax, ty + ay - 10, 20, 14, 9, 9, 14);
    return { S, ax: x, ay: y, cut: ty - 10 }; },
  // pines: tiers of needles on a straight trunk
  pinesm: R => { const h = 84 + R() * 16, S = sheet(80, 124), x = 40, y = 116; shadow(S, x, y, 22);
    trunk(S, R, x, y, 20, 6, 4); needles(S, R, x, y - h, y - 14, 52 + R() * 8, 6); return { S, ax: x, ay: y, cut: y - 16, amp: 1.6 }; },
  pine: R => { const h = 140 + R() * 24, S = sheet(108, 184), x = 54, y = 176; shadow(S, x, y, 30);
    trunk(S, R, x, y, 26, 9, 5); needles(S, R, x, y - h, y - 18, 76 + R() * 10, 8); return { S, ax: x, ay: y, cut: y - 20, amp: 1.8 }; },
  // the cypress: tall and narrow, a flame of small clumps
  cypress: R => { const h = 120 + R() * 24, w = 22 + R() * 4, S = sheet(64, 168), x = 32, y = 160; shadow(S, x, y, 16);
    trunk(S, R, x, y, 12, 5, 4);
    const cl = []; for (let i = 0; i < 70; i++) { const t = R(), yy = y - 10 - t * h, half = w * Math.sin(Math.PI * Math.min(1, (1 - t) * 1.05)) * (t > .85 ? (1 - t) * 4 : 1);
      cl.push([x + (R() - .5) * half * .9, yy, 7 + R() * 4 * (1 - t * .5)]); }
    cl.sort((p, q) => p[1] - q[1]); for (const [cx, cy, r] of cl) clump(S, cx, cy, r, R, 0, LEAF, -.25);
    return { S, ax: x, ay: y, cut: y - 12, amp: 1.2 }; },
  // the dead tree: bare branches forking up into twigs
  dead: R => { const S = sheet(140, 160), x = 70, y = 150; shadow(S, x, y, 26, 50);
    roots(S, R, x, y, 7, 3, DEAD); const [tx, ty] = trunk(S, R, x, y, 54 + R() * 10, 10, 6, (R() - .5) * .4, DEAD);
    const grow = (x0, y0, a, len, w, depth) => { const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len; limb(S, x0, y0, x1, y1, w, Math.max(1, w * .6), DEAD, depth * 7);
      if (depth > 0) { const k = 2 + (R() < .35 ? 1 : 0); for (let i = 0; i < k; i++) grow(x1, y1, a + (i - (k - 1) / 2) * (.5 + R() * .3) + (R() - .5) * .3, len * (.62 + R() * .15), Math.max(1, w * .62), depth - 1); } };
    for (let i = 0; i < 3; i++) grow(tx, ty + 6, -Math.PI / 2 + (i - 1) * .7 + (R() - .5) * .3, 24 + R() * 8, 5, 3);
    return { S, ax: x, ay: y, cut: ty, amp: .8 }; },
  // the weeping willow: a wide crown and long strands hanging from it
  willow: R => { const S = sheet(150, 160), x = 75, y = 150; shadow(S, x, y, 46);
    roots(S, R, x, y, 9, 3); const [tx, ty] = trunk(S, R, x, y, 48, 12, 7, (R() - .5) * .3);
    crown(S, R, tx, ty - 22, 46, 20, 20, 10, 15, .1);
    for (let i = 0; i < 70; i++) { const sx = tx + (R() - .5) * 96, sy = ty - 26 + Math.abs(sx - tx) * .25 + R() * 10, len = 30 + R() * 34;
      for (let k = 0; k < len; k++) { const xx = sx + Math.sin(k * .12 + i) * 1.4 * (k / len); if (hash(Math.round(xx), Math.round(sy + k), i) < .25) continue;
        const v = 2.6 - (xx - tx) / 60 - k / len * 1.4 + (hash(i, k, 3) - .5); S.put(xx, sy + k, pick(LEAF, v)); } }
    return { S, ax: x, ay: y, cut: ty - 4, amp: 3 }; },
  // the twisted old tree: a trunk bent into an S, a small leaning crown
  twisted: R => { const S = sheet(140, 160), x = 70, y = 150; shadow(S, x, y, 30);
    roots(S, R, x, y, 8, 4); const s = R() < .5 ? -1 : 1;
    let px = x, py = y; for (let i = 1; i <= 10; i++) { const t = i / 10, nx = x + s * Math.sin(t * 4.2) * 14 + s * t * 10, ny = y - t * 76; limb(S, px, py, nx, ny, 11 - t * 6, 11 - (t + .1) * 6, BARK, i * 5); px = nx; py = ny; }
    limb(S, px, py + 10, px - s * 26, py - 4, 4, 2); limb(S, px, py + 4, px + s * 18, py - 16, 4, 2);
    crown(S, R, px + s * 4, py - 16, 34, 18, 14, 10, 15, -.1); return { S, ax: x, ay: y, cut: py + 2, amp: 2 }; },
  // bushes and the plants on the ground
  // a rose bush: a mound of leaves starred with pink and crimson blooms
  roses: R => { const S = sheet(44, 34), x = 22, y = 30; shadow(S, x, y, 14, 50); crown(S, R, x, y - 10, 10, 5, 7, 6, 9);
    for (let i = 0; i < 14; i++) { const fx = x + (R() - .5) * 22, fy = y - 8 - R() * 12, c = R() < .5 ? [196, 92, 136] : R() < .5 ? [150, 40, 70] : [224, 150, 180];
      S.put(fx, fy, c); S.put(fx + 1, fy, c.map(v => v * .78)); S.put(fx, fy + 1, c.map(v => v * .62)); S.put(fx + 1, fy + 1, c.map(v => v * .5)); }
    return { S, ax: x, ay: y, cut: y - 4, amp: .6 }; },
  // a bed of flowers on the ground: low leaves under a mass of small blooms in pinks, lilac and white
  flowerbed: R => { const S = sheet(44, 26), x = 22, y = 22; crown(S, R, x, y - 4, 13, 4, 8, 5, 7, -.2);
    const COL = [[206, 110, 160], [170, 120, 200], [226, 214, 220], [190, 70, 110], [236, 176, 200]], c0 = R() * 5 | 0;
    for (let i = 0; i < 30; i++) { const fx = x + (R() - .5) * 30, fy = y - 2 - R() * 8, c = COL[(c0 + (R() < .7 ? 0 : 1 + (R() * 2 | 0))) % 5];
      S.put(fx, fy, c); S.put(fx + 1, fy, c.map(v => v * .8)); S.put(fx, fy + 1, c.map(v => v * .6)); }
    return { S, ax: x, ay: y, cut: y - 2, amp: .4 }; },
  bushs: R => { const S = sheet(36, 30), x = 18, y = 26; shadow(S, x, y, 12, 50); crown(S, R, x, y - 9, 8, 4, 5, 6, 8); return { S, ax: x, ay: y, cut: y - 4, amp: .6 }; },
  bushm: R => { const S = sheet(52, 40), x = 26, y = 35; shadow(S, x, y, 18, 55); crown(S, R, x, y - 12, 13, 6, 8, 7, 10); return { S, ax: x, ay: y, cut: y - 5, amp: .7 }; },
  bushl: R => { const S = sheet(72, 54), x = 36, y = 48; shadow(S, x, y, 26, 60); crown(S, R, x, y - 17, 20, 9, 12, 8, 13); return { S, ax: x, ay: y, cut: y - 6, amp: .8 }; },
  scrub: R => { const S = sheet(40, 30), x = 20, y = 27; shadow(S, x, y, 12, 40);
    for (let i = 0; i < 40; i++) { const bx = x + (R() - .5) * 26, h = 6 + R() * 14, lean = (R() - .5) * 6;
      for (let k = 0; k < h; k++) { const t = k / h; S.put(bx + lean * t * t, y - 2 - k, pick(LEAF, 1 + t * 2.4 + (hash(i, k) - .5))); } }
    return { S, ax: x, ay: y, cut: y - 3, amp: .8 }; },
  wildplant: R => { const S = sheet(36, 30), x = 18, y = 27;
    for (let i = 0; i < 18; i++) { const bx = x + (R() - .5) * 18, h = 5 + R() * 12, lean = (R() - .5) * 7;
      for (let k = 0; k < h; k++) { const t = k / h; S.put(bx + lean * t * t, y - 1 - k, pick(LEAF, 1.2 + t * 2.6)); } }
    for (let i = 0; i < 4; i++) { const fx = x + (R() - .5) * 14, fy = y - 9 - R() * 8; S.put(fx, fy, [120, 84, 160]); S.put(fx + 1, fy, [96, 64, 136]); S.put(fx, fy - 1, [150, 116, 190]); }
    return { S, ax: x, ay: y, cut: y - 2, amp: .8 }; },
  wildflowers: R => { const S = sheet(32, 22), x = 16, y = 19; crown(S, R, x, y - 4, 7, 3, 5, 4, 6, -.3);
    for (let i = 0; i < 8; i++) { const fx = x + (R() - .5) * 18, fy = y - 3 - R() * 6, c = R() < .6 ? [206, 200, 186] : [210, 186, 110];
      S.put(fx, fy, c); S.put(fx + 1, fy, c.map(v => v * .8)); S.put(fx, fy + 1, c.map(v => v * .7)); }
    return { S, ax: x, ay: y, cut: y - 2, amp: .5 }; },
  ornamental: R => { const S = sheet(40, 36), x = 20, y = 32; shadow(S, x, y, 12, 45);
    for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * .32, len = 12 + R() * 8;
      for (let k = 0; k < len; k++) { const t = k / len, xx = x + Math.cos(a) * k, yy = y - 2 + Math.sin(a) * k + t * t * 6;
        for (let s = -1; s <= 1; s++) if (Math.abs(s) <= (1 - t) * 2.5) S.put(xx + s * Math.sin(a), yy, pick(LEAF, 1.6 + (1 - Math.abs(s)) * .8 + t * 1.6)); } }
    return { S, ax: x, ay: y, cut: y - 3, amp: .6 }; },
  mossrock: R => { const S = sheet(52, 40), x = 26, y = 35; shadow(S, x, y, 20, 60);
    const rocks = [[x - 6, y - 10, 11, 9], [x + 7, y - 7, 9, 7], [x - 1, y - 4, 8, 5]];
    for (const [cx, cy, rx, ry] of rocks) for (let yy = cy - ry; yy <= cy + ry; yy++) for (let xx = cx - rx; xx <= cx + rx; xx++) {
      const nx = (xx - cx) / rx, ny = (yy - cy) / ry, q = nx * nx + ny * ny * (ny < 0 ? 1 : 1.6); if (q > 1 + (hash(xx, yy, 2) - .5) * .25) continue;
      const v = 2.3 - nx * 1.2 - ny * 1.4 + (hash(xx >> 1, yy >> 1, 3) - .5) * 1.2; const moss = ny < -.2 && hash(xx >> 1, yy, 5) < .45;
      S.put(xx, yy, moss ? pick(LEAF, v - .3) : pick(STONE, v)); }
    for (let i = 0; i < 16; i++) { const bx = x + (R() - .5) * 40, h = 3 + R() * 7; for (let k = 0; k < h; k++) S.put(bx, y - 1 - k, pick(LEAF, 1.2 + k / h * 2.4)); }
    return { S, ax: x, ay: y, cut: y, amp: 0 }; },
};

export const FLORA = Object.keys(KINDS);
const TREES = new Set(['oak', 'bigoak', 'ancient', 'irregular', 'lowbranch', 'pinesm', 'pine', 'cypress', 'dead', 'willow', 'twisted']);
const cache = new Map();
export function floraArt(kind, seed) {
  const key = kind + ':' + (seed % 4); let A = cache.get(key); if (A) return A;
  const R = rng(hash(seed % 4, kind.length * 31 + kind.charCodeAt(0), 5) * 1e9), o = KINDS[kind](R);
  outline(o.S); let c = toCanvas(o.S), ax = o.ax, ay = o.ay, cut = o.cut;
  // the trees drawn half as big again (to stand right beside the church and the priest), pixels kept square and sharp
  const k = TREES.has(kind) ? 1.5 : 1;
  if (k !== 1) { const b = document.createElement('canvas'); b.width = Math.round(c.width * k); b.height = Math.round(c.height * k); const g = b.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(c, 0, 0, b.width, b.height); c = b; ax *= k; ay *= k; cut *= k; }
  A = { c, ax: Math.round(ax), ay: Math.round(ay), cut: Math.max(1, Math.round(cut)), amp: (o.amp ?? 2.4) * k };
  cache.set(key, A); return A;
}
