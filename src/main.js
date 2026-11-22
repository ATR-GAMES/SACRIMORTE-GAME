// Character test bench: the priest alone on a plain white floor, PC controls, five melee weapons, plus a gallery of
// every animation in all eight facings.
import { ANIMS, bake, animsFor, animInfo, SW, SH, OX, OY } from './priest.js';
import { WEAPONS, WEAPON_IDS } from './weapons.js';
import { toScreen } from './raster.js';
import { ENEMIES, ENEMY_IDS, ENEMY_ANIMS, bakeEnemy } from './enemies.js';

const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const hud = document.getElementById('hud'), load = document.getElementById('load');
const DIRS = ['SE', 'S', 'SO', 'O', 'NO', 'N', 'NE', 'E'];
const NAMES = { idle: 'quieto', walk: 'caminar', run: 'correr', crouch: 'agachado', cwalk: 'agachado andando', jump: 'salto', roll: 'rodar',
  interact: 'interactuar', cross: 'crucifijo', pray: 'rezar', hurt: 'herido', death: 'muerte', clean: 'limpiarse la sangre' };
const nameOf = (a, wid) => a.startsWith('atk') ? `golpe ${a[3]}: ${WEAPONS[wid].blows[+a[3] - 1].name}` : NAMES[a];
const wname = wid => wid ? WEAPONS[wid].name : 'sin arma';
const ENAMES = { idle: 'quieto', walk: 'caminar', atk: 'ataque', hurt: 'herido', death: 'muerte' };

// ---------------------------------------------------------------- sprites: unarmed at boot, each weapon in the background
const SETS = {}, progress = {};
const tick = () => new Promise(r => setTimeout(r, 0));
async function bakeSet(wid, gore = 0) {
  const key = wid || '', list = animsFor(wid), set = { gore };
  const total = list.reduce((s, a) => s + animInfo(a, wid).n * 8, 0); let done = 0;
  for (const name of list) {
    const A = animInfo(name, wid), c = document.createElement('canvas'); c.width = SW * A.n; c.height = SH * 8;
    const cx = c.getContext('2d');
    for (let k = 0; k < 8; k++) {
      for (let f = 0; f < A.n; f++) {
        const s = bake(name, f, k, wid, gore);
        cx.putImageData(new ImageData(new Uint8ClampedArray(s.d.buffer), s.w, s.h), f * SW, k * SH);
        done++;
      }
      if (!gore) progress[key] = done / total;
      await tick();
    }
    set[name] = c;
  }
  if (!gore) { CLEAN[key] = set; if (!SETS[key]) SETS[key] = set; }
  return set;
}
// Blood on the priest. Every hit given or taken soaks him a little; the sprites are repainted at the new level row by
// row (one animation in one facing at a time), starting with exactly what is on screen right now, so the blood shows
// on the blow that spilled it. The rest catches up over the next frames.
const CLEAN = {};
let goreBusy = false;
const GORE_STEPS = [.05, .2, .4, .65];
const goreLevel = () => GORE_STEPS.filter(t => pl.gore >= t).length;
function ownSet(set) { // a private copy to paint over, never the clean original
  const o = { own: true, rows: {} };
  for (const k in set) {
    const c = set[k]; if (!(c instanceof HTMLCanvasElement)) continue;
    const n = document.createElement('canvas'); n.width = c.width; n.height = c.height; n.getContext('2d').drawImage(c, 0, 0);
    o[k] = n; o.rows[k] = set.rows ? set.rows[k].slice() : new Array(8).fill(set.gore || 0);
  }
  return o;
}
const GORE_FIRST = ['atk1', 'atk2', 'atk3', 'idle', 'walk', 'run', 'hurt', 'clean'];
function nextRow(set, lvl) {
  const order = [pl.anim, ...GORE_FIRST, ...Object.keys(set.rows)];
  for (const dirs of [[pl.k], [0, 1, 2, 3, 4, 5, 6, 7]]) for (const a of order) if (set.rows[a]) for (const d of dirs) if (set.rows[a][d] !== lvl) return [a, d];
  return null;
}
function goreTick() {
  const key = pl.wid || '', lvl = goreLevel();
  let set = SETS[key];
  goreBusy = false;
  if (!set) return;
  if (!lvl) { if (CLEAN[key] && set !== CLEAN[key]) SETS[key] = CLEAN[key]; return; }
  if (!set.own) SETS[key] = set = ownSet(set);
  const t0 = performance.now();
  let job;
  while ((job = nextRow(set, lvl)) && (performance.now() - t0 < 7)) {
    const [a, k] = job, A = animInfo(a, pl.wid), cx = set[a].getContext('2d');
    for (let f = 0; f < A.n; f++) { const s = bake(a, f, k, pl.wid, lvl); cx.putImageData(new ImageData(new Uint8ClampedArray(s.d.buffer), s.w, s.h), f * SW, k * SH); }
    set.rows[a][k] = lvl;
  }
  goreBusy = !!nextRow(set, lvl);
}
const ESETS = {};
async function bakeEnemySet(id) {
  const set = {}, E = ENEMIES[id], total = ENEMY_ANIMS.reduce((s, a) => s + E.anims[a].n * 8, 0); let done = 0;
  for (const a of ENEMY_ANIMS) {
    const A = E.anims[a], c = document.createElement('canvas'); c.width = SW * A.n; c.height = SH * 8;
    const cx = c.getContext('2d');
    for (let k = 0; k < 8; k++) {
      for (let f = 0; f < A.n; f++) { const s = bakeEnemy(id, a, f, k); cx.putImageData(new ImageData(new Uint8ClampedArray(s.d.buffer), s.w, s.h), f * SW, k * SH); done++; }
      progress['e:' + id] = done / total;
      await tick();
    }
    set[a] = c;
  }
  ESETS[id] = set;
}
// Everything not needed at boot is painted in the background; whatever is asked for jumps the queue.
let want = null, wantE = null;
async function baker() {
  const queue = [...WEAPON_IDS.map(w => ['w', w]), ...ENEMY_IDS.map(e => ['e', e])];
  while (queue.length) {
    const need = pendingSpawn.find(id => !ESETS[id]) || (wantE && !ESETS[wantE] ? wantE : null);
    let i = need ? queue.findIndex(q => q[0] === 'e' && q[1] === need) : -1;
    if (i < 0 && want && !SETS[want]) i = queue.findIndex(q => q[0] === 'w' && q[1] === want);
    const [[t, id]] = queue.splice(Math.max(0, i), 1);
    if (t === 'w') await bakeSet(id); else await bakeEnemySet(id);
  }
}
const fpsOf = (name, speed) => { const A = ANIMS[name]; return A.stride ? A.n * speed * A.stance / (2 * A.stride) : A.fps; };

