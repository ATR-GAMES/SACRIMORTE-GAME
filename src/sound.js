// Every sound in the game, made on the spot with Web Audio: no files. Blows, flesh, bone, the cries of the ten,
// the priest's breath, groans and steps, fire. Only what the characters do: no music, no ambience.
// The browser only lets sound start after a key or a touch, so the context is born on the first one.
import { synth, utter } from './voice.js?v=78777f9';
import { BEINGS } from './beings.js?v=78777f9';
let ac = null, bus, dry, noiseBuf, brownBuf, enabled = true, testing = false, live = 0;
try { enabled = localStorage.getItem('sacrimorte_sonido') !== '0'; } catch {}
const last = {}, waiting = new Set();
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = v => Math.max(-1, Math.min(1, v || 0));

function build(c) {
  ac = c;
  bus = ac.createGain(); bus.gain.value = enabled ? .9 : 0;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = .003; comp.release.value = .25;
  bus.connect(comp).connect(ac.destination);
  dry = ac.createGain(); dry.connect(bus);
  const m = ac.sampleRate * 2 | 0; noiseBuf = ac.createBuffer(1, m, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < m; i++) d[i] = Math.random() * 2 - 1;
  // Brown noise: warmer, rounder, for flesh, thumps and cloth (white noise there sounds like static).
  brownBuf = ac.createBuffer(1, m, ac.sampleRate); const e = brownBuf.getChannelData(0); let b = 0;
  for (let i = 0; i < m; i++) { b = (b + .02 * (Math.random() * 2 - 1)) / 1.02; e[i] = b * 3.5; }
}
export function ensure() {
  if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; build(new C()); warm('padre'); for (const w of waiting) warm(w); refill(); }
  if (ac.state === 'suspended' && !document.hidden) ac.resume();
}
// (src/sfx.js calls ensure() on the first key or touch when this engine is the one chosen.)
document.addEventListener('visibilitychange', () => { if (!ac) return; document.hidden ? ac.suspend() : ac.resume(); });

const ready = () => ac && enabled && (testing || ac.state === 'running');
const gate = (key, gap) => { const n = ac.currentTime; if ((last[key] ?? -1e9) > n - gap) return false; last[key] = n; return true; };
export const isOn = () => enabled;
export function toggle() {
  enabled = !enabled; try { localStorage.setItem('sacrimorte_sonido', enabled ? '1' : '0'); } catch {}
  if (ac) { const t = ac.currentTime; bus.gain.cancelScheduledValues(t); bus.gain.setTargetAtTime(enabled ? .9 : 0, t, .05); }
  return enabled;
}

