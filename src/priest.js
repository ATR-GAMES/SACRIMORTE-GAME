// El padre. A gaunt, unshaven parish priest in a worn black cassock with a shoulder cape, a dirty roman collar, a
// faded violet stole (the one for last rites), a wooden rosary at his belt, a battered wide-brimmed saturno hat and
// one bandaged, bloodied hand. He is built from ellipsoids on a small skeleton (IK legs, FK arms), posed per frame and
// handed to the raster to become pixels. Every one of the eight facings is drawn for real (none mirrored), so the
// bandaged hand and the rosary always stay on his left.
import { renderSprite, hash, M } from './raster.js?v=96ed7b9';
import { WEAPONS } from './weapons.js?v=96ed7b9';

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

// Colour ramps, darkest to lightest. Shadows lean cold and violet, lights lean warm.
export const RAMPS = {
  cassock: [0x0d0b12, 0x1b1823, 0x2a2533, 0x3c3548, 0x544a62],
  pants:   [0x0c0b0e, 0x19171c, 0x27242c, 0x37333d, 0x4b4652],
  hat:     [0x0a090c, 0x16141a, 0x232029, 0x332f3a, 0x48424f],
  hatband: [0x110910, 0x1d0f17, 0x2b1721, 0x39212e, 0x492b3a],
  skin:    [0x3a2a2e, 0x6a5552, 0x988480, 0xbfaea4, 0xdcd0c4],
  stub:    [0x1f171b, 0x382e32, 0x54474a, 0x726465, 0x8a7e7c],
  hair:    [0x141216, 0x2a272e, 0x45414a, 0x625d66, 0x827c82],
  collar:  [0x34302c, 0x6a645a, 0x9e9684, 0xc6bea8, 0xe2dbc8],
  stole:   [0x140a18, 0x26122e, 0x3d1c48, 0x56285f, 0x713a77],
  gold:    [0x2e200c, 0x5a4218, 0x8a6c2c, 0xb89448, 0xd8b86a],
  wood:    [0x1c110b, 0x362014, 0x543421, 0x744a2e, 0x92613c],
  silver:  [0x26282c, 0x4a4e54, 0x767a80, 0xa6aaae, 0xd2d4d4],
  boot:    [0x0f0a08, 0x1f140e, 0x332317, 0x493322, 0x5f442e],
  mud:     [0x18130e, 0x2a2118, 0x3c3022, 0x50402e, 0x64523a],
  bandage: [0x3a3029, 0x675a4a, 0x958774, 0xbbae98, 0xd4c8b0],
  blood:   [0x260506, 0x4a0a0b, 0x741210, 0x9a1c16, 0xbe2a1e],
  gore:    [0x2e0405, 0x520809, 0x780f0d, 0x9c1a13, 0xbc261a],
  eye:     [0x6e6656, 0x9a9078, 0xc0b796, 0xdcd3b2, 0xf0ead2],
  button:  [0x050406, 0x0e0c11, 0x2c2834, 0x4c4658, 0x6e667a],
  steel:   [0x22262c, 0x454b54, 0x6e757e, 0x9aa1a8, 0xcfd4d8],
  iron:    [0x141316, 0x26242a, 0x3a373f, 0x534f58, 0x6e6a72],
  rust:    [0x2a1208, 0x4a2210, 0x6e3618, 0x8e4c24, 0xa86434],
  wax:     [0x6a6250, 0x9a9078, 0xc4bca0, 0xe0d8bc, 0xf2ecd8],
  smear:   [0xb4b8c4, 0xc6cad4, 0xd6dae2, 0xe4e7ee, 0xf0f2f6],
};

