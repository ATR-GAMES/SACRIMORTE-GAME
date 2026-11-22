// Combat bench: the priest on a plain white floor against the demon's ten, with health, stamina, five weapons, the
// roll, prayer and the crucifix, and a great deal of blood. Plus a gallery of every animation in all eight facings.
import { ANIMS, bake, animsFor, animInfo, OX, OY } from './priest.js?v=96ed7b9';
import { WEAPONS, WEAPON_IDS } from './weapons.js?v=96ed7b9';
import { toScreen } from './raster.js?v=96ed7b9';
import { ENEMIES, ENEMY_IDS, ENEMY_ANIMS, bakeEnemy } from './enemies.js?v=96ed7b9';
import { Sheet, loadPacked } from './atlas.js?v=96ed7b9';
import { initTouch } from './touch.js?v=96ed7b9';
import { MOBILE, PERF } from './device.js?v=96ed7b9';

const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const hud = document.getElementById('hud'), load = document.getElementById('load'), deathEl = document.getElementById('death'), pauseEl = document.getElementById('pause');
const DIRS = ['SE', 'S', 'SO', 'O', 'NO', 'N', 'NE', 'E'];
const NAMES = { idle: 'quieto', walk: 'caminar', run: 'correr', crouch: 'agachado', cwalk: 'agachado andando', jump: 'salto', roll: 'rodar',
  interact: 'interactuar', cross: 'crucifijo', pray: 'rezar', hurt: 'herido', death: 'muerte', clean: 'limpiarse la sangre' };
const nameOf = (a, wid) => a.startsWith('atk') ? `golpe ${a[3]}: ${WEAPONS[wid].blows[+a[3] - 1].name}` : NAMES[a];
const wname = wid => wid ? WEAPONS[wid].name : 'sin arma';
const ENAMES = { idle: 'quieto', walk: 'caminar', atk: 'ataque', hurt: 'herido', death: 'muerte' };
const fkey = (a, k, f) => a + '|' + k + '|' + f;

// ---------------------------------------------------------------- tuning
// Weapons: damage per blow, reach, how wide the cut is (the cosine of its half-angle), stamina, knockback.
const WSTAT = {
  daga:       { dmg: 1.0, reach: 28, cone: .35, stam: 9,  knock: 3 },
  machete:    { dmg: 1.6, reach: 33, cone: .2,  stam: 13, knock: 6 },
  hacha:      { dmg: 2.8, reach: 38, cone: .15, stam: 20, knock: 10 },
  candelabro: { dmg: 2.4, reach: 41, cone: -.05, stam: 22, knock: 20 },
  horca:      { dmg: 2.0, reach: 50, cone: .6,  stam: 15, knock: 8 },
};
// Enemies: health, damage, how hard to stagger (a blow must do at least this), demonic (the crucifix burns them).
const ESTAT = {
  poseido:     { hp: 4,   dmg: 7,  poise: 0,   demon: 0 },
  carnicero:   { hp: 10,  dmg: 16, poise: 2.4, demon: 0 },
  monja:       { hp: 4,   dmg: 9, poise: 0,   demon: 0 },
  acolito:     { hp: 5,   dmg: 10, poise: 0,   demon: 1 },
  flagelante:  { hp: 6,   dmg: 10, poise: 1.5, demon: 1 },
  nino:        { hp: 2.5, dmg: 6,  poise: 0,   demon: 0 },
  obispo:      { hp: 7,   dmg: 12, poise: 1.5, demon: 1 },
  cabrio:      { hp: 14,  dmg: 20, poise: 2.6, demon: 1 },
  crucificado: { hp: 11,  dmg: 14, poise: 2.4, demon: 0 },
  diablillo:   { hp: 3,   dmg: 6,  poise: 0,   demon: 1 },
};
const HP = 100, ST = 100, ROLL_COST = 26, CROSS_DRAIN = 20, ST_REGEN = 42, PRAY_HEAL = 7;

// ---------------------------------------------------------------- sprites
const SETS = {}, CLEAN = {}, ESETS = {}, progress = {};
// Painting sprites is the heaviest thing the game does; it is done in slices of a few milliseconds so frames keep flowing.
let sliceT = 0;
const tick = () => new Promise(r => setTimeout(r, 0));
const yieldIfLate = async () => { if (performance.now() - sliceT > PERF.bakeBudget) { await tick(); sliceT = performance.now(); } };
async function bakeSet(wid) {
  const key = wid || '', pre = await loadPacked('p-' + (key || 'mano'));
  if (pre) { pre.gore = 0; progress[key] = 1; CLEAN[key] = pre; if (!SETS[key]) SETS[key] = pre; return; }
  const list = animsFor(wid), sh = new Sheet();
  const total = list.reduce((s, a) => s + animInfo(a, wid).n * 8, 0); let done = 0;
  for (const a of list) {
    const n = animInfo(a, wid).n;
    for (let k = 0; k < 8; k++) {
      for (let f = 0; f < n; f++) { sh.add(fkey(a, k, f), bake(a, f, k, wid, 0)); done++; progress[key] = done / total; await yieldIfLate(); }
    }
  }
  sh.gore = 0; CLEAN[key] = sh; if (!SETS[key]) SETS[key] = sh;
}
async function bakeEnemySet(id) {
  const pre = await loadPacked('e-' + id);
  if (pre) { progress['e:' + id] = 1; ESETS[id] = pre; return; }
  const E = ENEMIES[id], sh = new Sheet(), total = ENEMY_ANIMS.reduce((s, a) => s + E.anims[a].n * 8, 0); let done = 0;
  for (const a of ENEMY_ANIMS) for (let k = 0; k < 8; k++) {
    for (let f = 0; f < E.anims[a].n; f++) { sh.add(fkey(a, k, f), bakeEnemy(id, a, f, k)); done++; progress['e:' + id] = done / total; await yieldIfLate(); }
  }
  ESETS[id] = sh;
}
// Blood on the priest: repainted row by row (one animation in one facing), what is on screen first.
let goreBusy = false;
const GORE_STEPS = [.05, .2, .4, .65];
const goreLevel = () => GORE_STEPS.filter(t => pl.gore >= t).length;
const GORE_FIRST = ['atk1', 'atk2', 'atk3', 'idle', 'walk', 'run', 'hurt', 'clean', 'roll'];
function nextRow(sh, lvl) {
  const order = [pl.anim, ...GORE_FIRST, ...Object.keys(sh.rows)];
  for (const dirs of [[pl.k], [0, 1, 2, 3, 4, 5, 6, 7]]) for (const a of order) if (sh.rows[a]) for (const d of dirs) if (sh.rows[a][d] !== lvl) return [a, d];
  return null;
}
// Repainting goes frame by frame inside a row, so no single game frame has to wait for a whole animation.
let goreJob = null;
function goreTick() {
  const key = pl.wid || '', lvl = goreLevel();
  let sh = SETS[key];
  goreBusy = false;
  if (!sh) return;
  if (!lvl) { if (CLEAN[key] && sh !== CLEAN[key]) SETS[key] = CLEAN[key]; return; }
  if (sh === CLEAN[key]) { sh = sh.clone(); sh.rows = {}; for (const a of animsFor(pl.wid)) sh.rows[a] = new Array(8).fill(0); SETS[key] = sh; }
  const t0 = performance.now();
  do {
    if (!goreJob || goreJob.sh !== sh || goreJob.lvl !== lvl) { const r = nextRow(sh, lvl); if (!r) { goreJob = null; break; } goreJob = { sh, lvl, a: r[0], k: r[1], f: 0 }; }
    const j = goreJob, n = info(j.a).n;
    sh.put(fkey(j.a, j.k, j.f), bake(j.a, j.f, j.k, pl.wid, lvl));
    if (++j.f >= n) { sh.rows[j.a][j.k] = lvl; goreJob = null; }
  } while (performance.now() - t0 < PERF.goreBudget);
  goreBusy = !!(goreJob || nextRow(sh, lvl));
}
// Everything not needed at boot is painted in the background; whatever is asked for jumps the queue.
let want = null, wantE = null;
async function baker() {
  const queue = [...WEAPON_IDS.map(w => ['w', w]), ...ENEMY_IDS.map(e => ['e', e])];
  while (queue.length) {
    const need = pendingSpawn.find(id => !ESETS[id]) || (wantE && !ESETS[wantE] ? wantE : null);
    let i = need ? queue.findIndex(q => q[0] === 'e' && q[1] === need) : -1;
    if (i < 0 && want && !SETS[want]) i = queue.findIndex(q => q[0] === 'w' && q[1] === want);
    // On a phone nothing is painted ahead of time: only what has been asked for.
    if (i < 0 && !PERF.prefetch) { await new Promise(r => setTimeout(r, 120)); continue; }
    const [[t, id]] = queue.splice(Math.max(0, i), 1);
    if (t === 'w') await bakeSet(id); else await bakeEnemySet(id);
  }
}
const fpsOf = (name, speed) => { const A = ANIMS[name]; return A.stride ? A.n * speed * A.stance / (2 * A.stride) : A.fps; };