// ---------------------------------------------------------------- building blocks
// Dry: everything sounds right next to you, no echo.
function out(node, pan = 0) {
  const p = ac.createStereoPanner(); p.pan.value = clamp(pan); node.connect(p).connect(dry);
}
function env(t, a, d, peak) {
  const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(.0005, t + a + d); g.gain.linearRampToValueAtTime(0, t + a + d + .02); return g;
}
function noise(o) {
  const t = o.t ?? ac.currentTime, a = o.a ?? .003, s = ac.createBufferSource(); s.buffer = o.brown ? brownBuf : noiseBuf; s.playbackRate.value = o.rate || 1;
  const f = ac.createBiquadFilter(); f.type = o.type || 'bandpass'; f.frequency.setValueAtTime(o.f || 1000, t);
  // f → f2 over the whole sound; or, with f3, f → f2 at the peak and on to f3 (a swing: rises, then falls away).
  if (o.f3) { f.frequency.exponentialRampToValueAtTime(o.f2, t + a); f.frequency.exponentialRampToValueAtTime(o.f3, t + a + o.dur); }
  else if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + a + o.dur);
  f.Q.value = o.q ?? 1;
  const g = env(t, a, o.dur, o.vol ?? .5); s.connect(f).connect(g); out(g, o.pan);
  s.start(t, Math.random() * 1.5); s.stop(t + a + o.dur + .05);
}
function tone(o) {
  const t = o.t ?? ac.currentTime, a = o.a ?? .004, s = ac.createOscillator(); s.type = o.w || 'sine';
  s.frequency.setValueAtTime(o.f, t); if (o.f2) s.frequency.exponentialRampToValueAtTime(o.f2, t + a + o.dur);
  const g = env(t, a, o.dur, o.vol ?? .3);
  if (o.lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; s.connect(f).connect(g); } else s.connect(g);
  out(g, o.pan); s.start(t); s.stop(t + a + o.dur + .05);
}
// ---------------------------------------------------------------- weapons
// Each of the fifteen blows has its own sound, by what the blow does and what the weapon is made of.
// k: stab (goes in), slash (opens across), chop (bites deep), blunt (crushes), ram (driven straight in, blunt);
// f: pitch of the air it cuts; len: length of the swing; w: weight; thrust: a short straight push instead of an arc;
// tines: the fork goes in with several points.
const BLOW = {
  cruz: [{ k: 'blunt', f: 900, len: .18, w: 1 }, { k: 'blunt', f: 950, len: .2, w: .95 }, { k: 'blunt', f: 800, len: .22, w: 1.15 }],
  daga: [
    { k: 'stab', f: 2200, len: .1, w: .55 },                   // puñalada
    { k: 'slash', f: 2600, len: .12, w: .5 },                  // tajo de revés
    { k: 'stab', f: 2000, len: .08, w: .6, thrust: 1 },        // estocada
  ],
  machete: [
    { k: 'slash', f: 1800, len: .16, w: .8 },                  // tajo diagonal
    { k: 'slash', f: 1600, len: .18, w: .75 },                 // tajo horizontal
    { k: 'chop', f: 1400, len: .18, w: .95 },                  // machetazo
  ],
  hacha: [
    { k: 'chop', f: 800, len: .24, w: 1.25 },                  // hachazo
    { k: 'slash', f: 900, len: .26, w: 1.1 },                  // barrido
    { k: 'chop', f: 850, len: .22, w: 1.2 },                   // golpe ascendente
  ],
  candelabro: [
    { k: 'blunt', f: 600, len: .28, w: 1.35 },                 // mazazo
    { k: 'blunt', f: 650, len: .26, w: 1.2 },                  // golpe de costado
    { k: 'ram', f: 700, len: .18, w: 1.3, thrust: 1 },         // embestida
  ],
  horca: [
    { k: 'stab', f: 1200, len: .15, w: .9, thrust: 1, tines: 3 }, // ensarte
    { k: 'stab', f: 1000, len: .2, w: 1, tines: 3 },              // clavada
    { k: 'slash', f: 1300, len: .24, w: .85, tines: 3 },          // barrido de púas
  ],
};
const blowOf = (wid, blow) => (BLOW[wid] || BLOW.daga)[Math.max(0, Math.min(2, (blow || 1) - 1))];
export function swing(wid, blow, pan) {
  if (!ready()) return;
  const B = blowOf(wid, blow), h = blow === 3 ? 1.15 : 1, t = ac.currentTime, L = B.len * h * rnd(.92, 1.08), v = Math.min(1, .55 * B.w * h);
  if (B.thrust) noise({ t, a: L * .35, dur: L * .45, vol: v * .8, f: B.f * .7, f2: B.f * 1.4, f3: B.f * .9, q: 1.3, pan});
  else noise({ t, a: L * .5, dur: L * .6, vol: v, f: B.f * .45, f2: B.f * 1.25, f3: B.f * .5, q: 1.1, pan});
  if ((B.w > 1 || blow === 3) && Math.random() < .6) say('effort', 'padre', 1, .28, pan);                      // the priest puts his weight in
  if (B.w > 1) noise({ t, a: L * .5, dur: L * .6, vol: .22 * B.w, brown: 1, type: 'lowpass', f: 250, f2: 600, f3: 250, q: .7, pan});  // heavy air
}
export function hit(wid, blow, kill, pan) {
  if (!ready()) return;
  const B = blowOf(wid, blow), w = B.w * (blow === 3 ? 1.15 : 1), t = ac.currentTime;
  tone({ t, f: 135 * rnd(.92, 1.08), f2: 48, dur: .08 + .07 * w, vol: 1.2 * w, pan});                     // the body takes it
  noise({ t, dur: .06 + .03 * w, vol: 1.2, brown: 1, type: 'lowpass', f: 1500, f2: 350, pan});          // flesh
  if (B.k === 'stab') {
    for (let i = 0; i < (B.tines || 1); i++) noise({ t: t + i * .011, dur: .014, vol: .3, type: 'highpass', f: 2200, pan}); // the point(s) going in
    noise({ t: t + .01, a: .02, dur: .14, vol: 1.3, brown: 1, f: 800, f2: 280, q: 5, pan});           // and the wet pull
  } else if (B.k === 'slash') {
    noise({ t, dur: .05 + .05 * w, vol: .65, f: 3000, f2: 1000, q: 1.6, pan});                         // the edge opening
    noise({ t: t + .015, dur: .1, vol: .8, brown: 1, f: 520, f2: 260, q: 4, pan});
  } else if (B.k === 'chop') {
    noise({ t, dur: .045, vol: 1.1, brown: 1, f: 650, q: 7, pan});                                       // a deep "thock"
    crunch(t + .008, pan, 3);
  } else {                                                                                                         // blunt, ram
    tone({ t, f: 95, f2: 34, dur: .18 + .05 * w, vol: 1.2, pan});
    crunch(t + .01, pan, B.k === 'ram' ? 2 : 4);
    for (const [f, g] of [[310, 1], [847, .5], [1420, .3]]) tone({ t, f: f * rnd(.98, 1.02), dur: .3, vol: .07 * g, w: 'triangle', lp: 2200, pan}); // dull clang of the bronze
  }
  if (kill) {
    crunch(t + .03, pan, 4);
    for (let i = 0; i < 3; i++) noise({ t: t + .05 + i * .05 + rnd(0, .03), dur: rnd(.07, .12), vol: .4, brown: 1, f: rnd(300, 600), q: 3, pan});
    tone({ t: t + .45, f: 90, f2: 40, dur: .2, vol: .45, pan});                                       // drops to the floor
    noise({ t: t + .45, dur: .15, vol: .4, brown: 1, type: 'lowpass', f: 600, pan});
  }
}
// Bone: a few short, dry cracks, not hiss.
function crunch(t, pan, n) { for (let i = 0; i < n; i++) noise({ t: t + i * .014 + rnd(0, .008), dur: .02, vol: .4, brown: 1, f: rnd(1100, 2200), q: 3, pan}); }
export function equip(wid) {
  if (!ready()) return;
  // Pulled from under the cassock: one soft, low swish of cloth, then the grip lands in the hand. No hiss, no clicks.
  const t = ac.currentTime, heavy = wid === 'hacha' || wid === 'candelabro' || wid === 'horca', L = heavy ? .22 : .16;
  noise({ t, a: L * .6, dur: L * .6, vol: .3, type: 'lowpass', f: 450, f2: heavy ? 1200 : 1600, q: .5});
  if (!wid) return;
  const g = t + L * .9;
  tone({ t: g, f: heavy ? 120 : 170, f2: heavy ? 60 : 90, dur: .07, vol: heavy ? .3 : .22});
  noise({ t: g, dur: .03, vol: .15, type: 'lowpass', f: 700});
}

