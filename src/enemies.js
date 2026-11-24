// The ten enemies. The demon's conjuring has turned the townsfolk into killers (the possessed, the butcher, the nun,
// the choirboy, the man nailed to his cross); his own come with him (the acolyte, the flagellant, the black bishop,
// the goat, the imp). Each one: a look for fig.js, and idle / walk / atk / hurt / death in all eight facings.
// Attack frame 3 is the hit.
import { P_, mixP, gait } from './priest.js?v=7b25778';
import { hash } from './raster.js?v=7b25778';
import { bakeFig, bakeFigBox } from './fig.js?v=7b25778';

const { sin, cos, abs, max, min, PI } = Math, TAU = PI * 2;
const jit = (i, k, a) => (hash(i * 7 + k * 13, k * 5 + 3) - .5) * 2 * (a || 0);
const lerpA = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// ---------------------------------------------------------------- props
const CLEAVER = [
  [-1.6, 0, 0, 2.6, .9, .85, 'wood'], [1.2, .3, 0, .6, 1.3, .8, 'iron'],
  [6.0, 1.8, 0, 4.6, 3.4, .5, 'steel', null, 1], [6.0, 4.6, 0, 4.4, .8, .45, 'blood', null, 1],
];
const RITUAL = [
  [-1.6, 0, 0, 2.2, .8, .8, 'bone'], [.8, 0, 0, .55, 2.0, .7, 'gold'], [5.2, 0, 0, 4.4, 1.05, .45, 'iron', null, 1], [9.8, 0, 0, 1.2, .6, .4, 'blood', null, 1],
];
const SCOURGE = [[-1.2, 0, 0, 2.6, .75, .75, 'wood']];
for (const [y, z] of [[.9, .5], [-.9, .5], [.6, -.8], [-.6, -.8]]) SCOURGE.push(
  [4.5, y, z, 3.2, .38, .38, 'rope', null, 1], [10.2, y * 1.7, z * 1.7, 3.2, .38, .38, 'rope', null, 1], [13.6, y * 2.1, z * 2.1, .75, .75, .75, 'iron', null, 1]);
const STAFF = [
  [0, 0, 0, 24, .75, .75, 'iron'], [25.6, 0, 0, .7, 3.3, .7, 'iron', null, 1], [28.8, 0, 0, 3.2, .7, .7, 'iron', null, 1], [32.6, 0, 0, 1.2, 1.2, 1.2, 'ember', null, 1],
];

// ---------------------------------------------------------------- shared animation pieces
// st: ph pelvis height, hunch, hp head pitch, roll head tilt, jerk (possessed twitching), stride, lift, stance,
// armsFwd (held out in front while walking), limp, mod(P, anim, i) for what every pose carries (weapons, the cross).
const stance = (st, L, drop) => ({ pel: [1.5 * L, 0, (st.ph ?? 29.8) - 1.8 * L - (drop || 0)],
  footL: lerpA([1.5, .45, 2.6, 0], [6.5, .5, 2.6, 0], L), footR: lerpA([-1.8, .35, 2.6, 0], [-5.5, .35, 2.6, .45], L), drag: 2.2 * L - .5, flare: .6 + L });
// One keyframe of a blow: o = { lunge, drop, lean, twist, head, jaw, ...anything else for the pose }.
const K = (st, o) => {
  const { lunge = 0, drop = 0, lean = st.hunch, twist = 0, head, jaw, ...x } = o;
  return Object.assign(P_({ ...stance(st, lunge, drop), lean, twist, head: head || [st.hp - lean * .4, -twist * .5, st.roll || 0], jaw: jaw ?? st.jaw ?? 0 }), x);
};
// Right-hand weapon keys: h, d per frame, with a smear on frames 3 and 4.
const nrm3 = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const armed = (parts, keys, extra = {}) => {
  const a = nrm3(keys[2].d), b = nrm3(keys[4].d), sw = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const edge = d => { const n = nrm3(d), t = sw[0] * n[0] + sw[1] * n[1] + sw[2] * n[2], v = [sw[0] - n[0] * t, sw[1] - n[1] * t, sw[2] - n[2] * t]; return Math.hypot(...v) > .25 ? v : [0, 0, -1]; };
  return keys.map((k, i) => ({ ...k.o, armIK: { [-1]: k.h, [1]: extra.left ? extra.left(k.h, k.d, i) : null },
    weapon: { parts, d: k.d, e: k.e || edge(k.d), from: i === 3 || i === 4 ? { h: keys[i - 1].h, d: keys[i - 1].d } : null } }));
};

function human(st) {
  const ph = st.ph ?? 30, mod = (P, a, i) => st.mod ? st.mod(P, a, i) || P : P;
  return {
    idle: { n: 4, fps: st.idleFps || 4, loop: true, pose: i => {
      const b = sin(i / 4 * TAU);
      return mod(P_({ pel: [0, 0, ph - .25 * (1 + b)], lean: st.hunch + .03 * b, head: [st.hp + jit(i, 1, st.jerk), jit(i, 2, st.jerk), (st.roll || 0) + jit(i, 3, st.jerk)],
        armL: st.armL || [.1, .12, .2], armR: st.armR || [.1, .12, .2], footL: [1, .5, 2.6, 0], footR: [-.8, .4, 2.6, 0], jaw: st.jaw || 0, drag: .3 * b, tailPh: i * 1.5, flap: .3 + .1 * b }), 'idle', i);
    } },
    walk: { n: 8, loop: true, stride: st.stride, stance: st.stance || .5, pose: i => {
      const p = i / 8, P = P_({ pel: [st.fwd ?? .3, 0, ph - .8 + .9 * (1 - abs(cos(TAU * p)))], lean: st.hunch + .03, twist: .08 * cos(TAU * p),
        head: [st.hp + jit(i, 4, st.jerk), jit(i, 5, st.jerk), (st.roll || 0) + jit(i, 6, st.jerk)], drag: 1.3, flare: .4, jaw: st.jaw || 0, tailPh: i * .8, flap: .3 });
      gait(P, p, st.stride, st.lift || 3.4, st.stance || .5);
      if (st.limp) { P.footR[2] = 2.6 + (P.footR[2] - 2.6) * .3; P.tilt = .1 * sin(TAU * p); }
      if (st.armsFwd) { const a = st.armsFwd; P.armL = [a[0] - .15 * cos(TAU * p), a[1], a[2]]; P.armR = [a[0] + .15 * cos(TAU * p), a[1], a[2]]; }
      else { P.armL = [.05 - .42 * cos(TAU * p), .1, .22]; P.armR = [.05 + .42 * cos(TAU * p), .1, .22]; }
      return mod(P, 'walk', i);
    } },
    hurt: { n: 3, fps: 10, pose: i => {
      const k = [1, .75, .3][i];
      return mod(P_({ pel: [-1.5 * k, 0, ph - .5 * k], lean: st.hunch * (1 - k) - .4 * k, head: [-.5 * k, .2 * k, (st.roll || 0) + .2 * k], armL: [.5 * k + .1, .8 * k, .4 * k], armR: [.4 * k + .1, .85 * k, .3 * k],
        footR: [-4 * k, .3, 2.6, 0], drag: -2 * k, jaw: .6 * k, flap: .8 * k }), 'hurt', i);
    } },
    death: { n: 8, fps: 9, pose: i => {
      const flat = { pel: [0, 0, 30], footL: [1.5, .5, 2.6, -.4], footR: [.3, .3, 2.6, -.3], pivot: [0, 0, 0], lean: -.1 };
      const F = [
        { pel: [-1.5, 0, ph - .5], lean: -.45, head: [-.55, .2, .2], armL: [.6, .85, .4], armR: [.5, .9, .3], footR: [-4, .3, 2.6, 0], jaw: .8, flap: .9 },
        { pel: [-1, 0, 24], lean: -.3, head: [-.6, .3, .3], armL: [1.2, .9, .3], armR: [1.0, 1.0, .3], footL: [3, .4, 2.6, -.2], footR: [1, .4, 2.6, -.2], jaw: 1, flap: .7 },
        { ...flat, tumble: -.4, ground: true, head: [-.4, .3, .2], armL: [1.3, .9, .3], armR: [1.2, 1.0, .3], slide: -6, jaw: 1, flap: .6 },
        { ...flat, tumble: -.85, ground: true, head: [-.3, .3, .2], armL: [1.6, .9, .3], armR: [1.4, 1.0, .3], slide: -13, jaw: 1, flap: .4 },
        { ...flat, tumble: -1.3, ground: true, head: [-.2, .4, .3], armL: [2.1, .8, .3], armR: [1.8, 1.0, .3], slide: -20, jaw: .9, flap: .2 },
        { ...flat, tumble: -1.58, ground: true, head: [-.1, .7, .4], armL: [2.6, .7, .3], armR: [2.0, 1.1, .3], slide: -24, jaw: .8, flap: .05 },
        { ...flat, tumble: -1.52, ground: true, head: [0, .9, .5], armL: [2.7, .7, .25], armR: [2.1, 1.2, .25], slide: -24, jaw: .9, flap: 0 },
        { ...flat, tumble: -1.56, ground: true, head: [0, 1.0, .5], armL: [2.75, .7, .2], armR: [2.1, 1.25, .2], slide: -24, jaw: 1, flap: 0 },
      ][i];
      return mod(P_(F), 'death', i);
    } },
  };
}

