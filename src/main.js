// Character test bench: the priest alone on a plain white floor, PC controls, five melee weapons, plus a gallery of
// every animation in all eight facings.
import { ANIMS, bake, animsFor, animInfo, SW, SH, OX, OY } from './priest.js';
import { WEAPONS, WEAPON_IDS } from './weapons.js';
import { toScreen } from './raster.js';

const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const hud = document.getElementById('hud'), load = document.getElementById('load');
const DIRS = ['SE', 'S', 'SO', 'O', 'NO', 'N', 'NE', 'E'];
const NAMES = { idle: 'quieto', walk: 'caminar', run: 'correr', crouch: 'agachado', cwalk: 'agachado andando', jump: 'salto', roll: 'rodar',
  interact: 'interactuar', cross: 'crucifijo', pray: 'rezar', hurt: 'herido', death: 'muerte' };
const nameOf = (a, wid) => a.startsWith('atk') ? `golpe ${a[3]}: ${WEAPONS[wid].blows[+a[3] - 1].name}` : NAMES[a];
const wname = wid => wid ? WEAPONS[wid].name : 'sin arma';

// ---------------------------------------------------------------- sprites: unarmed at boot, each weapon in the background
const SETS = {}, progress = {};
const tick = () => new Promise(r => setTimeout(r, 0));
async function bakeSet(wid) {
  const key = wid || '', list = animsFor(wid), set = {};
  const total = list.reduce((s, a) => s + animInfo(a, wid).n * 8, 0); let done = 0;
  for (const name of list) {
    const A = animInfo(name, wid), c = document.createElement('canvas'); c.width = SW * A.n; c.height = SH * 8;
    const cx = c.getContext('2d');
    for (let k = 0; k < 8; k++) {
      for (let f = 0; f < A.n; f++) {
        const s = bake(name, f, k, wid);
        cx.putImageData(new ImageData(new Uint8ClampedArray(s.d.buffer), s.w, s.h), f * SW, k * SH);
        done++;
      }
      progress[key] = done / total;
      await tick();
    }
    set[name] = c;
  }
  SETS[key] = set;
}
let want = null;
async function baker() {
  const queue = [...WEAPON_IDS];
  while (queue.length) {
    const i = want && queue.includes(want) ? queue.indexOf(want) : 0;
    const [wid] = queue.splice(i, 1);
    await bakeSet(wid);
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
const pl = { x: 0, y: 0, z: 0, vz: 0, k: 1, mode: 'ground', anim: 'idle', t: 0, timer: 0, vx: 0, vy: 0, crouch: false, wid: '', pending: null };
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
  if (pl.pending !== null && SETS[pl.pending] && pl.mode !== 'atk') { pl.wid = pl.pending; pl.pending = null; if (!info(pl.anim)) setAnim('idle'); }
  const mv = moveVec(), shift = down('ShiftLeft', 'ShiftRight');
  if (pressed('KeyX') && pl.mode !== 'dead') { pl.mode = 'dead'; pl.fps = 0; setAnim('death'); }
  if (pressed('KeyT') && pl.mode === 'dead') { pl.mode = 'ground'; setAnim('idle'); }
  const blowKey = pressed('Mouse0') ? 0 : pressed('KeyJ') ? 1 : pressed('KeyK') ? 2 : pressed('KeyL') ? 3 : -1;

  switch (pl.mode) {
    case 'ground': {
      if (pressed('KeyC')) pl.crouch = !pl.crouch;
      let speed = 0;
      if (mv) { pl.k = mv.k; speed = pl.crouch ? CROUCH : shift ? RUN : WALK; pl.x += mv.x * speed * dt; pl.y += mv.y * speed * dt; }
      const a = mv ? (pl.crouch ? 'cwalk' : shift ? 'run' : 'walk') : (pl.crouch ? 'crouch' : 'idle');
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

  for (const p of dust) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += 8 * dt; p.vx *= .92; p.vy *= .92; }
  for (let i = dust.length - 1; i >= 0; i--) if (dust[i].t > dust[i].life) dust.splice(i, 1);
}

// ---------------------------------------------------------------- drawing
const view = { w: 400, h: 225, s: 3 };
let gallery = false, gIdx = 0, gT = 0, gWid = '';
function resize() {
  const W = innerWidth, H = innerHeight;
  view.s = gallery ? Math.max(1, Math.floor(Math.min(W / 560, H / 290))) : Math.max(2, Math.floor(Math.min(W / 400, H / 225)));
  view.w = Math.ceil(W / view.s); view.h = Math.ceil(H / view.s);
  cv.width = view.w; cv.height = view.h; cv.style.width = view.w * view.s + 'px'; cv.style.height = view.h * view.s + 'px';
  ctx.imageSmoothingEnabled = false;
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
  for (const p of dust) { const [sx, sy] = toScreen(p.x, p.y, p.z), a = 1 - p.t / p.life; ctx.fillStyle = `rgba(120,112,108,${a * .55})`; ctx.fillRect(Math.round(ox + sx), Math.round(oy + sy), 2, 2); }
  const [gx, gy] = toScreen(pl.x, pl.y, 0), hz = pl.z;
  const lying = pl.anim === 'death' && frameOf() >= 7;
  shadow(ox + gx, oy + gy, Math.max(6, (lying ? 20 : 12) - hz * .12), Math.max(2, 5 - hz * .05), Math.max(.08, .22 - hz * .004));
  const f = pl.frame ?? frameOf();
  sprite(pl.wid, pl.anim, f, pl.k, ox + gx, oy + gy - hz * Math.cos(Math.PI / 6));
  hud.innerHTML = `<b>${nameOf(pl.anim, pl.wid)}</b> · ${DIRS[pl.k]} · cuadro ${f + 1}/${info(pl.anim).n} · arma: <b>${wname(pl.wid)}</b>${bakingNote()}<br>
WASD / flechas: caminar · Shift: correr · C: agacharse / levantarse · Espacio: saltar · Q: rodar<br>
1 puñal · 2 machete · 3 hacha · 4 candelabro · 5 horca · 0 sin arma<br>
Clic izquierdo: golpe (clic otra vez para encadenar 1→2→3) · J / K / L: golpe 1 / 2 / 3<br>
E: interactuar · F (mantener): crucifijo · R: rezar · H: herido · X: morir · T: levantarse · Tab: galería`;
}

function drawGallery(dt) {
  gT += dt;
  WEAPON_IDS.forEach((w, i) => { if (pressed('Digit' + (i + 1))) { gWid = w; want = w; gT = 0; } });
  if (pressed('Digit0') || pressed('Backquote')) { gWid = ''; gT = 0; }
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, view.w, view.h);
  if (!SETS[gWid]) { hud.innerHTML = `<b>galería</b> · ${wname(gWid)}${bakingNote()}`; return; }
  const names = animsFor(gWid);
  if (pressed('ArrowRight') || pressed('KeyD')) { gIdx = (gIdx + 1) % names.length; gT = 0; }
  if (pressed('ArrowLeft') || pressed('KeyA')) { gIdx = (gIdx + names.length - 1) % names.length; gT = 0; }
  gIdx %= names.length;
  const name = names[gIdx], A = animInfo(name, gWid);
  const fps = A.stride ? fpsOf(name, name === 'run' ? RUN : name === 'walk' ? WALK : CROUCH) : A.fps;
  const f = A.loop ? Math.floor(gT * fps) % A.n : Math.min(A.n - 1, Math.floor(gT * fps) % (A.n + 6));
  const cw = Math.min(80, Math.floor(view.w / 8)), x0 = Math.floor((view.w - cw * 8) / 2) + cw / 2;
  ctx.font = '8px monospace'; ctx.textAlign = 'center';
  for (let k = 0; k < 8; k++) {
    const x = x0 + k * cw, y = 120;
    shadow(x, y, 11, 4, .18); sprite(gWid, name, f, k, x, y);
    ctx.fillStyle = '#8a8288'; ctx.fillText(DIRS[k], x, y + 14);
  }
  const n = A.n, fw = Math.min(cw, Math.floor(view.w / n), name === 'death' ? 80 : 56), fx0 = Math.floor((view.w - fw * n) / 2) + fw / 2;
  for (let i = 0; i < n; i++) { const x = fx0 + i * fw, y = 250; shadow(x, y, 11, 4, .12); sprite(gWid, name, i, 1, x, y); ctx.fillStyle = '#b0a8ae'; ctx.fillText(i + 1, x, y + 14); }
  hud.innerHTML = `<b>galería</b> · ${wname(gWid)} · ${nameOf(name, gWid)} (${gIdx + 1}/${names.length}) · ${n} cuadros × 8 direcciones<br>← / →: cambiar animación · 1-5 / 0: cambiar arma · Tab: volver a jugar`;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (pressed('Tab')) { gallery = !gallery; gT = 0; gWid = pl.wid; resize(); }
  if (gallery) drawGallery(dt); else { update(dt); drawPlay(); }
  hit.clear();
  requestAnimationFrame(frame);
}

resize();
await bakeSet('');
load.remove();
window.__S = { pl, SETS, progress, ANIMS, setGallery: (on, i = 0, w = '') => { gallery = on; gIdx = i; gWid = w; want = w || want; gT = 0; resize(); } };
requestAnimationFrame(frame);
baker();