// ---------------------------------------------------------------- the priest
export function hurt(pan, dmg = 10) {
  if (!ready()) return;
  const t = ac.currentTime;
  const kind = dmg >= 15 ? pickNew('padre', ['scream', 'broken']) : dmg >= 9 ? pickNew('padre', ['yelp', 'grunt', 'yelp']) : pickNew('padre', ['grunt', 'grunt', 'yelp']);
  say(kind, 'padre', Math.min(1.5, dmg / 14), .5, pan);
  if (dmg >= 13 && Math.random() < .55) say('groan', 'padre', 1, .3, pan, kind === 'broken' ? 1 : .6);   // and it keeps hurting
  tone({ t, f: 120, f2: 45, dur: .15, vol: .9, pan });
  noise({ t, dur: .09, vol: .6, brown: 1, type: 'lowpass', f: 1500, f2: 300, pan });
}
export function die(pan) {
  if (!ready()) return;
  prayOn(false); nextPant = 1e9;
  say('death', 'padre', 1.3, .6, pan);
  tone({ t: ac.currentTime + 1.1, f: 90, f2: 34, dur: .3, vol: .5, pan });
  noise({ t: ac.currentTime + 1.1, dur: .25, vol: .35, brown: 1, type: 'lowpass', f: 500 });
}
// Little to live on: ragged breathing, faster the closer he is.
let nextPant = 0;
export function lowHp(hp, busy) {
  if (!ready()) return;
  const now = ac.currentTime;
  if (hp >= 35 || hp <= 0 || busy) { if (hp >= 35) nextPant = 0; return; }
  if (!nextPant) nextPant = now + .6;
  if (now < nextPant) return;
  say('pant', 'padre', 1, .2 + .12 * (1 - hp / 35), 0);
  nextPant = now + .95 + .75 * hp / 35 + rnd(0, .25);
}
// His cassock: heavy wool that swishes and flaps.
const cloth = (t, d, v, f = 700, f2 = 1300) => noise({ t, a: d * .4, dur: d * .6, vol: v, brown: 1, f, f2, q: .6 });
// One foot on stone: heel, the sole, the toe scuffing off, the hem.
function foot(t, v) {
  tone({ t, f: rnd(70, 85), f2: 45, dur: .05, vol: .22 * v });
  noise({ t, dur: .04, vol: .35 * v, brown: 1, type: 'lowpass', f: rnd(350, 500) });
  noise({ t, dur: .012, vol: .05 * v, f: rnd(2500, 3500), q: 2 });
  noise({ t: t + rnd(.045, .075), a: .01, dur: .05, vol: .16 * v, brown: 1, f: rnd(800, 1100), q: 1.2 });
}
// What he walks on changes the step: hollow boards, a soft runner, crunching gravel, grass, stone.
export function step(run, crouch, floor = 'stone') {
  if (!ready()) return; const t = ac.currentTime, v = (run ? 1.4 : crouch ? .5 : 1) * rnd(.85, 1.1);
  if (floor === 'carpet') { noise({ t, dur: .05, vol: .18 * v, brown: 1, type: 'lowpass', f: 320 }); tone({ t, f: 70, f2: 45, dur: .04, vol: .1 * v }); }
  else if (floor === 'wood') { tone({ t, f: rnd(120, 140), f2: 70, dur: .07, vol: .26 * v }); noise({ t, dur: .05, vol: .25 * v, brown: 1, f: rnd(500, 700), q: 3 }); if (Math.random() < .25) tone({ t: t + .03, f: rnd(380, 520), f2: rnd(300, 360), dur: .09, vol: .03 * v, w: 'triangle' }); }
  else if (floor === 'gravel') { for (let i = 0; i < 5; i++) noise({ t: t + i * .012 + rnd(0, .01), dur: .02, vol: .14 * v, f: rnd(1800, 3800), q: 2 }); noise({ t, dur: .05, vol: .2 * v, brown: 1, type: 'lowpass', f: 600 }); }
  else if (floor === 'grass') { noise({ t, a: .01, dur: .07, vol: .12 * v, f: rnd(1500, 2500), q: .8 }); noise({ t, dur: .04, vol: .12 * v, brown: 1, type: 'lowpass', f: 400 }); }
  else foot(t, v);
  cloth(t, run ? .16 : .12, (run ? .22 : .09) * v);
}
export function jump() {
  if (!ready()) return; const t = ac.currentTime;
  noise({ t, dur: .06, a: .01, vol: .25, brown: 1, f: 900, q: 1.2 });                       // pushing off the floor
  cloth(t + .03, .22, .3, 600, 1600);
  if (Math.random() < .6) say('hup', 'padre', 1, .3, 0);
}
export function land() {
  if (!ready()) return; const t = ac.currentTime;
  foot(t, 1.6); foot(t + rnd(.015, .03), 1.3);                                             // both feet
  tone({ t, f: 100, f2: 40, dur: .12, vol: .55 });
  cloth(t, .18, .28, 900, 500);                                                             // the hem settles
  if (Math.random() < .35) say('grunt', 'padre', .4, .22, 0);
}
export function roll() {
  if (!ready()) return; const t = ac.currentTime;
  if (Math.random() < .7) say('hup', 'padre', 1, .3, 0);
  cloth(t, .45, .35, 500, 1500);
  for (const [dt, f, v] of [[.08, 95, .32], [.2, 80, .36], [.36, 90, .26]]) {                // shoulder, back, feet
    tone({ t: t + dt, f, f2: 42, dur: .09, vol: v });
    noise({ t: t + dt, dur: .07, vol: v * .7, brown: 1, type: 'lowpass', f: 600 });
  }
  noise({ t: t + .4, a: .02, dur: .1, vol: .2, brown: 1, f: 1000, q: 1 });                   // scuffs back up
}
export function breath() { if (!ready() || !gate('breath', .8)) return; say('pant', 'padre', 1, .26, 0); }
// The crucifix raised: he calls out once.
let crossWas = false;
export function crossOn(on) {
  if (on && !crossWas && ready()) say('rally', 'padre', 1, .38, 0);
  crossWas = on;
}
// Praying: a murmur under his breath, one phrase after another while he kneels.
let prayT = 0, praySrc = [];
export function prayOn(on) {
  if (!ac) return;
  if (!on) { if (prayT) { const n = ac.currentTime; for (const g of praySrc) { g.gain.cancelScheduledValues(n); g.gain.setTargetAtTime(0, n, .08); } praySrc = []; prayT = 0; } return; }
  if (!ready()) return;
  const now = ac.currentTime;
  if (prayT && now < prayT - .15) return;
  const t = Math.max(now + .05, prayT || now + .4), key = 'padre|whisper|1', P = pool[key];
  const [[buf]] = P && P.length ? P.shift() : render('whisper', 'padre', 1); want(key);
  const s = ac.createBufferSource(); s.buffer = buf; const g = ac.createGain(); g.gain.value = .3; s.connect(g); out(g, 0); s.start(t);
  praySrc = [...praySrc.slice(-2), g]; prayT = t + buf.duration + rnd(.25, .6);
}