// ---------------------------------------------------------------- the ten
export const ENEMIES = {};

// 1. El poseído: a neighbour, any neighbour. Black eyes weeping blood, head lolling, jerking like something else is
// working his strings.
{
  const st = { ph: 29.6, hunch: .3, hp: .25, roll: .38, jerk: .2, stride: 8, lift: 3, armsFwd: [.55, .18, .5], jaw: .35 };
  const A = human(st);
  A.atk = { n: 6, fps: 11, pose: i => K(st, [
    { lean: .3, armL: [1.4, .4, 1.6], armR: [1.4, .4, 1.6], jaw: .6 },
    { lean: -.12, armL: [2.6, .45, .9], armR: [2.55, .5, .9], head: [-.35, .1, .5], jaw: 1 },
    { lean: -.18, armL: [2.75, .5, .8], armR: [2.7, .55, .8], head: [-.4, .1, .55], jaw: 1 },
    { lunge: 1, lean: .75, armL: [1.6, .15, .3], armR: [1.55, .2, .3], head: [.1, 0, .2], jaw: 1 },
    { lunge: 1, drop: 1.5, lean: .85, armL: [.7, .25, .2], armR: [.75, .25, .2], head: [.4, 0, .1], jaw: .3 },
    { lunge: .3, lean: .45, armL: [.8, .2, .6], armR: [.8, .2, .6], jaw: .5 },
  ][i]) };
  A.atk2 = { n: 6, fps: 12, pose: i => K(st, [ // wild swipes, right then left
    { lean: .3, twist: -.4, armR: [1.2, .9, .6], armL: [.4, .2, .5], jaw: .6 },
    { lean: .25, twist: -.55, armR: [1.6, 1.2, .5], armL: [.4, .2, .5], jaw: 1 },
    { lunge: .6, lean: .5, twist: .4, armR: [1.5, -.4, .3], armL: [1.4, 1.0, .5], jaw: 1 },
    { lunge: .8, lean: .55, twist: -.3, armL: [1.5, -.3, .3], armR: [.8, -.3, .4], jaw: 1 },
    { lunge: .8, lean: .55, twist: -.5, armL: [1.3, -.7, .3], armR: [.6, .3, .4], jaw: .6 },
    { lunge: .3, lean: .4, armL: [.6, .2, .5], armR: [.6, .2, .5], jaw: .4 },
  ][i]) };
  A.atk3 = { n: 6, fps: 10, pose: i => K(st, [ // grabs you and bites
    { lean: .3, armL: [1.3, .5, .4], armR: [1.3, .5, .4], jaw: .5 },
    { lunge: .5, lean: .45, armL: [1.6, .25, .15], armR: [1.6, .25, .15], jaw: .8 },
    { lunge: .7, lean: .2, armL: [1.4, .05, .9], armR: [1.4, .05, .9], head: [-.5, 0, .1], jaw: 1 },
    { lunge: 1, lean: .8, armL: [1.3, .05, 1.1], armR: [1.3, .05, 1.1], head: [.6, 0, 0], jaw: 1 },
    { lunge: 1, lean: .7, armL: [1.1, .1, .9], armR: [1.1, .1, .9], head: [.4, 0, .2], jaw: .4 },
    { lunge: .3, lean: .4, armL: [.6, .2, .5], armR: [.6, .2, .5] },
  ][i]) };
  ENEMIES.poseido = { name: 'Poseído', speed: 34, hp: 3, range: 14, combos: [['atk2', 'atk'], ['atk', 'atk3'], ['atk2'], ['atk2', 'atk', 'atk3']],
    look: { skin: 'flesh', top: 'linen', stains: .25, pants: 'trousers', feet: 'boot', hair: 'wild', hairKey: 'darkhair', eyes: 'void', tears: 1, mouthBlood: 1, stubble: 1, veins: 1 }, anims: A };
}