// ---------------------------------------------------------------- materials (q = hit point in the part's own unit frame)
// How bloodied he is (0 clean .. 4 soaked). Stains are blotches fixed in each part's own coordinates, so they stay
// put on the cloth through every frame and facing; a higher level only lets more of the same blotches through.
let GORE = 0;
const GORE_T = [0, .21, .34, .48, .64];
const stain = (a, b, c, w = 1, cloth = true) => {
  if (!GORE) return false;
  const big = hash(((a + 3) * 2.3 | 0) + ((c + 3) * 2.3 | 0) * 13, ((b + 3) * 2.3 | 0) + 1);
  const fine = hash(((a + 3) * 7 | 0) + ((c + 3) * 7 | 0) * 31, ((b + 3) * 7 | 0) + 5);
  if (big * .7 + fine * .3 < GORE_T[GORE] * w) { M.key = cloth ? 'gore' : 'blood'; M.tone = (fine - .5) * .25; return true; }
  return false;
};
const torsoMat = (q0, q1, q2) => { stain(q0, q1, q2, q0 > 0 ? 1.35 : .55); };
const bootMat = (q0, q1, q2) => { stain(q0, q1, q2, 1.3); };
const stoleMat = (q0, q1, q2, p) => { stain(q0 + (p.si || 0), q1, q2 + (p.si || 0) * .7, 1.2); };
const handMat = (q0, q1, q2) => { stain(q0, q1, q2, 2.4, false); };
const headMat = (q0, q1, q2) => {
  const a1 = abs(q1); M.tone = q2 > .3 ? -.12 : 0;
  if (q0 < .1 || q2 > .6 || (a1 > .7 && q2 > -.35)) { M.key = 'hair'; M.tone = (hash((q1 * 9) | 0, (q0 * 5) | 0) - .5) * .3; return; }
  if (q2 > .0 && q2 < .36 && a1 > .12 && a1 < .64) M.tone = -.26;          // sunken eye sockets
  else if (q2 < -.06 && q2 > -.55 && a1 > .4) M.tone = -.08;               // hollow cheeks
  else if (q2 > .4) M.tone = -.06;
  if (q0 > .35 && q2 < .3) stain(q0 * 2, q1 * 2, q2 * 2, .75, false);   // spatter on the face
};
const jawMat = (q0, q1, q2, p, px, py) => {
  if (q2 < .25 && q0 > -.4 && ((px + py) & 1)) M.key = 'stub';
  if (q0 < -.2) M.key = 'hair';
  else if (q0 > .2) stain(q0 * 2, q1 * 2, q2 * 2, .9, false);
};
const hairMat = (q0, q1) => { M.tone = (hash((q1 * 11) | 0, 2) - .5) * .32; };
const hairClip = (q0, q1, q2) => q2 < -.45 && hash((q1 * 12 + 40) | 0, 5) < (-.45 - q2) * 2.2;
const crownMat = (q0, q1, q2) => { if (q2 < -.3) M.key = 'hatband'; else if (q2 > .7) M.tone = -.04; stain(q0, q1, q2, .45); };
const brimMat = (q0, q1) => { const r = q0 * q0 + q1 * q1; if (r > .8) M.tone = (hash(((atan2(q1, q0) + 4) * 6) | 0, 1) - .55) * .25; };
const brimClip = (q0, q1) => q0 * q0 + q1 * q1 > .78 && hash(((atan2(q1, q0) + 4) * 3.2) | 0, 7) > .82;
const collarMat = (q0, q1, q2) => { if (q0 > .5 && abs(q1) < .5 && q2 > -.6) { M.key = 'collar'; stain(q0 * 3, q1 * 3, q2 * 3, 1.6, false); } else stain(q0, q1, q2, 1); };
const mantleMat = (q0, q1, q2) => { if (q2 < -.55) M.tone = -.08; stain(q0, q1, q2, q0 > 0 ? 1.2 : .5); };
const skirtMat = (q0, q1, q2, p) => {
  const ang = atan2(q1, q0);
  M.tone = .1 * sin(ang * 7 + p.t * 4) * (.25 + p.t);
  if (p.t > .7 && hash(((ang + 4) * 5) | 0, p.idx) < (p.t - .7) * 4.2) M.key = 'mud';
  stain(cos(ang) * 1.6, sin(ang) * 1.6, p.t * 2.6, (q1 > 0 ? 1.3 : .7) * (.55 + p.t * .8));   // front and hem take most
};
const hemClip = (q0, q1, q2) => q2 < .35 && hash(((atan2(q1, q0) + 4) * 7) | 0, 9) > .52;
const cuffMat = (q0, q1, q2, p) => { if (p.t > .82) M.tone = -.1; stain(q0, q1, q2 + p.t * 3, 1.1 + p.t * .9); };
const bandMat = (q0, q1, q2) => { if (q0 > .45 && q2 > .35 && q1 > -.2) M.key = 'blood'; else if (q2 < -.4) M.tone = -.08; stain(q0, q1, q2, 2.4, false); };
const sleeveMat = (q0, q1, q2, p) => { if (p.t > .05 && p.t < .12) M.tone = -.08; stain(q0, q1, q2 + p.t * 3, .8); };

// ---------------------------------------------------------------- the body
const HIPW = 3.3, THIGH = 13.6, SHIN = 13.8, UARM = 9.8, FARM = 8.4;
function ik(H, F, knee) {
  let D = sub(F, H), d = len(D);
  const dh = nrm(D); d = min(d, THIGH + SHIN - .05);
  const A = add(H, mul(dh, d));
  const a = (THIGH * THIGH - SHIN * SHIN + d * d) / (2 * d), h = sqrt(max(0, THIGH * THIGH - a * a));
  const k = nrm(sub(knee, mul(dh, dot(knee, dh))));
  return { H, K: add(H, add(mul(dh, a), mul(k, h))), A };
}
const legAt = (L, s) => {
  const l1 = len(sub(L.K, L.H)), l2 = len(sub(L.A, L.K)), d = s * (l1 + l2);
  return d < l1 ? lerp(L.H, L.K, d / l1) : lerp(L.K, L.A, (d - l1) / l2);
};