// ---------------------------------------------------------------- input
const keys = new Set(), hit = new Set();
addEventListener('keydown', e => {
  const k = e.code; if (!keys.has(k)) hit.add(k); keys.add(k);
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape'].includes(k)) e.preventDefault();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
addEventListener('mousedown', e => { if (paused || performance.now() - (window.__lastTouch || -1e9) < 900) return; hit.add('Mouse' + e.button); e.preventDefault(); });
addEventListener('contextmenu', e => e.preventDefault());
const down = (...c) => c.some(k => keys.has(k)), pressed = c => hit.has(c);

// ---------------------------------------------------------------- the priest
const WALK = 40, RUN = 86, CROUCH = 21, ROLL = 200, JUMPV = 150, G = 520;
const pl = { x: 0, y: 0, z: 0, vz: 0, k: 1, mode: 'ground', anim: 'idle', t: 0, timer: 0, vx: 0, vy: 0, kx: 0, ky: 0, crouch: false, wid: '', pending: null,
  gore: 0, hp: HP, st: ST, stT: 0, flash: 0, stats: { kills: 0, wounds: 0, t0: performance.now() }, deathT: 0 };
const dust = [];
const info = a => animInfo(a, pl.wid);
const setAnim = (a) => { if (pl.anim !== a) { pl.anim = a; pl.t = 0; } };
const frameOf = () => { const A = info(pl.anim), f = Math.floor(pl.t * (pl.fps || A.fps || 8)); return A.loop ? f % A.n : Math.min(A.n - 1, f); };
const done = () => Math.floor(pl.t * (pl.fps || info(pl.anim).fps)) >= info(pl.anim).n;
const puff = (n, spread, x = pl.x, y = pl.y) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28; dust.push({ x, y, vx: Math.cos(a) * spread * (.5 + Math.random()), vy: Math.sin(a) * spread * (.5 + Math.random()), z: 1, life: .45 + Math.random() * .3, t: 0 }); } };
const spend = n => { pl.st = Math.max(0, pl.st - n); pl.stT = .7; };
const startBlow = n => {
  const s = WSTAT[pl.wid]; if (pl.st < s.stam * .4) { pl.tired = .5; return false; }
  spend(s.stam); pl.crouch = false; pl.mode = 'atk'; pl.blow = n; pl.queued = false; pl.fps = 0; pl.anim = 'atk' + n; pl.t = 0; pl.lunged = false; return true;
};
const dirOf = k => [Math.cos(k * Math.PI / 4), Math.sin(k * Math.PI / 4)];
let hitStop = 0, shake = 0;

// Screen direction → world direction (iso): right = (1,-1)/√2, down = (1,1)/√2.
function moveVec() {
  let sx = 0, sy = 0;
  if (down('KeyA', 'ArrowLeft')) sx--; if (down('KeyD', 'ArrowRight')) sx++;
  if (down('KeyW', 'ArrowUp')) sy--; if (down('KeyS', 'ArrowDown')) sy++;
  if (!sx && !sy) return null;
  const l = Math.hypot(sx, sy); sx /= l; sy /= l;
  const wx = (sx + sy * 2) * Math.SQRT1_2, wy = (-sx + sy * 2) * Math.SQRT1_2, wl = Math.hypot(wx, wy);
  return { x: wx / wl, y: wy / wl, k: ((Math.round(Math.atan2(wy, wx) / (Math.PI / 4)) % 8) + 8) % 8 };
}
function pickWeapon() {
  let pick;
  WEAPON_IDS.forEach((w, i) => { if (pressed('Digit' + (i + 1)) || pressed('Numpad' + (i + 1))) pick = w; });
  if (pressed('Digit0') || pressed('Backquote') || pressed('Numpad0')) pick = '';
  if (pick !== undefined) { pl.pending = pick; want = pick; }
}

// The priest takes a blow. Rolling, he isn't there; praying, he is wide open.
function hurtPriest(dmg, fx, fy, knock = 0, by = null) {
  if (pl.mode === 'dead' || pl.mode === 'roll') return false;
  if (pl.mode === 'pray' || pl.mode === 'unpray') dmg *= 1.5;
  pl.hp -= dmg; pl.flash = .12; pl.fightT = 0; pl.stats.wounds++; pl.gore += .02 + dmg / 300; shake = Math.max(shake, .18);
  const l = Math.hypot(fx, fy) || 1;
  bleed(pl.x, pl.y, 36, fx / l, fy / l, 18 + dmg * 1.5); splat({ x: pl.x + fx / l * 3, y: pl.y + fy / l * 3, r: 2 + dmg / 8, el: 1.2, dx: fx, dy: fy });
  pl.kx += fx / l * knock * 4; pl.ky += fy / l * knock * 4;
  if (pl.hp <= 0) { pl.hp = 0; pl.mode = 'dead'; pl.fps = 0; setAnim('death'); pl.frame = null; bleed(pl.x, pl.y, 30, 0, 0, 80, 1.1); fallen(by);
    pools.push({ x: pl.x, y: pl.y, t: -.8, r: 0, max: 20, el: .5, dx: 1, dy: 1, seed: (Math.random() * 1e9 | 0) + 1 }); return true; }
  if (pl.mode !== 'air' && pl.mode !== 'prep' && (pl.mode !== 'atk' || dmg >= 15)) { pl.mode = 'act'; pl.fps = 0; setAnim('hurt'); pl.frame = null; pl.crouch = false; }
  return true;
}
// ---------------------------------------------------------------- death
const EPITAPHS = [
  ['Pulvis es, et in pulverem reverteris.', 'Polvo eres, y en polvo te convertirás.', 'Génesis 3, 19'],
  ['Memento mori.', 'Recuerda que has de morir.', ''],
  ['Libera me, Domine, de morte aeterna.', 'Líbrame, Señor, de la muerte eterna.', 'Responsorio de difuntos'],
  ['Dies irae, dies illa, solvet saeclum in favilla.', 'Día de ira aquel día, en que el mundo se reducirá a cenizas.', 'Secuencia de difuntos'],
  ['In manus tuas, Domine, commendo spiritum meum.', 'En tus manos, Señor, encomiendo mi espíritu.', 'Lucas 23, 46'],
  ['Mors certa, hora incerta.', 'La muerte es cierta; la hora, incierta.', ''],
  ['Requiem aeternam dona eis, Domine.', 'Dales, Señor, el descanso eterno.', 'Misa de difuntos'],
  ['Ubi est, mors, victoria tua?', '¿Dónde está, oh muerte, tu victoria?', '1 Corintios 15, 55'],
];
const KILLER = { poseido: 'un poseído', carnicero: 'el carnicero', monja: 'la monja reptante', acolito: 'un acólito', flagelante: 'un flagelante',
  nino: 'el niño del coro', obispo: 'el fuego del obispo negro', cabrio: 'el cabrío', crucificado: 'el crucificado', diablillo: 'un diablillo' };
