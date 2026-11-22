// The retro sound engine: every sound built like the effects of 16-bit games — square, saw, triangle and noise
// waves with pitch slides, vibrato, filters, and the grain of a low sample rate and few bits. It doesn't try to sound
// real; it sounds like a game, and the demons get detuned low layers, ring modulation and crushed bits to frighten.
// Same calls as src/sound.js, so either can play the game (src/sfx.js chooses).
let ac = null, bus, testing = false, voices = 0;
const last = {};
const R = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.random() * a.length | 0];
const clamp = v => Math.max(-1, Math.min(1, v || 0));

function build(c) {
  ac = c; bus = ac.createGain(); bus.gain.value = .9;
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = .002; comp.release.value = .2;
  bus.connect(comp).connect(ac.destination);
}
export function ensure() {
  if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; build(new C()); }
  if (ac.state === 'suspended' && !document.hidden) ac.resume();
}
document.addEventListener('visibilitychange', () => { if (!ac) return; document.hidden ? ac.suspend() : ac.resume(); });
const ready = () => ac && (testing || ac.state === 'running');
const gate = (key, gap) => { const n = ac.currentTime; if ((last[key] ?? -1e9) > n - gap) return false; last[key] = n; return true; };

// ---------------------------------------------------------------- the generator
// o: wave square|saw|tri|sine|noise; f (Hz; for noise, how fast it changes = how bright); slide (octaves/s) and
// accel; duty (square) and dutyS (its sweep /s); vib [rate, depth]; arp [time, ratio]: a jump in pitch;
// a, s, d: attack, sustain, decay (s); punch: a kick at the start of the sustain; lp/hp [from, to] Hz: filters that
// sweep; ring [Hz, depth]: ring modulation (metallic, inhuman); crush: sample rate it is held to; bits; vol; at: delay.
function gen(o, sr) {
  const dur = (o.a || .001) + (o.s || 0) + (o.d || .1), n = Math.ceil(dur * sr), out = new Float32Array(n);
  const hold = Math.max(1, Math.round(sr / (o.crush || sr))), q = o.bits ? Math.pow(2, o.bits - 1) : 0, a = o.a || .001, s = o.s || 0, d = o.d || .1;
  let ph = 0, nz = 0, lp = 0, hp = 0, hpIn = 0, held = 0, wob = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let f = o.f * Math.pow(2, (o.slide || 0) * t + .5 * (o.accel || 0) * t * t);
    if (o.vib) f *= 1 + o.vib[1] * Math.sin(2 * Math.PI * o.vib[0] * t);
    if (o.arp && t > o.arp[0]) f *= o.arp[1];
    if (o.wob) { wob += (Math.random() * 2 - 1) * o.wob * .02; wob *= .995; f *= 1 + wob; }
    f = Math.max(15, Math.min(16000, f));
    ph += f / sr; if (ph >= 1) { ph -= Math.floor(ph); nz = Math.random() * 2 - 1; }
    const duty = Math.max(.05, Math.min(.95, (o.duty ?? .5) + (o.dutyS || 0) * t));
    let v = o.wave === 'noise' ? nz : o.wave === 'saw' ? 2 * ph - 1 : o.wave === 'tri' ? 1 - 4 * Math.abs(ph - .5) : o.wave === 'sine' ? Math.sin(2 * Math.PI * ph) : (ph < duty ? 1 : -1);
    if (o.ring) v *= 1 - o.ring[1] + o.ring[1] * Math.sin(2 * Math.PI * o.ring[0] * t);
    if (o.lp) { const c = o.lp[0] * Math.pow(o.lp[1] / o.lp[0], t / dur); lp += (v - lp) * (1 - Math.exp(-2 * Math.PI * c / sr)); v = lp; }
    if (o.hp) { const c = o.hp[0] * Math.pow(o.hp[1] / o.hp[0], t / dur), k = Math.exp(-2 * Math.PI * c / sr); hp = k * (hp + v - hpIn); hpIn = v; v = hp; }
    const e = t < a ? t / a : t < a + s ? 1 + (o.punch || 0) * (1 - (t - a) / (s || 1)) : Math.pow(Math.max(0, 1 - (t - a - s) / d), o.curve || 1.6);
    v *= e;
    if (i % hold === 0) held = q ? Math.round(v * q) / q : v;
    out[i] = held * (o.vol ?? 1);
  }
  return out;
}
// Several layers into one buffer, normalised.
function layers(list) {
  const sr = ac.sampleRate, parts = list.filter(Boolean).map(o => [gen(o, sr), Math.round((o.at || 0) * sr)]);
  let n = 0; for (const [b, off] of parts) n = Math.max(n, off + b.length);
  const out = new Float32Array(n); for (const [b, off] of parts) for (let i = 0; i < b.length; i++) out[off + i] += b[i];
  let pk = 0; for (const v of out) pk = Math.max(pk, Math.abs(v));
  const buf = ac.createBuffer(1, n, sr), k = 1 / (pk || 1); for (let i = 0; i < n; i++) out[i] *= k; buf.copyToChannel(out, 0);
  return buf;
}
function play(list, vol, pan = 0, delay = 0) {
  const buf = layers(list), s = ac.createBufferSource(); s.buffer = buf;
  const g = ac.createGain(); g.gain.value = vol; const p = ac.createStereoPanner(); p.pan.value = clamp(pan);
  s.connect(g).connect(p).connect(bus); s.start(ac.currentTime + .005 + delay);
  voices++; setTimeout(() => voices--, (buf.duration + delay) * 1000);
  return g;
}
const lo = { crush: 16000, bits: 8 }, lofi = { crush: 11025, bits: 6 };

