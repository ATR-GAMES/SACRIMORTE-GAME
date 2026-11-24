// The night begins: the midnight vigil, the demon bursting in through the great window, the priest thrown down, the
// curse, the faithful turning — every one of them coming for him.
// A timeline of shots and events. main.js hands in what it needs (env) and asks, each frame: how wide the shot is and
// where it looks, what to draw in the world (the faithful, the demon, the priest's own poses, flying glass), what lights
// there are, and what goes over the screen (black bars, titles, words). Esc, Enter or Space skips it.
import { toScreen } from './view.js?v=f76c404';
import { CELL } from './cathedral.js?v=f76c404';
import { FAITHFUL, DEMON } from './enemies.js?v=f76c404';

const GLASS = [[118, 56, 168], [156, 70, 172], [196, 64, 86], [220, 164, 72], [66, 82, 176], [180, 40, 60], [230, 220, 240]];
const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);

// The script. Times in seconds. Lines: [from, to, who, words].
const LINES = [
  [3.8, 8.8, 'El padre', 'Hermanos, recemos por las almas de nuestros difuntos… Requiem aeternam dona eis, Domine.'],
  [9.8, 11.4, 'El padre', '…¿Qué fue eso?'],
  [17.2, 21.6, 'El demonio', '¿Rezas por los muertos, padre? Esta noche… ellos rezarán por ti.'],
  [26.6, 28.6, 'El demonio', 'Esto es solo el principio.'],
  [31.4, 33.8, 'El padre', 'Señor… perdónalos.'],
];
const END = 34.2;
// Shots: [from, wide?, where]. wide: the whole hall; otherwise close in on the place named.
const SHOTS = [[0, 1, 'hall'], [11.6, 1, 'high'], [16.8, 0, 'stare'], [22, 1, 'hall'], [28.8, 1, 'high'], [30.4, 0, 'priest']];

