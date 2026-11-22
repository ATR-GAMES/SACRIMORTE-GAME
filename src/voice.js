// A throat, sample by sample: the screams, groans and death rattles of the priest and the ten.
// Glottal pulses (the vocal folds slapping shut) go through a cascade of resonators (the vocal tract), with what
// makes a real scream frightening: an unsteady pitch, rough doubled pulses, air, vocal fry as the breath runs out,
// and blood in the throat. Pure functions: no Web Audio here, so it can be rendered and studied anywhere.

// Vowels: formant frequency and bandwidth for F1..F3 (an adult male tract; others scale it).
const VOW = {
  a:  [[750, 90], [1150, 110], [2500, 170]],
  ae: [[680, 90], [1700, 120], [2450, 170]],
  uh: [[620, 90], [1200, 110], [2400, 170]],
  o:  [[560, 80], [850, 100], [2450, 170]],
  u:  [[340, 70], [850, 100], [2250, 170]],
  e:  [[520, 80], [1850, 110], [2500, 170]],
  i:  [[300, 60], [2250, 120], [3000, 200]],
  s:  [[2000, 500], [4800, 700], [6800, 900]],   // not a vowel: the hiss of an s, for whispering
};
const smooth = u => u * u * (3 - 2 * u);
// Value of a curve [[x, y], ...] at x in 0..1.
function at(pts, x) {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], s = smooth((x - x0) / ((x1 - x0) || 1));
    return y0 + (y1 - y0) * s;
  }
  return pts[pts.length - 1][1];
}
function vowAt(pts, x) {
  let i = 1; while (i < pts.length - 1 && x > pts[i][0]) i++;
  const [x0, a] = pts[Math.max(0, i - 1)], [x1, b] = pts[Math.min(pts.length - 1, i)];
  const s = pts.length < 2 ? 0 : smooth(Math.max(0, Math.min(1, (x - x0) / ((x1 - x0) || 1))));
  const A = VOW[a], B = VOW[b];
  return A.map((f, k) => [f[0] + (B[k][0] - f[0]) * s, f[1] + (B[k][1] - f[1]) * s]);
}