// ---------------------------------------------------------------- input
const keys = new Set(), hit = new Set();
addEventListener('keydown', e => {
  const k = e.code; if (!keys.has(k)) hit.add(k); keys.add(k);
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
addEventListener('mousedown', e => { hit.add('Mouse' + e.button); e.preventDefault(); });
addEventListener('contextmenu', e => e.preventDefault());
const down = (...c) => c.some(k => keys.has(k)), pressed = c => hit.has(c);

// ---------------------------------------------------------------- the priest
const WALK = 40, RUN = 86, CROUCH = 21, ROLL = 118, JUMPV = 150, G = 520;
const pl = { x: 0, y: 0, z: 0, vz: 0, k: 1, mode: 'ground', anim: 'idle', t: 0, timer: 0, vx: 0, vy: 0, crouch: false, wid: '', pending: null, gore: 0 };
const dust = [];
const info = a => animInfo(a, pl.wid);
const setAnim = (a) => { if (pl.anim !== a) { pl.anim = a; pl.t = 0; } };
const frameOf = () => {
  const A = info(pl.anim), f = Math.floor(pl.t * (pl.fps || A.fps || 8));
  return A.loop ? f % A.n : Math.min(A.n - 1, f);
};
const done = () => Math.floor(pl.t * (pl.fps || info(pl.anim).fps)) >= info(pl.anim).n;
const puff = (n, spread) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28; dust.push({ x: pl.x, y: pl.y, vx: Math.cos(a) * spread * (.5 + Math.random()), vy: Math.sin(a) * spread * (.5 + Math.random()), z: 1, life: .45 + Math.random() * .3, t: 0 }); } };
const startBlow = n => { pl.crouch = false; pl.mode = 'atk'; pl.blow = n; pl.queued = false; pl.fps = 0; pl.anim = 'atk' + n; pl.t = 0; pl.lunged = false; };

// Screen direction → world direction (iso): right = (1,-1)/√2, down = (1,1)/√2.
function moveVec() {
  let sx = 0, sy = 0;
  if (down('KeyA', 'ArrowLeft')) sx--; if (down('KeyD', 'ArrowRight')) sx++;
  if (down('KeyW', 'ArrowUp')) sy--; if (down('KeyS', 'ArrowDown')) sy++;
  if (!sx && !sy) return null;
  const l = Math.hypot(sx, sy); sx /= l; sy /= l;
  const wx = (sx + sy * 2) * Math.SQRT1_2, wy = (-sx + sy * 2) * Math.SQRT1_2, wl = Math.hypot(wx, wy);
  const k = ((Math.round(Math.atan2(wy, wx) / (Math.PI / 4)) % 8) + 8) % 8;
  return { x: wx / wl, y: wy / wl, k };
}

function pickWeapon() {
  let pick;
  WEAPON_IDS.forEach((w, i) => { if (pressed('Digit' + (i + 1)) || pressed('Numpad' + (i + 1))) pick = w; });
  if (pressed('Digit0') || pressed('Backquote') || pressed('Numpad0')) pick = '';
  if (pick === undefined) return;
  pl.pending = pick; want = pick;
}

