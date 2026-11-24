// A tiny software renderer that turns a posed 3D body of ellipsoids into one clean pixel-art sprite.
// Every pixel is ray-cast against analytic ellipsoids (no anti-aliasing), lit by a fixed moon with a real shadow
// map, quantised into hand-picked colour ramps with a touch of checker dither, then finished the way a pixel
// artist would: coloured outline (sel-out), inner contour lines where a limb crosses the body, stray-pixel cleanup
// and hand-placed decals (eyes, buttons, embroidery) that would be lost at this size if they were sampled.

import { K, V, toScreen } from './view.js?v=f76c404';
// The camera (its angle lives in src/view.js). World: x to screen down-right, y to screen down-left, z up.
const S2 = Math.SQRT1_2, C30 = V, S30 = K;
export const CAM = { r: [S2, -S2, 0], u: [-S30 * S2, -S30 * S2, C30], t: [C30 * S2, C30 * S2, S30] };
export { toScreen };

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Light, in camera space: moonlight from the upper left, a little in front. Rim from behind on the right.
const LC = norm([-.62, .62, .48]), RIM = norm([.8, .25, -.55]);
const LW = [0, 1, 2].map(i => LC[0] * CAM.r[i] + LC[1] * CAM.u[i] + LC[2] * CAM.t[i]);
const LR = norm(cross([0, 0, 1], LW)), LU = cross(LW, LR);
const LIGHT = { r: LR, u: LU, t: LW };

export const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// Projects every primitive into a basis and z-buffers it. Returns depth, owner and local hit coordinates.
function raster(prims, B, W, H, ox, oy, sc, keepQ) {
  const N = W * H, Z = new Float32Array(N).fill(-1e9), ID = new Int16Array(N).fill(-1);
  const Q = keepQ ? new Float32Array(N * 3) : null, NR = keepQ ? new Float32Array(N * 3) : null;
  for (let pi = 0; pi < prims.length; pi++) {
    const p = prims[pi], c = p.c;
    if (!keepQ && p.noCast) continue;
    const cx = dot(c, B.r), cy = dot(c, B.u), cz = dot(c, B.t);
    const A = p.ax.map(a => [dot(a, B.r), dot(a, B.u), dot(a, B.t)]), R = p.r;
    const ex = Math.sqrt((R[0] * A[0][0]) ** 2 + (R[1] * A[1][0]) ** 2 + (R[2] * A[2][0]) ** 2);
    const ey = Math.sqrt((R[0] * A[0][1]) ** 2 + (R[1] * A[1][1]) ** 2 + (R[2] * A[2][1]) ** 2);
    const x0 = Math.max(0, Math.floor((cx - ex) * sc + ox)), x1 = Math.min(W - 1, Math.ceil((cx + ex) * sc + ox));
    const y0 = Math.max(0, Math.floor((-cy - ey) * sc + oy)), y1 = Math.min(H - 1, Math.ceil((-cy + ey) * sc + oy));
    const k0 = A[0][2] / R[0], k1 = A[1][2] / R[1], k2 = A[2][2] / R[2], a = k0 * k0 + k1 * k1 + k2 * k2;
    for (let py = y0; py <= y1; py++) {
      const Y = -(py + .5 - oy) / sc - cy;
      for (let px = x0; px <= x1; px++) {
        const X = (px + .5 - ox) / sc - cx;
        const q0 = (X * A[0][0] + Y * A[0][1] - cz * A[0][2]) / R[0];
        const q1 = (X * A[1][0] + Y * A[1][1] - cz * A[1][2]) / R[1];
        const q2 = (X * A[2][0] + Y * A[2][1] - cz * A[2][2]) / R[2];
        const b = q0 * k0 + q1 * k1 + q2 * k2, cc = q0 * q0 + q1 * q1 + q2 * q2 - 1, d = b * b - a * cc;
        if (d < 0) continue;
        const z = (-b + Math.sqrt(d)) / a - (p.zb || 0), i = px + py * W;
        if (z <= Z[i]) continue;
        const h0 = q0 + z * k0, h1 = q1 + z * k1, h2 = q2 + z * k2;
        if (p.clip && p.clip(h0, h1, h2)) continue;
        Z[i] = z; ID[i] = pi;
        if (keepQ) {
          Q[i * 3] = h0; Q[i * 3 + 1] = h1; Q[i * 3 + 2] = h2;
          // Gradient of the ellipsoid; slices of cloth use only their own plane, so they shade as one round skirt.
          const g0 = h0 / R[0], g1 = h1 / R[1], g2 = p.cyl ? 0 : h2 / R[2];
          const nx = g0 * A[0][0] + g1 * A[1][0] + g2 * A[2][0], ny = g0 * A[0][1] + g1 * A[1][1] + g2 * A[2][1], nz = g0 * A[0][2] + g1 * A[1][2] + g2 * A[2][2];
          const l = Math.hypot(nx, ny, nz) || 1;
          NR[i * 3] = nx / l; NR[i * 3 + 1] = ny / l; NR[i * 3 + 2] = nz / l;
        }
      }
    }
  }
  return { Z, ID, Q, NR };
}

const pack = c => (0xff000000 | (c & 255) << 16 | (c & 0xff00) | (c >>> 16 & 255)) >>> 0;
const unp = v => (v & 255) << 16 | (v & 0xff00) | (v >>> 16 & 255);
const mix = (a, b, t) => { const f = (s) => Math.round((a >> s & 255) + ((b >> s & 255) - (a >> s & 255)) * t); return f(16) << 16 | f(8) << 8 | f(0); };