// o: dur (s); f0 [[x, Hz]]; vow [[x, vowel]]; amp [[x, 0..1]]; voiced 0..1; asp: breath 0..1; tilt: 0 pressed/bright
// .. 1 breathy/dark; jit: pitch jitter per pulse; shim: loudness jitter per pulse; sub: period doubling (roughness);
// chaos: slow wandering of the pitch; vib [rate, depth]; creak: vocal fry at the end (0..1); bubble: blood (0..1);
// scale: vocal tract (bigger body < 1 < smaller); drive: distortion.
export function synth(o, sr) {
  const n = Math.max(1, Math.ceil(o.dur * sr)), out = new Float32Array(n), T = 1 / sr, sc = o.scale || 1;
  const NF = 5, y1 = new Float64Array(NF), y2 = new Float64Array(NF), A = new Float64Array(NF), B = new Float64Array(NF), C = new Float64Array(NF);
  const voiced = o.voiced ?? 1, asp = o.asp ?? .2, tilt = o.tilt ?? .3, jit = o.jit ?? .02, shim = o.shim ?? .08, sub = o.sub ?? 0;
  const chaos = o.chaos ?? 0, creak = o.creak ?? 0, bubble = o.bubble ?? 0, cStart = 1 - .4 * creak;
  const oq = .45 + .3 * tilt, tp = oq * .68, tn = oq * .32, tl = .25 + .7 * tilt;   // open quotient, its parts, spectral tilt
  let env = 0, base = 100, ph = 0, idx = 0, jf = 1, amp = 1, wob = 0, prev = 0, tiltY = 0, bub = 0, bubS = 0, bubT = 0, nzLP = 0, f = 100;
  for (let i = 0; i < n; i++) {
    const x = i / n;
    if ((i & 31) === 0) {
      const V = vowAt(o.vow, x), eff = env = at(o.amp, x); base = at(o.f0, x);   // curves are read every 32 samples
      const F = [[V[0][0] * sc, V[0][1]], [V[1][0] * sc, V[1][1]], [V[2][0] * sc, V[2][1]], [3400 * sc, 250], [4300 * sc, 300]];
      for (let k = 0; k < NF; k++) {
        const bw = F[k][1] * (1 + .6 * (1 - eff)) * (k < 3 ? 1 : 1.2), r = Math.exp(-Math.PI * bw * T);
        C[k] = -r * r; B[k] = 2 * r * Math.cos(2 * Math.PI * Math.min(F[k][0], sr * .45) * T); A[k] = 1 - B[k] - C[k];
      }
    }
    // Pitch: the curve, vibrato, a slow wander, jitter per pulse; at the end, the voice breaks into fry.
    let f0 = base;
    if (o.vib) f0 *= 1 + o.vib[1] * Math.sin(2 * Math.PI * o.vib[0] * i * T);
    let cr = 0; if (creak && x > cStart) { cr = smooth((x - cStart) / (1 - cStart)); f0 = f0 * (1 - cr) + 55 * cr; }
    f = f0 * jf * (1 + wob);
    ph += f * T;
    if (ph >= 1) {
      ph -= 1; idx++;
      const j = jit + .12 * cr;
      jf = 1 + (Math.random() * 2 - 1) * j;
      amp = (1 + (Math.random() * 2 - 1) * (shim + .3 * cr)) * ((idx & 1) ? 1 - Math.min(.9, sub + .4 * cr) : 1);
      if (cr > .3 && Math.random() < .2 * cr) amp *= .2;                        // fry: pulses that barely come
      wob += (Math.random() * 2 - 1) * .025 * chaos; wob *= .96;
    }
    // Rosenberg glottal flow, then its slope (the lips radiate the derivative), then the tilt of the voice.
    let g = ph < tp ? .5 * (1 - Math.cos(Math.PI * ph / tp)) : ph < tp + tn ? Math.cos(Math.PI * (ph - tp) / (2 * tn)) : 0;
    g *= amp;
    const dg = (g - prev) / (Math.PI * f * T / (2 * tp) + 1e-9); prev = g;
    tiltY += (dg - tiltY) * (1 - tl * .9);
    // Breath: noise, stronger while the folds are open.
    const nz = Math.random() * 2 - 1; nzLP += (nz - nzLP) * .6;
    let src = tiltY * voiced * .5 + nzLP * asp * (ph < oq ? 1 : .45) * .9;
    // The tract.
    let v = src;
    for (let k = 0; k < NF; k++) { const y = A[k] * v + B[k] * y1[k] + C[k] * y2[k]; y2[k] = y1[k]; y1[k] = y; v = y; }
    // Blood: the sound chokes off in bubbles.
    if (bubble) { if (--bubT <= 0) { bubT = (.015 + Math.random() * .05) * sr; bub = Math.random() < .55 ? Math.random() : 0; } bubS += (bub - bubS) * .004; v *= 1 - bubble * bubS; }   // eased: no clicks
    out[i] = v * env;
  }
  // Level, grit, no clicks.
  let pk = 0, dc = 0, dcy = 0;
  for (let i = 0; i < n; i++) { const xi = out[i]; dcy = xi - dc + .995 * dcy; dc = xi; out[i] = dcy; pk = Math.max(pk, Math.abs(dcy)); }
  const dr = o.drive || 1, k = 1 / (pk || 1), td = Math.tanh(dr), fade = Math.min(n, sr * .004 | 0);
  for (let i = 0; i < n; i++) {
    let v = out[i] * k; if (dr > 1) v = Math.tanh(v * dr) / td;
    if (i < fade) v *= i / fade; if (i > n - fade) v *= (n - i) / fade;
    out[i] = v;
  }
  return out;
}