export function build(P, facing) {
  const prims = [], decals = [];
  const E = (c, ax, r, key, mat, x) => { const p = { c, ax, r, key, mat, ...x }; prims.push(p); return p; };
  const chain = (a, b, r0, r1, key, mat, x) => {
    const n = max(1, ceil(len(sub(b, a)) / (min(r0, r1) * .5)));
    for (let i = 0; i <= n; i++) { const t = i / n, r = r0 + (r1 - r0) * t; E(lerp(a, b, t), AX(v => v), [r, r, r], key, mat, { t, ...x }); }
  };
  const pel = P.pel;
  const U = v => Rz(P.twist, Ry(P.lean, Rx(P.tilt, v))), up = v => add(pel, U(v));

  // Legs.
  const legs = {};
  for (const s of [1, -1]) {
    const F = s > 0 ? P.footL : P.footR;
    const Hj = add(pel, Rz(P.twist * .35, [0, s * HIPW, -.6]));
    const L = ik(Hj, [F[0], s * (HIPW + F[1]), F[2]], nrm([1, s * .14, 0]));
    legs[s] = L;
    const mid = lerp(L.K, L.A, .6);
    chain(L.H, L.K, 2.6, 2.1, 'pants');
    chain(L.K, mid, 2.1, 1.95, 'pants');
    chain(mid, L.A, 2.05, 1.85, 'boot', bootMat);
    const fp = F[3] || 0, fx = nrm([cos(fp), s * .12, -sin(fp)]), fy = nrm(crs([0, 0, 1], fx)), fz = crs(fx, fy);
    E(add(L.A, add(mul(fx, 1.7), mul(fz, -1.15))), [fx, fy, fz], [3.3, 1.7, 1.35], 'boot', bootMat);
  }

  // Cassock skirt: horizontal slices from the hips to the hem, each wide enough to hold both legs at that height.
  const NS = 19, slices = [];
  for (let i = 0; i < NS; i++) {
    const t = i / (NS - 1) * .9, a = legAt(legs[1], t), b = legAt(legs[-1], t);
    const c = mul(add(a, b), .5);
    c[0] -= P.drag * t * t; c[2] += P.lift * t * t; c[0] += P.flareFwd * t * t;
    if (!P.tumble) c[2] = max(c[2], 1.4);
    let A = [a[0] - b[0], a[1] - b[1], 0]; const sep = hypot(A[0], A[1]);
    A = sep > .01 ? [A[0] / sep, A[1] / sep, 0] : [0, 1, 0];
    if (A[1] < 0) A = mul(A, -1);
    const B = crs(A, [0, 0, 1]);
    const ra = sep / 2 + 2.7 + 1.7 * t + P.flare * t * t, rb = 3.9 + 1.2 * t + P.flare * .6 * t * t;
    E(c, [A, B, [0, 0, 1]], [ra, rb, 1.35], 'cassock', skirtMat, { cyl: true, t, idx: i, clip: i === NS - 1 ? hemClip : null });
    slices.push({ c, A, B, ra, rb, t });
    if (i < 6 && i % 2 === 1) {
      const fu = sqrt((ra * A[0]) ** 2 + (rb * B[0]) ** 2);
      decals.push({ p: [c[0] + fu - .05, c[1], c[2]], n: [1, 0, 0], key: 'button', tone: 1 });
    }
  }
  const near = w => { let best = slices[0], bd = 1e9; for (const s of slices) { const d = abs(s.c[2] - w); if (d < bd) { bd = d; best = s; } } return best; };
  const front = w => { const s = near(w); return s.c[0] + sqrt((s.ra * s.A[0]) ** 2 + (s.rb * s.B[0]) ** 2); };
  const side = w => { const s = near(w); return s.c[1] + sqrt((s.ra * s.A[1]) ** 2 + (s.rb * s.B[1]) ** 2); };

  // Torso.
  E(up([0, 0, 5]), AX(U), [3.9, 5.3, 5.4], 'cassock', torsoMat);
  E(up([.3, 0, 12.6]), AX(U), [4.3, 6.0, 6.6], 'cassock', torsoMat);
  E(up([-.2, 0, 16.0]), AX(U), [5.2, 7.9, 3.4], 'cassock', mantleMat);
  chain(up([.3, 0, 18]), up([.8, 0, 23.2]), 1.95, 1.8, 'skin');
  E(up([.5, 0, 19.6]), AX(U), [2.9, 3.0, 1.7], 'cassock', collarMat);
  const chestF = w => max(.3 + 4.3 * sqrt(max(0, 1 - ((w - 12.6) / 6.6) ** 2)), 3.9 * sqrt(max(0, 1 - ((w - 5) / 5.4) ** 2)));
  for (let w = 7.5; w < 18; w += 2.3) decals.push({ p: up([chestF(w) + .05, 0, w]), n: U([1, 0, 0]), key: 'button', tone: 1 });

  // Head.
  const HS = 1.16, N0 = up([.3, 0, 21.0]), HR = v => U(Rz(P.head[1], Ry(P.head[0], Rx(P.head[2], v)))), hp = v => add(N0, HR(mul(v, HS)));
  const EH = (c, r, key, mat, x) => E(hp(c), AX(HR), mul(r, HS), key, mat, x);
  EH([.4, 0, 4.9], [4.0, 3.6, 4.6], 'skin', headMat);
  EH([1.2, 0, 2.4], [3.0, 2.6, 2.3], 'skin', jawMat);
  EH([4.3, 0, 4.1], [1.0, .75, 1.4], 'skin');
  EH([-1.4, 0, 4.4], [3.0, 3.45, 3.9], 'hair', hairMat, { clip: hairClip });
  const onHead = (q, c, r) => { const n = nrm(q); return { p: hp([c[0] + n[0] * r[0], c[1] + n[1] * r[1], c[2] + n[2] * r[2]]), n: HR(nrm([n[0] / r[0], n[1] / r[1], n[2] / r[2]])) }; };
  for (const s of [1, -1]) {
    const e = onHead([.86, s * .37, .15], [.4, 0, 4.9], [4.0, 3.6, 4.6]);
    decals.push({ ...e, key: 'eye', l: 3, tol: 2.2, face: .05 });
    const b = onHead([.8, s * .42, .42], [.4, 0, 4.9], [4.0, 3.6, 4.6]);
    decals.push({ ...b, key: 'hair', l: 0, tol: 2.2 });
  }
  const mo = onHead([.95, 0, -.3], [1.3, 0, 2.3], [3.0, 2.7, 2.3]);
  decals.push({ ...mo, key: 'blood', l: 0, tol: 2 });

  // Hat: on the head, or knocked off and lying on the ground.
  const hat = (F, FD, k, x) => {
    E(F([-.1, 0, 9.6]), AX(FD), mul([3.9, 3.8, 2.8], k), 'hat', crownMat, x);
    E(F([0, 0, 9.0]), AX(FD), mul([6.4, 6.4, .62], k), 'hat', brimMat, { clip: brimClip, noCast: true, ...x });
  };
  if (P.hatOff) {
    const [hu, hl, hw, tl] = P.hatOff, FD = v => Ry(tl, Rx(tl * .6, v));
    hat(v => add([hu, hl, hw - 9.0 * HS + .7], FD(mul(v, HS))), FD, HS, { fixed: true });
  } else hat(hp, HR, HS);

  // Arms: forward kinematics from the pose, or reaching for a target (a weapon's grip) with a two-bone solve.
  const hands = {}, fore = {};
  for (const s of [1, -1]) {
    const S0 = [-.2, s * 6.0, 16.2], T = P.armIK && P.armIK[s];
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
    chain(up(S0), up(El), 2.5, 2.15, 'cassock', sleeveMat);
    chain(up(El), up(Wr), 2.15, 2.5, 'cassock', cuffMat);
    E(up(Hc), AX(v => U(v)), [1.95, 1.7, 2.05], s > 0 ? 'bandage' : 'skin', s > 0 ? bandMat : handMat);
    hands[s] = up(Hc); fore[s] = U(d2);
  }

  // The weapon: in the right hand, stowed at the hip (or across the back), or trailing a smear on the blow.
  const WP = P.weapon && WEAPONS[P.weapon.id];
  if (WP) {
    const w = P.weapon;
    const frame = (X, Yv) => {
      let Y = sub(Yv, mul(X, dot(Yv, X))); if (len(Y) < .05) Y = crs(X, [0, 0, 1]); if (len(Y) < .05) Y = [0, 1, 0];
      Y = nrm(Y); return [X, Y, crs(X, Y)];
    };
    const put = (G, F, ghost) => {
      for (const p of WP.parts) {
        if (ghost && !p[8]) continue;
        const c = add(G, add(mul(F[0], p[0]), add(mul(F[1], p[1]), mul(F[2], p[2]))));
        if (ghost) E(c, F, [p[3] * .9, p[4] * 1.4 + .5, p[5] + .7], 'smear', null, { noCast: true, noLine: true, smear: true, zb: 4 });
        else E(c, F, [p[3], p[4], p[5]], p[6], p[7]);
      }
    };
    let G, X, Yv;
    if (w.stow) { G = up(WP.two ? [-5.2, 1.5, 8] : [.8, -6.8, 2.5]); X = nrm(U(WP.two ? [-.1, -.42, .9] : [.15, -.1, -1])); Yv = U([1, 0, 0]); }
    else if (w.d) { G = hands[-1]; X = nrm(U(w.d)); Yv = U(w.e || WP.edge); }
    else { G = hands[-1]; X = nrm(add(fore[-1], U([.9, 0, -.1]))); Yv = U([0, 0, -1]); }
    put(G, frame(X, Yv));
    if (w.from) {
      const G0 = up(w.from.h), X0 = nrm(U(w.from.d));
      for (const t of [.1, .22, .34, .46, .58, .7]) { const Xt = nrm(lerp(X0, X, t)); put(lerp(G0, G, t), frame(Xt, Yv), true); }
    }
  }

  // Crucifix held up in the right hand.
  if (P.prop === 'cross') {
    const Z = nrm(U([.35, 0, 1])), Y = nrm(U([0, 1, 0])), X = nrm(crs(Y, Z)), Y2 = crs(Z, X), h = hands[-1];
    E(add(h, mul(Z, 4.2)), [X, Y2, Z], [.95, .95, 6.6], 'silver');
    E(add(h, mul(Z, 7.4)), [X, Y2, Z], [.95, 3.4, .95], 'silver');
    E(add(h, mul(Z, -2.4)), [X, Y2, Z], [.7, .7, 1.2], 'wood');
    decals.push({ p: add(add(h, mul(Z, 7.4)), mul(X, .95)), n: X, key: 'gold', l: 4, tol: 2.2, face: 0 });
  }

  // Stole: round the back of the neck, down the chest, then hanging free over the skirt.
  for (const s of [1, -1]) {
    const pts = [up([-1.0, s * 2.8, 19.9]), up([1.5, s * 3.3, 19.4]), up([3.7, s * 3.1, 17.4])];
    for (let w = 16.4; w >= 3; w -= 1.4) pts.push(up([chestF(w) + .75, s * (2.9 - (17 - w) * .03), w]));
    let last = pts[pts.length - 1];
    const NH = 9;
    for (let j = 1; j <= NH; j++) {
      const w = last[2] - 1.35, k = j / NH;
      let u = last[0] - P.drag * .35 * k * k + P.flareFwd * .2 * k;
      if (!P.tumble) u = max(u, front(w) + .75);
      last = [u, last[1], w]; pts.push(last);
    }
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1], dn = nrm(sub(b, a)), out = i < 1 ? nrm(U([-.3, s, .4])) : U([1, 0, 0]);
      const W = nrm(crs(dn, out)), T = crs(dn, W), tip = i >= pts.length - 3;
      E(lerp(a, b, .5), [dn, W, T], [len(sub(b, a)) / 2 + .45, 1.35, .55], tip && i === pts.length - 2 ? 'gold' : 'stole', stoleMat, { noLine: true, si: i * .37 + s });
    }
    const cr = pts[pts.length - 4], fn = U([1, 0, 0]);
    for (const o of [[0, 0, 1.2], [0, 0, 0], [0, 0, -1.2], [0, 1.2, 0], [0, -1.2, 0]]) decals.push({ p: add(add(cr, o), [.5, 0, 0]), n: fn, key: 'gold', tone: 1, tol: 2.4, face: 0 });
  }

  // Rosary at the left of the belt.
  {
    const at = add(pel, [2.4, 4.3, 1.5]);
    let last = at;
    for (let j = 0; j < 10; j++) {
      const w = at[2] - j * 1.2, k = j / 9;
      const l = P.tumble ? at[1] + .8 : max(at[1], side(w) + .7);
      last = [at[0] - j * .1 - P.drag * .45 * k * k + P.flareFwd * .2 * k, l, w];
      E(last, AX(v => v), [.8, .8, .8], 'wood');
    }
    const Zc = [0, 0, 1], c = add(last, [0, 0, -2.6]);
    E(c, AX(v => v), [.45, .45, 1.7], 'silver');
    E(add(c, [0, 0, .7]), AX(v => v), [.45, 1.15, .45], 'silver');
  }

  // Into the world: tumble (rolls, falls), rest on the ground, then turn to face.
  const tb = P.tumble || 0, pv = P.pivot || [0, 0, 12];
  const T = v => add(Ry(tb, sub(v, pv)), pv), TD = v => Ry(tb, v);
  for (const p of prims) if (!p.fixed) { p.c = T(p.c); p.ax = p.ax.map(TD); }
  for (const d of decals) { d.p = T(d.p); if (d.n) d.n = TD(d.n); }
  if (P.ground) {
    let mn = 1e9;
    for (const p of prims) if (!p.fixed) mn = min(mn, p.c[2] - sqrt((p.r[0] * p.ax[0][2]) ** 2 + (p.r[1] * p.ax[1][2]) ** 2 + (p.r[2] * p.ax[2][2]) ** 2));
    for (const p of prims) if (!p.fixed) p.c[2] -= mn;
    for (const d of decals) d.p[2] -= mn;
  }
  if (P.slide) { for (const p of prims) p.c[0] -= P.slide; for (const d of decals) d.p[0] -= P.slide; }
  for (const p of prims) { p.c = Rz(facing, p.c); p.ax = p.ax.map(v => Rz(facing, v)); }
  for (const d of decals) { d.p = Rz(facing, d.p); if (d.n) d.n = Rz(facing, d.n); }
  return { prims, decals };
}