function update(dt) {
  pl.t += dt;
  pickWeapon();
  // Change weapon once its sprites exist and he isn't mid-blow.
  if (pl.pending !== null && SETS[pl.pending] && pl.mode !== 'atk') { const old = pl.wid || ''; if (SETS[old] && SETS[old].own && CLEAN[old]) SETS[old] = CLEAN[old]; pl.wid = pl.pending; pl.pending = null; if (!info(pl.anim)) setAnim('idle'); }
  const mv = moveVec(), shift = down('ShiftLeft', 'ShiftRight');
  if (pressed('KeyX') && pl.mode !== 'dead') { pl.mode = 'dead'; pl.fps = 0; setAnim('death'); }
  if (pressed('KeyT') && pl.mode === 'dead') { pl.mode = 'ground'; setAnim('idle'); }
  const blowKey = pressed('Mouse0') ? 0 : pressed('KeyJ') ? 1 : pressed('KeyK') ? 2 : pressed('KeyL') ? 3 : -1;

  switch (pl.mode) {
    case 'ground': {
      if (pressed('KeyC')) pl.crouch = !pl.crouch;
      let speed = 0;
      if (mv) { pl.k = mv.k; speed = pl.crouch ? CROUCH : shift ? RUN : WALK; pl.x += mv.x * speed * dt; pl.y += mv.y * speed * dt; }
      const a = mv ? (pl.crouch ? 'cwalk' : shift ? 'run' : 'walk') : pl.cleaning ? 'clean' : (pl.crouch ? 'crouch' : 'idle');
      if (a === 'clean') pl.crouch = false;
      setAnim(a); pl.fps = mv ? fpsOf(a, speed) : 0;
      if (a === 'run' && Math.random() < dt * 6) puff(1, 6);
      pl.vx = mv ? mv.x * speed : 0; pl.vy = mv ? mv.y * speed : 0;
      if (blowKey >= 0 && pl.wid) { if (mv) pl.k = mv.k; startBlow(blowKey || 1); }
      else if (pressed('Space')) { pl.crouch = false; pl.mode = 'prep'; pl.timer = .09; pl.fps = 0; setAnim('jump'); }
      else if (pressed('KeyQ')) { if (mv) pl.k = mv.k; pl.mode = 'roll'; pl.fps = 0; setAnim('roll'); puff(4, 10); }
      else if (pressed('KeyE')) { pl.mode = 'act'; pl.fps = 0; setAnim('interact'); }
      else if (pressed('KeyH')) { pl.mode = 'act'; pl.fps = 0; setAnim('hurt'); }
      else if (pressed('KeyR')) { pl.mode = 'pray'; pl.fps = 0; setAnim('pray'); }
      else if (pressed('KeyF')) { pl.mode = 'cross'; pl.fps = 0; setAnim('cross'); }
      break;
    }
    case 'atk': {
      // A click during the blow chains the next one: 1 → 2 → 3.
      if (blowKey === 0 && pl.blow < 3 && frameOf() >= 2) pl.queued = true;
      if (blowKey > 0 && frameOf() >= 4) pl.queuedTo = blowKey;
      const f = frameOf();
      if (f === 3 || f === 4) { const d = [Math.cos(pl.k * Math.PI / 4), Math.sin(pl.k * Math.PI / 4)], sp = WEAPONS[pl.wid].two ? 34 : 44; pl.x += d[0] * sp * dt; pl.y += d[1] * sp * dt; }
      if (f === 3 && !pl.lunged) { pl.lunged = true; puff(2, 6); }
      if (done()) {
        if (pl.queued) startBlow(pl.blow + 1);
        else if (pl.queuedTo) { const n = pl.queuedTo; pl.queuedTo = 0; startBlow(n); }
        else { pl.mode = 'ground'; setAnim('idle'); }
      }
      break;
    }
    case 'prep':
      pl.t = 0; pl.timer -= dt;
      if (pl.timer <= 0) { pl.mode = 'air'; pl.vz = JUMPV; pl.airT = 0; }
      break;
    case 'air': {
      pl.airT += dt;
      if (mv) { pl.vx += (mv.x * WALK - pl.vx) * Math.min(1, dt * 2); pl.vy += (mv.y * WALK - pl.vy) * Math.min(1, dt * 2); pl.k = mv.k; }
      pl.x += pl.vx * dt; pl.y += pl.vy * dt; pl.z += pl.vz * dt; pl.vz -= G * dt;
      pl.frame = pl.airT < .1 ? 1 : pl.vz > 45 ? 2 : pl.vz > -45 ? 3 : 4;
      if (pl.z <= 0) { pl.z = 0; pl.vz = 0; pl.mode = 'land'; pl.timer = .13; puff(6, 12); }
      break;
    }
    case 'land':
      pl.frame = 5; pl.timer -= dt; pl.vx *= .8; pl.vy *= .8; pl.x += pl.vx * dt; pl.y += pl.vy * dt;
      if (pl.timer <= 0) { pl.mode = 'ground'; pl.frame = null; }
      break;
    case 'roll': {
      const d = [Math.cos(pl.k * Math.PI / 4), Math.sin(pl.k * Math.PI / 4)], sp = ROLL * (1 - Math.min(1, pl.t * 1.6) * .55);
      pl.x += d[0] * sp * dt; pl.y += d[1] * sp * dt;
      if (done()) { pl.mode = 'ground'; puff(3, 8); }
      break;
    }
    case 'act': if (done()) pl.mode = 'ground'; break;
    case 'pray':
      if (pl.t * ANIMS.pray.fps >= 3) pl.frame = 3 + Math.floor((pl.t * ANIMS.pray.fps - 3) / 2) % 3;
      if (pressed('KeyR') || mv || pressed('Space')) { pl.mode = 'unpray'; pl.timer = .35; }
      break;
    case 'unpray':
      pl.timer -= dt; pl.frame = pl.timer > .2 ? 2 : pl.timer > .08 ? 1 : 0;
      if (pl.timer <= 0) { pl.mode = 'ground'; pl.frame = null; }
      break;
    case 'cross':
      if (pl.t * 8 >= 2) pl.frame = 2 + Math.floor(pl.t * 3) % 2;
      if (!down('KeyF')) { pl.mode = 'ground'; pl.frame = null; }
      break;
    case 'dead': break;
  }
  if (pl.mode === 'ground' || pl.mode === 'act' || pl.mode === 'dead' || pl.mode === 'atk') pl.frame = null;

  // Keep him on screen.
  const [sx, sy] = toScreen(pl.x, pl.y, 0), mx = view.w / 2 - 26, my = view.h / 2 - 14;
  const cx = Math.max(-mx, Math.min(mx, sx)), cy = Math.max(-my + 50, Math.min(my, sy));
  if (cx !== sx || cy !== sy) { const a = cx / Math.SQRT1_2, b = cy / (Math.SQRT1_2 * .5); pl.x = (a + b) / 2; pl.y = (b - a) / 2; }

  if (pressed('KeyN')) { const id = ENEMY_IDS[spawnIdx % ENEMY_IDS.length]; spawnIdx++; wantE = id; pendingSpawn.push(id); }
  if (pressed('KeyM')) { foes.length = 0; bolts.length = 0; pendingSpawn.length = 0; drops.length = 0; pools.length = 0; splats.length = 0; resetFloor(); pl.gore = 0; }
  updateFoes(dt);
  updateBlood(dt);
  // Once the killing is over he comes clean again, a level at a time: straight after the last one falls, or when
  // nobody has touched him nor been touched for a while and nothing is close.
  pl.fightT = (pl.fightT ?? 99) + dt;
  pl.gore = Math.min(1, pl.gore);
  const alive = foes.filter(f => f.anim !== 'death'), near = alive.some(f => Math.hypot(f.x - pl.x, f.y - pl.y) < 70);
  pl.cleaning = pl.gore > 0 && ((!alive.length && pl.fightT > 2.5) || (!near && pl.fightT > 8));
  if (pl.cleaning && pl.anim === 'clean') pl.gore = Math.max(0, pl.gore - .1 * dt);
  for (const p of dust) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += 8 * dt; p.vx *= .92; p.vy *= .92; }
  for (let i = dust.length - 1; i >= 0; i--) if (dust[i].t > dust[i].life) dust.splice(i, 1);
}