// The material callback sets these for the pixel being shaded.
export const M = { key: '', tone: 0 };

// Renders prims (world space) into a W×H sprite whose ground anchor is (ox, oy). ramps: key -> [5 colours dark..light].
// Each prim: { c, ax:[3 unit axes], r:[3 radii], mat(q0,q1,q2,prim), cyl?, clip?, flat? }.
// decals: [{ p:world point, n:world normal|null, key, tone }] painted after shading if they are the visible surface.
export function renderSprite(prims, decals, ramps, W, H, ox, oy) {
  const cam = raster(prims, CAM, W, H, ox, oy, 1, true);
  // Shadow map around the body, from the moon.
  const SW = 220, SS = 1.6, lc = [dot([0, 0, 28], LR), dot([0, 0, 28], LU)];
  const sh = raster(prims, LIGHT, SW, SW, SW / 2 - lc[0] * SS, SW / 2 + lc[1] * SS, SS, false);
  const { Z, ID, Q, NR } = cam, N = W * H;
  const out = new Uint32Array(N), mat = new Array(N), lvl = new Int8Array(N);
  for (let i = 0; i < N; i++) {
    if (ID[i] < 0) continue;
    const p = prims[ID[i]], px = i % W, py = (i / W) | 0;
    M.key = p.key; M.tone = 0;
    if (p.mat) p.mat(Q[i * 3], Q[i * 3 + 1], Q[i * 3 + 2], p, px, py);
    const n = [NR[i * 3], NR[i * 3 + 1], NR[i * 3 + 2]];
    // World point of the pixel, then its depth from the moon.
    const X = (px + .5 - ox), Y = -(py + .5 - oy), z = Z[i];
    const P = [0, 1, 2].map(k => X * CAM.r[k] + Y * CAM.u[k] + z * CAM.t[k]);
    const sx = Math.floor(dot(P, LR) * SS + SW / 2 - lc[0] * SS), sy = Math.floor(-dot(P, LU) * SS + SW / 2 + lc[1] * SS);
    let lit = Math.max(0, dot(n, LC));
    if (sx >= 0 && sy >= 0 && sx < SW && sy < SW && sh.Z[sx + sy * SW] > dot(P, LW) + 2.2) lit *= .22;
    const rim = dot(n, RIM) > .35 && n[2] < .5 ? .2 : 0;
    const tone = .2 + .72 * lit + .1 * n[1] + rim + M.tone;
    const v = Math.max(0, Math.min(4, tone * 4)), f = v - Math.floor(v);
    let l = Math.floor(v);
    if (f > .66 || (f > .4 && ((px + py) & 1))) l++;
    l = Math.max(0, Math.min(4, l));
    const ramp = ramps[M.key] || ramps.cassock;
    mat[i] = M.key; lvl[i] = l; out[i] = pack(ramp[l]);
  }
  // Inner contours: the far side of a depth step gets the darkest colour of its own ramp.
  const inner = out.slice();
  for (let i = 0; i < N; i++) {
    if (ID[i] < 0) continue;
    const px = i % W, nb = [px > 0 ? i - 1 : -1, px < W - 1 ? i + 1 : -1, i - W, i + W];
    for (const j of nb) {
      if (j < 0 || j >= N || ID[j] < 0) continue;
      if (Z[j] - Z[i] > 3.2 && !prims[ID[i]].noLine) { inner[i] = pack(mix((ramps[mat[i]] || ramps.cassock)[0], 0x050407, .35)); break; }
    }
  }
  // Stray pixels: one pixel unlike its four matching neighbours takes their colour.
  const clean = inner.slice();
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = x + y * W; if (!clean[i]) continue;
    const a = inner[i - 1], b = inner[i + 1], c = inner[i - W], d = inner[i + W];
    if (a && a === b && a === c && a === d && a !== inner[i]) clean[i] = a;
  }
  // Decals.
  for (const d of decals) {
    const X = dot(d.p, CAM.r), Y = dot(d.p, CAM.u), z = dot(d.p, CAM.t);
    if (d.n && dot(d.n, CAM.t) < (d.face ?? .12)) continue;
    const px = Math.floor(X + ox), py = Math.floor(-Y + oy);
    if (px < 0 || py < 0 || px >= W || py >= H) continue;
    const i = px + py * W;
    if (ID[i] < 0 || Math.abs(Z[i] - z) > (d.tol ?? 1.6)) continue;
    const ramp = ramps[d.key]; clean[i] = pack(ramp[Math.max(0, Math.min(4, d.l ?? lvl[i] + (d.tone || 0)))]);
  }
  // Outline: empty pixels touching the body take a dark version of what they touch (lighter towards the moon).
  const fin = clean.slice();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = x + y * W; if (clean[i]) continue;
    let best = -1;
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const a = x + dx, b = y + dy; if (a < 0 || b < 0 || a >= W || b >= H) continue;
      const j = a + b * W; if (clean[j] && (best < 0 || Z[j] > Z[best])) best = j;
    }
    if (best < 0 || prims[ID[best]].smear) continue;
    const ramp = ramps[mat[best]] || ramps.cassock;
    const litSide = (x < (best % W)) || (y < ((best / W) | 0));
    fin[i] = pack(mix(ramp[0], 0x040306, litSide && lvl[best] >= 3 ? .2 : .6));
  }
  return { w: W, h: H, d: fin };
}
export { unp };