// 2. El carnicero: huge, slow, the apron black with it, the cleaver he never put down.
{
  const st = { ph: 29.8, hunch: .14, hp: .12, roll: .1, jerk: .05, stride: 6.5, lift: 2.6, armR: [.15, .14, .5],
    mod: (P, a) => { if (!P.weapon) P.weapon = { parts: CLEAVER, e: [1, 0, 0] }; } };
  const A = human(st);
  const keys = armed(CLEAVER, [
    { h: [4, -8, 3], d: [.6, -.1, -.8], o: { lean: .15, armL: [.6, .3, .8] } },
    { h: [1, -6, 24], d: [-.5, 0, .85], o: { lean: -.1, twist: -.25, armL: [1.2, .3, .6] } },
    { h: [0, -6, 25], d: [-.75, 0, .6], o: { lean: -.15, twist: -.3, armL: [1.5, .2, .3] } },
    { h: [12, -3, 16], d: [1, 0, .05], o: { lunge: 1, lean: .4, armL: [.9, .3, .5] } },
    { h: [12, -3, 4], d: [.4, 0, -1], o: { lunge: 1, drop: 3, lean: .6, armL: [.6, .3, .6] } },
    { h: [6, -6, 4], d: [.6, 0, -.8], o: { lunge: .3, lean: .3, armL: [.4, .2, .5] } },
  ].map(k => ({ ...k, e: [1, 0, 0] })));
  A.atk = { n: 6, fps: 9, pose: i => K(st, keys[i]) };
  const keys2 = armed(CLEAVER, [ // across, from his right
    { h: [3, -8, 4], d: [.6, -.1, -.8], o: { lean: .15, armL: [.6, .3, .8] } },
    { h: [1, -13, 13], d: [-.6, -.7, .1], o: { twist: -.6, armL: [.8, .5, .6] } },
    { h: [0, -13.5, 14], d: [-.75, -.6, .2], o: { twist: -.72, armL: [.9, .5, .5] } },
    { h: [14, -2, 14], d: [.8, .55, 0], o: { lunge: .8, twist: .1, lean: .25, armL: [.5, .4, .6] } },
    { h: [8, 9, 13], d: [-.1, 1, -.1], o: { lunge: .8, twist: .62, lean: .2, armL: [.4, .4, .6] } },
    { h: [5, 0, 8], d: [.5, .3, -.8], o: { twist: .2, armL: [.5, .3, .7] } },
  ]);
  A.atk2 = { n: 6, fps: 9, pose: i => K(st, keys2[i]) };
  const keys3 = armed(CLEAVER, [ // the left fist, all his weight behind it
    { h: [3, -8, 4], d: [.6, -.1, -.8], o: { lean: .15, armL: [.4, .3, .9] } },
    { h: [1, -8, 6], d: [.5, -.2, -.8], o: { lean: -.05, twist: .35, armL: [.2, .4, 1.8] } },
    { h: [1, -8, 6], d: [.5, -.2, -.8], o: { lean: -.08, twist: .45, armL: [.1, .45, 2.0] } },
    { h: [3, -8, 5], d: [.6, -.1, -.8], o: { lunge: 1, lean: .45, twist: -.35, armL: [1.55, -.05, .05] } },
    { h: [3, -8, 5], d: [.6, -.1, -.8], o: { lunge: 1, lean: .45, twist: -.4, armL: [1.5, 0, .1] } },
    { h: [3, -8, 4], d: [.6, -.1, -.8], o: { lunge: .3, lean: .2, armL: [.6, .3, .8] } },
  ].map(k => ({ ...k, e: [1, 0, 0] })));
  A.atk3 = { n: 6, fps: 10, pose: i => { const P = K(st, keys3[i]); P.weapon.from = null; return P; } };
  ENEMIES.carnicero = { name: 'Carnicero', speed: 26, hp: 6, range: 18, combos: [['atk2', 'atk'], ['atk3', 'atk'], ['atk'], ['atk2', 'atk3']],
    look: { scale: 1.12, bw: 1.25, belly: 1.6, skin: 'skin', top: 'linen', stains: .2, sleeve: 'linen', forearm: 'skin', pants: 'trousers', feet: 'boot', hair: 'bald',
      stubble: 1, eyes: 'void', mouthBlood: 1, apron: 1, legW: 1.15, armW: 1.2 }, anims: A };
}

// 3. La monja reptante: on all fours under the habit, face turned up at you, quicker than she should be.
{
  const crawl = (p, b = 0) => {
    const hand = ph => [10 + 3.2 * cos(TAU * ph), 0, 1.8 + max(0, sin(TAU * ph)) * 2.6];
    const hl = hand(p), hr = hand(p + .5);
    return P_({ pel: [0, 0, 14.6 + .4 * sin(2 * TAU * p) + b], lean: 1.3, head: [-1.2, .25 * sin(TAU * p), .5], jaw: .45,
      footL: [-12 + 1.4 * cos(TAU * (p + .5)), .9, 2.2, 1.35], footR: [-12 + 1.4 * cos(TAU * p), .9, 2.2, 1.35],
      armIK: { 1: [hl[0], 5.5, hl[2]], [-1]: [hr[0], -5.5, hr[2]] }, armIKbody: true, flare: 1.2, flareFwd: .5 });
  };
  const A = {
    idle: { n: 4, fps: 4, loop: true, pose: i => { const P = crawl(0, .3 * sin(i / 4 * TAU)); P.head = [-1.15 + jit(i, 1, .15), jit(i, 2, .3), .5 + jit(i, 3, .3)]; return P; } },
    walk: { n: 8, loop: true, stride: 3.2, stance: .5, pose: i => crawl(i / 8) },
    atk: { n: 6, fps: 10, pose: i => [
      crawl(0),
      P_({ pel: [-1, 0, 17], lean: .25, head: [-.25, .3, .45], jaw: 1, footL: [-12, .9, 2.2, 1.35], footR: [-12, .9, 2.2, 1.35], armL: [2.5, .5, .8], armR: [2.45, .55, .8], flare: 1.2 }),
      P_({ pel: [-1.5, 0, 17.5], lean: .1, head: [-.35, .3, .5], jaw: 1, footL: [-12, .9, 2.2, 1.35], footR: [-12, .9, 2.2, 1.35], armL: [2.8, .55, .7], armR: [2.75, .6, .7], flare: 1.2 }),
      P_({ pel: [5, 0, 15], lean: 1.2, head: [-1.0, 0, .2], jaw: 1, footL: [-9, .9, 2.2, 1.2], footR: [-9, .9, 2.2, 1.2], armIK: { 1: [25, 4, 6], [-1]: [25, -4, 6] }, armIKbody: true, flare: 1.5 }),
      P_({ pel: [6, 0, 14], lean: 1.35, head: [-.9, 0, .1], jaw: .5, footL: [-8, .9, 2.2, 1.2], footR: [-8, .9, 2.2, 1.2], armIK: { 1: [23, 4, 2], [-1]: [23, -4, 2] }, armIKbody: true, flare: 1.5 }),
      crawl(.25),
    ][i] },
    hurt: { n: 3, fps: 10, pose: i => { const P = crawl(0); const k = [1, .7, .3][i]; P.lean = 1.3 - .6 * k; P.pel[2] += 2 * k; P.head = [-1.2 + .5 * k, .4 * k, .5 + .3 * k]; P.jaw = 1; return P; } },
    death: { n: 8, fps: 9, pose: i => {
      const k = min(1, i / 4), P = crawl(0);
      P.lean = 1.3 + .25 * k; P.pel = [0, 0, 14.6 - 7 * k]; P.head = [-1.2 + 1.3 * k, .9 * k, .5 + .3 * k]; P.jaw = 1;
      P.armIK = { 1: [10 + 4 * k, 8 + 5 * k, 1.5], [-1]: [12 + 2 * k, -7 - 6 * k, 1.5] };
      if (i === 0) { P.lean = .8; P.pel[2] = 17; P.head = [-.4, .3, .8]; }
      if (i >= 2) P.ground = true;
      return P;
    } },
  };
  A.atk2 = { n: 6, fps: 11, pose: i => { // a claw thrown sideways from all fours
    const P = crawl(i === 5 ? .25 : 0);
    if (i >= 1 && i <= 4) { P.jaw = 1; P.head = [-1.1, .2, .3]; }
    if (i === 1) { P.lean = 1.0; P.pel[2] += 1.5; P.armIK[-1] = [12, -13, 10]; }
    if (i === 2) { P.lean = .95; P.pel[2] += 2; P.armIK[-1] = [10, -15, 14]; }
    if (i === 3) { P.lean = 1.2; P.pel[0] = 3; P.armIK[-1] = [21, 4, 5]; }
    if (i === 4) { P.lean = 1.2; P.pel[0] = 3; P.armIK[-1] = [16, 10, 3]; }
    return P;
  } };
  A.atk3 = { n: 6, fps: 9, pose: i => { // rears up screaming, then throws herself on you
    const kn = { footL: [-12, .9, 2.2, 1.35], footR: [-12, .9, 2.2, 1.35], flare: 1.2 };
    return [crawl(0),
      P_({ pel: [-1, 0, 17], lean: .1, head: [-.5, 0, .6], jaw: 1, armL: [1.2, 1.3, .4], armR: [1.2, 1.3, .4], ...kn }),
      P_({ pel: [-1.5, 0, 17.5], lean: 0, head: [-.75, 0, .7], jaw: 1, armL: [1.5, 1.5, .3], armR: [1.5, 1.5, .3], ...kn }),
      P_({ pel: [6, 0, 15], lean: 1.1, head: [-.6, 0, .1], jaw: 1, armL: [1.6, .6, .2], armR: [1.6, .6, .2], ...kn, footL: [-9, .9, 2.2, 1.2], footR: [-9, .9, 2.2, 1.2] }),
      P_({ pel: [7, 0, 14], lean: 1.2, head: [-.5, 0, .1], jaw: .5, armL: [1.4, .1, .6], armR: [1.4, .1, .6], ...kn, footL: [-8, .9, 2.2, 1.2], footR: [-8, .9, 2.2, 1.2] }),
      crawl(.25)][i];
  } };
  ENEMIES.monja = { name: 'Monja reptante', speed: 42, hp: 3, range: 20, combos: [['atk2', 'atk2'], ['atk3'], ['atk2', 'atk'], ['atk']],
    look: { skin: 'flesh', top: 'habit', robe: { key: 'habit', len: .9, torn: 1, mud: 1 }, sleeve: 'habit', cuff: 1, gear: 'veil', gearKey: 'habit',
      eyes: 'ember', tears: 1, mouthBlood: 1, feet: 'bare', invcross: 'silver' }, anims: A };
}