// ---------------------------------------------------------------- weapons
// k: stab, slash, chop, blunt, ram; p: pitch of the weapon (small blades high, heavy low); len: swing length.
const BLOW = {
  daga:       [['stab', 1.5, .8], ['slash', 1.6, .85], ['stab', 1.4, .7]],
  machete:    [['slash', 1.2, 1], ['slash', 1.1, 1.05], ['chop', 1.1, 1.05]],
  hacha:      [['chop', .75, 1.3], ['slash', .8, 1.35], ['chop', .75, 1.25]],
  candelabro: [['blunt', .6, 1.45], ['blunt', .65, 1.4], ['ram', .7, 1.1]],
  horca:      [['stab', .95, 1.1], ['stab', .9, 1.2], ['slash', 1, 1.3]],
};
const blowOf = (wid, b) => { const [k, p, len] = (BLOW[wid] || BLOW.daga)[Math.max(0, Math.min(2, (b || 1) - 1))]; return { k, p, len, w: 1.6 - p * .6 }; };
export function swing(wid, blow, pan) {
  if (!ready()) return;
  const B = blowOf(wid, blow), j = R(.92, 1.08), L = B.len * (blow === 3 ? 1.15 : 1), thrust = B.k === 'stab' || B.k === 'ram';
  play([
    { wave: 'noise', f: 7000 * B.p * j, slide: thrust ? -1 : -2.2, a: (thrust ? .02 : .05) * L, d: (thrust ? .07 : .12) * L, hp: [700 * B.p, 250], lp: [7000 * B.p, 1800 * B.p], ...lo },
    B.p < .9 && { wave: 'noise', f: 900, slide: -1, a: .06 * L, d: .12 * L, lp: [700, 250], vol: .7, ...lofi },    // heavy air
  ], .2 + .08 * B.w, pan);
}
export function hit(wid, blow, kill, pan) {
  if (!ready()) return;
  const B = blowOf(wid, blow), j = R(.92, 1.08), w = B.w * (blow === 3 ? 1.2 : 1);
  const L = [
    { wave: 'square', f: 170 * j / Math.sqrt(w), slide: -6, a: .001, s: .02, d: .1 + .05 * w, punch: .6, lp: [1400, 300], ...lofi },          // the thud
    { wave: 'noise', f: 2200 * j, slide: -3, a: .001, s: .015, d: .1, lp: [3500, 600], vol: .8, ...lofi },                                   // flesh
  ];
  if (B.k === 'stab') L.push({ wave: 'noise', f: 12000, a: .001, d: .035, hp: [3000, 3000], vol: .5, ...lo },
    { wave: 'saw', f: 260 * j, slide: -2.5, vib: [32, .25], a: .005, d: .14, lp: [1100, 300], vol: .6, at: .015, ...lofi });               // in, and the wet pull
  if (B.k === 'slash') L.push({ wave: 'noise', f: 9000 * j, slide: -2, a: .002, d: .09, hp: [1800, 700], vol: .7, ...lo });               // the edge opening
  if (B.k === 'chop') L.push({ wave: 'square', duty: .3, f: 110 * j, slide: -4, a: .001, s: .02, d: .14, punch: 1, vol: .8, ...lofi },
    { wave: 'noise', f: 6000, a: .001, d: .03, vol: .6, at: .01, ...lofi });                                                               // a deep chop, bone
  if (B.k === 'blunt' || B.k === 'ram') L.push({ wave: 'tri', f: 95 * j, slide: -3, a: .001, s: .03, d: .2, punch: 1, vol: 1, ...lofi });
  if (B.k === 'blunt') L.push({ wave: 'square', duty: .25, f: 620 * j, arp: [.035, .76], a: .001, d: .28, vol: .35, ...lofi });         // the bronze
  if (kill) L.push({ wave: 'noise', f: 1400, slide: -1.2, a: .01, s: .05, d: .32, lp: [2600, 350], vol: .9, at: .04, ...lofi },          // the splatter
    { wave: 'square', duty: .4, f: 95, slide: -2.5, a: .002, d: .22, lp: [700, 200], vol: .8, at: .4, ...lofi });                         // drops to the floor
  play(L, .95 + .2 * Math.min(1.5, w), pan);
}
export function equip(wid) {
  if (!ready()) return;
  play([{ wave: 'noise', f: 2500, slide: 2.5, a: .04, d: .07, lp: [1800, 5000], vol: .6, ...lo },
    wid && { wave: 'square', duty: .2, f: 900, slide: -2, a: .001, d: .05, vol: .5, at: .1, ...lofi }], .2);
}