// ---------------------------------------------------------------- poses
const BASE = () => ({
  pel: [0, 0, 30.2], lean: .1, twist: 0, tilt: 0, head: [.06, 0, 0],
  armL: [.06, .1, .16], armR: [.06, .1, .16], footL: [.7, .35, 2.6, 0], footR: [-.5, .3, 2.6, 0],
  drag: 0, lift: 0, flare: 0, flareFwd: 0, tumble: 0, slide: 0, pivot: [0, 0, 12], prop: null, hatOff: null, ground: false,
});
const P_ = o => Object.assign(BASE(), o);
const mixP = (a, b, t) => {
  const o = {};
  for (const k in a) {
    const x = a[k], y = b[k];
    if (Array.isArray(x) && Array.isArray(y)) o[k] = x.map((v, i) => v + (y[i] - v) * t);
    else if (typeof x === 'number' && typeof y === 'number') o[k] = x + (y - x) * t;
    else o[k] = t < .5 ? x : y;
  }
  return o;
};
const TAU = PI * 2;
function gait(P, ph0, S, lift, stance) {
  for (const [k, ph] of [['footL', ph0], ['footR', (ph0 + .5) % 1]]) {
    let u, w = 2.6, fp = 0;
    if (ph < stance) { const t = ph / stance; u = S - 2 * S * t; if (t > .75) { fp = (t - .75) * 2.4; w += fp * 1.3; } }
    else { const t = (ph - stance) / (1 - stance), e = t * t * (3 - 2 * t); u = -S + 2 * S * e; w += lift * sin(PI * t); fp = .55 * (1 - t) - .2 * t; }
    P[k] = [u, .3, w, fp];
  }
}