// ---------------------------------------------------------------- blood
// Drops fly in arcs and land as splats painted for good into a floor layer; corpses bleed out into pools that spread.
const floor = document.createElement('canvas'); let floorCtx = floor.getContext('2d');
const splats = [], drops = [], pools = [];
const BLOOD = ['#2e0404', '#4a0808', '#6a0e0c', '#8a1610', '#a82018', '#c2301e'];
const rnd = (a, b) => a + Math.random() * (b - a);
const srand = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function paintSplat(g, s) {
  const [sx, sy] = toScreen(s.x, s.y, 0), cx = Math.round(view.w / 2 + sx), cy = Math.round(view.h / 2 + sy);
  const R = srand(s.seed), r = s.r, el = s.el || 0;
  let [dx, dy] = toScreen(s.dx || 1, s.dy || 0, 0); const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
  const ra = r * (1 + el), W = Math.ceil(ra + 2), H = Math.ceil(ra * .6 + 2);
  for (let j = -H; j <= H; j++) for (let i = -W; i <= W; i++) {
    const y2 = j / .55, a = i * dx + y2 * dy, b = -i * dy + y2 * dx, d = (a / ra) ** 2 + (b / r) ** 2;
    const edge = 1 + (R() - .5) * .55;
    if (d > edge) continue;
    let c = s.pool ? (d < .55 ? 1 : d < .85 ? 2 : 1) : (d < .35 ? 3 : d < .8 ? 2 : 1);
    if (R() < .08) c += 1; if (s.pool && d > .88 && R() < .3) c = 4;
    if (s.dark) c = Math.max(0, c - 1);
    g.fillStyle = BLOOD[Math.min(5, c)]; g.fillRect(cx + i, cy + j, 1, 1);
  }
  // Satellite drops around anything that landed hard.
  const n = s.pool ? 0 : Math.round(r * .8 + el * 2);
  for (let k = 0; k < n; k++) {
    const t = R() * Math.PI * 2, rr = r * (1.3 + R() * (1.2 + el)), ox = Math.cos(t) * rr + dx * el * r * R(), oy = Math.sin(t) * rr * .55 + dy * el * r * R();
    g.fillStyle = BLOOD[2 + (R() < .4 ? 1 : 0)]; g.fillRect(Math.round(cx + ox), Math.round(cy + oy), 1, 1);
  }
}
function splat(s) { s.seed = s.seed || (Math.random() * 1e9 | 0) + 1; splats.push(s); if (splats.length > 5000) splats.shift(); paintSplat(floorCtx, s); }
function resetFloor() { floor.width = view.w; floor.height = view.h; floorCtx = floor.getContext('2d'); for (const s of splats) paintSplat(floorCtx, s); }
// A burst of drops from (x, y, z) thrown along (dx, dy).
function bleed(x, y, z, dx, dy, n, power = 1) {
  for (let i = 0; i < n; i++) {
    const a = Math.atan2(dy, dx) + rnd(-.9, .9) * (dx || dy ? 1 : 3.5), sp = rnd(20, 150) * power;
    drops.push({ x: x + rnd(-2, 2), y: y + rnd(-2, 2), z: z + rnd(-4, 4), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rnd(10, 130) * power, sz: Math.random() < .25 ? 2 : 1 });
  }
}
function gibs(x, y, z, n) {
  for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), sp = rnd(30, 110); drops.push({ x, y, z: z + rnd(-6, 6), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rnd(60, 170), sz: 3, gib: 1 }); }
}
function drip(x, y, z) { drops.push({ x: x + rnd(-3, 3), y: y + rnd(-3, 3), z, vx: rnd(-6, 6), vy: rnd(-6, 6), vz: rnd(-10, 10), sz: 1 }); }
function updateBlood(dt) {
  for (const d of drops) {
    d.vz -= 430 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
    if (d.z <= 0) {
      const sp = Math.hypot(d.vx, d.vy);
      if (d.gib && !d.bounced) { d.bounced = 1; d.z = 0; d.vz = -d.vz * .3; d.vx *= .5; d.vy *= .5; splat({ x: d.x, y: d.y, r: 2.2, dark: 1 }); continue; }
      splat({ x: d.x, y: d.y, r: d.gib ? 2 : d.sz === 2 ? rnd(1.8, 3) : rnd(1, 1.8), el: Math.min(1.4, sp / 85), dx: d.vx, dy: d.vy, dark: d.gib });
      d.dead = 1;
    }
  }
  for (let i = drops.length - 1; i >= 0; i--) if (drops[i].dead) drops.splice(i, 1);
  for (const p of pools) {
    p.t += dt; if (p.t < 0) continue;
    p.r = Math.min(p.max, p.max * (1 - Math.exp(-p.t / 2.2)));
    if (p.t > 7 && !p.done) { p.done = 1; splat({ x: p.x, y: p.y, r: p.r, el: p.el, dx: p.dx, dy: p.dy, pool: 1, seed: p.seed }); }
  }
  for (let i = pools.length - 1; i >= 0; i--) if (pools[i].done) pools.splice(i, 1);
}
function drawBlood(ox, oy) {
  for (const p of pools) if (p.t > 0 && !p.done) paintSplat(ctx, { x: p.x, y: p.y, r: p.r, el: p.el, dx: p.dx, dy: p.dy, pool: 1, seed: p.seed });
}
function drawDrops(ox, oy) {
  for (const d of drops) {
    const [sx, sy] = toScreen(d.x, d.y, d.z), [tx, ty] = toScreen(d.x - d.vx * .02, d.y - d.vy * .02, d.z - d.vz * .02);
    ctx.fillStyle = BLOOD[2]; ctx.fillRect(Math.round(ox + tx), Math.round(oy + ty), 1, 1);
    ctx.fillStyle = d.gib ? BLOOD[1] : BLOOD[4]; ctx.fillRect(Math.round(ox + sx), Math.round(oy + sy), d.sz, d.sz);
    if (d.gib) { ctx.fillStyle = BLOOD[5]; ctx.fillRect(Math.round(ox + sx), Math.round(oy + sy), 1, 1); }
  }
}