// ---------------------------------------------------------------- the priest
const PR = 150;                                                    // his pitch
export function hurt(pan, dmg = 10) {
  if (!ready()) return;
  const j = R(.92, 1.08), big = dmg >= 15;
  play([
    { wave: 'square', duty: .3, f: PR * 2 * j * (big ? 1.25 : 1), slide: big ? -1.5 : -3, vib: [18, .06], a: .004, s: big ? .1 : .03, d: big ? .3 : .13, lp: [3000, 700], ...lo },
    big && { wave: 'saw', f: PR * 2.6 * j, slide: -1.3, vib: [23, .09], a: .01, s: .08, d: .3, lp: [2600, 600], vol: .55, ...lo },
    { wave: 'noise', f: 1600, slide: -3, a: .001, d: .1, lp: [2500, 500], vol: .7, ...lofi },
  ], .8, pan);
}
export function die(pan) {
  if (!ready()) return;
  prayOn(false); beat = 1e9;
  play([
    { wave: 'saw', f: PR * 3, slide: -1.3, vib: [7, .06], a: .01, s: .25, d: 1.3, lp: [3000, 250], ...lo },
    { wave: 'square', duty: .15, f: PR * .75, slide: -.9, a: .02, s: .2, d: 1.4, vol: .6, ...lofi },
    { wave: 'noise', f: 900, slide: -.8, a: .05, s: .2, d: 1.1, lp: [1800, 200], vol: .45, ...lofi },
    { wave: 'tri', f: 80, slide: -2, a: .001, d: .3, punch: 1, vol: .9, at: 1.1, ...lofi },
  ], .5, pan);
}
// Little life left: his heart, louder and faster the closer he is.
let beat = 0;
export function lowHp(hp, busy) {
  if (!ready()) return;
  const now = ac.currentTime;
  if (hp >= 35 || hp <= 0) { if (hp >= 35) beat = 0; return; }
  if (!beat) beat = now + .3;
  if (now < beat) return;
  const k = 1 - hp / 35;
  play([{ wave: 'tri', f: 62, slide: -2, a: .002, d: .1, punch: .5, lp: [500, 150], ...lofi },
    { wave: 'tri', f: 55, slide: -2, a: .002, d: .12, lp: [400, 120], vol: .7, at: .16, ...lofi }], .35 + .25 * k);
  beat = now + 1.05 - .45 * k;
}
export function step(run, crouch) {
  if (!ready()) return;
  play([{ wave: 'noise', f: R(700, 1000), slide: -2, a: .001, d: run ? .05 : .04, lp: [1600, 500], ...lofi },
    run && { wave: 'noise', f: 3000, a: .015, d: .05, lp: [2500, 900], vol: .4, ...lo }], run ? .5 : crouch ? .18 : .4);
}
export function jump() { if (!ready()) return; play([{ wave: 'noise', f: 2500, slide: 2, a: .03, d: .1, lp: [1200, 4000], ...lo }, { wave: 'square', duty: .4, f: 110, slide: 2.5, a: .002, d: .08, lp: [900, 900], vol: .4, ...lofi }], .35); }
export function land() { if (!ready()) return; play([{ wave: 'noise', f: 900, slide: -3, a: .001, s: .01, d: .1, lp: [1500, 300], ...lofi }, { wave: 'tri', f: 90, slide: -3, a: .001, d: .1, punch: .5, vol: .8, ...lofi }], .6); }
export function roll() {
  if (!ready()) return;
  play([{ wave: 'noise', f: 3000, slide: -1, a: .12, d: .25, lp: [900, 3000], ...lo },
    ...[.08, .2, .34].map(at => ({ wave: 'noise', f: 800, slide: -3, a: .001, d: .06, lp: [1200, 300], vol: .7, at, ...lofi }))], .25);
}
export function breath() {
  if (!ready() || !gate('breath', .8)) return;
  play([{ wave: 'noise', f: 4000, a: .1, d: .18, lp: [1400, 900], ...lo }, { wave: 'noise', f: 4000, a: .12, d: .15, lp: [1000, 1300], vol: .8, at: .35, ...lo }], .2);
}
// The crucifix raised: a bright, rising shimmer.
let crossWas = false;
export function crossOn(on) {
  if (on && !crossWas && ready())
    play([0, .05, .1].map((at, i) => ({ wave: 'square', duty: .125, f: [880, 1109, 1319][i], vib: [6, .01], a: .005, s: .1, d: .5, vol: .5, at, ...lo })), .18);
  crossWas = on;
}
// Praying: a low murmur in syllables.
let prayT = 0;
export function prayOn(on) {
  if (!ac) return;
  if (!on) { prayT = 0; return; }
  if (!ready()) return;
  const now = ac.currentTime; if (prayT && now < prayT) return;
  const n = 6 + (Math.random() * 5 | 0);
  play(Array.from({ length: n }, (_, i) => ({ wave: 'noise', f: 2500, a: .04, s: .04, d: .08, lp: [R(500, 900), R(400, 700)], at: i * R(.15, .2), ...lofi })), .1);
  prayT = now + n * .18 + R(.4, .8);
}
export function door(open, pan) {
  if (!ready()) return;
  play([{ wave: 'square', duty: .3, f: 300, slide: open ? 1 : -1, vib: [18, .08], a: .01, d: .3, lp: [1500, 800], ...lofi },
    !open && { wave: 'tri', f: 90, slide: -3, a: .001, d: .15, punch: .6, at: .3, ...lofi }], .3, pan);
}
export function sizzle(pan) {
  if (!ready() || !gate('sizzle', .12)) return;
  play([{ wave: 'noise', f: 11000, a: .01, d: .25, hp: [3000, 3000], ...lo }, ...Array.from({ length: 4 }, () => ({ wave: 'noise', f: 6000, a: .001, d: .015, vol: .8, at: R(0, .2), ...lofi }))], .2, pan);
}