// ---------------------------------------------------------------- what a body says
const R = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.random() * a.length | 0];
// Each returns one or more utterances [params, gap before]. B: the being; I: how hard it was hit (0..1.5).
export const SAY = {
  grunt: (B, I) => [{ dur: R(.13, .2) * (1 + .3 * I), f0: [[0, B.f * 1.15], [.3, B.f * (1.25 + .2 * I)], [1, B.f * .8]], vow: [[0, 'uh'], [1, pick(['u', 'o'])]],
    amp: [[0, 0], [.07, 1], [.5, .75], [1, 0]], jit: .025, sub: .12 + (B.sub || 0), asp: .35 + (B.breathy || 0) * .4, tilt: .45, chaos: .3, creak: .5, drive: 1.5 + (B.drive || 0) }],
  yelp: (B, I) => [{ dur: R(.18, .28), f0: [[0, B.f * 1.7], [.18, B.f * (2.3 + .5 * I)], [1, B.f * 1.4]], vow: [[0, 'ae'], [1, 'a']],
    amp: [[0, 0], [.04, 1], [.6, .8], [1, 0]], jit: .025, sub: .15 + (B.sub || 0), asp: .2 + (B.breathy || 0) * .4, tilt: .12, chaos: .7 * (B.chaos || 1), drive: 1.5 + (B.drive || 0) }],
  scream: (B, I) => [{ dur: R(.45, .7) * (1 + .35 * I), f0: [[0, B.f * 1.9], [.12, B.f * (2.6 + .6 * I)], [.65, B.f * (2.4 + .4 * I)], [1, B.f * 1.5]],
    vow: [[0, 'a'], [.6, 'ae'], [1, pick(['o', 'uh'])]], amp: [[0, 0], [.03, 1], [.7, .85], [1, 0]],
    jit: .035, sub: .3 + (B.sub || 0), asp: .25 + (B.breathy || 0) * .4, tilt: .05, chaos: 1.3 * (B.chaos || 1), creak: .35, drive: 1.8 + (B.drive || 0) }],
  // A scream that breaks: a short one, a catch of breath, a longer one.
  broken: (B, I) => [[{ ...SAY.scream(B, I * .6)[0], dur: R(.18, .26), creak: 0 }, 0], [{ ...SAY.scream(B, I)[0], dur: R(.35, .5) }, R(.05, .1)]],
  inhale: (B) => [{ dur: R(.15, .22), f0: [[0, B.f]], vow: [[0, 'a'], [1, 'uh']], amp: [[0, 0], [.75, 1], [1, 0]], voiced: 0, asp: 1, tilt: .2 }],
  choke: (B, I) => [{ dur: R(.32, .5), f0: [[0, B.f * 1.25], [.3, B.f * 1.3], [1, B.f * .65]], vow: [[0, 'uh'], [1, 'u']], amp: [[0, 0], [.06, 1], [.7, .7], [1, 0]],
    jit: .06, sub: .45, asp: .4, tilt: .35, chaos: .9, bubble: .85, creak: .5, drive: 1.4 }],
  winded: (B) => [{ dur: R(.25, .35), f0: [[0, B.f * 1.05], [1, B.f * .7]], vow: [[0, 'uh'], [1, 'o']], amp: [[0, 0], [.04, 1], [1, 0]], voiced: .35, asp: 1, tilt: .55, creak: .4 }],
  roar: (B, I) => [{ dur: R(.35, .55), f0: [[0, B.f * 1.1], [.35, B.f * 1.5], [1, B.f * .9]], vow: [[0, 'a'], [1, 'o']], amp: [[0, 0], [.08, 1], [.8, .8], [1, 0]],
    jit: .03, sub: .45 + (B.sub || 0), asp: .3 + (B.breathy || 0) * .4, tilt: .1, chaos: 1, creak: .3, drive: 2.2 + (B.drive || 0) }],
  moan: (B) => [{ dur: R(.8, 1.2), f0: [[0, B.f], [.55, B.f * 1.3], [1, B.f * .8]], vib: [5, .025], vow: [[0, 'o'], [1, 'u']], amp: [[0, 0], [.2, 1], [.8, .7], [1, 0]],
    jit: .02, sub: .1, asp: .45, tilt: .5, creak: .35, drive: 1.3 }],
  whimper: (B) => [{ dur: R(.35, .5), f0: [[0, B.f * 1.7], [.4, B.f * 1.95], [1, B.f * 1.5]], vib: [7, .05], vow: [[0, 'i'], [1, 'u']], amp: [[0, 0], [.15, .7], [1, 0]],
    jit: .03, asp: .5, tilt: .4 }],
  hiss: (B) => [{ dur: R(.35, .55), f0: [[0, B.f]], vow: [[0, 'i'], [1, 'e']], voiced: .12, asp: 1, tilt: 0, amp: [[0, 0], [.08, 1], [1, 0]], scale: 1.1 }],
  bleat: (B, I) => [{ dur: R(.45, .65), f0: [[0, B.f * 1.6], [.2, B.f * (2 + .4 * I)], [1, B.f * 1.3]], vib: [9, .1], vow: [[0, 'e'], [.4, 'ae'], [1, 'a']],
    amp: [[0, 0], [.05, 1], [.8, .8], [1, 0]], jit: .04, sub: .35, asp: .3, tilt: .1, chaos: .8, drive: 1.6 }],
  death: (B) => [{ dur: R(1.1, 1.5) * (B.len || 1), f0: [[0, B.f * 2.2], [.13, B.f * 2.8], [.5, B.f * 1.7], [1, B.f * .5]], vow: [[0, 'a'], [.5, 'o'], [1, 'u']],
    amp: [[0, 0], [.03, 1], [.5, .7], [.85, .35], [1, 0]], jit: .04, sub: .35 + (B.sub || 0), asp: .3 + (B.breathy || 0) * .4, tilt: .1, chaos: 1.3 * (B.chaos || 1), creak: .7, drive: 1.8 + (B.drive || 0) }],
  // The priest's own: a gaunt old man's throat.
  hup: (B) => [{ dur: R(.09, .13), f0: [[0, B.f * 1.25], [1, B.f * 1.05]], vow: [[0, 'uh'], [1, pick(['u', 'uh'])]], amp: [[0, 0], [.15, 1], [1, 0]],
    jit: .02, asp: .5 + (B.breathy || 0) * .3, tilt: .45, drive: 1.2 }],
  // After a heavy blow: a long groan sinking into fry.
  groan: (B) => [{ dur: R(.6, .9), f0: [[0, B.f * 1.3], [.3, B.f * 1.15], [1, B.f * .75]], vow: [[0, 'o'], [.6, 'uh'], [1, 'u']], amp: [[0, 0], [.1, 1], [.7, .6], [1, 0]],
    jit: .03, sub: .15 + (B.sub || 0), asp: .45 + (B.breathy || 0) * .3, tilt: .5, chaos: .5, creak: .6, drive: 1.3 }],
  // Near the end: ragged breath out and in, a little voice caught in it.
  pant: (B) => [[{ dur: R(.22, .3), f0: [[0, B.f * 1.1], [1, B.f * .9]], vow: [[0, 'a'], [1, 'uh']], amp: [[0, 0], [.12, 1], [1, 0]], voiced: R(.08, .2), asp: 1, tilt: .35, creak: .3 }, 0],
    [{ dur: R(.25, .32), f0: [[0, B.f]], vow: [[0, 'uh'], [1, 'a']], amp: [[0, 0], [.65, .75], [1, 0]], voiced: 0, asp: 1, tilt: .2 }, R(.08, .14)]],
  // The crucifix raised: a firm shout from the chest.
  rally: (B) => [{ dur: R(.28, .38), f0: [[0, B.f * 1.35], [.3, B.f * 1.5], [1, B.f * 1.1]], vow: [[0, 'a'], [1, 'o']], amp: [[0, 0], [.06, 1], [.7, .8], [1, 0]],
    jit: .02, sub: .08, asp: .25, tilt: .15, chaos: .3, drive: 1.8 }],
  // Prayer: a murmur under the breath, syllable after syllable.
  whisper: (B) => {
    const n = 9 + (Math.random() * 6 | 0), sy = R(.14, .19), dur = n * sy + .35, vow = [], amp = [[0, 0]];
    for (let k = 0; k < n; k++) {
      const x0 = k * sy / dur, x1 = (k + 1) * sy / dur, v = Math.random() < .15 ? 's' : pick(['a', 'e', 'i', 'o', 'u', 'uh', 'e', 'a']);
      vow.push([x0 + (x1 - x0) * .5, v]); amp.push([x0 + (x1 - x0) * .3, R(.6, 1)], [x0 + (x1 - x0) * .75, R(.45, .8)], [x1, R(.05, .2)]);
    }
    amp.push([1, 0]);
    return [{ dur, f0: [[0, B.f * .95], [1, B.f * .85]], vow: [[0, vow[0][1]], ...vow], amp, voiced: .1, asp: 1, tilt: .3 }];
  },
  // The priest swinging hard: a short push of breath and voice.
  effort: (B) => [{ dur: R(.1, .15), f0: [[0, B.f * 1.2], [1, B.f * .9]], vow: [[0, 'a'], [1, 'uh']], amp: [[0, 0], [.06, 1], [1, 0]], jit: .02, asp: .6, tilt: .4, drive: 1.3 }],
};
// Normalise every entry to [params, gap].
export function utter(kind, B, I = 1) {
  return SAY[kind](B, I).map(u => Array.isArray(u) ? u : [u, 0]).map(([p, g]) => [{ ...p, scale: (p.scale || 1) * (B.sc || 1) }, g]);
}
export { pick, R };