// ---------------------------------------------------------------- enemies (only to see them move, strike and fall)
const foes = [], bolts = [];
let spawnIdx = 0;
const pendingSpawn = [];
const octOf = (dx, dy) => ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
const eInfo = (f) => ENEMIES[f.id].anims[f.anim];
const eSet = (f, a) => { if (f.anim !== a) { f.anim = a; f.t = 0; f.struck = false; } };
const eFrame = f => { const A = eInfo(f), n = Math.floor(f.t * (f.fps || A.fps || 8)); return A.loop ? n % A.n : Math.min(A.n - 1, n); };
const eDone = f => Math.floor(f.t * (f.fps || eInfo(f).fps)) >= eInfo(f).n;
function spawnFoe(id) {
  const a = Math.random() * Math.PI * 2, r = 150;
  foes.push({ id, x: pl.x + Math.cos(a) * r, y: pl.y + Math.sin(a) * r, k: 0, anim: 'idle', t: Math.random(), hp: ENEMIES[id].hp, fps: 0, dead: 0, cool: .6 + Math.random() * .6 });
}
function updateFoes(dt) {
  const waiting = pendingSpawn.splice(0);
  for (const id of waiting) { if (ESETS[id]) spawnFoe(id); else pendingSpawn.push(id); }
  // The priest's blow lands on frame 3.
  if (pl.mode !== 'atk' || frameOf() < 3) pl.hitDone = false;
  const blowHit = pl.mode === 'atk' && frameOf() === 3 && !pl.hitDone;
  if (blowHit) pl.hitDone = true;
  const fd = [Math.cos(pl.k * Math.PI / 4), Math.sin(pl.k * Math.PI / 4)];
  for (const f of foes) {
    f.t += dt;
    const E = ENEMIES[f.id], dx = pl.x - f.x, dy = pl.y - f.y, d = Math.hypot(dx, dy) || 1;
    if (f.anim === 'death') { if (eDone(f)) f.dead += dt; continue; }
    if (blowHit && d < (WEAPONS[pl.wid] && WEAPONS[pl.wid].two ? 42 : 32) && (dx * -fd[0] + dy * -fd[1]) > d * .3) {
      f.hp--; f.fps = 0; f.anim = ''; eSet(f, f.hp <= 0 ? 'death' : 'hurt'); f.x -= dx / d * 6; f.y -= dy / d * 6;
      const sc = ENEMIES[f.id].look.scale || 1, two = WEAPONS[pl.wid] && WEAPONS[pl.wid].two;
      bleed(f.x, f.y, 34 * sc, -dx / d, -dy / d, two ? 70 : 45, two ? 1.25 : 1);
      pl.gore += (two ? .06 : .045) + (f.hp <= 0 ? .04 : 0); pl.fightT = 0;
      splat({ x: f.x - dx / d * 4, y: f.y - dy / d * 4, r: 4 * sc, el: 1.5, dx: -dx, dy: -dy });
      if (f.hp <= 0) {
        bleed(f.x, f.y, 30 * sc, -dx / d, -dy / d, 110, 1.3); bleed(f.x, f.y, 26 * sc, 0, 0, 40, .8); gibs(f.x, f.y, 30 * sc, 10);
        pools.push({ x: f.x, y: f.y, t: -.7, r: 0, max: 16 * sc + Math.random() * 5, el: .6, dx: -dx, dy: -dy, seed: (Math.random() * 1e9 | 0) + 1 });
      }
      continue;
    }
    if (f.anim === 'hurt') { if (eDone(f)) eSet(f, 'idle'); continue; }
    if (f.anim === 'atk') {
      const fr = eFrame(f), ef = [Math.cos(f.k * Math.PI / 4), Math.sin(f.k * Math.PI / 4)];
      if ((fr === 3 || fr === 4) && !E.ranged) { f.x += ef[0] * 30 * dt; f.y += ef[1] * 30 * dt; }
      if (fr === 3 && !f.struck) {
        f.struck = true;
        if (E.ranged) bolts.push({ x: f.x + ef[0] * 12, y: f.y + ef[1] * 12, z: 30, vx: dx / d * 90, vy: dy / d * 90, t: 0 });
        else if (d < E.range + 8 && pl.mode === 'ground') { pl.mode = 'act'; pl.fps = 0; setAnim('hurt'); pl.gore += .08; pl.fightT = 0; bleed(pl.x, pl.y, 36, dx / d, dy / d, 35); splat({ x: pl.x + dx / d * 3, y: pl.y + dy / d * 3, r: 3, el: 1.2, dx, dy }); }
      }
      if (eDone(f)) { eSet(f, 'idle'); f.cool = .8 + Math.random() * .8; }
      continue;
    }
    f.cool -= dt;
    if (pl.mode === 'dead') { eSet(f, 'idle'); f.fps = 0; continue; }
    f.k = octOf(dx, dy);
    if (d <= E.range && f.cool <= 0) { f.fps = 0; eSet(f, 'atk'); continue; }
    if (d > E.range * .8) {
      const A = E.anims.walk, sp = E.speed;
      f.x += dx / d * sp * dt; f.y += dy / d * sp * dt;
      eSet(f, 'walk'); f.fps = A.hop ? 9 : A.n * sp * A.stance / (2 * A.stride);
    } else { eSet(f, 'idle'); f.fps = 0; }
  }
  // Keep them from standing inside each other or the priest.
  for (const a of foes) {
    if (a.anim === 'death') continue;
    for (const b of [...foes, pl]) {
      if (a === b || b.anim === 'death') continue;
      const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy), m = 10 * ((ENEMIES[a.id].look.scale || 1) + (b === pl ? 1 : ENEMIES[b.id].look.scale || 1));
      if (d > 0 && d < m) { a.x += dx / d * (m - d) * .5; a.y += dy / d * (m - d) * .5; }
    }
  }
  for (const f of foes) {
    if (f.anim === 'death') continue;
    const E = ENEMIES[f.id], hurt = 1 - f.hp / E.hp, always = f.id === 'crucificado' || f.id === 'flagelante';
    f.dripT = (f.dripT || 0) - dt;
    if ((hurt > 0 || always) && f.dripT <= 0) { f.dripT = .5 / (hurt * 3 + (always ? 1 : 0) + .2); drip(f.x, f.y, 26 * (E.look.scale || 1)); }
  }
  for (let i = foes.length - 1; i >= 0; i--) if (foes[i].dead > 30) foes.splice(i, 1);
  for (const b of bolts) {
    b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt;
    if (Math.hypot(b.x - pl.x, b.y - pl.y) < 10 && pl.z < 20) { b.t = 9; if (pl.mode === 'ground') { pl.mode = 'act'; pl.fps = 0; setAnim('hurt'); pl.gore += .05; pl.fightT = 0; bleed(pl.x, pl.y, 36, b.vx, b.vy, 25); } }
  }
  for (let i = bolts.length - 1; i >= 0; i--) if (bolts[i].t > 2) bolts.splice(i, 1);
}