// A heavy door: the latch, the hinges creaking, and the boom of it shutting.
export function door(open, pan) {
  if (!ready()) return; const t = ac.currentTime;
  noise({ t, dur: .03, vol: .35, f: 2600, q: 4, pan }); tone({ t, f: 900, f2: 700, dur: .03, vol: .08, w: 'triangle', pan });
  const d = open ? .6 : .42;
  for (let i = 0; i < 3; i++) { const f = rnd(330, 560); tone({ t: t + .06 + i * d / 3.2, f, f2: f * rnd(.7, 1.35), dur: d / 3, vol: .05, w: 'sawtooth', lp: 1700, pan }); }
  noise({ t: t + .06, a: d * .3, dur: d * .7, vol: .07, f: 1300, q: 6, pan });
  if (!open) { tone({ t: t + .46, f: 88, f2: 38, dur: .2, vol: .8, pan }); noise({ t: t + .46, dur: .16, vol: .5, brown: 1, type: 'lowpass', f: 700, pan }); }
}
export function sizzle(pan) {
  if (!ready() || !gate('sizzle', .12)) return; const t = ac.currentTime;
  noise({ t, a: .02, dur: .3, vol: .3, type: 'highpass', f: 4200, pan});
  for (let i = 0; i < 5; i++) noise({ t: t + rnd(0, .25), dur: .012, vol: .35, f: rnd(2500, 5000), q: 3, pan });
}