// 4. El acólito: the demon's congregation, hooded in crimson, a pentagram on the breast, a sacrificial knife in both
// hands held low before him as if in procession.
{
  const carry = { h: [7.5, -1, 3], d: [.15, 0, -1] };
  const left = (h) => [h[0] - .5, h[1] + 2.2, h[2] + .6];
  const st = { ph: 30, hunch: .08, hp: .2, roll: 0, jerk: .04, stride: 6, lift: 3,
    mod: (P, a) => { if (!P.weapon) { P.weapon = { parts: RITUAL, d: carry.d, e: [1, 0, 0] }; if (a === 'idle' || a === 'walk') P.armIK = { [-1]: carry.h, 1: left(carry.h) }; } } };
  const A = human(st);
  const keys = armed(RITUAL, [
    { ...carry, o: { lean: .08 } },
    { h: [3, -1, 23], d: [.6, 0, -.3], o: { lean: -.12, head: [-.1, 0, 0] } },
    { h: [2, -1, 24.5], d: [.65, 0, -.25], o: { lean: -.2, head: [-.15, 0, 0] } },
    { h: [12, -1, 14], d: [.5, 0, -.9], o: { lunge: .9, lean: .45 } },
    { h: [13, -1, 5], d: [.3, 0, -1], o: { lunge: 1, drop: 3, lean: .62 } },
    { h: [8, -1, 4], d: [.2, 0, -1], o: { lunge: .4, lean: .25 } },
  ].map(k => ({ ...k, e: [1, 0, 0] })), { left: (h) => left(h) });
  A.atk = { n: 6, fps: 10, pose: i => K(st, keys[i]) };
  const keys2 = armed(RITUAL, [ // one-handed, a slash across the throat
    { ...carry, o: {} },
    { h: [1, -11, 12], d: [-.5, -.8, 0], o: { twist: -.55, armL: [.5, .3, .8] } },
    { h: [0, -11.5, 12.5], d: [-.6, -.75, .1], o: { twist: -.65, armL: [.5, .3, .8] } },
    { h: [13, -1, 12], d: [.85, .5, 0], o: { lunge: .8, twist: .1, lean: .25, armL: [.5, .3, .8] } },
    { h: [7, 9, 11], d: [0, 1, 0], o: { lunge: .8, twist: .6, lean: .2, armL: [.5, .3, .8] } },
    { ...carry, o: { twist: .1 } },
  ], { left: (h, d, i) => i === 0 || i === 5 ? left(h) : null });
  A.atk2 = { n: 6, fps: 11, pose: i => K(st, keys2[i]) };
  const keys3 = armed(RITUAL, [ // two quick thrusts, both hands on the hilt
    { ...carry, o: {} },
    { h: [13, -2, 12], d: [1, 0, 0], o: { lunge: .5, lean: .3 } },
    { h: [3, -3, 11], d: [.95, 0, .1], o: { lunge: .4, lean: .05 } },
    { h: [15, -2, 12], d: [1, 0, -.05], o: { lunge: 1, lean: .45 } },
    { h: [15, -2, 12], d: [1, 0, -.05], o: { lunge: 1, lean: .45 } },
    { ...carry, o: {} },
  ].map(k => ({ ...k, e: [0, 0, -1] })), { left: (h) => left(h) });
  A.atk3 = { n: 6, fps: 12, pose: i => K(st, keys3[i]) };
  ENEMIES.acolito = { name: 'Acólito', speed: 30, hp: 3, range: 16, combos: [['atk3'], ['atk2', 'atk'], ['atk3', 'atk2'], ['atk']],
    look: { skin: 'skin', top: 'crimson', robe: { key: 'crimson', len: .9, mud: 1 }, sleeve: 'crimson', cuff: 1, gear: 'hood', gearKey: 'crimson', eyes: 'ember',
      belt: 'rope', pentagram: 'gold', feet: 'bare' }, anims: A };
}

// 5. El flagelante: capirote, bare back torn open by his own scourge. Standing still he whips himself.
{
  const st = { ph: 30, hunch: .12, hp: .08, roll: .05, jerk: .04, stride: 5.5, lift: 2.4, armR: [.2, .2, .3],
    mod: (P) => { if (!P.weapon) P.weapon = { parts: SCOURGE, e: [0, 0, 1] }; } };
  const A = human(st);
  A.idle = { n: 6, fps: 7, loop: true, pose: i => {
    const R = [[.2, .2, .3], [1.6, -.1, 1.0], [2.6, -.35, 1.3], [2.9, -.55, 1.9], [2.4, -.4, 1.6], [1.0, 0, .8]][i];
    return P_({ pel: [0, 0, 29.7], lean: .18 + (i === 3 ? .1 : 0), head: [.12 + (i === 3 ? .12 : 0), 0, .05], armR: R, armL: [.5, .2, 1.4], footL: [1, .5, 2.6, 0], footR: [-.8, .4, 2.6, 0],
      weapon: { parts: SCOURGE, e: [0, 0, 1] } });
  } };
  const keys = armed(SCOURGE, [
    { h: [3, -7, 2], d: [.3, -.2, -1], o: { lean: .2 } },
    { h: [-2, -7, 22], d: [-.6, -.2, .7], o: { lean: -.12, twist: -.2 } },
    { h: [-3, -7, 23], d: [-.8, -.1, .5], o: { lean: -.18, twist: -.25 } },
    { h: [12, -3, 16], d: [1, 0, -.1], o: { lunge: 1, lean: .35 } },
    { h: [12, -3, 8], d: [.6, 0, -.8], o: { lunge: 1, drop: 1.5, lean: .5 } },
    { h: [5, -6, 4], d: [.3, -.2, -1], o: { lunge: .3, lean: .3 } },
  ].map(k => ({ ...k, e: [0, 0, 1] })));
  A.atk = { n: 6, fps: 11, pose: i => K(st, keys[i]) };
  const keys2 = armed(SCOURGE, [ // a flat lash across
    { h: [3, -7, 2], d: [.3, -.2, -1], o: { lean: .2 } },
    { h: [0, -12, 13], d: [-.5, -.85, .1], o: { twist: -.6 } },
    { h: [-1, -12.5, 13], d: [-.6, -.8, .15], o: { twist: -.7 } },
    { h: [13, -1, 13], d: [.85, .5, 0], o: { lunge: .8, twist: .15, lean: .25 } },
    { h: [6, 9, 12], d: [-.1, 1, -.1], o: { lunge: .8, twist: .6, lean: .2 } },
    { h: [4, -3, 4], d: [.3, 0, -1], o: { twist: .15 } },
  ].map(k => ({ ...k, e: [0, 0, 1] })));
  A.atk2 = { n: 6, fps: 11, pose: i => K(st, keys2[i]) };
  const keys3 = armed(SCOURGE, [ // from the ground up
    { h: [3, -7, 2], d: [.3, -.2, -1], o: { lean: .2 } },
    { h: [-2, -8, 0], d: [-.4, -.2, -1], o: { lean: .3, drop: 2 } },
    { h: [-3, -8, -1], d: [-.5, -.1, -1], o: { lean: .35, drop: 2.5 } },
    { h: [12, -3, 12], d: [.9, 0, .4], o: { lunge: .8, lean: .1 } },
    { h: [6, -5, 22], d: [.2, -.1, 1], o: { lunge: .8, lean: -.15 } },
    { h: [4, -6, 6], d: [.3, -.2, -.8], o: {} },
  ].map(k => ({ ...k, e: [0, 0, 1] })));
  A.atk3 = { n: 6, fps: 11, pose: i => K(st, keys3[i]) };
  ENEMIES.flagelante = { name: 'Flagelante', speed: 28, hp: 4, range: 22, combos: [['atk2', 'atk3'], ['atk'], ['atk2', 'atk'], ['atk3', 'atk2']],
    look: { skin: 'skin', top: 'skin', wounds: 1, sleeve: 'skin', robe: { key: 'cassock', len: .9, torn: 1, blood: .12 }, gear: 'capirote', gearKey: 'hat', feet: 'bare', belt: 'rope' }, anims: A };
}