const ash = [];
let epi = 0;
function fallen(by) {
  pl.deathT = 0; ash.length = 0;
  epi = (epi + 1 + (Math.random() * (EPITAPHS.length - 1) | 0)) % EPITAPHS.length;
  const [la, es, src] = EPITAPHS[epi], s = pl.stats, secs = Math.round((performance.now() - s.t0) / 1000);
  deathEl.className = '';
  deathEl.innerHTML = '<div class="d-title">¡Has caído!</div>';
}
function revive() {
  deathEl.className = ''; deathEl.innerHTML = ''; pl.stats = { kills: 0, wounds: 0, t0: performance.now() };
  foes.length = 0; bolts.length = 0; pendingSpawn.length = 0;
  Object.assign(pl, { hp: HP, st: ST, mode: 'ground', x: 0, y: 0, z: 0, kx: 0, ky: 0, gore: 0, frame: null }); setAnim('idle');
}

function update(dt) {
  pl.t += dt;
  pickWeapon();
  if (pl.pending !== null && SETS[pl.pending] && pl.mode !== 'atk') {
    const old = pl.wid || ''; if (CLEAN[old]) SETS[old] = CLEAN[old];
    pl.wid = pl.pending; pl.pending = null; if (!info(pl.anim)) setAnim('idle');
  }
  const mv = moveVec(), shift = down('ShiftLeft', 'ShiftRight');
  if ((pressed('KeyT') || pressed('Enter') || pressed('NumpadEnter')) && pl.mode === 'dead' && pl.deathT > 1.8) revive();
  const blowKey = pressed('Mouse0') ? 0 : pressed('KeyJ') ? 1 : pressed('KeyK') ? 2 : pressed('KeyL') ? 3 : -1;
  const canRoll = () => pl.st >= 10;

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
      else if (pressed('KeyQ') && canRoll()) { if (mv) pl.k = mv.k; spend(ROLL_COST); pl.mode = 'roll'; pl.fps = 0; setAnim('roll'); puff(4, 10); }
      else if (pressed('KeyE')) { pl.mode = 'act'; pl.fps = 0; setAnim('interact'); }
      else if (pressed('KeyR')) { pl.mode = 'pray'; pl.fps = 0; setAnim('pray'); }
      else if (pressed('KeyF') && pl.st > 5) { pl.mode = 'cross'; pl.fps = 0; setAnim('cross'); }
      break;
    }
    case 'atk': {
      if (blowKey === 0 && pl.blow < 3 && frameOf() >= 2) pl.queued = true;
      if (blowKey > 0 && frameOf() >= 4) pl.queuedTo = blowKey;
      // Rolling out of a blow once it has landed.
      if (pressed('KeyQ') && frameOf() >= 4 && canRoll()) { if (mv) pl.k = mv.k; spend(ROLL_COST); pl.mode = 'roll'; pl.fps = 0; setAnim('roll'); puff(4, 10); break; }
      const f = frameOf();
      if (f === 3 || f === 4) { const d = dirOf(pl.k), sp = WEAPONS[pl.wid].two ? 34 : 44; pl.x += d[0] * sp * dt; pl.y += d[1] * sp * dt; }
      if (f === 3 && !pl.lunged) { pl.lunged = true; puff(2, 6); }
      if (done()) {
        if (pl.queued && startBlow(pl.blow + 1)) {}
        else if (pl.queuedTo) { const n = pl.queuedTo; pl.queuedTo = 0; if (!startBlow(n)) { pl.mode = 'ground'; setAnim('idle'); } }
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
      const d = dirOf(pl.k), sp = ROLL * (1 - Math.min(1, pl.t * 1.6) * .45);
      pl.x += d[0] * sp * dt; pl.y += d[1] * sp * dt;
      if (done()) { pl.mode = 'ground'; puff(3, 8); }
      break;
    }
    case 'act': if (done()) pl.mode = 'ground'; break;
    case 'pray':
      if (pl.t * ANIMS.pray.fps >= 3) { pl.frame = 3 + Math.floor((pl.t * ANIMS.pray.fps - 3) / 2) % 3; pl.hp = Math.min(HP, pl.hp + PRAY_HEAL * dt); }
      if (pressed('KeyR') || mv || pressed('Space')) { pl.mode = 'unpray'; pl.timer = .35; }
      break;
    case 'unpray':
      pl.timer -= dt; pl.frame = pl.timer > .2 ? 2 : pl.timer > .08 ? 1 : 0;
      if (pl.timer <= 0) { pl.mode = 'ground'; pl.frame = null; }
      break;
    case 'cross':
      if (pl.t * 8 >= 2) pl.frame = 2 + Math.floor(pl.t * 3) % 2;
      pl.st = Math.max(0, pl.st - CROSS_DRAIN * dt); pl.stT = .7;
      if (!down('KeyF') || pl.st <= 0) { pl.mode = 'ground'; pl.frame = null; }
      break;
    case 'dead': break;
  }
  if (pl.mode === 'ground' || pl.mode === 'act' || pl.mode === 'dead' || pl.mode === 'atk' || pl.mode === 'roll') pl.frame = null;

  // Knocked back, stamina, flashes.
  pl.x += pl.kx * dt; pl.y += pl.ky * dt; pl.kx *= Math.exp(-dt * 7); pl.ky *= Math.exp(-dt * 7);
  pl.stT -= dt; if (pl.stT <= 0 && pl.mode !== 'cross') pl.st = Math.min(ST, pl.st + ST_REGEN * dt);
  pl.flash = Math.max(0, pl.flash - dt); pl.tired = Math.max(0, (pl.tired || 0) - dt);
  clampToView(pl);

  if (pressed('KeyN')) { const id = ENEMY_IDS[spawnIdx % ENEMY_IDS.length]; spawnIdx++; wantE = id; pendingSpawn.push(id); }
  if (pressed('KeyB')) for (let i = 0; i < 6; i++) { const id = ENEMY_IDS[Math.random() * ENEMY_IDS.length | 0]; pendingSpawn.push(id); }
  if (pressed('KeyM')) { foes.length = 0; bolts.length = 0; pendingSpawn.length = 0; drops.length = 0; pools.length = 0; splats.length = 0; resetFloor(); pl.gore = 0; }
  updateFoes(dt);
  updateBlood(dt);
  // Once the killing is over he comes clean again (standing still, wiping himself down).
  pl.fightT = (pl.fightT ?? 99) + dt;
  pl.gore = Math.min(1, pl.gore);
  const living = foes.filter(f => f.anim !== "death"), near = living.some(f => Math.hypot(f.x - pl.x, f.y - pl.y) < 70);
  pl.cleaning = pl.mode !== 'dead' && pl.gore > 0 && ((!living.length && pl.fightT > 2.5) || (!near && pl.fightT > 8));
  if (pl.cleaning && pl.anim === 'clean') pl.gore = Math.max(0, pl.gore - .1 * dt);
  for (const p of dust) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += 8 * dt; p.vx *= .92; p.vy *= .92; }
  for (let i = dust.length - 1; i >= 0; i--) if (dust[i].t > dust[i].life) dust.splice(i, 1);
}
function clampToView(o) {
  const [sx, sy] = toScreen(o.x, o.y, 0), mx = view.w / 2 - 26, my = view.h / 2 - 14;
  const cx = Math.max(-mx, Math.min(mx, sx)), cy = Math.max(-my + 50, Math.min(my, sy));
  if (cx !== sx || cy !== sy) { const a = cx / Math.SQRT1_2, b = cy / (Math.SQRT1_2 * .5); o.x = (a + b) / 2; o.y = (b - a) / 2; }
}

