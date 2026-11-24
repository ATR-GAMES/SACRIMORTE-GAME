// The church seen from out in the open: everything of it above the eaves of its outer walls (the clerestory of the
// nave, its steep roof and great west gable with the rose, the two towers with their belfries and spires, the roofs of
// the wings, the pinnacles) as one sprite drawn through a depth buffer, and at its feet the buttresses and the porch
// as small sprites sorted with everything else.
// Anything above the eaves seen at the same pixel as anything below them is always the nearer of the two, so the one
// big sprite is simply drawn last, over the rest.
// Coordinates: x, y in cells as the cathedral is laid out (src/cathedral.js), z in pixels of height on screen.
import { GY } from './view.js?v=7b25778';

const hash = (a, b, c = 0) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1440662683); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const WG = [[150, 70, 210], [190, 86, 210], [118, 60, 190], [226, 80, 108], [250, 190, 90], [86, 104, 216]];
const glow = c => { const g = c.slice(); g.glow = 1; return g; };

// The half width of a pointed arch d pixels above its springing (hw below it).
const archW = (d, hw) => { if (d <= 0) return hw; const R = hw * 1.6, c = R - hw; return Math.sqrt(Math.max(0, R * R - d * d)) - c; };
// A pointed window, h along the wall and z up (pixels): its sill, a moulded frame and leaded glass (or a dark belfry
// opening with louvres, or a niche with a saint in it).
function lancet(h, z, hc, zb, zt, hw, seed, kind = 'glass') {
  const spring = zt - hw * 1.48, x = Math.abs(h - hc);
  if (z > zt + 3 || z < zb - 4) return;
  if (z < zb) return x < hw + 3.5 ? (z < zb - 2 ? [176, 162, 176] : [92, 80, 100]) : undefined;   // the sill
  if (x >= archW(z - spring, hw + 3)) return;
  if (x >= archW(z - spring, hw + 1.2)) return [172, 158, 174];                                   // the frame
  if (x >= archW(z - spring, hw)) return [74, 62, 82];                                             // its reveal
  if (kind === 'dark') return (Math.floor(z) % 6 < 2) ? [70, 58, 76] : [14, 9, 18];
  if (kind === 'niche') {
    if (x < hw * .46 && z > zb + 2 && z < spring + hw * .2) { const k = (h - hc) < 0 ? 1 : .72; return [168 * k, 156 * k, 166 * k]; }
    return [34, 26, 42];
  }
  if (x < 1.1 && hw > 6) return [160, 146, 164];                                                    // the mullion
  if (Math.floor(z) % 7 === 0 || ((Math.floor(h) + Math.floor(z / 7) * 2) % 5 + 5) % 5 === 0) return [40, 28, 46];
  return glow(WG[Math.floor(hash(Math.floor(h / 5) + seed, Math.floor(z / 7), 9) * 6)]);
}
// A rose window: radius R pixels, petals of glass between stone spokes and rings.
function rose(h, z, hc, zc, R) {
  const dx = h - hc, dz = z - zc, d = Math.hypot(dx, dz);
  if (d > R + 4) return;
  if (d > R) return [176, 162, 176];
  if (d > R - 2.5) return [86, 74, 94];
  const a = Math.atan2(dz, dx);
  if (d < R * .16) return glow([255, 196, 96]);
  if (Math.abs(d - R * .16) < 1.2 || Math.abs(d - R * .56) < 1.3) return [168, 154, 170];
  const n = d < R * .56 ? 6 : 12;
  if (Math.abs(Math.sin(a * n / 2)) < (d < R * .56 ? .1 : .14)) return [168, 154, 170];
  const petal = Math.floor(((a + Math.PI) / (2 * Math.PI)) * n);
  return glow(WG[(petal * 7 + (d < R * .56 ? 3 : 0)) % 6].map(x => x * (.85 + .25 * (1 - d / R))));
}
// The clock: a pale dial in a stone ring, its hours, two iron hands at a quarter to midnight.
function clock(h, z, hc, zc, R) {
  const dx = h - hc, dz = z - zc, d = Math.hypot(dx, dz);
  if (d > R + 3) return;
  if (d > R) return [176, 162, 176];
  const a = Math.atan2(dx, dz);                                                     // 0 straight up, clockwise
  if (d > R - 4 && Math.abs(Math.sin(a * 6)) < .12) return [40, 30, 36];
  const hand = (ang, len) => { const ux = Math.sin(ang), uz = Math.cos(ang), t = dx * ux + dz * uz, off = Math.abs(dx * uz - dz * ux); return t > -1 && t < len && off < 1.2; };
  if (hand(0, R * .5) || hand(-Math.PI / 2, R * .78) || d < 2) return [36, 28, 34];
  return glow([236, 216, 170].map(x => x * (.92 - d / R * .18)));
}