// 6. El niño del coro: red cassock, white surplice, eyes gone. Stands too still, head on one side. Then leaps.
{
  const st = { ph: 30, hunch: .02, hp: .15, roll: .45, jerk: .14, stride: 7, lift: 3.4, armL: [.02, .06, .05], armR: [.02, .06, .05] };
  const A = human(st);
  A.atk = { n: 6, fps: 11, pose: i => [
    P_({ pel: [-.5, 0, 21.5], lean: .45, head: [-.2, 0, .4], armL: [-.6, .25, .3], armR: [-.6, .25, .3], footL: [2.5, .5, 2.6, 0], footR: [-.5, .5, 2.6, 0], flare: 1 }),
    P_({ pel: [0, 0, 30], rise: 9, lean: .5, head: [-.3, 0, .2], armL: [1.5, .3, .4], armR: [1.5, .3, .4], footL: [3, .4, 10, .4], footR: [0, .4, 8, .5], jaw: 1, lift: 3 }),
    P_({ pel: [0, 0, 30], rise: 14, lean: .7, head: [-.4, 0, .1], armL: [1.65, .2, .2], armR: [1.65, .2, .2], footL: [2, .4, 9, .4], footR: [-1, .4, 7, .5], jaw: 1, lift: 4 }),
    P_({ pel: [1, 0, 30], rise: 7, lean: .95, head: [-.6, 0, 0], armL: [1.75, .1, .15], armR: [1.75, .1, .15], footL: [0, .4, 6, .5], footR: [-3, .4, 5, .5], jaw: 1, lift: 3 }),
    P_({ pel: [-.5, 0, 21], lean: .6, head: [-.4, 0, .2], armL: [.9, .4, .3], armR: [.9, .4, .3], footL: [3, .6, 2.6, 0], footR: [-1.5, .6, 2.6, .2], jaw: .6, flare: 1.4 }),
    P_({ pel: [0, 0, 28], lean: .15, head: [.1, 0, .4], armL: [.1, .1, .1], armR: [.1, .1, .1] }),
  ][i] };
  A.atk2 = { n: 6, fps: 13, pose: i => [ // a flurry of scratches
    P_({ pel: [0, 0, 29], lean: .3, head: [0, 0, .4], armL: [1.4, .4, 1.4], armR: [.9, .4, .7], jaw: .6 }),
    P_({ pel: [1, 0, 28.5], lean: .45, head: [0, 0, .3], armL: [1.5, .2, .4], armR: [1.8, .4, 1.5], jaw: 1, footL: [3, .5, 2.6, 0] }),
    P_({ pel: [1.5, 0, 28.5], lean: .5, head: [0, 0, .3], armL: [1.9, .4, 1.5], armR: [1.5, .2, .4], jaw: 1, footL: [3, .5, 2.6, 0] }),
    P_({ pel: [2, 0, 28], lean: .6, head: [0, 0, .2], armL: [1.5, .15, .3], armR: [1.95, .4, 1.4], jaw: 1, footL: [4, .5, 2.6, 0], footR: [-2, .4, 2.6, .3] }),
    P_({ pel: [1.5, 0, 28.5], lean: .55, head: [0, 0, .3], armL: [1.0, .3, .6], armR: [1.2, .3, .5], jaw: .5, footL: [3, .5, 2.6, 0] }),
    P_({ pel: [0, 0, 29.5], lean: .15, head: [.1, 0, .4], armL: [.1, .1, .1], armR: [.1, .1, .1] }),
  ][i] };
  A.atk3 = { n: 6, fps: 10, pose: i => [ // low, then the teeth
    P_({ pel: [0, 0, 22], lean: .5, head: [-.3, 0, .3], armL: [.3, .3, .4], armR: [.3, .3, .4], footL: [2.5, .6, 2.6, 0], footR: [-1, .6, 2.6, .2], flare: 1 }),
    P_({ pel: [-.5, 0, 20], lean: .62, head: [-.5, 0, .2], armL: [-.3, .3, .4], armR: [-.3, .3, .4], footL: [2.5, .6, 2.6, 0], footR: [-1, .6, 2.6, .3], jaw: .6, flare: 1.2 }),
    P_({ pel: [-.5, 0, 20], lean: .65, head: [-.6, 0, .2], armL: [-.4, .3, .4], armR: [-.4, .3, .4], footL: [2.5, .6, 2.6, 0], footR: [-1, .6, 2.6, .3], jaw: 1, flare: 1.2 }),
    P_({ pel: [5, 0, 22], lean: 1.0, head: [-.8, 0, 0], armL: [-.4, .35, .3], armR: [-.4, .35, .3], footL: [6, .6, 2.6, 0], footR: [-4, .6, 2.6, .5], jaw: 1, flare: 1.5 }),
    P_({ pel: [5, 0, 22], lean: .9, head: [-.6, 0, .1], armL: [.2, .3, .3], armR: [.2, .3, .3], footL: [6, .6, 2.6, 0], footR: [-4, .6, 2.6, .5], jaw: .2, flare: 1.5 }),
    P_({ pel: [0, 0, 28], lean: .15, head: [.1, 0, .4], armL: [.1, .1, .1], armR: [.1, .1, .1] }),
  ][i] };
  ENEMIES.nino = { name: 'Niño del coro', speed: 38, hp: 2, range: 14, leap: 1, combos: [['atk2', 'atk3'], ['atk2'], ['atk3', 'atk2']],
    look: { scale: .66, headS: 1.32, skin: 'flesh', top: 'surplice', robe: { key: 'redcass', len: .9 }, over: { key: 'surplice', len: .5 }, sleeve: 'surplice', cuff: 1,
      hair: 'bowl', hairKey: 'brownhair', eyes: 'void', tears: 1, mouthBlood: 1, feet: 'boot' }, anims: A };
}