// ---------------------------------------------------------------- blood
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
    if (d > 1 + (R() - .5) * .55) continue;
    let c = s.pool ? (d < .55 ? 1 : d < .85 ? 2 : 1) : (d < .35 ? 3 : d < .8 ? 2 : 1);
    if (R() < .08) c += 1; if (s.pool && d > .88 && R() < .3) c = 4;
    if (s.dark) c = Math.max(0, c - 1);
    g.fillStyle = BLOOD[Math.min(5, c)]; g.fillRect(cx + i, cy + j, 1, 1);
  }
  const n = s.pool ? 0 : Math.round(r * .8 + el * 2);
  for (let k = 0; k < n; k++) {
    const t = R() * Math.PI * 2, rr = r * (1.3 + R() * (1.2 + el)), ox = Math.cos(t) * rr + dx * el * r * R(), oy = Math.sin(t) * rr * .55 + dy * el * r * R();
    g.fillStyle = BLOOD[2 + (R() < .4 ? 1 : 0)]; g.fillRect(Math.round(cx + ox), Math.round(cy + oy), 1, 1);
  }
}
function splat(s) { s.seed = s.seed || (Math.random() * 1e9 | 0) + 1; splats.push(s); if (splats.length > PERF.splats) splats.shift(); paintSplat(floorCtx, s); }
function resetFloor() { floor.width = view.w; floor.height = view.h; floorCtx = floor.getContext('2d'); for (const s of splats) paintSplat(floorCtx, s); }
function bleed(x, y, z, dx, dy, n, power = 1) {
  n = Math.round(n * PERF.blood);
  for (let i = 0; i < n; i++) {
    const a = Math.atan2(dy, dx) + rnd(-.9, .9) * (dx || dy ? 1 : 3.5), sp = rnd(20, 150) * power;
    drops.push({ x: x + rnd(-2, 2), y: y + rnd(-2, 2), z: z + rnd(-4, 4), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rnd(10, 130) * power, sz: Math.random() < .25 ? 2 : 1 });
  }
}
function gibs(x, y, z, n) { for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), sp = rnd(30, 110); drops.push({ x, y, z: z + rnd(-6, 6), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rnd(60, 170), sz: 3, gib: 1 }); } }
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

// ---------------------------------------------------------------- enemies
const foes = [], bolts = [];
let spawnIdx = 0;
const pendingSpawn = [];
const octOf = (dx, dy) => ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
const eInfo = (f) => ENEMIES[f.id].anims[f.anim];
const eSet = (f, a) => { if (f.anim !== a) { f.anim = a; f.t = 0; f.struck = false; } };
const eFrame = f => { const A = eInfo(f), n = Math.floor(f.t * (f.fps || A.fps || 8)); return A.loop ? n % A.n : Math.min(A.n - 1, n); };
const eDone = f => Math.floor(f.t * (f.fps || eInfo(f).fps)) >= eInfo(f).n;
const alive = f => f.anim !== 'death';
function spawnFoe(id) {
  // From a random edge of what the camera sees.
  const side = Math.random() * 4 | 0, u = Math.random(), mx = view.w / 2 - 30, my = view.h / 2 - 20;
  const sx = side < 2 ? (side ? mx : -mx) : (u * 2 - 1) * mx, sy = side >= 2 ? (side === 2 ? -my + 50 : my) : (u * 2 - 1) * my + 25;
  const a = sx / Math.SQRT1_2, b = sy / (Math.SQRT1_2 * .5);
  foes.push({ id, x: (a + b) / 2, y: (b - a) / 2, k: 0, anim: 'idle', t: Math.random(), hp: ESTAT[id].hp, fps: 0, dead: 0, cool: .8 + Math.random() * .8,
    side: Math.random() < .5 ? 1 : -1, flash: 0, barT: 0, kx: 0, ky: 0, seed: Math.random() * 100 });
}
// The priest's blow, landing on frame 3 of every swing.
function priestBlow() {
  const s = WSTAT[pl.wid], fd = dirOf(pl.k), mult = pl.blow === 3 ? 1.5 : 1;
  let any = false;
  for (const f of foes) {
    if (!alive(f)) continue;
    const dx = f.x - pl.x, dy = f.y - pl.y, d = Math.hypot(dx, dy) || 1, sc = ENEMIES[f.id].look.scale || 1;
    if (d > s.reach + 6 * sc || (dx * fd[0] + dy * fd[1]) / d < s.cone) continue;
    any = true;
    const dmg = s.dmg * mult, E = ESTAT[f.id];
    f.hp -= dmg; f.flash = .1; f.barT = 3;
    const kb = s.knock * mult / Math.max(1, sc * sc); f.kx += dx / d * kb * 6; f.ky += dy / d * kb * 6;
    bleed(f.x, f.y, 34 * sc, dx / d, dy / d, Math.round(30 + dmg * 16), WEAPONS[pl.wid].two ? 1.25 : 1);
    splat({ x: f.x + dx / d * 4, y: f.y + dy / d * 4, r: 3 + dmg * 1.2 * sc, el: 1.5, dx, dy });
    pl.gore += .02 + dmg * .015; pl.fightT = 0;
    if (f.hp <= 0) {
      f.anim = ''; f.fps = 0; eSet(f, 'death'); f.charge = null; pl.stats.kills++;
      bleed(f.x, f.y, 30 * sc, dx / d, dy / d, 110, 1.3); bleed(f.x, f.y, 26 * sc, 0, 0, 40, .8); gibs(f.x, f.y, 30 * sc, 10); pl.gore += .04;
      pools.push({ x: f.x, y: f.y, t: -.7, r: 0, max: 16 * sc + Math.random() * 5, el: .6, dx, dy, seed: (Math.random() * 1e9 | 0) + 1 });
    } else if (dmg >= E.poise) { f.anim = ''; f.fps = 0; eSet(f, 'hurt'); f.charge = null; f.combo = null; }
  }
  if (any) { hitStop = .055; shake = Math.max(shake, .12); }
}
// How close each one stands to the priest, and how far its blows reach from there.
const sepOf = f => 8 * ((ENEMIES[f.id].look.scale || 1) + 1);
const reachOf = f => sepOf(f) + ENEMIES[f.id].range * .5 + 5;
const isAtk = a => a === 'atk' || a === 'atk2' || a === 'atk3';
const MULT = { atk: 1, atk2: .8, atk3: 1.4 };
const startAttack = (f, a, leap = false) => { f.fps = 0; f.anim = ''; eSet(f, a); f.leapA = leap; };
const nextCombo = f => { const C = ENEMIES[f.id].combos; f.combo = [...C[Math.random() * C.length | 0]]; startAttack(f, f.combo.shift()); };
function walkAnim(f, sp) { const A = ENEMIES[f.id].anims.walk; eSet(f, 'walk'); f.fps = A.hop ? 9 : A.n * sp * A.stance / (2 * A.stride); }