// ---------------------------------------------------------------- the ten
// p: pitch; w: wave; v: vibrato rate; demon: a second voice an octave down, ring-modulated and crushed;
// hiss / bleat / chirp: their own colour.
const FOE = {
  poseido:     { p: 200, w: 'saw', v: 14, demon: .45, wob: 1 },
  carnicero:   { p: 120, w: 'square', v: 9, demon: .7 },
  monja:       { p: 330, w: 'saw', v: 7, demon: .4, hiss: 1 },
  acolito:     { p: 210, w: 'saw', v: 6, demon: .4 },
  flagelante:  { p: 180, w: 'saw', v: 10, demon: .35 },
  nino:        { p: 420, w: 'tri', v: 8, demon: .6 },
  obispo:      { p: 100, w: 'saw', v: 5, demon: .8 },
  cabrio:      { p: 240, w: 'square', v: 13, demon: .6, bleat: 1 },
  crucificado: { p: 140, w: 'saw', v: 4, demon: .45 },
  diablillo:   { p: 520, w: 'square', v: 22, demon: .5, chirp: 1 },
};
// A cry: the voice, its demon underneath, and the breath of it.
function voice(F, o, vol, pan) {
  const j = R(.92, 1.08), main = { wave: F.w, duty: .3, f: F.p * o.m * j, slide: o.slide, vib: [F.v * (o.vr || 1), (o.vd ?? .07) * (F.bleat ? 2.5 : 1)], wob: F.wob,
    arp: F.chirp ? [o.s * .5 + .02, 1.5] : null, a: o.a ?? .008, s: o.s, d: o.d, lp: [4000, 900], ring: o.ring, ...lo };
  play([
    main,
    F.demon && { ...main, wave: 'square', duty: .2, f: main.f * .5, vib: [F.v * .5, .05], ring: [37, .7], lp: [1800, 400], crush: 8000, bits: 5, vol: F.demon },
    { wave: 'noise', f: 5000, slide: o.slide * .5, a: .01, s: o.s, d: o.d * .9, lp: [F.hiss ? 9000 : 3500, 900], hp: F.hiss ? [2500, 2500] : null, vol: F.hiss ? .8 : o.br ?? .3, ...lo },
  ], vol, pan);
}
// How a body answers each blow. m: pitch × its own; slide (octaves/s); s, d: hold and fall; ring: gurgle.
const CRY = {
  yelp:   { m: 1.6, slide: -3, s: .03, d: .15 },
  scream: { m: 1.9, slide: -1, s: .12, d: .32, vr: 1.5, vd: .1, br: .45 },
  long:   { m: 2.1, slide: -.8, s: .2, d: .45, vr: 1.6, vd: .12, br: .5 },
  grunt:  { m: .9, slide: -2.5, s: .02, d: .1, vd: .03, br: .2 },
  choke:  { m: 1.2, slide: -1.6, s: .05, d: .3, ring: [24, .85], br: .35 },
  winded: { m: .8, slide: -1.5, s: .02, d: .22, vd: .02, br: 1 },
  roar:   { m: .85, slide: .4, s: .15, d: .25, ring: [45, .5], br: .5, a: .03 },
  death:  { m: 2.2, slide: -1.5, s: .15, d: .95, vr: .8, vd: .12, br: .5 },
  whimper:{ m: 2, slide: -.3, s: .05, d: .35, vr: .7, vd: .1, br: .2, a: .05 },
};
const ANSWER = { stab: ['yelp', 'choke'], slash: ['scream', 'yelp'], chop: ['long', 'scream'], blunt: ['grunt', 'roar'], ram: ['winded'] };
const lastSaid = {};
export function pain(id, wid, blow, pan, stagger = true) {
  const F = FOE[id]; if (!F || !ready() || voices > 8 || !gate(id + 'pain', .15)) return;
  const B = blowOf(wid, blow), list = stagger ? ANSWER[B.k] || ANSWER.blunt : ['grunt', 'yelp'];
  let k = pick(list); if (k === lastSaid[id] && list.length > 1) k = list.find(x => x !== k); lastSaid[id] = k;
  voice(F, CRY[k], stagger ? .38 : .26, pan);
}
export function cry(id, kind, pan) {
  const F = FOE[id]; if (!F || !ready()) return;
  if (kind !== 'death' && (voices > 8 || !gate(id + kind, kind === 'cow' ? 1.4 : .35))) return;
  if (kind === 'death') { voice(F, CRY.death, .45, pan); play([{ wave: 'tri', f: 85, slide: -2.5, a: .001, d: .22, punch: 1, ...lofi }], .35, pan, .6); return; }
  if (kind === 'atk') return voice(F, CRY.roar, .3, pan);
  if (kind === 'cow') return voice(F, CRY.whimper, .2, pan);
}
export function eswing(id, scale, pan) {
  if (!ready() || !gate('esw' + id, .08)) return; const s = scale || 1;
  if (id === 'flagelante') return play([{ wave: 'noise', f: 3000, slide: 2, a: .05, d: .04, lp: [2000, 6000], ...lo }, { wave: 'noise', f: 12000, a: .001, d: .03, hp: [3000, 3000], at: .07, ...lo }], .35, pan);
  play([{ wave: 'noise', f: 5000 / s, slide: -2, a: .05 * s, d: .1 * s, hp: [600, 250], lp: [5000 / s, 1500], ...lo }], .3, pan);
}
export function fire(pan) {
  if (!ready()) return;
  play([{ wave: 'noise', f: 600, slide: 3, a: .1, s: .1, d: .25, lp: [400, 3500], ...lofi }, { wave: 'saw', f: 70, slide: 1.2, a: .05, d: .35, lp: [500, 500], vol: .6, ...lofi }], .35, pan);
}
export function shatter(pan) {
  if (!ready()) return;
  play([{ wave: 'square', duty: .125, f: 2400, arp: [.04, .7], slide: -1, a: .001, d: .3, vol: .6, ...lo }, { wave: 'noise', f: 12000, a: .001, d: .12, hp: [3000, 3000], ...lo }], .55, pan);
}
export function stomp(pan) {
  if (!ready()) return;
  play([{ wave: 'noise', f: 400, slide: -2, a: .001, s: .05, d: .5, lp: [900, 120], ...lofi }, { wave: 'tri', f: 65, slide: -2, a: .001, s: .05, d: .5, punch: 1, ...lofi }], .6, pan);
}
export function snort(pan) { if (!ready()) return; play([0, .14].map(at => ({ wave: 'noise', f: 1500, a: .01, d: .08, lp: [900, 600], at, ...lofi })), .4, pan); }
export function summon(pan) {
  if (!ready() || !gate('summon', .25)) return;
  play([{ wave: 'saw', f: 300, slide: -2, vib: [6, .08], ring: [33, .6], a: .2, d: .4, lp: [1500, 300], ...lofi }], .25, pan);
}

export function _offline(c) { testing = true; voices = 0; for (const k in last) delete last[k]; build(c); }