const STAND = P_({});
const KNEEL = P_({ pel: [-1, 0, 16.5], lean: .12, head: [.7, 0, 0], footL: [6.5, .3, 2.6, 0], footR: [-12, .2, 2.0, 1.35],
  armL: [.35, -.34, 2.1], armR: [.35, -.34, 2.1] });
const HURT = P_({ pel: [-1.2, 0, 28.8], lean: -.38, head: [-.45, 0, .12], armL: [.6, .8, .5], armR: [.5, .85, .3], footR: [-4.5, .3, 2.6, 0], drag: -2 });
const CURL = P_({ pel: [-1, 0, 17], lean: 1.3, head: [.9, 0, 0], footL: [5, .4, 10, .5], footR: [3, .4, 8, .5], armL: [1.3, .25, 1.9], armR: [1.2, .25, 2.0], flare: 1, drag: -1 });
const LYING = { pel: [0, 0, 30], lean: .1, footL: [-1.5, .5, 2.6, 1.2], footR: [-.5, .2, 3.4, 1.0], pivot: [0, 0, 0], ground: true, flare: .5 };
const KNEELDEAD = P_({ pel: [-2, 0, 15.5], lean: .3, head: [.95, .2, .25], footL: [-12, .3, 2.0, 1.3], footR: [-11.5, .3, 2.0, 1.3], armL: [.05, .22, .06], armR: [.05, .22, .05] });