function updateFoes(dt) {
  for (const id of pendingSpawn.splice(0)) { if (ESETS[id]) spawnFoe(id); else pendingSpawn.push(id); }
  if (pl.mode !== 'atk' || frameOf() < 3) pl.hitDone = false;
  if (pl.mode === 'atk' && frameOf() === 3 && !pl.hitDone) { pl.hitDone = true; priestBlow(); }
  // The crucifix held up: the demon's own burn and are driven back, the possessed cower.
  const crossUp = pl.mode === 'cross' && pl.t * 8 >= 2, cd = dirOf(pl.k);
  for (const f of foes) {
    f.t += dt; f.flash = Math.max(0, f.flash - dt); f.barT = Math.max(0, f.barT - dt);
    f.x += f.kx * dt; f.y += f.ky * dt; f.kx *= Math.exp(-dt * 8); f.ky *= Math.exp(-dt * 8);
    const E = ENEMIES[f.id], S = ESTAT[f.id], sc = E.look.scale || 1, dx = pl.x - f.x, dy = pl.y - f.y, d = Math.hypot(dx, dy) || 1;
    if (!alive(f)) { if (eDone(f)) f.dead += dt; continue; }
    f.cowed = false;
    if (crossUp && d < 85 && (-dx * cd[0] - dy * cd[1]) / d > .45) {
      f.cowed = true; f.x -= dx / d * 34 * dt; f.y -= dy / d * 34 * dt; f.combo = null; f.charge = null;
      if (S.demon) { f.burn = (f.burn || 0) + dt; if (f.burn > .45) { f.burn = 0; f.hp -= .5; f.flash = .1; f.barT = 3; bleed(f.x, f.y, 30 * sc, -dx / d, -dy / d, 6, .6);
        if (f.hp <= 0) { f.anim = ''; eSet(f, 'death'); pl.stats.kills++; bleed(f.x, f.y, 30 * sc, 0, 0, 60, 1); pools.push({ x: f.x, y: f.y, t: -.7, r: 0, max: 14 * sc, el: .3, dx: 1, dy: 0, seed: (Math.random() * 1e9 | 0) + 1 }); continue; } } }
      if (isAtk(f.anim) && eFrame(f) < 3) eSet(f, 'idle');
      if (f.anim !== 'hurt' && !isAtk(f.anim)) { f.k = octOf(dx, dy); eSet(f, 'idle'); f.fps = 0; }
      continue;
    }
    if (f.anim === 'hurt') { if (eDone(f)) { eSet(f, 'idle'); f.cool = Math.max(f.cool, .25); f.combo = null; } continue; }

    // The goat's charge: locked onto a line, gores whatever is at the end of it.
    if (f.charge) {
      const c = f.charge; c.t += dt;
      f.x += c.dx * 125 * dt; f.y += c.dy * 125 * dt; f.fps = 22;
      if (d < sepOf(f) + 6) { hurtPriest(S.dmg, c.dx, c.dy, 30, f.id); f.charge = null; startAttack(f, 'atk'); f.t = 3 / eInfo(f).fps; f.struck = true; f.cool = 1.2; }
      else if (c.t > 1.1) { f.charge = null; eSet(f, 'idle'); f.cool = .8; }
      continue;
    }
    // In the middle of a blow.
    if (isAtk(f.anim)) {
      const fr = eFrame(f);
      if (fr <= 1 && !f.leapA) f.k = octOf(dx, dy);                       // turns to follow you while winding up
      const ef = dirOf(f.k);
      if (f.leapA && fr >= 1 && fr <= 3) { const v = f.id === 'monja' ? 75 : f.id === 'diablillo' ? 95 : 120; f.x += ef[0] * v * dt; f.y += ef[1] * v * dt; }
      else if ((fr === 3 || fr === 4) && d > sepOf(f) + 2 && !(f.id === 'obispo' && f.anim !== 'atk2')) { f.x += ef[0] * 30 * dt; f.y += ef[1] * 30 * dt; }
      if (fr === 3 && !f.struck) {
        f.struck = true;
        const mult = MULT[f.anim];
        if (f.id === 'obispo' && f.anim !== 'atk2') {
          const n = f.anim === 'atk3' ? 3 : 1, a0 = Math.atan2(dy, dx);
          for (let i = 0; i < n; i++) { const a = a0 + (i - (n - 1) / 2) * .32; bolts.push({ x: f.x + ef[0] * 12, y: f.y + ef[1] * 12, z: 32, vx: Math.cos(a) * 95, vy: Math.sin(a) * 95, t: 0, dmg: S.dmg * (n > 1 ? .8 : 1), by: f.id }); }
        } else {
          const aoe = (E.aoe || []).includes(f.anim), front = (dx * ef[0] + dy * ef[1]) / d;
          if (d < reachOf(f) + 8 && (aoe || front > .2)) hurtPriest(S.dmg * mult, dx, dy, f.id === 'carnicero' || f.id === 'crucificado' || f.id === 'cabrio' ? 14 : 5, f.id);
          if (aoe && f.id === 'cabrio') { shake = Math.max(shake, .25); puff(14, 30, f.x + ef[0] * 14, f.y + ef[1] * 14); }
        }
      }
      if (eDone(f)) {
        if (f.combo && f.combo.length && d < reachOf(f) + 16 && pl.mode !== 'dead') { f.k = octOf(dx, dy); startAttack(f, f.combo.shift()); }
        else { f.combo = null; eSet(f, 'idle'); f.fps = 0; f.cool = .45 + Math.random() * .7; f.back = Math.random() < .3 ? .35 : 0; f.strafe = Math.random() < .55 ? (Math.random() < .5 ? 1 : -1) : 0; f.leapA = false; }
      }
      continue;
    }
    f.cool -= dt;
    if (pl.mode === 'dead') { eSet(f, 'idle'); f.fps = 0; continue; }
    f.k = octOf(dx, dy);
    const R = reachOf(f);
    // Their own tricks from a distance.
    if (f.cool <= 0) {
      if (f.id === 'cabrio' && d > 55 && d < 140) { f.charge = { dx: dx / d, dy: dy / d, t: 0 }; eSet(f, 'walk'); continue; }
      if (E.leap && d > R + 6 && d < 78) { startAttack(f, 'atk', true); continue; }
      if (f.id === 'monja' && d > R + 4 && d < 52) { startAttack(f, 'atk', true); continue; }
      if (f.id === 'obispo' && d > R + 6 && d < 170) { startAttack(f, Math.random() < .4 ? 'atk3' : 'atk'); continue; }
    }
    // Close enough: stand and fight. Strike in combos; between them, step back, circle, or wait.
    if (d <= R + 4) {
      if (f.cool <= 0) { nextCombo(f); continue; }
      let mx = 0, my = 0, sp = 0;
      if (f.back > 0) { f.back -= dt; mx = -dx / d; my = -dy / d; sp = E.speed * .6; }
      else if (f.strafe) { mx = -dy / d * f.strafe; my = dx / d * f.strafe; sp = E.speed * .35; }
      if (sp) { f.x += mx * sp * dt; f.y += my * sp * dt; walkAnim(f, sp); } else { eSet(f, 'idle'); f.fps = 0; }
      continue;
    }
    // The bishop would rather keep his distance.
    if (f.id === 'obispo' && d < 70) { f.x -= dx / d * E.speed * dt; f.y -= dy / d * E.speed * dt; walkAnim(f, E.speed); continue; }
    let mx = dx / d, my = dy / d;
    if (f.id === 'monja' && d > R + 20) { mx += -dy / d * .9 * f.side; my += dx / d * .9 * f.side; }             // circles in
    if (f.id === 'diablillo') { const w = Math.sin(f.t * 5 + f.seed) * 1.1; mx += -dy / d * w; my += dx / d * w; } // zigzags
    const l = Math.hypot(mx, my); mx /= l; my /= l;
    let sp = E.speed;
    if (f.id === 'poseido' && Math.sin(f.t * 1.7 + f.seed) > .93) sp = 0;                                        // twitching stops
    if (f.id === 'obispo' && d < 110) sp = 0;
    f.x += mx * sp * dt; f.y += my * sp * dt;
    if (sp) { walkAnim(f, sp); f.k = octOf(mx, my); } else { eSet(f, 'idle'); f.fps = 0; }
  }
  // Keep them out of each other and out of the priest.
  for (const a of foes) {
    if (!alive(a)) continue;
    for (const b of [...foes, pl]) {
      if (a === b || (b !== pl && !alive(b))) continue;
      const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
      const m = b === pl ? sepOf(a) : 9 * ((ENEMIES[a.id].look.scale || 1) + (ENEMIES[b.id].look.scale || 1));
      if (d > 0 && d < m) { const k = b === pl ? 1 : .5; a.x += dx / d * (m - d) * k; a.y += dy / d * (m - d) * k; }
    }
    clampToView(a);
  }
  for (const f of foes) {
    if (!alive(f)) continue;
    const hurt = 1 - f.hp / ESTAT[f.id].hp, always = f.id === 'crucificado' || f.id === 'flagelante';
    f.dripT = (f.dripT || 0) - dt;
    if ((hurt > 0 || always) && f.dripT <= 0) { f.dripT = .5 / (hurt * 3 + (always ? 1 : 0) + .2); drip(f.x, f.y, 26 * (ENEMIES[f.id].look.scale || 1)); }
  }
  for (let i = foes.length - 1; i >= 0; i--) if (foes[i].dead > 30) foes.splice(i, 1);
  for (const b of bolts) {
    b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt;
    const dx = b.x - pl.x, dy = b.y - pl.y, d = Math.hypot(dx, dy) || 1;
    if (crossUp && d < 40 && (dx * cd[0] + dy * cd[1]) / d > .3) { b.t = 9; puff(6, 14, b.x, b.y); continue; }   // shattered on the cross
    if (d < 10 && pl.z < 20) { b.t = 9; hurtPriest(b.dmg, b.vx, b.vy, 4, b.by); }
  }
  for (let i = bolts.length - 1; i >= 0; i--) if (bolts[i].t > 2.2) bolts.splice(i, 1);
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
// The same sprite added on top of itself: a white-hot flash, cheap everywhere.
const glow = (fn, a) => { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; fn(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; };
const drawS = (sh, a, k, f, x, y) => sh.draw(ctx, fkey(a, k, f), Math.round(x - OX), Math.round(y - OY));
const bar = (x, y, w, h, v, fg, bg = '#2a2228') => { ctx.fillStyle = bg; ctx.fillRect(x, y, w, h); ctx.fillStyle = fg; ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, v))), h); };

