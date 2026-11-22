// Generic figure builder for the enemies. Same skeleton and renderer as the priest (IK legs, FK or IK arms, sliced
// skirts), but everything he wears is described by a "look": skin, clothes, head (human, goat, imp), headgear
// (hood, veil, capirote, mitre), and extras (wings, tail, horns, a cross nailed to the arms, brands on the chest).
import { renderSprite, hash, M } from './raster.js?v=7fc74c5';
import { RAMPS, ik, legAt } from './priest.js?v=7fc74c5';

const { sin, cos, sqrt, PI, abs, max, min, atan2, hypot, ceil } = Math;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => hypot(a[0], a[1], a[2]), nrm = a => mul(a, 1 / (len(a) || 1));
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const Rx = (t, v) => [v[0], v[1] * cos(t) - v[2] * sin(t), v[1] * sin(t) + v[2] * cos(t)];
const Ry = (t, v) => [v[0] * cos(t) + v[2] * sin(t), v[1], -v[0] * sin(t) + v[2] * cos(t)];
const Rz = (t, v) => [v[0] * cos(t) - v[1] * sin(t), v[0] * sin(t) + v[1] * cos(t), v[2]];
const AX = f => [f([1, 0, 0]), f([0, 1, 0]), f([0, 0, 1])];
const ID = AX(v => v);

export const FRAMPS = {
  ...RAMPS,
  ember:    [0x4a0804, 0x8a1606, 0xd0380e, 0xff6a1e, 0xffc050],
  void:     [0x000000, 0x050405, 0x0a080a, 0x100c10, 0x181418],
  linen:    [0x3a3430, 0x645a50, 0x8e8272, 0xb0a490, 0xcac0ac],
  flesh:    [0x232226, 0x403c3e, 0x666062, 0x8c8584, 0xaaa29e],
  raw:      [0x3a0808, 0x6a1410, 0x8e2a20, 0xb04434, 0xc8645a],
  hide:     [0x120d0b, 0x221914, 0x352820, 0x4a382c, 0x5e4838],
  horn:     [0x2a2420, 0x4e463a, 0x7a6e5a, 0xa49678, 0xc8bc9a],
  imp:      [0x1a0606, 0x3a0c0c, 0x601414, 0x8a2018, 0xa83424],
  crimson:  [0x1a0406, 0x34080c, 0x560e12, 0x7a161a, 0x9a2422],
  surplice: [0x6a665e, 0x9a958a, 0xc4bfb2, 0xe0dcd0, 0xf2efe6],
  redcass:  [0x200608, 0x3e0c10, 0x601418, 0x822020, 0x9e2e2a],
  rope:     [0x2a2014, 0x4a3a24, 0x6e5a38, 0x8e7a4e, 0xaa9668],
  bone:     [0x3a3428, 0x6a604c, 0x9a8e74, 0xc2b698, 0xded4b8],
  habit:    [0x08080b, 0x121217, 0x1c1c23, 0x292932, 0x3a3a46],
  membrane: [0x1a0a0c, 0x2e1216, 0x4a1c20, 0x66282a, 0x803a36],
  trousers: [0x14120f, 0x24201b, 0x363027, 0x4a4234, 0x5e5442],
  apron:    [0x1e1510, 0x34261c, 0x4c3828, 0x644a34, 0x7a5c42],
  darkhair: [0x0a0808, 0x18120f, 0x2a201a, 0x3c2e24, 0x4e3c2e],
  brownhair:[0x1c120a, 0x342214, 0x4e341e, 0x6a4828, 0x845c34],
};

const HIPW = 3.3, UARM = 9.8, FARM = 8.4;