// 7. El obispo negro: the demon's own prelate. Mitre with the cross turned over, a staff crowned the same way, and in
// the other hand hellfire he throws from afar.
{
  const staff = (dz = 1) => ({ parts: STAFF, d: [.08, 0, dz], e: [0, 1, 0] });
  const st = { ph: 30, hunch: -.02, hp: .05, roll: 0, jerk: .02, stride: 5.5, lift: 2.6, armR: [.25, .2, 1.05], armL: [.55, .2, 1.4],
    mod: (P, a) => { if (!P.weapon) P.weapon = staff(); if (a === 'walk') { P.armR = [.25, .2, 1.05]; P.armL = [.55, .2, 1.4]; } } };
  const A = human(st);
  A.atk = { n: 6, fps: 8, pose: i => K(st, [
    { armR: [.25, .2, 1.05], armL: [.55, .2, 1.4], weapon: staff() },
    { lean: -.15, armR: [2.1, .25, .4], armL: [-.4, .35, .5], weapon: staff(), glow: .9, head: [-.2, 0, 0] },
    { lean: -.05, armR: [2.2, .25, .35], armL: [1.2, .3, .6], weapon: staff(), glow: 1.6, head: [-.1, 0, 0] },
    { lunge: .5, lean: .2, armR: [1.9, .25, .4], armL: [1.6, .05, .05], weapon: staff(), glow: 2.6 },
    { lunge: .5, lean: .22, armR: [1.7, .25, .5], armL: [1.55, .05, .1], weapon: staff(), glow: 1.2 },
    { lean: .05, armR: [.4, .2, 1.0], armL: [.8, .2, 1.2], weapon: staff() },
  ][i]) };
  const swing = (d) => ({ parts: STAFF, d, e: [0, 1, 0] });
  A.atk2 = { n: 6, fps: 10, pose: i => K(st, [ // the staff, swung like a club when you get too close
    { armR: [.25, .2, 1.05], armL: [.55, .2, 1.4], weapon: staff() },
    { twist: -.6, armR: [1.2, 1.0, .5], armL: [.6, .3, 1.2], weapon: swing([-.3, -.9, .3]) },
    { twist: -.72, armR: [1.3, 1.1, .4], armL: [.6, .3, 1.2], weapon: swing([-.4, -.85, .35]) },
    { lunge: .7, twist: .3, lean: .2, armR: [1.5, .2, .2], armL: [.5, .3, 1.0], weapon: swing([.9, .4, .15]) },
    { lunge: .7, twist: .6, lean: .2, armR: [1.4, -.4, .3], armL: [.5, .3, 1.0], weapon: swing([.3, .95, .1]) },
    { armR: [.4, .2, 1.0], armL: [.8, .2, 1.2], weapon: staff() },
  ][i]) };
  A.atk3 = { n: 6, fps: 7, pose: i => K(st, [ // both arms up: a spray of three
    { armR: [.25, .2, 1.05], armL: [.55, .2, 1.4], weapon: staff() },
    { lean: -.2, armR: [2.3, .3, .3], armL: [2.6, .5, .2], weapon: staff(), glow: 1.2, head: [-.3, 0, 0] },
    { lean: -.25, armR: [2.4, .3, .25], armL: [2.75, .5, .15], weapon: staff(), glow: 2.2, head: [-.35, 0, 0] },
    { lunge: .5, lean: .15, armR: [2.0, .3, .3], armL: [1.6, .6, .1], weapon: staff(), glow: 3 },
    { lunge: .5, lean: .18, armR: [1.8, .3, .4], armL: [1.5, .5, .1], weapon: staff(), glow: 1 },
    { lean: .05, armR: [.4, .2, 1.0], armL: [.8, .2, 1.2], weapon: staff() },
  ][i]) };
  ENEMIES.obispo = { name: 'Obispo negro', speed: 22, hp: 5, range: 16, ranged: true, combos: [['atk2'], ['atk2', 'atk2']],
    look: { scale: 1.1, skin: 'flesh', top: 'cassock', robe: { key: 'cassock', len: .9 }, mantle: 'redcass', chasuble: 'redcass', sleeve: 'cassock', cuff: 1,
      gear: 'mitre', gearKey: 'cassock', eyes: 'ember', hair: 'long', hairKey: 'hair', feet: 'boot' }, anims: A };
}

// 8. El cabrío: goat-headed, ram-horned, hooved, the pentagram burned into his chest still glowing.
{
  const st = { ph: 29.2, hunch: .34, hp: -.1, roll: 0, jerk: .03, stride: 9, lift: 4, armsFwd: [.35, .32, .5], armL: [.3, .3, .5], armR: [.3, .3, .5] };
  const A = human(st);
  A.atk = { n: 6, fps: 9, pose: i => K(st, [
    { lean: .34, armL: [.3, .3, .5], armR: [.3, .3, .5] },
    { drop: 3, lean: .62, head: [.95, 0, 0], armL: [-.4, .45, .4], armR: [-.4, .45, .4] },
    { drop: 3.5, lean: .72, head: [1.05, 0, 0], armL: [-.55, .5, .4], armR: [-.55, .5, .4] },
    { lunge: 1, drop: 2, lean: .82, head: [1.05, 0, 0], armL: [-.2, .5, .5], armR: [-.2, .5, .5] },
    { lunge: 1, lean: .3, twist: .45, head: [.2, -.2, 0], armL: [1.6, .5, .3], armR: [2.3, .4, .3] },
    { lunge: .3, lean: .35, armL: [.5, .3, .5], armR: [.8, .3, .6] },
  ][i]) };
  A.atk2 = { n: 6, fps: 10, pose: i => K(st, [ // both claws, one after the other
    { lean: .34, armL: [.3, .3, .5], armR: [.3, .3, .5] },
    { lean: .3, twist: -.5, armR: [2.0, .8, .6], armL: [.4, .4, .5] },
    { lunge: .6, lean: .5, twist: .4, armR: [1.5, -.3, .3], armL: [1.8, .8, .5] },
    { lunge: .9, lean: .55, twist: -.4, armL: [1.5, -.3, .3], armR: [.8, .3, .4] },
    { lunge: .9, lean: .5, twist: -.5, armL: [1.2, -.6, .3], armR: [.6, .3, .4] },
    { lunge: .3, lean: .35, armL: [.4, .3, .5], armR: [.4, .3, .5] },
  ][i]) };
  A.atk3 = { n: 6, fps: 8, pose: i => K(st, [ // both fists brought down on the ground: it shakes
    { lean: .3, armL: [.3, .3, .5], armR: [.3, .3, .5] },
    { lean: -.2, head: [-.3, 0, 0], armL: [2.9, .3, .6], armR: [2.9, .3, .6], jaw: 1 },
    { lean: -.25, head: [-.35, 0, 0], armL: [3.0, .25, .5], armR: [3.0, .25, .5], jaw: 1 },
    { lunge: .8, drop: 4, lean: .9, head: [.5, 0, 0], armL: [1.3, .15, .1], armR: [1.3, .15, .1], jaw: .5 },
    { lunge: .8, drop: 5, lean: 1.0, head: [.6, 0, 0], armL: [.9, .2, .1], armR: [.9, .2, .1] },
    { lunge: .3, lean: .4, armL: [.4, .3, .5], armR: [.4, .3, .5] },
  ][i]) };
  ENEMIES.cabrio = { name: 'Cabrío', speed: 30, hp: 8, range: 22, combos: [['atk2', 'atk3'], ['atk'], ['atk2', 'atk'], ['atk3']], aoe: ['atk3'],
    look: { scale: 1.3, headKind: 'goat', skin: 'hide', top: 'hide', pants: 'hide', sleeve: 'hide', feet: 'hoof', claws: 1, bw: 1.15, legW: 1.2, armW: 1.25, pentagram: 'ember', tail: .5 }, anims: A };
}