function drawPlay() {
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, view.w, view.h);
  const sk = shake > 0 ? 2 : 0, ox = view.w / 2 + (sk ? Math.round(rnd(-sk, sk)) : 0), oy = view.h / 2 + (sk ? Math.round(rnd(-sk, sk)) : 0);
  ctx.drawImage(floor, ox - view.w / 2, oy - view.h / 2);
  for (const p of pools) if (p.t > 0 && !p.done) {
    if (!p.cv || p.r - p.cr >= .8) {
      const R = Math.ceil(p.r * (1 + p.el)) + 4; p.cv = p.cv || document.createElement('canvas'); p.cv.width = R * 2 + 1; p.cv.height = Math.ceil(R * 1.3) + 4;
      p.cr = p.r; const [sx, sy] = toScreen(p.x, p.y, 0); p.ax = Math.round(view.w / 2 + sx) - R; p.ay = Math.round(view.h / 2 + sy) - Math.ceil(R * .65) - 2;
      const g = p.cv.getContext('2d'); g.translate(-p.ax, -p.ay); paintSplat(g, { x: p.x, y: p.y, r: p.r, el: p.el, dx: p.dx, dy: p.dy, pool: 1, seed: p.seed });
    }
    ctx.drawImage(p.cv, p.ax + ox - view.w / 2, p.ay + oy - view.h / 2);
  }
  for (const p of dust) { const [sx, sy] = toScreen(p.x, p.y, p.z), a = 1 - p.t / p.life; ctx.fillStyle = `rgba(120,112,108,${a * .55})`; ctx.fillRect(Math.round(ox + sx), Math.round(oy + sy), 2, 2); }
  // The crucifix's reach, a faint holy glare on the floor.
  if (pl.mode === 'cross' && pl.t * 8 >= 2) {
    const cd = dirOf(pl.k), [cx, cy] = toScreen(pl.x + cd[0] * 40, pl.y + cd[1] * 40, 0);
    const g = ctx.createRadialGradient(ox + cx, oy + cy, 2, ox + cx, oy + cy, 46); g.addColorStop(0, 'rgba(255,236,170,.32)'); g.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = g; ctx.fillRect(ox + cx - 50, oy + cy - 50, 100, 100);
  }
  const [gx, gy] = toScreen(pl.x, pl.y, 0), hz = pl.z;
  const lying = pl.anim === 'death' && frameOf() >= 7, f = pl.frame ?? frameOf();
  const list = [{ d: pl.x + pl.y, draw: () => {
    shadow(ox + gx, oy + gy, Math.max(6, (lying ? 20 : 12) - hz * .12), Math.max(2, 5 - hz * .05), Math.max(.08, .22 - hz * .004));
    drawS(SETS[pl.wid], pl.anim, pl.k, f, ox + gx, oy + gy - hz * Math.cos(Math.PI / 6));
    if (pl.flash > 0) glow(() => drawS(SETS[pl.wid], pl.anim, pl.k, f, ox + gx, oy + gy - hz * Math.cos(Math.PI / 6)), .75);
    ctx.globalAlpha = 1;
  } }];
  for (const e of foes) list.push({ d: e.x + e.y - (!alive(e) && eDone(e) ? 40 : 0), draw: () => {
    const [sx, sy] = toScreen(e.x, e.y, 0), sc = ENEMIES[e.id].look.scale || 1;
    ctx.globalAlpha = e.dead > 28 ? Math.max(0, 1 - (e.dead - 28) / 2) : 1;
    shadow(ox + sx, oy + sy, Math.round(12 * sc), Math.max(2, Math.round(5 * sc)), .2);
    drawS(ESETS[e.id], e.anim, e.k, eFrame(e), ox + sx, oy + sy);
    if (e.flash > 0) glow(() => drawS(ESETS[e.id], e.anim, e.k, eFrame(e), ox + sx, oy + sy), .8);
    else if (e.cowed && ESTAT[e.id].demon) glow(() => drawS(ESETS[e.id], e.anim, e.k, eFrame(e), ox + sx, oy + sy), .35 + .2 * Math.sin(performance.now() / 70));
    ctx.globalAlpha = 1;
    if (alive(e) && e.barT > 0) bar(Math.round(ox + sx - 9), Math.round(oy + sy - 64 * sc), 18, 2, e.hp / ESTAT[e.id].hp, '#b8261c');
  } });
  list.sort((p, q) => p.d - q.d).forEach(o => o.draw());
  for (const d of drops) {
    const [sx, sy] = toScreen(d.x, d.y, d.z), [tx, ty] = toScreen(d.x - d.vx * .02, d.y - d.vy * .02, d.z - d.vz * .02);
    ctx.fillStyle = BLOOD[2]; ctx.fillRect(Math.round(ox + tx), Math.round(oy + ty), 1, 1);
    ctx.fillStyle = d.gib ? BLOOD[1] : BLOOD[4]; ctx.fillRect(Math.round(ox + sx), Math.round(oy + sy), d.sz, d.sz);
    if (d.gib) { ctx.fillStyle = BLOOD[5]; ctx.fillRect(Math.round(ox + sx), Math.round(oy + sy), 1, 1); }
  }
  for (const b of bolts) {
    const [sx, sy] = toScreen(b.x, b.y, b.z), fl = (b.t * 20 | 0) & 1, [tx, ty] = toScreen(b.x - b.vx * .06, b.y - b.vy * .06, b.z);
    ctx.fillStyle = 'rgba(138,22,6,.6)'; ctx.fillRect(Math.round(ox + tx - 2), Math.round(oy + ty - 2), 4, 4);
    ctx.fillStyle = '#ff6a1e'; ctx.fillRect(Math.round(ox + sx - 3), Math.round(oy + sy - 3), 6, 6);
    ctx.fillStyle = fl ? '#ffc050' : '#d0380e'; ctx.fillRect(Math.round(ox + sx - 1), Math.round(oy + sy - 2), 3, 3);
  }
  // Health and stamina; red at the edges when he's close to the end.
  const low = 1 - pl.hp / HP;
  if (low > .55 && pl.mode !== 'dead') { const a = (low - .55) * (.9 + .3 * Math.sin(performance.now() / 160)); const g = ctx.createRadialGradient(view.w / 2, view.h / 2, view.h * .35, view.w / 2, view.h / 2, view.w * .7); g.addColorStop(0, 'rgba(120,0,0,0)'); g.addColorStop(1, `rgba(120,0,0,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, view.w, view.h); }
  const bx = 8, by = MOBILE ? 8 : view.h - 16;
  if (pl.mode === 'dead') drawDeath(ox + gx, oy + gy);
  else { bar(bx, by, 90, 4, pl.hp / HP, '#b8261c'); bar(bx, by + 6, 90, 2, pl.st / ST, pl.tired > 0 ? '#e0a020' : '#8a8490'); }
  if (hud.style.opacity !== '0') hud.style.opacity = 0;
  if (touch) touch.draw(ctx);
}

// Colour drains out of the world, the dark closes in on the body until only it and its blood are lit, and ash rises.
function drawDeath(px, py) {
  const t = pl.deathT, dk = Math.min(1, t / 2.4), e = dk * dk * (3 - 2 * dk);
  ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = `rgba(128,128,128,${e * .8})`; ctx.fillRect(0, 0, view.w, view.h);
  ctx.globalCompositeOperation = 'source-over';
  const cy = py - 6, r0 = 8 + 10 * (1 - e), r1 = r0 + 26 + (1 - e) * view.w;
  const g = ctx.createRadialGradient(px, cy, r0, px, cy, r1);
  g.addColorStop(0, `rgba(40,4,6,${.55 * e})`); g.addColorStop(.45, `rgba(16,2,4,${.85 * e})`); g.addColorStop(1, `rgba(6,0,2,${.96 * e})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, view.w, view.h);
  const v = ctx.createRadialGradient(view.w / 2, view.h / 2, view.h * .3, view.w / 2, view.h / 2, view.w * .75);
  v.addColorStop(0, 'rgba(90,0,0,0)'); v.addColorStop(1, `rgba(70,0,6,${.5 * e})`); ctx.fillStyle = v; ctx.fillRect(0, 0, view.w, view.h);
  for (const a of ash) {
    const k = Math.min(1, a.t / .6) * Math.max(0, 1 - a.t / a.life);
    ctx.fillStyle = a.ember ? `rgba(220,${70 + (a.seed * 60 | 0)},20,${k * .9})` : `rgba(150,140,140,${k * .5})`;
    ctx.fillRect(Math.round(a.x), Math.round(a.y), a.s, a.s);
  }
}
function updateAsh(dt) {
  if (pl.mode !== 'dead') { ash.length = 0; return; }
  for (const a of ash) { a.t += dt; a.x += (a.vx + Math.sin(a.t * 1.3 + a.seed * 9) * 4) * dt; a.y += a.vy * dt; }
  for (let i = ash.length - 1; i >= 0; i--) if (ash[i].t > ash[i].life) ash.splice(i, 1);
}