export function createIntro(env) {
  const { MAP, WORLD, SFX, pl } = env, C = CELL;
  const [wx, wy] = MAP.windowAt.map(v => v * C), [dx0, dy0] = MAP.demonAt.map(v => v * C);
  const faithful = MAP.congregation.map(p => ({ ...p, x: p.x * C, y: p.y * C, ph: Math.random() * 9 }));
  const shards = [];
  const st = { t: 0, active: true, fired: new Set(), demon: null, mood: 'sit', priest: null, transformWanted: false, transformed: false, flash: 0, red: 0, ring: -1, hint: 0, shake: 0 };
  const cam = { x: pl.x, y: pl.y, wide: true };
  const at = (cx, cy) => [cx * C, cy * C];
  const PLACES = { hall: at(MAP.windowAt[0] - 1, MAP.windowAt[1] + 10), high: at(MAP.windowAt[0] + 1, MAP.windowAt[1] + 3), stare: [(pl.x + dx0) / 2, (pl.y + dy0) / 2 + C], priest: [pl.x, pl.y + C] };

  // ---- what happens, when
  const once = (key, t, fn) => { if (st.t >= t && !st.fired.has(key)) { st.fired.add(key); fn(); } };
  function shatter(quiet) {
    WORLD.breakWindow();
    if (quiet) return;
    st.flash = 1; st.shake = 1;
    for (let n = 0; n < 5; n++) setTimeout(() => SFX.shatter((Math.random() - .5) * .8), n * 60);
    SFX.stomp(0); setTimeout(() => SFX.stomp(0), 120);
    // the glass blown inward, over the altar and down the hall
    for (let n = 0; n < 320; n++) {
      const sp = 120 + Math.random() * 380, a = (Math.random() - .5) * 1.5;
      shards.push({ x: wx + (Math.random() - .5) * 13 * C, y: wy + Math.random() * C, z: 40 + Math.random() * 180,
        vx: Math.sin(a) * sp, vy: Math.cos(a) * sp, vz: 40 + Math.random() * 160, col: GLASS[Math.random() * GLASS.length | 0], s: Math.random() < .35 ? 6 : 4, spin: Math.random() * 6 });
    }
  }
  function events() {
    once('pray', 2.5, () => SFX.prayOn(true));
    once('rumble', 9.4, () => { SFX.prayOn(false); SFX.stomp(0); st.shake = .5; st.mood = 'look'; });
    once('rumble2', 10.8, () => { SFX.stomp(0); st.shake = .5; });
    once('turn', 11.2, () => { pl.k = 6; });                                              // he turns to the window
    // the demon bursts through it, the glass flying ahead of him
    once('burst', 12, () => { shatter(false); st.demon = { x: wx, y: wy - C, z: 120, anim: 'hover', t: 0, k: 2 }; SFX.cry('obispo', 'death', 0); st.mood = 'fear'; });
    once('fall', 12.25, () => { st.priest = { name: 'fall', t: 0, k: 2 }; });             // thrown back onto the floor
    once('cower', 13, () => { st.priest = { name: 'cower', t: 0, k: 2 }; });
    once('land', 15.6, () => { st.demon.anim = 'stand'; st.demon.k = 6; SFX.stomp(0); st.shake = .7; });   // lands, and looks down at him
    once('speak1', 17.2, () => { st.demon.anim = 'speak'; SFX.cry('obispo', 'atk', 0); });
    once('turnP', 21.8, () => { st.demon.anim = 'stand'; st.demon.k = 2; });            // turns to the people
    once('curse', 22.8, () => { st.demon.anim = 'curse'; st.ring = 0; SFX.cry('cabrio', 'death', 0); SFX.stomp(0); st.shake = .7; });
    once('stand', 23.6, () => { st.mood = 'stand'; for (let n = 0; n < 5; n++) setTimeout(() => SFX.cry(n & 1 ? 'poseida' : 'poseido', 'hurt', (Math.random() - .5) * 1.4), n * 180); });
    once('speak2', 26.6, () => { st.demon.anim = 'speak'; st.demon.k = 6; SFX.cry('obispo', 'atk', 0); });
    once('leave', 28.8, () => { st.demon.anim = 'hover'; st.demon.leaving = 0; st.demon.k = 6; });
    once('turnF', 29.6, () => { st.transformWanted = true; });
    once('rise', 30.6, () => { st.priest = { name: 'rise', t: 0, k: 2 }; });
    once('stood', 31.4, () => { st.priest = null; pl.k = 2; });
  }
  // The faithful become the possessed, as soon as their sprites are ready.
  function tryTransform() {
    if (!st.transformWanted || st.transformed || !env.ready()) return;
    st.transformed = true;
    env.possess(faithful.map(f => ({ id: FAITHFUL[f.n].into, x: f.x, y: f.y })));
    faithful.length = 0;
    for (let n = 0; n < 8; n++) setTimeout(() => SFX.cry(n & 1 ? 'poseida' : 'poseido', n % 3 ? 'atk' : 'death', (Math.random() - .5) * 1.4), n * 120);
  }
  function update(dt) {
    if (st.active) {
      st.t += dt; events();
      const sh = [...SHOTS].reverse().find(s => st.t >= s[0]);
      cam.wide = !!sh[1];
      const [tx, ty] = PLACES[sh[2]], k = Math.min(1, dt * (st.t < .5 ? 30 : 2.2));
      cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
      if (st.t >= END) finish();
    }
    const D = st.demon;
    if (D) {
      D.t += dt;
      if (D.leaving === undefined) { const p = ease((st.t - 12) / 3.6); D.x = wx + (dx0 - wx) * p; D.y = wy - C + (dy0 - wy + C) * p; D.z = 120 * (1 - p) + 50 * Math.sin(p * Math.PI); }
      else { D.leaving += dt; const p = ease(D.leaving / 1.6); D.x = dx0 + (wx - dx0) * p; D.y = dy0 + (wy - C - dy0) * p; D.z = 200 * p; if (D.leaving > 1.7) st.demon = null; }
    }
    if (st.priest) st.priest.t += dt;
    for (const f of faithful) f.ph += dt;
    if (st.ring >= 0) { st.ring += dt; st.red = Math.max(st.red, Math.max(0, 1 - Math.abs(st.ring - .6) * 1.2)); if (st.ring > 3.2) st.ring = -1; }
    st.red = Math.max(0, st.red - dt * .35); st.flash = Math.max(0, st.flash - dt * 1.6);
    if (st.shake > 0) { env.shake(st.shake * .3); st.shake = Math.max(0, st.shake - dt); }
    tryTransform();
    // glass in the air, tumbling; where it lands it stays, glinting on the stone
    for (const s of shards) {
      s.vz -= 520 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.vx *= .995; s.vy *= .995; s.spin += dt * 14;
      if (s.z <= 0) { const [sx, sy] = toScreen(s.x, s.y, 0); WORLD.blood.fillStyle = `rgb(${s.col})`; WORLD.blood.fillRect(Math.round(sx), Math.round(sy - WORLD.heightAt(s.x, s.y)), s.s > 4 ? 2 : 1, 1); s.dead = 1; }
    }
    for (let n = shards.length - 1; n >= 0; n--) if (shards[n].dead) shards.splice(n, 1);
    if (st.hint > 0) st.hint -= dt;
  }
  function finish() {
    if (!st.active) return;
    const wasBroken = st.fired.has('burst');
    for (const key of ['burst', 'fall', 'cower', 'land', 'stand', 'leave', 'turnF', 'rise', 'stood']) st.fired.add(key);
    if (!wasBroken) shatter(true);
    st.demon = null; st.priest = null; st.transformWanted = true; st.active = false; st.hint = 7; pl.k = 2; SFX.prayOn(false); cam.wide = false;
  }
  // The priest's own pose while the cinematic has him (null: drawn as usual).
  function priestPose() {
    const P = st.priest; if (!P) return null;
    const A = env.cine[P.name], f = A.loop === false || P.name !== 'cower' ? Math.min(A.n - 1, Math.floor(P.t * A.fps)) : Math.floor(P.t * A.fps) % A.n;
    return { name: P.name, f, k: P.k };
  }
  // Things in the world, to sort with everything else.
  function drawables(ox, oy) {
    const out = [];
    const anim = st.mood;
    for (const f of faithful) {
      const fr = anim === 'stand' ? Math.floor(f.ph * 10) % 4 : anim === 'fear' ? Math.floor(f.ph * 9) % 2 : anim === 'sit' ? Math.floor(f.ph * 1.5) % 2 : 0;
      const spr = env.faithSprite(f.n, anim, fr, 6, false); if (!spr) continue;
      const [sx, sy] = toScreen(f.x, f.y, 0), y = sy - WORLD.heightAt(f.x, f.y) + oy, x = sx + ox;
      out.push({ d: f.x + f.y, draw: g => g.drawImage(spr, Math.round(x - env.FOX), Math.round(y - env.FOY)) });
    }
    const D = st.demon;
    if (D) {
      const A = DEMON.anims[D.anim], fr = Math.floor(D.t * A.fps) % A.n, spr = env.demonSprite(D.anim, fr, D.k), [, , bx, by] = DEMON.box;
      if (spr) { const [sx, sy] = toScreen(D.x, D.y, D.z), x = sx + ox, y = sy - WORLD.heightAt(D.x, D.y) + oy;
        out.push({ d: D.x + D.y + C * 2, draw: g => { g.drawImage(spr, Math.round(x - bx), Math.round(y - by));
          g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .14 + .08 * Math.sin(D.t * 6); g.drawImage(spr, Math.round(x - bx), Math.round(y - by)); g.restore(); } }); }
    }
    return out;
  }
  // In the world, over everything standing: the glass in the air, the curse rolling out.
  function drawFx(g, ox, oy) {
    for (const s of shards) { const [sx, sy] = toScreen(s.x, s.y, s.z), glint = Math.sin(s.spin) > .7; g.fillStyle = glint ? '#fff4e0' : `rgb(${s.col})`; g.fillRect(Math.round(sx + ox), Math.round(sy + oy), s.s, Math.sin(s.spin) > 0 ? s.s : 1); }
    if (st.ring >= 0 && st.demon) {
      const [sx, sy] = toScreen(st.demon.x, st.demon.y, 0), R = st.ring * 420;
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const [dr, a] of [[0, .7], [-14, .35]]) { g.strokeStyle = `rgba(255,40,30,${Math.max(0, a - st.ring * .2)})`; g.lineWidth = 3; g.beginPath(); g.ellipse(sx + ox, sy + oy - WORLD.heightAt(st.demon.x, st.demon.y), Math.max(1, R + dr), Math.max(1, (R + dr) * .75), 0, 0, 7); g.stroke(); }
      g.restore();
    }
  }
  const lights = () => {
    const L = [];
    if (st.demon) L.push({ x: st.demon.x, y: st.demon.y, z: st.demon.z + 90, col: [255, 60, 40], r: 160, flicker: 3 });
    if (st.t > 12 || !st.active) L.push({ x: wx, y: wy + C, z: 60, col: [70, 84, 140], r: 140 });   // the night through the hole
    return L;
  };
  // Over everything, in screen units (W × H): the bars, the red of the curse, the flash, the title, the words.
  function overlay(g, W, H) {
    const bar = st.active ? Math.round(H * .11 * ease(Math.min(st.t, END - st.t) / .8)) : 0;
    if (st.red > 0) { g.fillStyle = `rgba(150,0,10,${st.red * .35})`; g.fillRect(0, 0, W, H); }
    if (st.flash > 0) { g.fillStyle = `rgba(255,250,240,${st.flash * .85})`; g.fillRect(0, 0, W, H); }
    if (st.active && st.t < 1.2) { g.fillStyle = `rgba(0,0,0,${1 - ease(st.t / 1.2)})`; g.fillRect(0, 0, W, H); }
    if (bar) { g.fillStyle = '#000'; g.fillRect(0, 0, W, bar); g.fillRect(0, H - bar, W, bar); }
    g.save(); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    if (st.active && st.t < 3.6) {                                                        // the title
      const a = ease(st.t / .8) * (1 - ease((st.t - 2.8) / .8));
      g.globalAlpha = a; g.font = '24px "Jacquard 24"'; g.fillStyle = '#140103'; g.fillText(MAP.name, W / 2, H * .42 + 2); g.fillStyle = '#a3150f'; g.fillText(MAP.name, W / 2, H * .42);
      g.font = '16px "Pixelify Sans"'; g.fillStyle = '#c8b89a'; g.fillText('VIGILIA DE DIFUNTOS · MEDIANOCHE', W / 2, H * .42 + 18);
    }
    const line = st.active && LINES.find(([a, b]) => st.t >= a && st.t < b);
    if (line) {                                                                           // the words, written as they are said
      const [a, b, who, words] = line, n = Math.floor((st.t - a) * 38), shown = words.slice(0, n), fade = Math.min(1, (b - st.t) / .3);
      const demon = who === 'El demonio', bw = Math.min(W - 24, 380), bx = Math.round(W / 2 - bw / 2), by = Math.round(H - bar - 52);
      g.globalAlpha = fade; g.fillStyle = 'rgba(8,3,6,.86)'; g.fillRect(bx, by, bw, 46); g.fillStyle = demon ? '#7a1010' : '#5e5246'; g.fillRect(bx, by, bw, 1); g.fillRect(bx, by + 45, bw, 1);
      g.textAlign = 'left'; g.font = '16px "Jacquard 24"'; g.fillStyle = demon ? '#c8301e' : '#a3150f'; g.fillText(who, bx + 8, by + 14);
      g.font = '16px "Pixelify Sans"'; g.fillStyle = demon ? '#e8b0a0' : '#c8b89a';
      const ws = shown.split(' '), lines = ['']; for (const w of ws) { const t = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + w : w; if (g.measureText(t).width > bw - 16) lines.push(w); else lines[lines.length - 1] = t; }
      lines.slice(0, 2).forEach((l, i) => g.fillText(l, bx + 8, by + 29 + i * 13));
    }
    if (st.active && st.t > 4) { g.globalAlpha = .55; g.textAlign = 'right'; g.font = '16px "Pixelify Sans"'; g.fillStyle = '#8a7a68'; g.fillText('ESC · SALTAR', W - 8, H - Math.max(4, bar - 12)); }
    if (!st.active && st.hint > 0) {                                                      // what he can do now
      g.globalAlpha = Math.min(1, st.hint / .6); g.textAlign = 'center'; g.font = '16px "Pixelify Sans"';
      const txt = env.mobile ? 'TOCA EL BOTÓN DE ATAQUE · GOLPEA CON LA CRUZ' : 'CLIC / J · GOLPEA CON LA CRUZ', y = Math.round(H * .8);
      g.fillStyle = 'rgba(6,2,4,.6)'; const w = g.measureText(txt).width + 16; g.fillRect(Math.round(W / 2 - w / 2), y - 13, Math.round(w), 18);
      g.fillStyle = '#000'; g.fillText(txt, W / 2 + 1, y + 1); g.fillStyle = '#c8b89a'; g.fillText(txt, W / 2, y);
    }
    g.restore();
  }
  // Everything that must be painted before it is needed (all of it small, but the demon is big).
  function* preload() {
    { const [ax, ay] = toScreen(PLACES.hall[0], PLACES.hall[1]); yield* [...(function* () {})()]; for (const _ of WORLD.warmFloor(ax - 1000, ay - 700, ax + 1000, ay + 700)) yield () => {}; }
    for (let n = 0; n < 4; n++) for (const [a, fs] of [['sit', 2], ['look', 1], ['fear', 2], ['stand', 4]]) for (let f = 0; f < fs; f++) yield () => env.faithSprite(n, a, f, 6, false);
    for (const [name, A] of Object.entries(env.cine)) for (let f = 0; f < A.n; f++) yield () => env.cineSprite(name, f, 2);
    for (const k of [2, 6]) for (const [a, A] of Object.entries(DEMON.anims)) for (let f = 0; f < A.n; f++) yield () => env.demonSprite(a, f, k);
  }
  return { get active() { return st.active; }, get t() { return st.t; }, cam, update, drawables, drawFx, lights, overlay, priestPose, preload, skip: finish, startNeeds: () => ['poseido', 'poseida'] };
}