// 9. El crucificado: a man nailed through the hands to a cross he drags behind him. He swings it.
{
  const nail = s => [-2.4, s * 13.0, 16.9];
  const st = { ph: 29.4, hunch: .3, hp: .7, roll: .35, jerk: .08, stride: 4.5, lift: 1.6, limp: 1,
    mod: (P, a) => { P.armIK = { 1: nail(1), [-1]: nail(-1) }; P.armIKbody = false; } };
  const A = human(st);
  A.atk = { n: 6, fps: 8, pose: i => {
    const P = K(st, [
      { lean: .3 }, { lean: .25, twist: -.8, head: [.2, .5, .2] }, { lean: .22, twist: -.95, head: [.1, .6, .2] },
      { lunge: .7, lean: .35, twist: .55, head: [.1, -.3, .2] }, { lunge: .8, lean: .35, twist: 1.0, head: [.2, -.5, .3] }, { lunge: .3, lean: .3, twist: .35 },
    ][i]);
    return st.mod(P) || P;
  } };
  A.death = { n: 8, fps: 8, pose: i => {
    const flat = { pel: [0, 0, 30], footL: [-1.5, .5, 2.6, 1.2], footR: [-.5, .2, 3.4, 1.0], pivot: [0, 0, 0], ground: true, lean: .05, head: [.3, .8, .3] };
    const P = P_([
      { pel: [-1, 0, 28.8], lean: -.2, head: [-.3, .2, .3] },
      { pel: [-1.5, 0, 20.5], lean: .1, head: [.6, .2, .2], footL: [-5, .3, 2.6, .6], footR: [-3.5, .3, 2.6, .5] },
      { pel: [-2, 0, 15.5], lean: .3, head: [.9, .2, .25], footL: [-12, .3, 2, 1.3], footR: [-11.5, .3, 2, 1.3] },
      { ...flat, tumble: .5, slide: 6 }, { ...flat, tumble: 1.0, slide: 14 }, { ...flat, tumble: 1.45, slide: 22 }, { ...flat, tumble: 1.57, slide: 24 }, { ...flat, tumble: 1.55, slide: 24, head: [.3, 1.0, .4] },
    ][i]);
    return st.mod(P) || P;
  } };
  A.atk2 = { n: 6, fps: 8, pose: i => { const P = K(st, [ // the other way round
      { lean: .3 }, { lean: .25, twist: .8, head: [.2, -.5, .2] }, { lean: .22, twist: .95, head: [.1, -.6, .2] },
      { lunge: .7, lean: .35, twist: -.55, head: [.1, .3, .2] }, { lunge: .8, lean: .35, twist: -1.0, head: [.2, .5, .3] }, { lunge: .3, lean: .3, twist: -.35 },
    ][i]); st.mod(P); return P; } };
  A.atk3 = { n: 6, fps: 8, pose: i => { // reared back, then the whole cross brought down in front of him
    const P = K(st, [{ lean: .3 }, { lean: -.3, head: [-.3, 0, .2] }, { lean: -.42, head: [-.4, 0, .2] },
      { lunge: 1, lean: 1.0, head: [.9, 0, .2] }, { lunge: 1, drop: 2, lean: 1.12, head: [1.0, 0, .2] }, { lunge: .3, lean: .5 }][i]);
    st.mod(P); return P;
  } };
  ENEMIES.crucificado = { name: 'Crucificado', speed: 18, hp: 7, range: 22, combos: [['atk', 'atk2'], ['atk3'], ['atk2', 'atk', 'atk3']], aoe: ['atk', 'atk2'],
    look: { skin: 'flesh', top: 'flesh', wounds: 1, sleeve: 'flesh', pants: 'trousers', feet: 'bare', hair: 'long', hairKey: 'darkhair', eyes: 'void', tears: 1, mouthBlood: 1,
      cross: 1, nailed: 1, stubble: 1 }, anims: A };
}

// 10. El diablillo: small, red-black, bat-winged, hopping, all claws and grin.
{
  const st = { ph: 22, hunch: .45, hp: -.35, roll: 0, jerk: .1, stride: 6, lift: 3, armsFwd: [.6, .35, 1.0], armL: [.6, .35, 1.0], armR: [.6, .35, 1.0] };
  const A = human(st);
  const crouchF = { footL: [2, .6, 2.6, 0], footR: [-.5, .6, 2.6, .2] };
  A.idle = { n: 4, fps: 6, loop: true, pose: i => { const b = sin(i / 4 * TAU); return P_({ pel: [0, 0, 21 + .5 * b], lean: .45, head: [-.35, jit(i, 2, .2), jit(i, 3, .15)], armL: [.6, .35, 1.0], armR: [.6, .35, 1.0], ...crouchF, flap: .45 + .45 * b, tailPh: i * 1.6 }); } };
  A.walk = { n: 6, loop: true, stride: 6, stance: .5, hop: true, pose: i => {
    const p = i / 6, k = sin(PI * p);
    return P_({ pel: [0, 0, 20 + 5 * k], rise: 10 * k, lean: .45 - .15 * k, head: [-.35, 0, 0], armL: [.7 + .4 * k, .4, .9], armR: [.7 + .4 * k, .4, .9],
      footL: [1.5 - 2 * k, .6, 2.6 + 2 * k, .4 * k], footR: [-.5 - 2 * k, .6, 2.6 + 2 * k, .4 * k], flap: .5 + .5 * cos(TAU * p), tailPh: i });
  } };
  A.atk = { n: 6, fps: 11, pose: i => [
    P_({ pel: [-.5, 0, 17], lean: .55, head: [-.4, 0, 0], armL: [-.3, .4, .6], armR: [-.3, .4, .6], ...crouchF, flap: 1 }),
    P_({ pel: [0, 0, 24], rise: 10, lean: .55, head: [-.5, 0, 0], armL: [1.6, .3, .3], armR: [1.6, .3, .3], footL: [1, .5, 8, .5], footR: [-1, .5, 7, .5], flap: 0, jaw: 1 }),
    P_({ pel: [0, 0, 24], rise: 15, lean: .6, head: [-.5, 0, 0], armL: [2.2, .4, .3], armR: [2.2, .4, .3], footL: [1, .5, 8, .5], footR: [-1, .5, 7, .5], flap: 1, jaw: 1 }),
    P_({ pel: [1, 0, 24], rise: 7, lean: .85, head: [-.7, 0, 0], armL: [1.2, .2, .2], armR: [1.4, .2, .2], footL: [0, .5, 6, .5], footR: [-2, .5, 5, .5], flap: .2, jaw: 1 }),
    P_({ pel: [0, 0, 17], lean: .7, head: [-.5, 0, 0], armL: [.5, .4, .3], armR: [.5, .4, .3], ...crouchF, flap: .7 }),
    P_({ pel: [0, 0, 21], lean: .45, head: [-.35, 0, 0], armL: [.6, .35, 1.0], armR: [.6, .35, 1.0], ...crouchF, flap: .4 }),
  ][i] };
  const base = (o) => P_({ pel: [0, 0, 21], lean: .45, head: [-.35, 0, 0], armL: [.6, .35, 1.0], armR: [.6, .35, 1.0], ...crouchF, flap: .4, ...o });
  A.atk2 = { n: 6, fps: 12, pose: i => base([ // a slash, standing
    {}, { armR: [2.2, .7, .4], flap: .8, jaw: .6 }, { armR: [2.4, .75, .4], flap: .9, jaw: 1, lean: .35 },
    { armR: [1.3, -.4, .2], armL: [1.8, .6, .4], lean: .7, pel: [2, 0, 21], jaw: 1, flap: .3 }, { armL: [1.3, -.4, .2], armR: [.8, .3, .6], lean: .7, pel: [2, 0, 21], flap: .2 }, {},
  ][i]) };
  A.atk3 = { n: 6, fps: 11, pose: i => base([ // spins: wings and tail
    {}, { twist: -.6, flap: 1, tailPh: 1 }, { twist: -.9, flap: 1, tailPh: 2 },
    { twist: .8, flap: 0, tailPh: 4, lean: .55, jaw: 1 }, { twist: 1.2, flap: .5, tailPh: 5, lean: .5 }, { tailPh: 6 },
  ][i]) };
  ENEMIES.diablillo = { name: 'Diablillo', speed: 44, hp: 2, range: 14, leap: 1, combos: [['atk2', 'atk3'], ['atk2', 'atk2'], ['atk3']], aoe: ['atk3'],
    look: { scale: .62, headKind: 'imp', headS: 1.35, skin: 'imp', top: 'imp', pants: 'imp', sleeve: 'imp', feet: 'claw', claws: 1, wings: 1.1, tail: .9, eyes: 'ember', bw: .9 }, anims: A };
}