// ---------------------------------------------------------------- pause
let paused = false, pSel = 0, pPage = 'main';
const P_ITEMS = [['Continuar', () => setPause(false)], ['Controles', () => { pPage = 'keys'; renderPause(); }],
  ['Invocar enemigo', () => { const id = ENEMY_IDS[spawnIdx % ENEMY_IDS.length]; spawnIdx++; wantE = id; pendingSpawn.push(id); setPause(false); }],
  ['Horda de seis', () => { for (let i = 0; i < 6; i++) pendingSpawn.push(ENEMY_IDS[Math.random() * ENEMY_IDS.length | 0]); setPause(false); }],
  ['Reiniciar combate', () => { restart(); setPause(false); }], ['Galería', () => { setPause(false); gallery = true; gT = 0; gWid = pl.wid; resize(); hud.style.opacity = 1; }]];
const P_KEYS = [['WASD / flechas', 'caminar'], ['Shift', 'correr'], ['Q', 'rodar (esquiva, invulnerable)'], ['Espacio', 'saltar'], ['C', 'agacharse / levantarse'],
  ['1 – 5 · 0', 'puñal, machete, hacha, candelabro, horca · sin arma'], ['Clic', 'golpe (clic otra vez encadena 1 → 2 → 3)'], ['J / K / L', 'golpe 1 / 2 / 3'],
  ['R', 'rezar: cura, pero te deja expuesto'], ['F (mantener)', 'crucifijo: repele, y quema a los demoníacos'], ['E', 'interactuar'],
  ['N', 'invocar al siguiente enemigo'], ['B', 'horda de seis'], ['M', 'quitar enemigos y limpiar la sangre'], ['Tab', 'galería de animaciones'], ['Esc / P', 'pausa']];