// ---------------------------------------------------------------- drawing
const view = { w: 400, h: 225, s: 3 };
let gallery = false, gIdx = 0, gT = 0, gWid = '', gWho = 0;
function resize() {
  const W = innerWidth, H = innerHeight;
  view.s = gallery ? Math.max(1, Math.floor(Math.min(W / 560, H / 290))) : Math.max(2, Math.floor(Math.min(W / 400, H / 225)));
  view.w = Math.ceil(W / view.s); view.h = Math.ceil(H / view.s);
  cv.width = view.w; cv.height = view.h; cv.style.width = view.w * view.s + 'px'; cv.style.height = view.h * view.s + 'px';
  ctx.imageSmoothingEnabled = false;
  if (!gallery && (floor.width !== view.w || floor.height !== view.h)) resetFloor();
}
addEventListener('resize', resize);

function shadow(x, y, rx, ry, a) {
  ctx.fillStyle = `rgba(20,16,24,${a})`;
  for (let j = -ry; j <= ry; j++) { const w = Math.round(rx * Math.sqrt(1 - (j / (ry + .5)) ** 2)); ctx.fillRect(Math.round(x - w), Math.round(y + j), w * 2, 1); }
}
function sprite(set, name, f, k, x, y) { ctx.drawImage(SETS[set][name], f * SW, k * SH, SW, SH, Math.round(x - OX), Math.round(y - OY), SW, SH); }
const bakingNote = () => {
  const w = pl.pending ?? (gallery && !SETS[gWid] ? gWid : null);
  return w !== null && w !== undefined && !SETS[w] ? `<br><i>afilando ${wname(w)}… ${Math.round((progress[w] || 0) * 100)}%</i>` : '';
};