// ---------------------------------------------------------------- the shapes
// A face: v its corners [x, y, z] (cells, cells, pixels), m its material, deco(x, y, z) → colour or undefined.
export function buildExterior({ O, E, G, PXC, CELL, V }) {
  const NE = E + 120;                                       // the eaves of the nave (its clerestory above the wings)
  const TE = E + 250;                                       // the top of the towers' belfry stage
  const big = [], objects = [], lights = [], flames = [], solids = [];
  let into = big;
  const iso = p => [p[0], p[1], p[2] / PXC];
  function face(v, m, deco, ctr) {
    const [a, b, c] = v.map(iso), u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const l = Math.hypot(...n) || 1; n = n.map(x => x / l);
    const fc = v.map(iso).reduce((s, p) => [s[0] + p[0] / v.length, s[1] + p[1] / v.length, s[2] + p[2] / v.length], [0, 0, 0]), cc = iso(ctr);
    if (n[0] * (fc[0] - cc[0]) + n[1] * (fc[1] - cc[1]) + n[2] * (fc[2] - cc[2]) < 0) n = n.map(x => -x);
    into.push({ v: v.map(p => [p[0] + O, p[1] + O, p[2]]), m, deco, n, top: Math.max(...v.map(p => p[2])), bot: Math.min(...v.map(p => p[2])) });
  }
  function box(x0, y0, z0, x1, y1, z1, m, d = {}) {
    const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], m, d.t, c);
    face([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], m, d.s, c);
    face([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], m, d.e, c);
    face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], m, d.n, c);
    face([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], m, d.w, c);
  }
  function pyr(x0, y0, x1, y1, z0, z1, m) {
    const A = [(x0 + x1) / 2, (y0 + y1) / 2, z1], c = [A[0], A[1], z0 + (z1 - z0) / 4];
    face([[x0, y0, z0], [x1, y0, z0], A], m, null, c); face([[x1, y0, z0], [x1, y1, z0], A], m, null, c);
    face([[x1, y1, z0], [x0, y1, z0], A], m, null, c); face([[x0, y1, z0], [x0, y0, z0], A], m, null, c);
  }
  // a roof, its ridge running along y (n–s) or x, gables at its ends
  function roof(x0, y0, x1, y1, ze, zr, alongY, gS, gE) {
    const xm = (x0 + x1) / 2, ym = (y0 + y1) / 2, c = [xm, ym, ze + (zr - ze) / 3];
    // a pale stone coping along the verges, where the slates end at a gable
    const vg = (x, y, z) => { const e = alongY ? Math.min(y - y0, y1 - y) : Math.min(x - x0, x1 - x); if (e < .32) return e < .07 ? [70, 60, 78] : [150, 136, 156]; };
    if (alongY) {
      face([[x0, y0, ze], [xm, y0, zr], [xm, y1, zr], [x0, y1, ze]], 'slate', vg, c); face([[xm, y0, zr], [x1, y0, ze], [x1, y1, ze], [xm, y1, zr]], 'slate', vg, c);
      face([[x0, y0, ze], [x1, y0, ze], [xm, y0, zr]], 'stone', null, c); face([[x0, y1, ze], [x1, y1, ze], [xm, y1, zr]], 'stone', gS, c);
    } else {
      face([[x0, y0, ze], [x1, y0, ze], [x1, ym, zr], [x0, ym, zr]], 'slate', vg, c); face([[x0, ym, zr], [x1, ym, zr], [x1, y1, ze], [x0, y1, ze]], 'slate', vg, c);
      face([[x0, y0, ze], [x0, ym, zr], [x0, y1, ze]], 'stone', null, c); face([[x1, y0, ze], [x1, y1, ze], [x1, ym, zr]], 'stone', gE, c);
    }
  }
  // a gable wall standing up on its own (front at yf, back at yb): its face, its sloping coping
  function gable(a, b, yf, yb, zb, zt, deco) {
    const m = (a + b) / 2, c = [m, (yf + yb) / 2, zb + (zt - zb) / 3], F = [[a, yf, zb], [b, yf, zb], [m, yf, zt]], B = [[a, yb, zb], [b, yb, zb], [m, yb, zt]];
    face(F, 'stone', deco, c); face(B, 'stone', null, c);
    face([F[0], F[2], B[2], B[0]], 'trim', null, c); face([F[1], B[1], B[2], F[2]], 'trim', null, c);
    for (let t = .12; t < .95; t += .13) for (const s of [-1, 1]) {            // crockets climbing its edges
      const x = m + s * (1 - t) * (b - a) / 2, z = zb + t * (zt - zb);
      pyr(x - .22, yf - .45, x + .22, yf - .05, z, z + 16, 'trim');
    }
  }
  const pinnacle = (cx, cy, s, z0, z1, z2) => { box(cx - s, cy - s, z0, cx + s, cy + s, z1, 'trim'); box(cx - s - .06, cy - s - .06, z1, cx + s + .06, cy + s + .06, z1 + 4, 'trim'); pyr(cx - s, cy - s, cx + s, cy + s, z1 + 4, z2, 'trim'); };
  const cross = (cx, cy, z) => { box(cx - .1, cy - .1, z, cx + .1, cy + .1, z + 46, 'gold'); box(cx - .45, cy - .1, z + 28, cx + .45, cy + .1, z + 35, 'gold'); };
  const light = (x, y, z, col, r, fl) => { lights.push({ x: (x + O) * CELL, y: (y + O) * CELL, z: z / V, col, r, flicker: fl }); };
  const flame = (x, y, z) => flames.push([20 * ((x + O) - (y + O)), GY * ((x + O) + (y + O)) - z, hash(x * 7, y * 3) * 9]);

  // ---- the nave, from the apse to the west front: its clerestory rises over the wings' roofs, under a steep roof
  const NX0 = 33, NX1 = 57, NY0 = 5, NY1 = 75, NR = NE + (NX1 - NX0) / 2 * PXC * .75;
  const clere = (x, y, z) => { const k = Math.round((y - 9.5) / 3); if (k < 0 || k > 21) return; return lancet(y * 20, z, (9.5 + k * 3) * 20, E + 22, NE - 16, 7, k * 5); };
  const westFront = (x, y, z) => {
    for (const cx of [37.5, 52.5]) { const p = lancet(x * 20, z, cx * 20, E + 18, NE - 10, 11, cx | 0); if (p) return p; }
    for (const cx of [41, 43, 45, 47, 49]) { const p = lancet(x * 20, z, cx * 20, NE - 66, NE - 10, 6.5, cx | 0, 'niche'); if (p) return p; }
  };
  box(NX0, NY0, E, NX1, NY1, NE, 'stone', { e: clere, s: westFront, w: clere });
  box(NX0 - .25, NY0 - .25, NE - 7, NX1 + .25, NY1 + .1, NE, 'trim');                 // its cornice
  for (let y = 8; y <= 70; y += 6) for (const x of [NX0 - .1, NX1 + .1]) pinnacle(x, y, .3, NE - 40, NE + 26, NE + 74);   // the flying buttresses' heads
  roof(NX0 - .4, NY0 - .4, NX1 + .4, NY1 - .2, NE, NR, true);
  for (let y = 10; y < 72; y += 4) box(45 + .4 - .1, y, NR - 2, 45 + .4 + .1, y + .2, NR + 10, 'iron');   // the ridge cresting
  // the west front's gable, the rose in it, a cross on its point
  const GT = NR + 30, RZ = NE + 84;
  gable(NX0 - .6, NX1 + .6, NY1 + .45, NY1 - .2, NE - 8, GT, (x, y, z) => rose(x * 20, z, 45 * 20, RZ, 66));
  cross(45, NY1 + .1, GT - 2);
  light(45, NY1 + 3, RZ, [160, 90, 220], 90); light(37.5, NY1 + 2, E + 70, [150, 80, 210], 46); light(52.5, NY1 + 2, E + 70, [150, 80, 210], 46);

  // ---- the two towers: a tall stage with a window, the belfry, a cornice and battlements, pinnacles at the corners,
  // a spire with a cross; the clock on the clock tower
  for (const [x0, x1, clockFace] of [[24, 34, false], [56, 66, true]]) {
    const y0 = 65, y1 = 76, xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
    const deco = horiz => (x, y, z) => {
      const h = (horiz ? x : y) * 20, c0 = (horiz ? x0 : y0) + 3, c1 = (horiz ? x1 : y1) - 3, mid = (horiz ? xm : ym) * 20;
      for (const cx of [c0, c1]) { const p = lancet(h, z, cx * 20, TE - 122, TE - 22, 15, cx | 0, 'dark'); if (p) return p; }
      if (clockFace && horiz) { const p = clock(h, z, mid, TE - 168, 26); if (p) return p; }
      else { const p = lancet(h, z, mid, E + 24, E + 112, 9, x0); if (p) return p; }
    };
    box(x0, y0, E, x1, y1, TE, 'stone', { s: deco(true), e: deco(false) });
    box(x0 - .15, y0 - .15, E + 128, x1 + .15, y1 + .15, E + 134, 'trim');           // a string course
    box(x0 - .3, y0 - .3, TE, x1 + .3, y1 + .3, TE + 9, 'trim');                      // the cornice
    for (let x = x0; x < x1 - .4; x += 1.2) { box(x, y1 - .1, TE + 9, x + .65, y1 + .3, TE + 24, 'trim'); box(x, y0 - .3, TE + 9, x + .65, y0 + .1, TE + 24, 'trim'); }
    for (let y = y0; y < y1 - .4; y += 1.2) { box(x1 - .1, y, TE + 9, x1 + .3, y + .65, TE + 24, 'trim'); box(x0 - .3, y, TE + 9, x0 + .1, y + .65, TE + 24, 'trim'); }
    for (const [cx, cy] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) pinnacle(cx, cy, .5, TE + 9, TE + 56, TE + 118);
    pyr(x0 + 1.3, y0 + 1.3, x1 - 1.3, y1 - 1.3, TE + 9, TE + 250, 'slate');           // the spire
    for (const [cx, cy] of [[xm, y1 - 1.6], [x1 - 1.6, ym]]) { box(cx - .55, cy - .55, TE + 40, cx + .55, cy + .55, TE + 70, 'stone', { s: (x, y, z) => lancet(x * 20, z, cx * 20, TE + 44, TE + 66, 4, 3, 'dark'), e: (x, y, z) => lancet(y * 20, z, cy * 20, TE + 44, TE + 66, 4, 3, 'dark') }); pyr(cx - .65, cy - .65, cx + .65, cy + .65, TE + 70, TE + 96, 'slate'); }   // lucarnes
    cross(xm, ym, TE + 248);
    light(xm, y1 + 2, TE - 70, [140, 80, 200], 60);
    if (clockFace) light(xm, y1 + 2, TE - 168, [255, 220, 160], 40);
  }

  // ---- the wings' roofs, a round window in each gable that faces south
  const W0 = E + (34 - 12.85) / 2 * PXC * .62, W1 = E + (74.15 - 56) / 2 * PXC * .62;
  roof(12.85, 4.85, 34, 36.15, E, W0, true, (x, y, z) => rose(x * 20, z, 23.4 * 20, E + 46, 22));
  roof(56, 4.85, 74.15, 68.15, E, W1, true, (x, y, z) => rose(x * 20, z, 65.1 * 20, E + 40, 18));
  box(12.75, 36.05, E - 6, 34, 36.3, E, 'trim'); box(74.05, 4.85, E - 6, 74.3, 68.15, E, 'trim'); box(56, 68.05, E - 6, 74.3, 68.3, E, 'trim');   // the eaves' cornices

  // ---- at its feet: buttresses along every wall the camera sees, a lantern on each; the porch before the great doors
  const ground = fn => { into = []; fn(); const f = into; into = big; objects.push({ faces: f }); };
  // along a wall whose outer face is at f (x = f when vert, else y = f), its middle at s
  const buttress = (vert, f, s) => {
    const B = (a0, a1, o0, o1, z0, z1, m, d) => vert ? box(f + o0, s + a0, z0, f + o1, s + a1, z1, m, d) : box(s + a0, f + o0, z0, s + a1, f + o1, z1, m, d);
    ground(() => {
      B(-.36, .36, 0, .95, G, G + 96, 'stone'); B(-.4, .4, 0, 1, G + 96, G + 101, 'trim');
      B(-.3, .3, 0, .62, G + 101, G + 152, 'stone'); B(-.34, .34, 0, .67, G + 152, G + 157, 'trim');
      B(-.25, .25, 0, .34, G + 157, E, 'stone');
      B(-.1, .1, .95, 1.12, G + 54, G + 72, 'lantern'); B(-.13, .13, .95, 1.14, G + 72, G + 75, 'iron');
    });
    if (vert) pinnacle(f + .16, s, .26, E - 2, E + 36, E + 78); else pinnacle(s, f + .16, .26, E - 2, E + 36, E + 78);
    const [lx, ly] = vert ? [f + 1.05, s] : [s, f + 1.05];
    light(lx, ly, G + 64, [255, 168, 86], 46, hash(lx * 3, ly * 5) * 9); flame(lx, ly, G + 62);
    solids.push(vert ? [Math.floor(f + .4) + O, Math.floor(s) + O] : [Math.floor(s) + O, Math.floor(f + .4) + O]);
  };
  for (const x of [15.5, 20.5, 25.5, 30.5]) buttress(false, 36, x);           // the study and library, over the graveyard
  for (const y of [9.5, 15.5, 21.5, 27.5, 33.5, 47.5, 53.5, 64.5]) buttress(true, 74, y);   // the east wing, on the courtyard
  buttress(false, 68, 69.5);                                                  // the stores' south end
  for (const x of [36.5, 53.5]) buttress(false, 75, x);                       // the west front, either side of the porch
  buttress(false, 76, 25.2); buttress(false, 76, 65.2); buttress(true, 66, 70.5);   // the towers' outer corners
  // the porch: two jambs going up into pinnacles, a moulded head, a gable with a cross
  ground(() => {
    const deep = 76.5, tymp = (x, y, z) => { const h = Math.abs(x - 45) * 20; for (let r = 0; r < 3; r++) { const w = archW(z - (G + 150) + r * 7, 70 - r * 7); if (Math.abs(h - w) < 1.3) return [178, 164, 178]; } };
    box(41.1, 75, G, 42.5, deep, E, 'stone'); box(47.5, 75, G, 48.9, deep, E, 'stone');
    box(41.1, 75, G + 146, 48.9, deep, E, 'stone', { s: tymp });
    box(40.95, deep - .1, G + 146, 49.05, deep + .1, G + 151, 'trim');
    box(41, 75, G + 18, 42.6, deep + .08, G + 22, 'trim'); box(47.4, 75, G + 18, 49, deep + .08, G + 22, 'trim');
  });
  gable(41, 49, 76.6, 75, E - 4, E + 72, (x, y, z) => rose(x * 20, z, 45 * 20, E + 26, 15));
  cross(45, 75.9, E + 70);
  pinnacle(41.8, 75.75, .42, E - 4, E + 30, E + 84); pinnacle(48.2, 75.75, .42, E - 4, E + 30, E + 84);
  for (const x of [41.5, 48.5]) { light(x, 77.2, G + 70, [255, 168, 86], 54, x); }
  solids.push([41 + O, 75 + O], [42 + O, 75 + O], [47 + O, 75 + O], [48 + O, 75 + O]);

  // ---- drawn
  const out = [];
  for (const o of objects) { const r = raster(o.faces); if (r) { r.d = Math.max(...o.faces.flatMap(f => f.v.map(p => p[0] + p[1]))) * CELL; out.push(r); } }
  const B = raster(big); if (B) { B.d = Infinity; B.big = true; out.push(B); }
  return { objects: out, lights, flames, solids };

  // ---- the rasteriser: each face turned to the camera, pixel by pixel, the nearest kept
  function raster(faces) {
    const tris = []; let X0 = 1e9, X1 = -1e9, Y0 = 1e9, Y1 = -1e9;
    for (const f of faces) {
      const n = f.n; if (n[0] + n[1] + n[2] * 2 * GY / PXC <= 1e-6) continue;
      f.lit = .62 * Math.max(0, n[0]) ** 2 + .86 * Math.max(0, n[1]) ** 2 + 1.04 * Math.max(0, n[2]) ** 2 + .42 * (Math.min(0, n[0]) ** 2 + Math.min(0, n[1]) ** 2);
      const S = f.v.map(p => [20 * (p[0] - p[1]), GY * (p[0] + p[1]) - p[2]]);
      for (const s of S) { X0 = Math.min(X0, s[0]); X1 = Math.max(X1, s[0]); Y0 = Math.min(Y0, s[1]); Y1 = Math.max(Y1, s[1]); }
      for (let t = 1; t + 1 < f.v.length; t++) tris.push([f, f.v[0], f.v[t], f.v[t + 1], S[0], S[t], S[t + 1]]);
    }
    if (!tris.length) return null;
    X0 = Math.floor(X0) - 1; Y0 = Math.floor(Y0) - 1; X1 = Math.ceil(X1) + 1; Y1 = Math.ceil(Y1) + 1;
    const w = X1 - X0 + 1, h = Y1 - Y0 + 1, zb = new Float32Array(w * h).fill(-1e9);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), im = g.createImageData(w, h), D = im.data;
    for (const [f, P, Q, R, A, Bp, C] of tris) {
      const det = (Bp[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (Bp[1] - A[1]); if (Math.abs(det) < 1e-9) continue;
      const bx0 = Math.floor(Math.min(A[0], Bp[0], C[0])), bx1 = Math.ceil(Math.max(A[0], Bp[0], C[0])), by0 = Math.floor(Math.min(A[1], Bp[1], C[1])), by1 = Math.ceil(Math.max(A[1], Bp[1], C[1]));
      for (let py = by0; py <= by1; py++) for (let px = bx0; px <= bx1; px++) {
        const qx = px + .5 - A[0], qy = py + .5 - A[1];
        const b1 = (qx * (C[1] - A[1]) - (C[0] - A[0]) * qy) / det, b2 = ((Bp[0] - A[0]) * qy - qx * (Bp[1] - A[1])) / det, b0 = 1 - b1 - b2;
        if (b0 < -1e-6 || b1 < -1e-6 || b2 < -1e-6) continue;
        const I = b0 * P[0] + b1 * Q[0] + b2 * R[0], J = b0 * P[1] + b1 * Q[1] + b2 * R[1], z = b0 * P[2] + b1 * Q[2] + b2 * R[2];
        const idx = (py - Y0) * w + (px - X0), dep = I + J + z / GY; if (dep <= zb[idx]) continue;
        let col = f.deco ? f.deco(I - O, J - O, z) : undefined;
        if (!col) col = paint(f, I, J, z);
        if (!col.glow) col = [col[0] * f.lit, col[1] * f.lit, col[2] * f.lit];
        zb[idx] = dep; const o = idx * 4; D[o] = col[0]; D[o + 1] = col[1]; D[o + 2] = col[2]; D[o + 3] = 255;
      }
    }
    g.putImageData(im, 0, 0);
    const mask = new Uint8Array(w * h); for (let n = 0; n < w * h; n++) mask[n] = D[n * 4 + 3] ? 1 : 0;
    return { c, x: X0, y: Y0, mask };
  }
  function paint(f, I, J, z) {
    const n = f.n;
    switch (f.m) {
      case 'stone': {
        if (n[2] > .9) return [116, 104, 124].map(x => x * (.93 + hash(I * 3, J * 3, 1) * .1));
        if (Math.abs(n[2]) > .3) return [126, 112, 132];
        const hh = (Math.abs(n[0]) > Math.abs(n[1]) ? J : I) * 20, row = Math.floor(z / 8), y = z - row * 8, sh = (row & 1) * 5, xx = (((hh + sh) % 10) + 10) % 10, col = Math.floor((hh + sh) / 10);
        if (y < 1 || xx < 1) return [50, 40, 56];
        let k = .82 + hash(col, row, 5) * .22; if (y < 2) k *= 1.1; if (xx < 2) k *= 1.05;
        return [112 * k, 98 * k, 118 * k];
      }
      case 'trim': return [158, 144, 162].map(x => x * (.94 + hash(Math.floor(I * 4), Math.floor(J * 4) + Math.floor(z / 4), 2) * .1));
      case 'slate': {
        const hz = z - f.bot, along = (Math.abs(n[0]) > Math.abs(n[1]) ? J : I) * 10, course = Math.floor(hz / 5), off = (course & 1) * 5, joint = Math.floor((along + off) / 10);
        let col = [74, 62, 96].map(x => x * (.84 + hash(joint, course, 3) * .24));
        if (((hz % 5) + 5) % 5 < 1) col = [40, 32, 54]; else if ((((along + off) % 10) + 10) % 10 < 1) col = col.map(x => x * .7);
        if (hz < 4.5) col = hz < 1 ? [70, 60, 78] : [146, 132, 152];                   // a stone cornice at the eaves (not a dark lip, which reads as wood)
        const up = (z - f.bot) / Math.max(1, f.top - f.bot); return col.map(x => x * (1 - .25 * up * up));
      }
      case 'gold': return glow([226, 188, 104]);
      case 'iron': return [52, 46, 60];
      case 'lantern': return glow([255, 214, 140]);
      default: return [24, 18, 30];
    }
  }
}