function renderPause() {
  if (pPage === 'keys') {
    pauseEl.innerHTML = `<div class="p-title">Controles</div><div class="p-keys">${P_KEYS.map(([k, v]) => `<b>${k}</b><span>${v}</span>`).join('')}</div>
      <div class="p-item sel" data-i="back">Volver</div>`;
  } else {
    pauseEl.innerHTML = `<div class="p-title">Pausa</div>${P_ITEMS.map(([t], i) => `<div class="p-item${i === pSel ? ' sel' : ''}" data-i="${i}">${t}</div>`).join('')}
      <div class="p-hint">↑ ↓ elegir · Enter aceptar · Esc continuar</div>`;
  }
  for (const el of pauseEl.querySelectorAll('.p-item')) {
    el.onmouseenter = () => { if (el.dataset.i !== 'back') { pSel = +el.dataset.i; for (const o of pauseEl.querySelectorAll('.p-item')) o.classList.toggle('sel', o === el); } };
    el.onclick = () => { if (el.dataset.i === 'back') { pPage = 'main'; renderPause(); } else P_ITEMS[+el.dataset.i][1](); };
  }
}
function setPause(on) {
  paused = on; pPage = 'main'; if (on) pSel = 0;
  pauseEl.classList.toggle('on', on); if (on) renderPause(); else pauseEl.innerHTML = '';
  keys.clear();
}
function pauseInput() {
  if (pPage === 'keys') { if (pressed('Escape') || pressed('Enter') || pressed('Space') || pressed('Backspace')) { pPage = 'main'; renderPause(); } return; }
  if (pressed('Escape') || pressed('KeyP')) { setPause(false); return; }
  const n = P_ITEMS.length;
  if (pressed('ArrowDown') || pressed('KeyS')) { pSel = (pSel + 1) % n; renderPause(); }
  if (pressed('ArrowUp') || pressed('KeyW')) { pSel = (pSel + n - 1) % n; renderPause(); }
  if (pressed('Enter') || pressed('Space') || pressed('NumpadEnter')) P_ITEMS[pSel][1]();
}
function restart() {
  revive(); drops.length = 0; pools.length = 0; splats.length = 0; resetFloor();
}
// The world behind the menu: frozen, drained and dimmed.
function drawPauseVeil() {
  ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = 'rgba(128,128,128,.85)'; ctx.fillRect(0, 0, view.w, view.h);
  ctx.globalCompositeOperation = 'source-over';
  const g = ctx.createRadialGradient(view.w / 2, view.h / 2, view.h * .1, view.w / 2, view.h / 2, view.w * .7);
  g.addColorStop(0, 'rgba(12,2,4,.86)'); g.addColorStop(1, 'rgba(6,0,2,.96)'); ctx.fillStyle = g; ctx.fillRect(0, 0, view.w, view.h);
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
  const sh = eid ? ESETS[eid] : CLEAN[gWid];
  if (!sh) {
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
  const cw = Math.min(80, Math.floor(view.w / 8)), x0 = Math.floor((view.w - cw * 8) / 2) + cw / 2;
  ctx.font = '8px monospace'; ctx.textAlign = 'center';
  for (let k = 0; k < 8; k++) { const x = x0 + k * cw, y = 125; shadow(x, y, 11, 4, .18); drawS(sh, name, k, f, x, y); ctx.fillStyle = '#8a8288'; ctx.fillText(DIRS[k], x, y + 14); }
  const n = A.n, fw = Math.min(cw, Math.floor(view.w / n), name === 'death' ? 80 : 60), fx0 = Math.floor((view.w - fw * n) / 2) + fw / 2;
  for (let i = 0; i < n; i++) { const x = fx0 + i * fw, y = 255; shadow(x, y, 11, 4, .12); drawS(sh, name, 1, i, x, y); ctx.fillStyle = '#b0a8ae'; ctx.fillText(i + 1, x, y + 14); }
  ctx.textAlign = 'left';
  if (touch) touch.draw(ctx);
  const an = eid ? ENAMES[name] : nameOf(name, gWid);
  hud.innerHTML = `<b>galería</b> · <b>${who}</b> (${gWho + 1}/${whoN}) · ${an} (${gIdx + 1}/${names.length}) · ${n} cuadros × 8 direcciones<br>↑ / ↓: cambiar personaje · ← / →: cambiar animación${eid ? '' : ' · 1-5 / 0: arma del padre'} · Tab: volver a jugar`;
}

let last = performance.now();
function frame(now) {
  let dt = Math.min(.05, (now - last) / 1000); last = now;
  if (paused) { pauseInput(); hit.clear(); if (paused) { drawPlay(); drawPauseVeil(); } requestAnimationFrame(frame); last = performance.now(); return; }
  if (!gallery && pl.mode !== 'dead' && (pressed('Escape') || pressed('KeyP'))) { setPause(true); hit.clear(); requestAnimationFrame(frame); return; }
  if (pressed('Tab')) { gallery = !gallery; gT = 0; gWid = pl.wid; resize(); }
  if (gallery) hud.style.opacity = 1;
  if (gallery) drawGallery(dt);
  else {
    // A blow that lands freezes the world for a moment.
    if (hitStop > 0) { hitStop -= dt; dt = 0; }
    shake = Math.max(0, shake - (now - (frame.p || now)) / 1000); frame.p = now;
    const real = dt;
    if (pl.mode === 'dead') {
      pl.deathT += real; dt *= pl.deathT < 1.3 ? .3 : 1; updateAsh(real);
      if (pl.deathT > 1.2 && !deathEl.classList.contains('on')) deathEl.classList.add('on');
      if (pl.deathT > 1.8) deathEl.classList.add('ready');
    }
    update(dt); goreTick(); drawPlay();
  }
  hit.clear();
  requestAnimationFrame(frame);
}

const touch = MOBILE ? initTouch({ keys, hit, view, weapons: ['', ...WEAPON_IDS],
  state: () => ({ mode: pl.mode, wid: pl.pending ?? pl.wid, st: pl.st, paused, gallery }) }) : null;
resize();
await bakeSet('');
load.remove();
const mem = () => { /* atlas pages, painted or downloaded */ const sets = new Set([...Object.values(SETS), ...Object.values(CLEAN), ...Object.values(ESETS)]); let b = 0; for (const s of sets) b += s.bytes; return Math.round(b / 1048576) + ' MB'; };
window.__S = { MOBILE, setPause, hurtPriest, goreLevel, pl, SETS, ESETS, foes, progress, ANIMS, mem, spawn: id => { wantE = id; pendingSpawn.push(id); },
  setGallery: (on, i = 0, w = '', who = 0) => { gallery = on; gIdx = i; gWid = w; gWho = who; want = w || want; wantE = who ? ENEMY_IDS[who - 1] : wantE; gT = 0; resize(); } };
requestAnimationFrame(frame);
baker();