function drawPlay() {
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, view.w, view.h);
  const ox = view.w / 2, oy = view.h / 2;
  ctx.drawImage(floor, 0, 0); drawBlood(ox, oy);
  for (const p of dust) { const [sx, sy] = toScreen(p.x, p.y, p.z), a = 1 - p.t / p.life; ctx.fillStyle = `rgba(120,112,108,${a * .55})`; ctx.fillRect(Math.round(ox + sx), Math.round(oy + sy), 2, 2); }
  const [gx, gy] = toScreen(pl.x, pl.y, 0), hz = pl.z;
  const lying = pl.anim === 'death' && frameOf() >= 7;
  const f = pl.frame ?? frameOf();
  const list = [{ d: pl.x + pl.y, draw: () => {
    shadow(ox + gx, oy + gy, Math.max(6, (lying ? 20 : 12) - hz * .12), Math.max(2, 5 - hz * .05), Math.max(.08, .22 - hz * .004));
    sprite(pl.wid, pl.anim, f, pl.k, ox + gx, oy + gy - hz * Math.cos(Math.PI / 6));
  } }];
  for (const e of foes) list.push({ d: e.x + e.y - (e.anim === 'death' && eDone(e) ? 40 : 0), draw: () => {
    const [sx, sy] = toScreen(e.x, e.y, 0), sc = ENEMIES[e.id].look.scale || 1;
    ctx.globalAlpha = e.dead > 28 ? Math.max(0, 1 - (e.dead - 28) / 2) : 1;
    shadow(ox + sx, oy + sy, Math.round(12 * sc), Math.max(2, Math.round(5 * sc)), .2);
    ctx.drawImage(ESETS[e.id][e.anim], eFrame(e) * SW, e.k * SH, SW, SH, Math.round(ox + sx - OX), Math.round(oy + sy - OY), SW, SH);
    ctx.globalAlpha = 1;
  } });
  list.sort((p, q) => p.d - q.d).forEach(o => o.draw());
  drawDrops(ox, oy);
  for (const b of bolts) {
    const [sx, sy] = toScreen(b.x, b.y, b.z), fl = (b.t * 20 | 0) & 1;
    const [tx, ty] = toScreen(b.x - b.vx * .06, b.y - b.vy * .06, b.z);
    ctx.fillStyle = 'rgba(138,22,6,.6)'; ctx.fillRect(Math.round(ox + tx - 2), Math.round(oy + ty - 2), 4, 4);
    ctx.fillStyle = '#ff6a1e'; ctx.fillRect(Math.round(ox + sx - 3), Math.round(oy + sy - 3), 6, 6);
    ctx.fillStyle = fl ? '#ffc050' : '#d0380e'; ctx.fillRect(Math.round(ox + sx - 1), Math.round(oy + sy - 2), 3, 3);
  }
  hud.innerHTML = `<b>${nameOf(pl.anim, pl.wid)}</b> · ${DIRS[pl.k]} · cuadro ${f + 1}/${info(pl.anim).n} · arma: <b>${wname(pl.wid)}</b> · sangre: ${'▮'.repeat(goreLevel())}${'▯'.repeat(4 - goreLevel())}${pl.cleaning ? ' <i>(limpiándose…)</i>' : goreBusy ? ' <i>(manchándose…)</i>' : ''}${bakingNote()}<br>
WASD / flechas: caminar · Shift: correr · C: agacharse / levantarse · Espacio: saltar · Q: rodar<br>
1 puñal · 2 machete · 3 hacha · 4 candelabro · 5 horca · 0 sin arma<br>
Clic izquierdo: golpe (clic otra vez para encadenar 1→2→3) · J / K / L: golpe 1 / 2 / 3<br>
E: interactuar · F (mantener): crucifijo · R: rezar · H: herido · X: morir · T: levantarse · Tab: galería<br>
N: aparecer enemigo (siguiente: <b>${ENEMIES[ENEMY_IDS[spawnIdx % ENEMY_IDS.length]].name}</b>) · M: quitar enemigos y limpiar la sangre${pendingSpawn.length ? ` · <i>invocando ${ENEMIES[pendingSpawn[0]].name}… ${Math.round((progress['e:' + pendingSpawn[0]] || 0) * 100)}%</i>` : ''}`;
}