export const ANIMS = {
  idle: { n: 8, fps: 5, loop: true, pose: i => { const b = sin(i / 8 * TAU); return P_({ pel: [0, 0, 30.2 - .25 * (1 + b)], lean: .12 + .03 * b, head: [.06 - .03 * b, 0, 0], armL: [.06 + .02 * b, .11, .16], armR: [.04 - .02 * b, .11, .18], drag: .35 * b }); } },
  walk: { n: 8, loop: true, stride: 7.5, stance: .5, pose: i => {
    const p = i / 8, P = P_({ pel: [.3, 0, 29.2 + .9 * (1 - abs(cos(TAU * p)))], lean: .13, twist: .08 * cos(TAU * p), head: [.04, -.06 * cos(TAU * p), 0], drag: 1.3, flare: .4 });
    gait(P, p, 7.5, 3.4, .5);
    P.armL = [.05 - .42 * cos(TAU * p), .1, .22 + .15 * max(0, -cos(TAU * p))]; P.armR = [.05 + .42 * cos(TAU * p), .1, .22 + .15 * max(0, cos(TAU * p))];
    return P; } },
  run: { n: 8, loop: true, stride: 11, stance: .4, pose: i => {
    const p = i / 8, P = P_({ pel: [1.5, 0, 26.6 + 1.6 * (1 - abs(cos(TAU * p)))], lean: .38, twist: .14 * cos(TAU * p), head: [-.22, 0, 0], drag: 4.2, flare: 1.8, lift: 1.8 });
    gait(P, p, 11, 6.5, .4);
    P.armL = [.25 - .95 * cos(TAU * p), .14, 1.45]; P.armR = [.25 + .95 * cos(TAU * p), .14, 1.45];
    return P; } },
  crouch: { n: 4, fps: 4, loop: true, pose: i => { const b = sin(i / 4 * TAU); return P_({ pel: [-1, 0, 18 - .3 * b], lean: .55 + .03 * b, head: [-.4, 0, 0], footL: [3.8, .7, 2.6, 0], footR: [-2.6, .5, 2.6, .35], armL: [.6, .22, 1.0], armR: [.45, .22, .9], flare: 1.2, flareFwd: 1.5 }); } },
  cwalk: { n: 8, loop: true, stride: 5, stance: .55, pose: i => {
    const p = i / 8, P = P_({ pel: [0, 0, 17.6 + .6 * (1 - abs(cos(TAU * p)))], lean: .55, head: [-.4, 0, 0], drag: .8, flare: 1.2, flareFwd: 1 });
    gait(P, p, 5, 3, .55);
    P.footL[1] = .7; P.footR[1] = .7;
    P.armL = [.55 - .2 * cos(TAU * p), .22, 1.0]; P.armR = [.5 + .2 * cos(TAU * p), .22, .95];
    return P; } },
  jump: { n: 6, fps: 10, loop: false, pose: i => [
    P_({ pel: [-.5, 0, 21.5], lean: .42, head: [-.25, 0, 0], armL: [-.75, .22, .3], armR: [-.75, .22, .3], footL: [2.5, .4, 2.6, 0], footR: [.5, .4, 2.6, 0], flare: 1, flareFwd: 1 }),
    P_({ pel: [.5, 0, 31.5], lean: .08, head: [-.15, 0, 0], armL: [2.4, .3, .35], armR: [2.3, .3, .4], footL: [1.2, .3, 5.5, 1.1], footR: [-2, .3, 4.5, 1.0], lift: -1.5, drag: .5 }),
    P_({ pel: [0, 0, 30], lean: .1, head: [-.1, 0, 0], armL: [1.8, .45, .6], armR: [1.6, .45, .7], footL: [4, .3, 12, .4], footR: [-2.5, .3, 7, .8], lift: -.5, flare: .8 }),
    P_({ pel: [0, 0, 29.5], lean: .18, head: [0, 0, 0], armL: [1.3, .65, .8], armR: [1.2, .65, .9], footL: [5, .4, 14, .2], footR: [1, .4, 11, .5], lift: 1.5, flare: 1.8 }),
    P_({ pel: [0, 0, 30], lean: .05, head: [.15, 0, 0], armL: [2.2, .8, .5], armR: [2.1, .8, .5], footL: [2, .4, 6, .3], footR: [-1, .4, 4.5, .4], lift: 4.5, flare: 3 }),
    P_({ pel: [-.5, 0, 20], lean: .5, head: [-.3, 0, 0], armL: [.9, .55, .7], armR: [.8, .55, .7], footL: [3, .6, 2.6, 0], footR: [-1.5, .6, 2.6, .2], lift: 1.2, flare: 2.2, flareFwd: 1.5 }),
  ][i] },
  roll: { n: 8, fps: 16, loop: false, pose: i => {
    const k = i / 8, P = mixP(STAND, CURL, i === 0 ? .55 : i === 7 ? .7 : 1);
    P.tumble = TAU * k; P.ground = true; P.pivot = [3, 0, 16]; return P;
  } },
  interact: { n: 6, fps: 9, loop: false, pose: i => [
    P_({ lean: .14, armR: [.8, .1, .7] }),
    P_({ pel: [.5, 0, 28], lean: .3, head: [.25, 0, 0], armR: [1.3, .05, .35], footR: [2.5, .3, 2.6, 0], footL: [-1, .3, 2.6, 0] }),
    P_({ pel: [1, 0, 26.8], lean: .45, head: [.35, 0, 0], armR: [1.45, 0, .12], armL: [.3, .2, .3], footR: [4, .3, 2.6, 0], footL: [-2, .3, 2.6, .2], flareFwd: .6 }),
    P_({ pel: [1, 0, 26.8], lean: .45, head: [.35, 0, 0], armR: [1.5, -.05, .25], armL: [.3, .2, .3], footR: [4, .3, 2.6, 0], footL: [-2, .3, 2.6, .2], flareFwd: .6 }),
    P_({ pel: [.5, 0, 28], lean: .25, armR: [.9, .1, .6], footR: [2, .3, 2.6, 0] }),
    STAND,
  ][i] },
  cross: { n: 4, fps: 8, loop: false, pose: i => {
    const hold = (tr) => P_({ pel: [0, 0, 28.6], lean: -.04, head: [-.08, -.1, 0], armR: [1.68 + tr, .02, .22 - tr], armL: [1.25, -.15, 1.75], footR: [3.5, .3, 2.6, 0], footL: [-3, .4, 2.6, .25], prop: 'cross', drag: -.5 });
    return [P_({ lean: .05, armR: [1.0, .1, 1.4], armL: [.6, 0, 1.0], prop: 'cross' }), hold(.06), hold(0), hold(.03)][i];
  } },
  pray: { n: 6, fps: 6, loop: false, pose: i => {
    if (i < 3) return mixP(STAND, KNEEL, [.15, .55, 1][i]);
    const b = sin((i - 3) / 3 * TAU); return mixP(KNEEL, P_({ ...KNEEL, head: [.82, 0, 0], lean: .16 }), .5 + .5 * b);
  } },
  // After the killing: wipes his face with the sleeve, wrings his hands, dries the palms down the cassock.
  clean: { n: 12, fps: 6, loop: true, pose: i => {
    const F = [
      { lean: .15, head: [.25, 0, 0], armR: [.9, -.2, 1.6], armL: [.2, .12, .3] },
      { lean: .18, head: [.38, .22, .15], armR: [1.3, -.45, 1.95], armL: [.2, .12, .3] },
      { lean: .18, head: [.38, .1, .1], armR: [1.36, -.3, 2.02], armL: [.2, .12, .3] },
      { lean: .18, head: [.36, -.06, .05], armR: [1.36, -.12, 2.06], armL: [.2, .12, .3] },
      { lean: .18, head: [.38, .2, .12], armR: [1.3, -.42, 1.96], armL: [.2, .12, .3] },
      { lean: .18, head: [.36, -.04, .05], armR: [1.36, -.14, 2.05], armL: [.2, .12, .3] },
      { lean: .2, head: [.5, 0, 0], armL: [.55, -.32, 1.55], armR: [.6, -.32, 1.45] },
      { lean: .2, head: [.5, 0, 0], armL: [.62, -.32, 1.42], armR: [.53, -.32, 1.58] },
      { lean: .2, head: [.5, 0, 0], armL: [.55, -.32, 1.55], armR: [.6, -.32, 1.45] },
      { lean: .24, head: [.42, 0, 0], armL: [.12, .3, .15], armR: [.28, .3, .28], pel: [0, 0, 29.4] },
      { lean: .24, head: [.42, 0, 0], armL: [.28, .3, .28], armR: [.12, .3, .15], pel: [0, 0, 29.4] },
      { lean: .22, head: [.4, 0, 0], armL: [.14, .3, .16], armR: [.26, .3, .26], pel: [0, 0, 29.6] },
    ][i];
    return P_(F);
  } },
  hurt: { n: 4, fps: 11, loop: false, pose: i => [HURT, P_({ ...HURT, lean: -.48, pel: [-2.2, 0, 28.2], head: [-.6, .1, .15], footR: [-6.5, .3, 2.6, 0], drag: -3 }), mixP(HURT, STAND, .5), mixP(HURT, STAND, .85)][i] },
  death: { n: 10, fps: 8, loop: false, pose: i => {
    const fall = (t, extra) => P_({ ...KNEELDEAD, tumble: t, pivot: [2, 0, 2], ...extra });
    return [
      HURT,
      P_({ ...HURT, lean: -.25, pel: [-1.5, 0, 26], head: [.3, .2, .2], armL: [.3, .5, .2], armR: [.25, .5, .2] }),
      P_({ pel: [-1.5, 0, 20.5], lean: .1, head: [.6, .2, .2], footL: [-5, .3, 2.6, .6], footR: [-3.5, .3, 2.6, .5], armL: [.15, .28, .1], armR: [.12, .28, .1], flare: 1 }),
      KNEELDEAD,
      P_({ ...KNEELDEAD, lean: .4, head: [1.1, .25, .3] }),
      fall(.35, { lean: .45, armL: [.5, .4, .2], armR: [.4, .45, .2] }),
      fall(.8, { slide: 8, pel: [-1.5, 0, 22], lean: .4, footL: [-7, .3, 4, .8], footR: [-6.5, .3, 4, .8], armL: [1.0, .45, .2], armR: [.9, .5, .2], hatOff: [16, 6, 12, .7], ground: true }),
      fall(1.2, { ...LYING, slide: 20, lean: .25, armL: [1.6, .5, .2], armR: [1.4, .6, .2], hatOff: [24, 9, 1.2, .35] }),
      fall(1.52, { ...LYING, slide: 26, head: [.5, 1.0, .4], armL: [2.5, .5, .3], armR: [1.3, .9, .25], hatOff: [26, 10, .7, .2] }),
      fall(1.57, { ...LYING, slide: 26, head: [.5, 1.1, .45], armL: [2.6, .5, .3], armR: [1.3, .95, .2], hatOff: [26, 10, .7, .2] }),
    ][i];
  } },
};