// 0. La poseída: a woman from the pews, her shawl still on her head.
{
  const st = { ph: 29.4, hunch: .32, hp: .3, roll: -.4, jerk: .22, stride: 7.5, lift: 3, armsFwd: [.6, .2, .5], jaw: .4 };
  const A = human(st);
  A.atk = ENEMIES.poseido.anims.atk; A.atk2 = ENEMIES.poseido.anims.atk2; A.atk3 = ENEMIES.poseido.anims.atk3;
  ENEMIES.poseida = { name: 'Poseída', speed: 36, hp: 3, range: 14, combos: ENEMIES.poseido.combos,
    look: { skin: 'flesh', top: 'habit', robe: { key: 'habit', len: .95 }, sleeve: 'habit', gear: 'veil', gearKey: 'darkhair', eyes: 'void', tears: 1, mouthBlood: 1, veins: 1, bw: .9 }, anims: A };
}

// ---------------------------------------------------------------- the faithful (the night begins with them at prayer)
// Looks without the possession; each turns into its possessed kind. sit: sitting in a pew, hands joined; stand: up,
// shaking, as the curse takes them.
const SIT = (o = {}) => P_({ pel: [-2.4, 0, 15.5], lean: .16, head: [.3, 0, 0], footL: [6.6, .5, 2.6, 0], footR: [6.4, -.2, 2.6, 0],
  armL: [.35, -.34, 2.0], armR: [.35, -.34, 2.0], flare: 1.2, flareFwd: 1, ...o });
export const FAITHFUL = [
  { into: 'poseido', look: { skin: 'flesh', top: 'linen', pants: 'trousers', feet: 'boot', hair: 'wild', hairKey: 'darkhair', eyes: 'white', stubble: 1 } },
  { into: 'poseida', look: { skin: 'flesh', top: 'habit', robe: { key: 'habit', len: .95 }, sleeve: 'habit', gear: 'veil', gearKey: 'darkhair', eyes: 'white', bw: .9 } },
  { into: 'poseido', look: { skin: 'flesh', top: 'apron', pants: 'trousers', feet: 'boot', hair: 'wild', hairKey: 'brownhair', eyes: 'white' } },
  { into: 'poseida', look: { skin: 'flesh', top: 'redcass', robe: { key: 'redcass', len: .95 }, sleeve: 'redcass', gear: 'veil', gearKey: 'habit', eyes: 'white', bw: .9 } },
];
export const FAITHFUL_ANIMS = {
  sit: { n: 2, fps: 1.5, pose: i => SIT({ head: [.3 + .05 * i, 0, 0] }) },
  look: { n: 1, fps: 1, pose: () => SIT({ head: [-.25, 0, 0], lean: .05 }) },         // looking up at the window
  // terrified: thrown back in the pew, arms up against what they see, shaking
  fear: { n: 2, fps: 9, pose: i => SIT({ lean: -.25 + .04 * i, head: [-.4 + .05 * i, jit(i, 9, .2), jit(i, 8, .2)], armL: [1.7 + .1 * i, .55, 1.5], armR: [1.9 - .1 * i, .5, 1.4], jaw: .7 }) },
  stand: { n: 4, fps: 10, pose: i => P_({ pel: [0, 0, 29.4], lean: .35 + .1 * (i & 1), head: [.4 + jit(i, 1, .3), jit(i, 2, .4), jit(i, 3, .5)],
    armL: [.3 + .4 * (i & 1), .5, .3], armR: [.5 - .3 * (i & 1), .5, .4], footL: [1, .5, 2.6, 0], footR: [-1, .4, 2.6, 0], jaw: .5 + .5 * (i & 1) }) },
};
export const bakeFaithful = (n, anim, f, k, possessed) => bakeFig(FAITHFUL_ANIMS[anim].pose(f), possessed ? { ...FAITHFUL[n].look, eyes: 'void', tears: 1, veins: 1 } : FAITHFUL[n].look, k);

// ---------------------------------------------------------------- the demon who comes through the window
// Tall and thin, ash-grey, long curving horns, torn wings, eyes like coals, a black robe in rags.
export const DEMON = {
  box: [320, 340, 160, 300],                                                          // its sprite: width, height, the feet
  look: { scale: 2.5, headKind: 'imp', headS: 1.12, skin: 'flesh', top: 'habit', robe: { key: 'habit', len: 1, torn: 1 }, sleeve: 'habit', feet: 'claw', claws: 1,
    wings: 1.45, eyes: 'ember', bw: .78, armW: .8, legW: .8, horns: 'small' },
  anims: {
    hover: { n: 4, fps: 5, pose: i => P_({ pel: [0, 0, 30], lean: .05, head: [.05, 0, 0], armL: [.3, .55, .2], armR: [.3, .55, .2], footL: [.5, .4, 1, .6], footR: [-.5, .4, .5, .7],
      flap: .2 + .8 * Math.abs(Math.sin(i / 4 * TAU)), flare: 1.2 }) },
    curse: { n: 4, fps: 6, pose: i => P_({ pel: [0, 0, 30], lean: -.2, head: [-.35, 0, 0], armL: [2.8, .9, .3], armR: [2.8, .9, .3], footL: [1, .4, 2.6, 0], footR: [-1, .4, 2.6, 0],
      flap: .9 + .1 * (i & 1), jaw: .5 + .5 * (i & 1), flare: 1.6 }) },
    stand: { n: 2, fps: 2, pose: i => P_({ pel: [0, 0, 30], lean: .2, head: [.25, 0, 0], armL: [.4, .4, .6], armR: [.4, .4, .6], footL: [2, .4, 2.6, 0], footR: [-2, .4, 2.6, 0], flap: .55 + .05 * i, flare: 1 }) },
    speak: { n: 2, fps: 4, pose: i => P_({ pel: [0, 0, 30], lean: .1, head: [.15, 0, 0], armL: [.6, .4, .8], armR: [1.4, .1, .9], footL: [1, .4, 2.6, 0], footR: [-1, .4, 2.6, 0],
      flap: .4, jaw: i ? .7 : .1, flare: .9 }) },
  },
};
export const bakeDemon = (anim, f, k) => bakeFigBox(DEMON.anims[anim].pose(f), DEMON.look, k, ...DEMON.box);

export const ENEMY_IDS = Object.keys(ENEMIES);
export const ENEMY_ANIMS = ['idle', 'walk', 'atk', 'atk2', 'atk3', 'hurt', 'death'];
export const bakeEnemy = (id, anim, f, k) => bakeFig(ENEMIES[id].anims[anim].pose(f), ENEMIES[id].look, k);