export function buildFig(P, L, facing) {
  const prims = [], decals = [];
  const E = (c, ax, r, key, mat, x) => { const p = { c, ax, r, key, mat, ...x }; prims.push(p); return p; };
  const chain = (a, b, r0, r1, key, mat, x) => {
    const n = max(1, ceil(len(sub(b, a)) / (min(r0, r1) * .5)));
    for (let i = 0; i <= n; i++) { const t = i / n, r = r0 + (r1 - r0) * t; E(lerp(a, b, t), ID, [r, r, r], key, mat, { t, ...x }); }
  };
  const rod = (a, b, r, key, mat, x) => { // one long ellipsoid from a to b
    const d = nrm(sub(b, a)), o = abs(d[2]) < .9 ? [0, 0, 1] : [1, 0, 0], Y = nrm(crs(o, d)), Z = crs(d, Y);
    return E(lerp(a, b, .5), [d, Y, Z], [len(sub(b, a)) / 2 + r * .5, r, r], key, mat, x);
  };
  const panel = (e, a, b, key, x) => { // a thin sheet over the triangle e-a-b
    const c = mul(add(add(e, a), b), 1 / 3), A1 = nrm(sub(a, b)), n = nrm(crs(sub(a, e), sub(b, e))), A2 = crs(n, A1);
    E(c, [A1, A2, n], [len(sub(a, b)) / 2 + .6, len(sub(c, e)) + .4, .35], key, null, x);
  };
  const pel = P.pel, bw = L.bw || 1, skin = L.skin || 'skin';
  const U = v => Rz(P.twist, Ry(P.lean, Rx(P.tilt, v))), Ui = v => Rx(-P.tilt, Ry(-P.lean, Rz(-P.twist, v)));
  const up = v => add(pel, U(v));

  // Skin with lash wounds and blood, for bare torsos.
  const woundMat = (q0, q1, q2, p, px, py) => {
    if (!L.wounds) return;
    const s = (q2 * 9 + q1 * 3.5 + 20) % 2;
    if (s < .35 && hash((q1 * 5 + 30) | 0, (q2 * 9 + 30) | 0) > .3) M.key = hash((q1 * 7) | 0, (q2 * 11) | 0) > .5 ? 'raw' : 'blood';
  };
  const furMat = (q0, q1, q2, p, px, py) => { M.tone = (hash(((q1 + 2) * 7) | 0, ((q2 + 2) * 9 + ((px + py) & 1)) | 0) - .5) * .3; };
  const stainMat = (q0, q1, q2) => { if (L.stains && hash(((q1 + 2) * 2.6 + (q0 > 0 ? 0 : 17)) | 0, ((q2 + 2) * 2.2) | 0) > 1 - L.stains) M.key = 'blood'; };
  const topMat = L.top === skin ? woundMat : L.top === 'hide' ? furMat : stainMat;

  // ---------------------------------------------------------------- legs
  const legs = {}, legKey = L.pants || 'pants';
  for (const s of [1, -1]) {
    const F = s > 0 ? P.footL : P.footR;
    const Hj = add(pel, Rz(P.twist * .35, [0, s * HIPW * bw, -.6]));
    const Lg = ik(Hj, [F[0], s * (HIPW * bw + F[1]), F[2]], nrm([1, s * .14, 0]));
    legs[s] = Lg;
    const mid = lerp(Lg.K, Lg.A, .6), lm = legKey === 'hide' ? furMat : null;
    chain(Lg.H, Lg.K, 2.6 * (L.legW || 1), 2.1 * (L.legW || 1), legKey, lm);
    const lowKey = L.feet === 'boot' ? (L.boot || 'boot') : legKey;
    chain(Lg.K, mid, 2.1 * (L.legW || 1), 1.9, legKey, lm);
    chain(mid, Lg.A, 1.95, L.feet === 'hoof' ? 1.4 : 1.7, lowKey, lm);
    const fp = F[3] || 0, fx = nrm([cos(fp), s * .12, -sin(fp)]), fy = nrm(crs([0, 0, 1], fx)), fz = crs(fx, fy);
    if (L.feet === 'hoof') E(add(Lg.A, add(mul(fx, .6), mul(fz, -1.4))), [fx, fy, fz], [2.0, 1.6, 1.4], 'void');
    else if (L.feet === 'bare' || L.feet === 'claw') {
      E(add(Lg.A, add(mul(fx, 1.6), mul(fz, -1.4))), [fx, fy, fz], [3.0, 1.5, 1.0], skin);
      if (L.feet === 'claw') for (const o of [-1, 0, 1]) E(add(Lg.A, add(add(mul(fx, 4.3), mul(fy, o * .9)), mul(fz, -1.6))), [fx, fy, fz], [1.2, .35, .35], 'horn');
    } else E(add(Lg.A, add(mul(fx, 1.7), mul(fz, -1.15))), [fx, fy, fz], [3.3, 1.7, 1.35], L.boot || 'boot');
  }

  // ---------------------------------------------------------------- skirts (robes, habits, the surplice over a cassock)
  const slices = [];
  const skirt = (R, grow) => {
    const NS = max(6, Math.round(19 * R.len / .9));
    for (let i = 0; i < NS; i++) {
      const t = i / (NS - 1) * R.len, a = legAt(legs[1], t), b = legAt(legs[-1], t);
      const c = mul(add(a, b), .5);
      c[0] -= P.drag * t * t; c[2] += P.lift * t * t; c[0] += P.flareFwd * t * t;
      if (!P.tumble) c[2] = max(c[2], 1.4);
      let A = [a[0] - b[0], a[1] - b[1], 0]; const sep = hypot(A[0], A[1]);
      A = sep > .01 ? [A[0] / sep, A[1] / sep, 0] : [0, 1, 0];
      if (A[1] < 0) A = mul(A, -1);
      const B = crs(A, [0, 0, 1]);
      const ra = sep / 2 + (2.7 + 1.7 * t) * bw + grow + P.flare * t * t, rb = 3.9 + 1.2 * t + grow + P.flare * .6 * t * t;
      const last = i === NS - 1;
      E(c, [A, B, [0, 0, 1]], [ra, rb, 1.35], R.key, skirtMat(R), { cyl: true, t, idx: i, clip: last && R.torn ? hemClip : null });
      if (!grow) slices.push({ c, A, B, ra, rb });
    }
  };
  const skirtMat = R => (q0, q1, q2, p) => {
    const ang = atan2(q1, q0);
    M.tone = .1 * sin(ang * 7 + p.t * 4) * (.25 + p.t);
    if (R.mud && p.t > .7 && hash(((ang + 4) * 5) | 0, p.idx) < (p.t - .7) * 4.2) M.key = 'mud';
    if (R.blood && hash(((ang + 4) * 4) | 0, (p.t * 9) | 0) > 1 - R.blood) M.key = 'blood';
  };
  const hemClip = (q0, q1, q2) => q2 < .35 && hash(((atan2(q1, q0) + 4) * 7) | 0, 9) > .52;
  if (L.robe) skirt(L.robe, 0);
  if (L.over) skirt(L.over, .7);
  const near = w => { let best = null, bd = 1e9; for (const s of slices) { const d = abs(s.c[2] - w); if (d < bd) { bd = d; best = s; } } return best; };
  const front = w => { const s = near(w); return s ? s.c[0] + sqrt((s.ra * s.A[0]) ** 2 + (s.rb * s.B[0]) ** 2) : pel[0] + 3.5; };

  // ---------------------------------------------------------------- torso
  const top = L.top || 'linen', bel = L.belly || 0;
  E(up([0, 0, 5]), AX(U), [3.9 + bel * .6, 5.3 * bw, 5.4], top, topMat);
  E(up([.3, 0, 12.6]), AX(U), [4.3, 6.0 * bw, 6.6], top, topMat);
  if (bel) E(up([2.0 + bel, 0, 6.5]), AX(U), [3.0 + bel * 1.2, 4.6 * bw, 4.8], top, topMat);
  E(up([-.2, 0, 15.8]), AX(U), [4.2, 7.0 * bw, 3.1], L.mantle || top, L.mantle ? null : topMat);
  if (L.mantle) E(up([-.2, 0, 16.0]), AX(U), [5.2, 7.9 * bw, 3.4], L.mantle);
  chain(up([.3, 0, 18]), up([.6, 0, 23]), 1.95, 1.8, skin);
  const chestF = w => max(.3 + 4.3 * sqrt(max(0, 1 - ((w - 12.6) / 6.6) ** 2)), 3.9 + bel * .6 * sqrt(max(0, 1 - ((w - 5) / 5.4) ** 2)), bel ? 2 + bel + (3 + bel * 1.2) * sqrt(max(0, 1 - ((w - 6.5) / 4.8) ** 2)) : 0);
  if (L.belt) E(up([0, 0, 2.2]), AX(U), [4.6 + bel, 5.9 * bw, .9], L.belt);
  if (L.chasuble) { // the bishop's front panel
    E(up([chestF(11) - .2, 0, 10]), AX(U), [1.0, 4.6 * bw, 9.5], L.chasuble, null, { noLine: true });
    for (let w = 4; w <= 16; w += 1.1) decals.push({ p: up([chestF(w) + .9, 0, w]), n: U([1, 0, 0]), key: 'ember', l: 2, tol: 2.6, face: 0 });
    for (const l of [-1.7, -.6, .6, 1.7]) decals.push({ p: up([chestF(7) + .9, l, 7]), n: U([1, 0, 0]), key: 'ember', l: 2, tol: 2.6, face: 0 });
  }
  if (L.apron) { // hangs from the chest past the knees
    const pts = [];
    for (let w = 16; w >= 4; w -= 1.5) pts.push(up([chestF(w) + .6, 0, w]));
    let last = pts[pts.length - 1];
    for (let j = 1; j <= 9; j++) { const w = last[2] - 1.5; last = [max(last[0] - P.drag * .05 * j, front(w) + .6), last[1], w]; if (!L.robe) last[0] = max(last[0], pel[0] + 4.5 + P.footL[0] * .4 * (j / 9)); pts.push(last); }
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1], dn = nrm(sub(b, a)), W = nrm(crs(dn, U([1, 0, 0]))), T = crs(dn, W);
      E(lerp(a, b, .5), [dn, W, T], [len(sub(b, a)) / 2 + .5, 4.8 * bw, .6], 'apron', (q0, q1) => { if (hash(((q1 + 2) * 3) | 0, i) > .55) M.key = 'blood'; }, { noLine: true });
    }
  }
  // Brands and pendants on the chest.
  const chestPt = (l, w, o = .15) => ({ p: up([chestF(w) + o, l, w]), n: U([1, 0, 0]) });
  if (L.pentagram) {
    const pts = [0, 1, 2, 3, 4].map(k => { const a = -PI / 2 + k * TAU5; return [cos(a) * 2.8, 11.2 + sin(a) * 2.8]; });
    for (let k = 0; k < 5; k++) { const a = pts[k], b = pts[(k + 2) % 5]; for (let t = 0; t <= 1; t += .2) { const l = a[0] + (b[0] - a[0]) * t, w = a[1] + (b[1] - a[1]) * t; decals.push({ ...chestPt(l, w), key: L.pentagram, l: 3, tol: 2.4, face: 0 }); } }
  }
  if (L.invcross) {
    for (let w = 8; w <= 14; w += .9) decals.push({ ...chestPt(0, w), key: L.invcross, l: 3, tol: 2.4, face: 0 });
    for (const l of [-1.6, -.8, .8, 1.6]) decals.push({ ...chestPt(l, 9.6), key: L.invcross, l: 3, tol: 2.4, face: 0 });
  }

  // ---------------------------------------------------------------- head
  const HS = L.headS || 1.12, N0 = up([.3, 0, 21]);
  const HR = v => U(Rz(P.head[1], Ry(P.head[0], Rx(P.head[2], v)))), hp = v => add(N0, HR(mul(v, HS)));
  const EH = (c, r, key, mat, x, ax) => E(hp(c), ax || AX(HR), mul(r, HS), key, mat, x);
  const onEl = (q, c, r) => { const n = nrm(q); return { p: hp([c[0] + n[0] * r[0], c[1] + n[1] * r[1], c[2] + n[2] * r[2]]), n: HR(nrm([n[0] / r[0], n[1] / r[1], n[2] / r[2]])) }; };
  const jaw = P.jaw || 0, HC = [.4, 0, 4.9], HRAD = [4.0, 3.6, 4.6];
  const hairKey = L.hairKey || 'hair';
  const kind = L.headKind || 'human';
  if (kind === 'goat') {
    const SN = v => HR(Ry(.38, v));
    EH([-.2, 0, 5.6], [3.7, 3.4, 3.9], 'hide', furMat);
    EH([3.6, 0, 3.6], [4.0, 2.1, 2.2], 'hide', furMat, null, AX(SN));
    EH([7.0, 0, 2.0], [1.5, 1.7, 1.6], 'hide', (q0, q1, q2) => { M.tone = -.15; });
    EH([4.6, 0, 1.6 - jaw * 1.4], [3.1, 1.5, .9], 'hide', furMat, null, AX(v => HR(Ry(.38 + jaw * .4, v))));
    for (const s of [1, -1]) {
      EH([-.4, s * 3.7, 5.2], [.9, 2.4, .55], 'hide', furMat, null, AX(v => HR(Rx(s * .5, v))));
      const pts = [];
      for (let k = 0; k <= 16; k++) { const t = k / 16, th = t * 1.75 * PI, R = 4.4 * (1 - .42 * t); pts.push([-1.8 - R * sin(th), s * (3.0 + 2.6 * t), 6.4 + R * cos(th)]); }
      for (let k = 0; k < pts.length; k++) { const t = k / 16, r = 1.45 * (1 - .72 * t) + .25; EH(pts[k], [r, r, r], 'horn', () => { M.tone = (k % 3 === 0) ? -.15 : .05; }); }
      decals.push({ ...onEl([.55, s * .78, .18], [-.2, 0, 5.6], [3.7, 3.4, 3.9]), key: 'ember', l: 4, tol: 2.4, face: -.3 });
    }
    chain(hp([5.0, 0, .6]), hp([4.2, 0, -3.6]), .95 * HS, .35 * HS, 'hide', furMat);
  } else {
    // human, or the imp's small head
    const headMat = (q0, q1, q2) => {
      const a1 = abs(q1), H = L.hair;
      const hairy = H === 'short' || H === 'wild' ? (q2 > .42 || q0 < -.25 || (a1 > .78 && q2 > -.2)) : H === 'bowl' ? (q2 > .3 || q0 < -.15 || (a1 > .76 && q2 > -.3)) : H === 'long' ? (q2 > .45 || q0 < 0 || a1 > .72) : false;
      if (hairy) { M.key = hairKey; M.tone = (hash((q1 * 9) | 0, (q0 * 5) | 0) - .5) * .3; return; }
      M.tone = q2 > .3 ? -.08 : 0;
      if (q2 > 0 && q2 < .36 && a1 > .12 && a1 < .64 && q0 > .3) M.tone = L.eyes === 'void' ? -.6 : -.3;
      else if (q2 < -.06 && q2 > -.55 && a1 > .4) M.tone = -.12;
      if (L.veins && hash(((q1 + 2) * 6) | 0, ((q2 + 2) * 8) | 0) > .86) M.key = 'raw';
    };
    EH(HC, HRAD, skin, headMat);
    EH([1.2 + jaw * .4, 0, 2.4 - jaw * 1.3], [3.0, 2.6, 2.3], skin, (q0, q1, q2, p, px, py) => { if (L.stubble && q2 < .25 && q0 > -.4 && ((px + py) & 1)) M.tone = -.2; });
    EH([4.3, 0, 4.1], [1.0, .75, 1.4], skin);
    if (L.hair === 'long') EH([-1.8, 0, 2.6], [2.6, 3.7, 5.6], hairKey, (q0, q1) => { M.tone = (hash((q1 * 11) | 0, 2) - .5) * .32; }, { clip: (q0, q1, q2) => q2 < -.4 && hash((q1 * 12 + 40) | 0, 5) < (-.4 - q2) * 2.2 });
    if (L.hair === 'wild') for (const [x, y, z] of [[-1, 2.5, 8.6], [.5, -2.2, 8.9], [-2.8, .3, 8], [1.6, .9, 9.2]]) EH([x, y, z], [1.6, 1.5, 1.3], hairKey);
    if (kind === 'imp') {
      for (const s of [1, -1]) {
        EH([-.2, s * 3.9, 5.8], [.6, 2.7, .9], skin, null, null, AX(v => HR(Rx(-s * .7, v))));
        chain(hp([1.0, s * 2.0, 8.4]), hp([2.4, s * 3.0, 11.2]), .95 * HS, .55 * HS, 'horn');
        chain(hp([2.4, s * 3.0, 11.2]), hp([4.2, s * 3.2, 12.4]), .55 * HS, .2 * HS, 'horn');
      }
    }
    if (L.horns === 'small') for (const s of [1, -1]) chain(hp([1.2, s * 2.2, 8.6]), hp([2.8, s * 3.4, 11.6]), .9 * HS, .3 * HS, 'horn');
    // Eyes, tears of blood, the mouth.
    for (const s of [1, -1]) {
      const e = onEl([.86, s * .37, .15], HC, HRAD);
      decals.push({ ...e, key: L.eyes === 'void' ? 'void' : L.eyes === 'white' ? 'eye' : 'ember', l: L.eyes === 'void' ? 0 : 4, tol: 2.2, face: .05 });
      if (L.eyes === 'void') decals.push({ ...onEl([.86, s * .26, .15], HC, HRAD), key: 'void', l: 0, tol: 2.2, face: .05 });
      if (L.tears) for (const z of [-.05, -.25, -.45]) decals.push({ ...onEl([.9, s * .36, z], HC, HRAD), key: 'blood', l: 2, tol: 2.2 });
    }
    const mo = onEl([.95, 0, -.3 - jaw * .4], [1.2, 0, 2.4 - jaw * 1.3], [3.0, 2.6, 2.3]);
    decals.push({ ...mo, key: jaw > .3 ? 'void' : 'blood', l: 0, tol: 2 });
    if (L.mouthBlood) for (const z of [-.55, -.75]) decals.push({ ...onEl([.93, .1, z], [1.2, 0, 2.4 - jaw * 1.3], [3.0, 2.6, 2.3]), key: 'blood', l: 2, tol: 2 });
    if (kind === 'imp') for (const l of [-.45, -.15, .15, .45]) decals.push({ ...onEl([.9, l, -.15], [1.2, 0, 2.4], [3.0, 2.6, 2.3]), key: 'bone', l: 4, tol: 2 });
  }

  // Headgear.
  const gear = L.gear;
  if (gear === 'hood' || gear === 'veil') {
    const key = L.gearKey;
    EH([-.5, 0, 5.6], [5.3, 5.0, 5.9], key, (q0, q1, q2) => { if (q0 > .2) M.tone = -.1; }, { clip: (q0, q1, q2) => q0 > .3 && q2 < .6 && abs(q1) < .8 });
    E(up([-.8, 0, 18.4]), AX(U), [5.6, 7.2 * bw, 3.6], key);
    if (gear === 'veil') {
      E(up([-4.0, 0, 13]), AX(U), [2.0, 5.6 * bw, 8.5], key);
      EH([.25, 0, 4.7], [4.35, 4.0, 4.95], 'collar', null, { clip: (q0, q1, q2) => q0 > .5 && q2 < .5 && q2 > -.62 && abs(q1) < .62 });
      E(up([2.6, 0, 18.4]), AX(U), [2.6, 4.4, 2.6], 'collar');
    }
  } else if (gear === 'capirote') {
    const key = L.gearKey || 'hat';
    for (let k = 0; k <= 11; k++) { const t = k / 11, r = 4.5 * (1 - t) + .45; EH([-.4 + t * .3, 0, 7.6 + t * 17], [r, r * .96, 1.7], key); }
    E(hp([4.3, 0, 3.4]), AX(HR), [1.1 * HS, 4.5 * HS, 5.6 * HS], key, null, { noLine: true });
    E(up([chestF(15) + .9, 0, 15.5]), AX(U), [.9, 5.2 * bw, 4.8], key);
    for (const s of [1, -1]) decals.push({ p: hp([5.7, s * 1.5, 5.4]), n: HR([1, 0, 0]), key: 'void', l: 0, tol: 2.8, face: 0 },
      { p: hp([5.7, s * 1.0, 5.4]), n: HR([1, 0, 0]), key: 'void', l: 0, tol: 2.8, face: 0 });
  } else if (gear === 'mitre') {
    const key = L.gearKey || 'cassock';
    for (let k = 0; k <= 12; k++) { const t = k / 12; EH([-.4, 0, 9.6 + t * 7.4], [2.7 * (1 - .25 * t), 4.0 * (1 - t) + .45, .75], key, (q0, q1) => { if (abs(q1) < .12) M.tone = -.2; }); }
    EH([-.4, 0, 9.2], [3.9, 3.8, 1.5], key);
    for (let z = 10; z <= 15.4; z += .9) decals.push({ p: hp([2.4, 0, z]), n: HR([1, 0, 0]), key: 'redcass', l: 4, tol: 1.6, face: .25 });
    for (const l of [-1.2, -.5, .5, 1.2]) decals.push({ p: hp([2.45, l, 11.2]), n: HR([1, 0, 0]), key: 'redcass', l: 4, tol: 1.6, face: .25 });
  }

  // ---------------------------------------------------------------- arms
  const hands = {}, fore = {};
  for (const s of [1, -1]) {
    const S0 = [-.2, s * 6.0 * bw, 16.2];
    let T = P.armIK && P.armIK[s];
    if (T && P.armIKbody) T = Ui(sub(T, pel));
    let El, Wr, Hc, d2;
    if (T) {
      const L1 = UARM, L2 = FARM + 1.5, dh = nrm(sub(T, S0)), d = min(len(sub(T, S0)), L1 + L2 - .05);
      const Tt = add(S0, mul(dh, d)), a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = sqrt(max(0, L1 * L1 - a * a));
      const pl = [-.55, s * .4, -.55], pole = nrm(sub(pl, mul(dh, dot(pl, dh))));
      El = add(S0, add(mul(dh, a), mul(pole, h))); d2 = nrm(sub(Tt, El)); Wr = sub(Tt, mul(d2, 1.5)); Hc = Tt;
    } else {
      const [p, ab, e] = s > 0 ? P.armL : P.armR;
      const d1 = [sin(p) * cos(ab), s * sin(ab), -cos(p) * cos(ab)];
      d2 = [sin(p + e) * cos(ab), s * sin(ab), -cos(p + e) * cos(ab)];
      El = add(S0, mul(d1, UARM)); Wr = add(El, mul(d2, FARM)); Hc = add(Wr, mul(d2, 1.5));
    }
    const upKey = L.sleeve || top, foreKey = L.forearm || upKey, am = k => k === skin ? woundMat : k === 'hide' ? furMat : null;
    chain(up(S0), up(El), 2.5 * (L.armW || 1), 2.15 * (L.armW || 1), upKey, am(upKey));
    chain(up(El), up(Wr), 2.15 * (L.armW || 1), L.cuff ? 2.5 : 1.8 * (L.armW || 1), foreKey, am(foreKey));
    E(up(Hc), AX(U), [1.95, 1.7, 2.05], skin);
    hands[s] = up(Hc); fore[s] = U(d2);
    if (L.claws) {
      const D = U(d2), side = nrm(crs(D, U([0, 0, 1])));
      for (const o of [-1, 0, 1]) { const b = add(up(Hc), add(mul(D, 1.6), mul(side, o * .9))); rod(b, add(b, add(mul(D, 2.8), mul(U([0, 0, -1]), .9))), .42, 'horn'); }
    }
    if (L.nailed) {
      decals.push({ p: add(up(Hc), U([1.6, 0, 1.2])), n: null, key: 'iron', l: 3, tol: 3 });
      decals.push({ p: add(up(Hc), U([1.4, 0, -1])), n: null, key: 'blood', l: 2, tol: 3 });
    }
  }
  if (P.glow) { // a ball of hellfire in the left hand
    E(add(hands[1], U([1.2, 0, 1.2])), ID, [P.glow, P.glow, P.glow], 'ember', () => { M.tone = .5; }, { noCast: true, noLine: true, glow: true });
  }

  // ---------------------------------------------------------------- what's in the right hand
  if (P.weapon && P.weapon.parts) {
    const w = P.weapon;
    const frame = (X, Yv) => { let Y = sub(Yv, mul(X, dot(Yv, X))); if (len(Y) < .05) Y = crs(X, [0, 0, 1]); if (len(Y) < .05) Y = [0, 1, 0]; Y = nrm(Y); return [X, Y, crs(X, Y)]; };
    const put = (G, F, ghost) => {
      for (const p of w.parts) {
        if (ghost && !p[8]) continue;
        const c = add(G, add(mul(F[0], p[0]), add(mul(F[1], p[1]), mul(F[2], p[2]))));
        if (ghost) E(c, F, [p[3] * .9, p[4] * 1.4 + .5, p[5] + .7], 'smear', null, { noCast: true, noLine: true, smear: true, zb: 4 });
        else E(c, F, [p[3], p[4], p[5]], p[6], p[7]);
      }
    };
    const G = hands[-1], X = w.d ? nrm(U(w.d)) : nrm(add(fore[-1], U([.9, 0, -.1]))), Yv = U(w.e || [0, 0, -1]);
    put(G, frame(X, Yv));
    if (w.from) { const G0 = up(w.from.h), X0 = nrm(U(w.from.d)); for (const t of [.1, .22, .34, .46, .58, .7]) put(lerp(G0, G, t), frame(nrm(lerp(X0, X, t)), Yv), true); }
  }

  // ---------------------------------------------------------------- extras
  if (L.cross) { // nailed by the hands to a beam across the shoulders, the upright dragging behind
    rod(up([-3.4, -16, 17.2]), up([-3.4, 16, 17.2]), 1.5, 'wood', crossMat);
    const top3 = up([-3.6, 0, 27]), foot = P.tumble ? up([-3.6, 0, -14]) : [pel[0] - 24, 0, 1.2];
    rod(top3, foot, 1.6, 'wood', crossMat);
  }
  if (L.wings) {
    const f = P.flap ?? .3;
    for (const s of [1, -1]) {
      const B = [-3.4, s * 2.8, 15.6], a = -.35 + f * 1.4;
      const dirA = nrm([-.55, s * cos(a), sin(a)]), El = add(B, mul(dirA, 7 * L.wings));
      const tips = [0, 1, 2].map(j => { const fa = a + .55 - j * .62; return add(El, mul(nrm([-.45 - .25 * j, s * cos(fa), sin(fa)]), (10 - j * 1.6) * L.wings)); });
      chain(up(B), up(El), .7, .55, skin);
      for (const t of tips) chain(up(El), up(t), .5, .25, skin);
      const body = [-3.6, s * 2.2, 6];
      panel(up(El), up(tips[0]), up(tips[1]), 'membrane', { noLine: true });
      panel(up(El), up(tips[1]), up(tips[2]), 'membrane', { noLine: true });
      panel(up(El), up(tips[2]), up(body), 'membrane', { noLine: true });
    }
  }
  if (L.tail) {
    const ph = P.tailPh || 0, base = add(pel, [-3.4, 0, 1]);
    let prev = base;
    for (let k = 1; k <= 12; k++) {
      const t = k / 12, p = add(base, [-t * 13 * L.tail, sin(ph + t * 3) * 3.2 * t, -5 * t + 11 * t * t]);
      chain(prev, p, 1.15 - .7 * (k - 1) / 12, 1.15 - .7 * t, skin); prev = p;
    }
    E(prev, ID, [1.5, 1.5, .5], skin, () => { M.tone = -.1; });
  }

  // ---------------------------------------------------------------- into the world
  const tb = P.tumble || 0, pv = P.pivot || [0, 0, 12];
  const T = v => add(Ry(tb, sub(v, pv)), pv), TD = v => Ry(tb, v);
  for (const p of prims) { p.c = T(p.c); p.ax = p.ax.map(TD); }
  for (const d of decals) { d.p = T(d.p); if (d.n) d.n = TD(d.n); }
  if (P.ground) {
    let mn = 1e9;
    for (const p of prims) mn = min(mn, p.c[2] - sqrt((p.r[0] * p.ax[0][2]) ** 2 + (p.r[1] * p.ax[1][2]) ** 2 + (p.r[2] * p.ax[2][2]) ** 2));
    for (const p of prims) p.c[2] -= mn;
    for (const d of decals) d.p[2] -= mn;
  }
  if (P.slide) { for (const p of prims) p.c[0] -= P.slide; for (const d of decals) d.p[0] -= P.slide; }
  if (P.rise) { for (const p of prims) p.c[2] += P.rise; for (const d of decals) d.p[2] += P.rise; }
  const S = L.scale || 1;
  for (const p of prims) { p.c = mul(Rz(facing, p.c), S); p.ax = p.ax.map(v => Rz(facing, v)); p.r = mul(p.r, S); }
  for (const d of decals) { d.p = mul(Rz(facing, d.p), S); if (d.n) d.n = Rz(facing, d.n); }
  return { prims, decals };
}
const TAU5 = PI * 2 / 5;
const crossMat = (q0, q1, q2) => { M.tone = (hash(((q0 + 2) * 9) | 0, ((q1 + 2) * 2) | 0) - .5) * .25; };

export const FSW = 144, FSH = 136, FOX = 72, FOY = 96;
export function bakeFig(P, L, k) {
  const { prims, decals } = buildFig(P, L, k * PI / 4);
  return renderSprite(prims, decals, FRAMPS, FSW, FSH, FOX, FOY);
}