// ---------------------------------------------------------------- baking
export const SW = 144, SH = 136, OX = 72, OY = 96;
// Facing k (0..7) is the world angle k·45°. k=1 looks straight down the screen.
export function bake(anim, frame, k, wid, gore = 0) {
  GORE = gore;
  const P = poseFor(anim, frame, wid), { prims, decals } = build(P, k * PI / 4);
  return renderSprite(prims, decals, RAMPS, SW, SH, OX, OY);
}

// ---------------------------------------------------------------- armed
const CARRY = new Set(['idle', 'walk', 'run', 'crouch', 'cwalk', 'jump']), STOW = new Set(['pray', 'cross', 'interact', 'clean']);
const lerpA = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
export const animsFor = wid => wid ? [...Object.keys(ANIMS), 'atk1', 'atk2', 'atk3'] : Object.keys(ANIMS);
export const animInfo = (anim, wid) => anim.startsWith('atk') ? { n: 6, fps: WEAPONS[wid].fps, loop: false } : ANIMS[anim];

function blowPose(W, wid, b, i) {
  const kf = W.blows[b].keys, k = kf[i], L = k.lunge || 0, lean = k.lean ?? .1, tw = k.twist || 0;
  const P = P_({ pel: [1.5 * L, 0, 29.8 - 1.8 * L - (k.drop || 0)], lean, twist: tw, head: [.05 - lean * .55, -tw * .6, 0],
    footL: lerpA([1.5, .45, 2.6, 0], [6.5, .5, 2.6, 0], L), footR: lerpA([-1.8, .35, 2.6, 0], [-5.5, .35, 2.6, .45], L),
    drag: 2.2 * L - .5, flare: .6 + L, armL: W.two ? [.1, .1, .2] : [.75 + .3 * L, .3, 1.5] });
  const sw = sub(nrm(kf[4].d), nrm(kf[2].d));
  const edgeAt = d => { const n = nrm(d), v = sub(sw, mul(n, dot(sw, n))); return len(v) > .25 ? v : W.edge; };
  P.weapon = { id: wid, h: k.h, d: k.d, e: edgeAt(k.d), from: i === 3 || i === 4 ? { h: kf[i - 1].h, d: kf[i - 1].d } : null };
  P.armIK = { [-1]: k.h, [1]: W.two ? add(k.h, mul(nrm(k.d), W.grip2)) : null };
  return P;
}
export function poseFor(anim, i, wid) {
  const W = wid && WEAPONS[wid];
  if (W && anim.startsWith('atk')) return blowPose(W, wid, +anim[3] - 1, i);
  const P = ANIMS[anim].pose(i);
  if (!W) return P;
  if (STOW.has(anim)) { P.weapon = { id: wid, stow: true }; return P; }
  if (CARRY.has(anim)) {
    const c = W.carry, p = i / ANIMS[anim].n, both = W.two && !c.one, sw = c.swing ?? (both ? 0 : 1); let h = c.h.slice();
    if (anim === 'walk' || anim === 'cwalk') { h[0] += 2.2 * sw * cos(TAU * p); h[2] += .5 * sin(2 * TAU * p); }
    if (anim === 'run') { h = add(h, [2, both ? 1 : 0, 2.5]); h[0] += 3 * sw * cos(TAU * p); }
    if (anim === 'idle' || anim === 'crouch') h[2] += .3 * sin(TAU * p);
    if (anim === 'jump') h[2] += i === 0 || i === 5 ? -1 : 2.5;
    P.weapon = { id: wid, h, d: c.d, e: c.e };
    P.armIK = { [-1]: h, [1]: both ? add(h, mul(nrm(c.d), c.grip2 ?? W.grip2)) : null };
    if (c.armL && anim !== 'run') P.armL = c.armL;
    return P;
  }
  P.weapon = { id: wid };
  return P;
}
export { P_, mixP, gait, ik, legAt };