function drawGallery(dt) {
  gT += dt;
  const whoN = ENEMY_IDS.length + 1;
  if (pressed('ArrowDown') || pressed('KeyS')) { gWho = (gWho + 1) % whoN; gIdx = 0; gT = 0; }
  if (pressed('ArrowUp') || pressed('KeyW')) { gWho = (gWho + whoN - 1) % whoN; gIdx = 0; gT = 0; }
  const eid = gWho ? ENEMY_IDS[gWho - 1] : null;
  if (!eid) {
    WEAPON_IDS.forEach((w, i) => { if (pressed('Digit' + (i + 1))) { gWid = w; want = w; gT = 0; } });
    if (pressed('Digit0') || pressed('Backquote')) { gWid = ''; gT = 0; }
  } else wantE = eid;
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, view.w, view.h);
  const who = eid ? ENEMIES[eid].name : 'Padre · ' + wname(gWid);
  if (eid ? !ESETS[eid] : !SETS[gWid]) {
    const pr = eid ? progress['e:' + eid] : progress[gWid];
    hud.innerHTML = `<b>galería</b> · ${who}<br><i>pintando… ${Math.round((pr || 0) * 100)}%</i><br>↑ / ↓: cambiar personaje · Tab: volver a jugar`;
    return;
  }
  const names = eid ? ENEMY_ANIMS : animsFor(gWid);
  if (pressed('ArrowRight') || pressed('KeyD')) { gIdx = (gIdx + 1) % names.length; gT = 0; }
  if (pressed('ArrowLeft') || pressed('KeyA')) { gIdx = (gIdx + names.length - 1) % names.length; gT = 0; }
  gIdx %= names.length;
  const name = names[gIdx], A = eid ? ENEMIES[eid].anims[name] : animInfo(name, gWid);
  const fps = A.hop ? 9 : A.stride ? (eid ? A.n * ENEMIES[eid].speed * A.stance / (2 * A.stride) : fpsOf(name, name === 'run' ? RUN : name === 'walk' ? WALK : CROUCH)) : A.fps;
  const f = A.loop ? Math.floor(gT * fps) % A.n : Math.min(A.n - 1, Math.floor(gT * fps) % (A.n + 6));
  const sheet = eid ? ESETS[eid][name] : SETS[gWid][name];
  const draw = (fr, k, x, y) => ctx.drawImage(sheet, fr * SW, k * SH, SW, SH, Math.round(x - OX), Math.round(y - OY), SW, SH);
  const cw = Math.min(80, Math.floor(view.w / 8)), x0 = Math.floor((view.w - cw * 8) / 2) + cw / 2;
  ctx.font = '8px monospace'; ctx.textAlign = 'center';
  for (let k = 0; k < 8; k++) {
    const x = x0 + k * cw, y = 125;
    shadow(x, y, 11, 4, .18); draw(f, k, x, y);
    ctx.fillStyle = '#8a8288'; ctx.fillText(DIRS[k], x, y + 14);
  }
  const n = A.n, fw = Math.min(cw, Math.floor(view.w / n), name === 'death' ? 80 : 60), fx0 = Math.floor((view.w - fw * n) / 2) + fw / 2;
  for (let i = 0; i < n; i++) { const x = fx0 + i * fw, y = 255; shadow(x, y, 11, 4, .12); draw(i, 1, x, y); ctx.fillStyle = '#b0a8ae'; ctx.fillText(i + 1, x, y + 14); }
  const an = eid ? ENAMES[name] : nameOf(name, gWid);
  hud.innerHTML = `<b>galería</b> · <b>${who}</b> (${gWho + 1}/${whoN}) · ${an} (${gIdx + 1}/${names.length}) · ${n} cuadros × 8 direcciones<br>↑ / ↓: cambiar personaje · ← / →: cambiar animación${eid ? '' : ' · 1-5 / 0: arma del padre'} · Tab: volver a jugar`;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (pressed('Tab')) { gallery = !gallery; gT = 0; gWid = pl.wid; resize(); }
  if (gallery) drawGallery(dt); else { update(dt); goreTick(); drawPlay(); }
  hit.clear();
  requestAnimationFrame(frame);
}

resize();
await bakeSet('');
load.remove();
window.__S = { goreLevel, pl, SETS, ESETS, foes, progress, ANIMS, spawn: id => { wantE = id; pendingSpawn.push(id); }, setGallery: (on, i = 0, w = '', who = 0) => { gallery = on; gIdx = i; gWid = w; gWho = who; want = w || want; wantE = who ? ENEMY_IDS[who - 1] : wantE; gT = 0; resize(); } };
requestAnimationFrame(frame);
baker();