// ---------------------------------------------------------------- voices
// Screams, groans and death rattles come from src/voice.js, a throat rendered sample by sample, fresh every time.
// The demons' cries carry a second layer under them: the same cry slowed and darkened, inhuman.
// Rendering a cry costs a few milliseconds (more on a phone), so a few of each are kept ready, rendered in
// spare moments; a cry played is replaced in the background. Intensity is kept in three steps.
const IB = [.4, .9, 1.3], pool = {}, todo = [];
const bucket = I => I < .65 ? 0 : I < 1.1 ? 1 : 2;
function render(kind, who, b) {
  return utter(kind, BEINGS[who], IB[b]).map(([p, gap]) => {
    const d = synth(p, ac.sampleRate), buf = ac.createBuffer(1, d.length, ac.sampleRate); buf.copyToChannel(d, 0); return [buf, gap];
  });
}
function want(key) { if (!todo.includes(key)) todo.push(key); }
function refill() {
  if (ac && todo.length) {
    const key = todo.shift(), [who, kind, b] = key.split('|'), P = pool[key] ||= [];
    if (P.length < 2) { P.push(render(kind, who, +b)); if (P.length < 2) want(key); }
  }
  const idle = window.requestIdleCallback; idle ? idle(refill, { timeout: 250 }) : setTimeout(refill, 60);
}
// Get the cries of someone ready before they are needed.
const KINDS = { padre: ['grunt', 'yelp', 'scream', 'broken', 'death', 'effort', 'hup', 'groan', 'pant', 'rally', 'whisper'] };
const FOE = ['grunt', 'yelp', 'scream', 'choke', 'roar', 'death', 'broken', 'winded', 'inhale', 'whimper'];
const EXTRA = { monja: ['hiss'], cabrio: ['bleat'], flagelante: ['moan'] };
export function warm(who) {
  if (!ac) return;
  for (const kind of KINDS[who] || [...FOE, ...(EXTRA[who] || [])]) for (const b of kind === 'grunt' || kind === 'yelp' ? [0, 1, 2] : [1, 2]) want(who + '|' + kind + '|' + b);
}
function say(kind, who, I, vol, pan, delay = 0) {
  const B = BEINGS[who]; if (!B) return;
  const key = who + '|' + kind + '|' + bucket(I), P = pool[key];
  const parts = P && P.length ? P.shift() : render(kind, who, bucket(I)); want(key);
  let t = ac.currentTime + .01 + delay;
  for (const [buf, gap] of parts) {
    t += gap;
    const s = ac.createBufferSource(); s.buffer = buf; const g = ac.createGain(); g.gain.value = vol * .8; s.connect(g); out(g, pan); s.start(t);
    if (B.demon) {
      const s2 = ac.createBufferSource(); s2.buffer = buf; s2.playbackRate.value = .62;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      const g2 = ac.createGain(); g2.gain.value = vol * .8 * B.demon * 1.3; s2.connect(lp).connect(g2); out(g2, pan); s2.start(t);
    }
    t += buf.duration;
  }
  live++; setTimeout(() => live--, Math.max(0, t - ac.currentTime) * 1000);
}
// Never the same cry twice in a row from the same throat.
const lastSaid = {};
function pickNew(who, list) {
  let k = list[Math.random() * list.length | 0];
  if (k === lastSaid[who] && list.some(x => x !== k)) k = list.find(x => x !== k);
  return lastSaid[who] = k;
}
// How a body answers each kind of blow.
const ANSWER = {
  stab: ['yelp', 'choke', 'yelp', 'choke'],        // pierced: a sharp cry, or a choke on blood
  slash: ['scream', 'yelp', 'scream'],             // cut open: a scream
  chop: ['scream', 'broken'],                      // hacked: a long scream, or one that breaks
  blunt: ['grunt', 'grunt', 'roar'],               // crushed: the air knocked out, or a roar of rage
  ram: ['winded'],                                 // winded: no voice, then a gasp back in
};
export function pain(id, wid, blow, pan, stagger = true) {
  const B = BEINGS[id]; if (!B || !ready()) return;
  if (live > 6 || !gate(id + 'pain', .15)) return;
  const K = blowOf(wid, blow), I = Math.min(1.5, K.w * (blow === 3 ? 1.15 : 1));
  let kind = stagger ? pickNew(id, ANSWER[K.k] || ANSWER.blunt) : pickNew(id, ['grunt', 'yelp', 'grunt']);
  if (id === 'cabrio' && (kind === 'scream' || kind === 'yelp')) kind = 'bleat';
  if (id === 'flagelante' && Math.random() < .25) kind = 'moan';      // he has learnt to welcome the lash
  say(kind, id, stagger ? I : I * .4, stagger ? .42 : .3, pan);
  if (kind === 'winded') say('inhale', id, 1, .3, pan, .4);
  if (id === 'monja' && Math.random() < .35) say('hiss', id, 1, .3, pan, .45);
}
// Their other cries: the roar as they strike, the death, the cowering before the crucifix.
export function cry(id, kind, pan) {
  const B = BEINGS[id]; if (!B || !ready()) return;
  if (kind !== 'death' && (live > 6 || !gate(id + kind, kind === 'cow' ? 1.4 : .35))) return;
  if (kind === 'death') { say('death', id, 1, .5, pan); const t = ac.currentTime + .7; tone({ t, f: 90, f2: 36, dur: .28, vol: .4, pan }); noise({ t, dur: .2, vol: .25, brown: 1, type: 'lowpass', f: 500, pan }); return; }
  if (kind === 'atk') return say(id === 'monja' ? 'hiss' : id === 'cabrio' ? 'bleat' : 'roar', id, .8, .32, pan);
  if (kind === 'cow') return say(B.demon >= .4 || id === 'monja' ? 'hiss' : 'whimper', id, 1, .22, pan);
}
// The swing of one of theirs, by size; the flagellant's whip cracks.
export function eswing(id, scale, pan) {
  if (!ready() || !gate('esw' + id, .08)) return; const t = ac.currentTime, s = scale || 1;
  if (id === 'flagelante') { noise({ t, a: .06, dur: .05, vol: .12, f: 1500, f2: 3500, q: 1, pan }); noise({ t: t + .08, dur: .03, vol: .5, type: 'highpass', f: 2500, pan}); return; }
  noise({ t, a: .07 * s, dur: .1 * s, vol: .55, f: 1500 / s, f2: 2600 / s, q: 1.5, pan});
}
export function fire(pan) {
  if (!ready()) return; const t = ac.currentTime;
  noise({ t, a: .1, dur: .35, vol: .45, type: 'lowpass', f: 300, f2: 2400, q: 2, pan});
  tone({ t, f: 65, f2: 110, dur: .35, vol: .25, pan});
  for (let i = 0; i < 6; i++) noise({ t: t + rnd(.05, .4), dur: .015, vol: .15, f: rnd(2000, 4500), q: 3, pan });
}
export function shatter(pan) {
  if (!ready()) return; const t = ac.currentTime;
  [1870, 2630, 3950, 5100].forEach(f => tone({ t, f: f * rnd(.97, 1.03), dur: .35, vol: .12, pan}));
  noise({ t, dur: .12, vol: .5, type: 'highpass', f: 3000, pan});
}
export function stomp(pan) {
  if (!ready()) return; const t = ac.currentTime;
  tone({ t, f: 72, f2: 26, dur: .6, vol: .7, pan}); noise({ t, dur: .45, vol: .45, type: 'lowpass', f: 300, f2: 90, pan}); crunch(t, pan, 5);
}
export function snort(pan) { if (!ready()) return; const t = ac.currentTime; noise({ t, dur: .1, vol: .7, f: 650, q: 2.5, pan }); noise({ t: t + .15, dur: .14, vol: .8, f: 600, q: 2.5, pan }); }
export function summon(pan, id) {
  if (id) { if (ac) warm(id); else waiting.add(id); }
  if (!ready() || !gate('summon', .25)) return; const t = ac.currentTime;
  noise({ t, a: .35, dur: .25, vol: .14, f: 300, f2: 1800, q: 3, pan});
  tone({ t, f: 49, f2: 41, a: .3, dur: .4, vol: .2, w: 'sawtooth', lp: 220, pan});
}

// For tools/sndtest: render sounds offline to measure them.
export function _offline(c) { testing = true; live = 0; for (const k in last) delete last[k]; build(c); }
