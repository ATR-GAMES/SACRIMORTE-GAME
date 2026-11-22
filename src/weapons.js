// The priest's melee arms. Each weapon is a few ellipsoids in its own frame (X along the haft from the right hand,
// Y towards the edge, Z the flat), a grip (one hand, or where the left hand takes the haft), a carry pose and three
// blows. Blow keyframes live in the upper-body frame (u forward, l left, w up, origin at the pelvis):
//   h = right hand, d = where the weapon points, plus body: lean, twist (+ turns to his left), lunge 0..1, drop (pelvis).
// Frame 3 is the hit; frames 3 and 4 draw a smear behind the blade.
import { M, hash } from './raster.js?v=96ed7b9';

const steelMat = (q0, q1) => {
  if (q0 > .35 && hash((q0 * 5) | 0, (q1 * 3 + 9) | 0) > .72) M.key = 'blood';
  else if (hash((q0 * 6 + 3) | 0, (q1 * 4) | 0) > .82) M.key = 'rust';
};
// The dagger stays bright: a little rust at the base, no blood, so it reads at this size.
const daggerMat = (q0) => { if (q0 < -.6) M.key = 'rust'; else M.tone = .12; };
const ironMat = (q0, q1, q2) => { if (hash((q0 * 5 + 7) | 0, (q2 * 3 + 2) | 0) > .78) M.key = 'rust'; };
const haftMat = (q0) => { M.tone = (hash((q0 * 7 + 11) | 0, 4) - .5) * .18; };
const waxMat = (q0, q1, q2) => { if (q0 < -.2 && hash((q1 * 4 + 5) | 0, (q2 * 4) | 0) > .6) M.key = 'blood'; };

// part: [along X, off Y, off Z, rx, ry, rz, ramp, mat, blade?]
const W = (o) => o;
export const WEAPONS = {
  daga: W({ name: 'puñal', two: false, fps: 16, grip2: 0, edge: [0, 0, -1],
    parts: [
      [-3.6, 0, 0, .9, 1, 1, 'iron', ironMat], [-1.4, 0, 0, 2.2, .85, .85, 'wood', haftMat], [1.1, 0, 0, .6, 2.4, .85, 'iron', ironMat],
      [6.6, .2, 0, 5.6, 1.5, .55, 'steel', daggerMat, 1], [11.6, .1, 0, 1.4, .8, .5, 'steel', daggerMat, 1],
    ],
    carry: { h: [8, -5, 8], d: [.62, -.5, .5], e: [0, 0, -1], swing: .3, armL: [.75, .3, 1.15] },
    blows: [
      { name: 'puñalada', keys: [ // overhead reverse-grip stab
        { h: [8, -5, 8], d: [.62, -.5, .5] }, { h: [1, -5.5, 21], d: [.5, 0, -.4], lean: -.08 }, { h: [1.5, -5, 23], d: [.7, 0, -.35], lean: -.12 },
        { h: [11, -3, 13], d: [.55, 0, -1], lean: .35, lunge: 1 }, { h: [11, -2.5, 7], d: [.2, 0, -1], lean: .45, lunge: 1, drop: 1.5 }, { h: [6, -4.5, 10], d: [-.1, 0, -1], lean: .15, lunge: .4 }] },
      { name: 'tajo de revés', keys: [ // backhand across, left to right
        { h: [8, -5, 8], d: [.62, -.5, .5] }, { h: [6, 3.5, 13], d: [-.3, .8, -.4], twist: .55 }, { h: [6.5, 4, 14], d: [-.2, 1, -.2], twist: .65 },
        { h: [13, -1, 14], d: [.6, -.5, -.5], twist: 0, lean: .2, lunge: .7 }, { h: [8, -10, 13], d: [0, -1, -.4], twist: -.55, lean: .15, lunge: .7 }, { h: [5, -6, 10], d: [-.15, -.3, -1], twist: -.15 }] },
      { name: 'estocada', keys: [ // a straight lunge
        { h: [8, -5, 8], d: [.62, -.5, .5] }, { h: [-1, -7, 12], d: [.7, 0, -.4], lean: -.12 }, { h: [-2, -7, 12], d: [.8, 0, -.3], lean: -.15, drop: .5 },
        { h: [16, -2, 13], d: [.95, .1, -.2], lean: .45, lunge: 1, drop: 1.5 }, { h: [16.5, -1.5, 12.5], d: [.95, .1, -.25], lean: .5, lunge: 1, drop: 2 }, { h: [8, -4, 10], d: [.2, 0, -1], lean: .2, lunge: .4 }] },
    ] }),

  machete: W({ name: 'machete', two: false, fps: 13, grip2: 0, edge: [0, 0, -1],
    parts: [
      [-1.5, 0, 0, 2.8, .9, .8, 'wood', haftMat], [1.6, 0, 0, .5, 1.5, .8, 'iron', ironMat],
      [9.4, .35, 0, 8, 1.6, .5, 'steel', steelMat, 1], [16.2, .75, 0, 3.1, 2.15, .5, 'steel', steelMat, 1],
    ],
    carry: { h: [3.5, -7, -.5], d: [.65, -.12, -.75], e: [1, 0, .3] },
    blows: [
      { name: 'tajo diagonal', keys: [
        { h: [3.5, -7, -.5], d: [.65, -.12, -.75] }, { h: [-1, -8.5, 21], d: [-.45, -.4, .8], twist: -.4 }, { h: [-1.5, -8.5, 22.5], d: [-.6, -.35, .7], twist: -.5, lean: -.05 },
        { h: [13, -2, 15], d: [.9, .3, -.1], twist: .1, lean: .3, lunge: 1 }, { h: [9, 4, 6], d: [.2, .6, -.8], twist: .45, lean: .35, lunge: 1, drop: 1.5 }, { h: [4, -4, 7], d: [.6, 0, -.8], twist: .1, lean: .1, lunge: .3 }] },
      { name: 'tajo horizontal', keys: [
        { h: [3.5, -7, -.5], d: [.65, -.12, -.75] }, { h: [1.5, -12, 13], d: [-.6, -.7, .1], twist: -.6 }, { h: [.5, -12.5, 14], d: [-.75, -.6, .2], twist: -.72 },
        { h: [14, -2, 14], d: [.8, .55, 0], twist: .1, lean: .2, lunge: .8 }, { h: [8, 9, 13], d: [-.1, 1, -.1], twist: .62, lean: .15, lunge: .8 }, { h: [5, 0, 9], d: [.5, .3, -.8], twist: .2 }] },
      { name: 'machetazo', keys: [ // straight down from over the head
        { h: [3.5, -7, -.5], d: [.65, -.12, -.75] }, { h: [1, -5, 24], d: [-.5, 0, .85], lean: -.1 }, { h: [0, -5, 25], d: [-.75, 0, .6], lean: -.15 },
        { h: [12.5, -3, 16], d: [1, 0, .05], lean: .35, lunge: 1 }, { h: [12, -3, 5.5], d: [.4, 0, -1], lean: .55, lunge: 1, drop: 3 }, { h: [6, -5, 7], d: [.6, 0, -.8], lean: .2, lunge: .4 }] },
    ] }),

  hacha: W({ name: 'hacha', two: true, fps: 11, grip2: -5.5, edge: [1, 0, 0],
    parts: [
      [6, 0, 0, 14.5, .85, .85, 'wood', haftMat], [-8.8, 0, 0, .95, 1.1, 1.1, 'iron', ironMat],
      [19, 2.9, 0, 2.7, 3.9, .7, 'steel', steelMat, 1], [19, 6.4, 0, 3.8, .85, .65, 'steel', steelMat, 1], [19, -1.6, 0, 1.5, 1.4, .95, 'iron', ironMat],
    ],
    carry: { h: [3, -7.2, -.5], d: [.42, -.15, -.9], e: [1, 0, 0], one: true, swing: .6 },
    blows: [
      { name: 'hachazo', keys: [
        { h: [5, -6, 6], d: [.35, -.3, -.88] }, { h: [0, -3, 20], d: [-.6, -.2, .75], lean: -.12 }, { h: [-1, -3, 21], d: [-.8, -.1, .55], lean: -.2 },
        { h: [10, -1.5, 18], d: [.9, 0, .35], lean: .3, lunge: .8 }, { h: [12, -1.5, 7], d: [.5, 0, -.9], lean: .6, lunge: 1, drop: 4 }, { h: [9, -2, 8], d: [.45, -.15, -.85], lean: .45, lunge: .8, drop: 3 }] },
      { name: 'barrido', keys: [
        { h: [5, -6, 6], d: [.35, -.3, -.88] }, { h: [0, -10, 13], d: [-.4, -.9, .2], twist: -.7 }, { h: [-1, -10, 13.5], d: [-.5, -.8, .3], twist: -.82 },
        { h: [11, -3, 13], d: [.9, .45, 0], twist: 0, lean: .2, lunge: .8 }, { h: [6, 8, 12], d: [0, 1, -.1], twist: .72, lean: .2, lunge: .8 }, { h: [5, 2, 9], d: [.3, .6, -.6], twist: .3 }] },
      { name: 'golpe ascendente', keys: [
        { h: [5, -6, 6], d: [.35, -.3, -.88] }, { h: [6, 4, 5], d: [.2, .6, -.8], twist: .3, lean: .35, drop: 2.5 }, { h: [6, 5, 4], d: [.1, .5, -.9], twist: .42, lean: .4, drop: 3 },
        { h: [12, -1, 12], d: [.8, -.2, .5], twist: 0, lean: .1, lunge: .7 }, { h: [6, -7, 20], d: [.1, -.4, .9], twist: -.4, lean: -.15, lunge: .5 }, { h: [5, -5, 13], d: [.1, -.45, .88], twist: -.1 }] },
    ] }),

  candelabro: W({ name: 'candelabro', two: true, fps: 10, grip2: -6, edge: [1, 0, 0],
    parts: [
      [6.5, 0, 0, 14.8, .95, .95, 'iron', ironMat], [-8.8, 0, 0, 1.1, 3.4, 3.4, 'iron', ironMat], [7, 0, 0, 1.6, 1.6, 1.6, 'iron', ironMat],
      [20.6, 0, 0, .8, 5.1, .8, 'iron', ironMat, 1], [20.6, -4.6, 0, 1.4, .7, .7, 'iron', ironMat, 1], [20.6, 4.6, 0, 1.4, .7, .7, 'iron', ironMat, 1],
      [21.8, -4.7, 0, 1, 1.25, 1.25, 'iron', ironMat, 1], [21.8, 0, 0, 1, 1.25, 1.25, 'iron', ironMat, 1], [21.8, 4.7, 0, 1, 1.25, 1.25, 'iron', ironMat, 1],
      [24.2, -4.7, 0, 2, .75, .75, 'wax', waxMat], [24.8, 0, 0, 2.6, .75, .75, 'wax', waxMat], [24.2, 4.7, 0, 2, .75, .75, 'wax', waxMat],
    ],
    carry: { h: [7.5, -3, 10.5], d: [.18, -.42, .89], e: [.2, 1, 0] },
    blows: [
      { name: 'mazazo', keys: [
        { h: [7.5, -3, 10.5], d: [.18, -.42, .89] }, { h: [-.5, -3, 20], d: [-.65, -.15, .7], lean: -.15 }, { h: [-1.5, -3, 21], d: [-.85, -.1, .5], lean: -.22 },
        { h: [10, -1.5, 17], d: [.9, 0, .3], lean: .3, lunge: .8 }, { h: [11.5, -1.5, 6.5], d: [.55, 0, -.85], lean: .62, lunge: 1, drop: 4.5 }, { h: [8, -2, 8], d: [.4, -.1, -.85], lean: .45, lunge: .8, drop: 3.5 }] },
      { name: 'golpe de costado', keys: [
        { h: [7.5, -3, 10.5], d: [.18, -.42, .89] }, { h: [-.5, -10, 12], d: [-.45, -.85, .25], twist: -.75 }, { h: [-1.5, -10, 12.5], d: [-.55, -.8, .3], twist: -.85 },
        { h: [11, -3, 12.5], d: [.9, .4, .05], twist: 0, lean: .2, lunge: .8 }, { h: [5, 8, 11.5], d: [-.05, 1, -.05], twist: .75, lean: .2, lunge: .8 }, { h: [4, 1, 9], d: [.2, .5, .8], twist: .3 }] },
      { name: 'embestida', keys: [ // driven straight out like a ram
        { h: [7.5, -3, 10.5], d: [.18, -.42, .89] }, { h: [-1, -6, 12], d: [.92, .1, .3], lean: -.18 }, { h: [-2, -6, 12], d: [.95, .1, .25], lean: -.22, drop: .5 },
        { h: [12, -3, 13], d: [.97, .12, .15], lean: .45, lunge: 1, drop: 1.5 }, { h: [12.5, -3, 13], d: [.97, .12, .1], lean: .5, lunge: 1, drop: 2 }, { h: [6, -4, 10], d: [.4, -.1, .9], lean: .15, lunge: .4 }] },
    ] }),

  horca: W({ name: 'horca', two: true, fps: 12, grip2: 9, edge: [0, 1, 0],
    parts: [
      [7, 0, 0, 17.5, .62, .62, 'wood', haftMat], [24.4, 0, 0, .55, 2.6, .55, 'rust', ironMat],
      [27.3, -2.2, 0, 3, .48, .48, 'iron', ironMat, 1], [27.6, 0, 0, 3.3, .48, .48, 'iron', ironMat, 1], [27.3, 2.2, 0, 3, .48, .48, 'iron', ironMat, 1],
    ],
    carry: { h: [2, -5, 9], d: [.8, .1, .55], e: [0, 1, 0] },
    blows: [
      { name: 'ensarte', keys: [
        { h: [2, -5, 9], d: [.8, .1, .55] }, { h: [-3, -6, 11], d: [1, .1, .08], lean: -.15 }, { h: [-4, -6, 11], d: [1, .1, .05], lean: -.2, drop: .5 },
        { h: [10, -3, 12], d: [1, .06, 0], lean: .45, lunge: 1, drop: 1.5 }, { h: [11, -3, 12], d: [1, .06, -.02], lean: .5, lunge: 1, drop: 2 }, { h: [4, -4.5, 10], d: [.9, .1, .35], lean: .15, lunge: .4 }] },
      { name: 'clavada', keys: [ // raised high, driven down
        { h: [2, -5, 9], d: [.8, .1, .55] }, { h: [2, -6, 20], d: [.8, 0, -.25], lean: -.1 }, { h: [1.5, -6, 21], d: [.75, 0, -.2], lean: -.15 },
        { h: [10, -3, 15], d: [.8, 0, -.6], lean: .4, lunge: .9, drop: 2 }, { h: [11, -3, 12.5], d: [.7, 0, -.72], lean: .5, lunge: 1, drop: 3 }, { h: [3, -5, 10], d: [.85, .1, .45], lean: .15, lunge: .3 }] },
      { name: 'barrido de púas', keys: [
        { h: [2, -5, 9], d: [.8, .1, .55] }, { h: [0, -8, 12], d: [.5, -.85, .1], twist: -.6 }, { h: [-.5, -8, 12], d: [.42, -.9, .1], twist: -.7 },
        { h: [6, -1, 12], d: [.9, .4, 0], twist: .3, lean: .2, lunge: .7 }, { h: [3, 5, 11], d: [.45, .88, -.1], twist: .65, lean: .15, lunge: .7 }, { h: [2, -3, 10], d: [.8, .25, .5], twist: .15 }] },
    ] }),
};
export const WEAPON_IDS = Object.keys(WEAPONS);
