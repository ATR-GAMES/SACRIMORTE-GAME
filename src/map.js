// The map (M): the whole cathedral as a lit model, over the frozen world, drawn by the game's own world (`model`):
// every wall that stands in front of a room cut down, so each room shows inside with its furniture and candles. The
// places are named, and he is the red mark, pointing where he faces. Unexplored parts can be kept dark (SHOW_ALL).
// (The flat ink plan it used to be is still here, drawBase, unused.)
// Drawn on a canvas of its own at the screen's full resolution, so lines and letters stay crisp.
import { F, B, CELL } from './cathedral.js?v=78777f9';

const FLOOR = {
  [F.STONE]: [72, 66, 66], [F.AISLE]: [64, 58, 62], [F.CARPET]: [98, 26, 30], [F.MARBLE]: [94, 88, 86], [F.MOSAIC]: [104, 82, 50],
  [F.WOOD]: [84, 58, 40], [F.GRASS]: [42, 56, 36], [F.TILE]: [94, 58, 44], [F.DIRT]: [70, 58, 46], [F.CHAPEL]: [90, 56, 46],
  [F.STEP]: [104, 98, 94], [F.GRAVEL]: [80, 76, 70],
};
const INK = '#d8c8a6', INK_DIM = '#8a7a68', RED = '#c8301e';

export function createMap(M, doorOpen, model) {
  const W = M.W, H = M.H, seen = new Uint8Array(W * H), visited = new Set();
  const el = document.createElement('div'); el.id = 'map'; el.innerHTML = '<canvas></canvas>'; document.body.appendChild(el);
  const cv = el.querySelector('canvas'), g = cv.getContext('2d');
  let open = false, base = null, fit = null, dirty = true;
  // For now the whole cathedral is shown from the start; set to false to uncover it only as he explores.
  const SHOW_ALL = true;
  if (SHOW_ALL) { for (let k = 0; k < W * H; k++) if (M.floor[k]) seen[k] = 1; for (const z of M.zones || []) visited.add(z); }

  // ---- what he has seen
  function reveal(x, y, r = 7) {
    const ci = x / CELL, cj = y / CELL;
    for (let j = Math.floor(cj - r); j <= cj + r; j++) for (let i = Math.floor(ci - r); i <= ci + r; i++) {
      if (i < 0 || j < 0 || i >= W || j >= H || (i + .5 - ci) ** 2 + (j + .5 - cj) ** 2 > r * r) continue;
      const k = j * W + i; if (!seen[k] && M.floor[k]) { seen[k] = 1; dirty = true; }
    }
  }
  function enter(zone) {
    if (!zone || visited.has(zone)) return; visited.add(zone); dirty = true;
    const [x0, y0, x1, y1] = zone.r;
    for (let j = y0 - 1; j <= y1; j++) for (let i = x0 - 1; i <= x1; i++) if (i >= 0 && j >= 0 && i < W && j < H && M.floor[j * W + i]) seen[j * W + i] = 1;
  }

  // ---- drawing
  const resize = () => { const d = devicePixelRatio || 1; cv.width = Math.round(innerWidth * d); cv.height = Math.round(innerHeight * d); cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px'; dirty = true; };
  addEventListener('resize', () => { if (open) resize(); });
  // The whole cathedral fitted to the screen: cell corner (i, j) → (ox + u(i − j), oy + .75u(i + j)).
  function fitIt() {
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (M.floor[j * W + i]) { const a = i - j, b = i + j; a0 = Math.min(a0, a - 1); a1 = Math.max(a1, a + 1); b0 = Math.min(b0, b); b1 = Math.max(b1, b + 2); }
    const top = cv.height * .13, bottom = cv.height * .08, side = cv.width * .05;
    const u = Math.min((cv.width - side * 2) / (a1 - a0), (cv.height - top - bottom) / ((b1 - b0) * .75));
    return { u, ox: cv.width / 2 - u * (a0 + a1) / 2, oy: top + (cv.height - top - bottom) / 2 - u * .75 * (b0 + b1) / 2 };
  }
  const P = (i, j) => [fit.ox + fit.u * (i - j), fit.oy + fit.u * .75 * (i + j)];
  function drawBase() {
    const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const b = c.getContext('2d'), u = fit.u, d = devicePixelRatio || 1;
    const diamond = (i, j) => { const [x0, y0] = P(i, j), [x1, y1] = P(i + 1, j), [x2, y2] = P(i + 1, j + 1), [x3, y3] = P(i, j + 1); b.moveTo(x0, y0); b.lineTo(x1, y1); b.lineTo(x2, y2); b.lineTo(x3, y3); b.closePath(); };
    // floors, by kind
    const byCol = new Map();
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i; if (!seen[k]) continue;
      const col = M.block[k] === B.ARCH ? [140, 130, 118] : FLOOR[M.floor[k]] || [70, 64, 64];
      const key = col.join(); if (!byCol.has(key)) byCol.set(key, []); byCol.get(key).push([i, j]);
    }
    for (const [key, cells] of byCol) { b.fillStyle = `rgb(${key})`; b.beginPath(); for (const [i, j] of cells) diamond(i, j); b.fill(); }
    // walls: every edge of a seen floor cell that meets no floor
    const floorAt = (i, j) => i >= 0 && j >= 0 && i < W && j < H && M.floor[j * W + i] !== F.VOID;
    b.strokeStyle = INK; b.lineWidth = Math.max(1.5, u * .32); b.lineCap = 'round'; b.beginPath();
    const seg = (a, c) => { b.moveTo(...P(...a)); b.lineTo(...P(...c)); };
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      if (!seen[j * W + i]) continue;
      if (!floorAt(i - 1, j)) seg([i, j], [i, j + 1]); if (!floorAt(i + 1, j)) seg([i + 1, j], [i + 1, j + 1]);
      if (!floorAt(i, j - 1)) seg([i, j], [i + 1, j]); if (!floorAt(i, j + 1)) seg([i, j + 1], [i + 1, j + 1]);
    }
    b.stroke();
    // piers: small dots
    b.fillStyle = INK_DIM;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (M.block[j * W + i] === B.COLUMN && (seen[(j) * W + i - 1] || seen[(j - 1) * W + i] || seen[(j) * W + i + 1])) {
      const [x, y] = P(i + .5, j + .5); b.beginPath(); b.arc(x, y, Math.max(1.2, u * .3), 0, 7); b.fill();
    }
    // the great window behind the altar and the main doors, when seen
    const mark = (t, col) => { b.strokeStyle = col; b.lineWidth = Math.max(2, u * .55); b.beginPath();
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) if (M.block[j * W + i] === t && seen[(j + 1) * W + i]) seg([i, j + 1], [i + 1, j + 1]); b.stroke(); };
    mark(B.GREAT, '#6a7cc8'); mark(B.DOOR, '#8a5a36');
    // place names (largest first, none on top of another)
    const boxes = [], zones = [...visited].sort((p, q) => (q.r[2] - q.r[0]) * (q.r[3] - q.r[1]) - (p.r[2] - p.r[0]) * (p.r[3] - p.r[1]));
    const seenNames = new Set();
    for (const z of zones) {
      const area = (z.r[2] - z.r[0]) * (z.r[3] - z.r[1]); if (seenNames.has(z.name) && area < 400) continue; seenNames.add(z.name);
      const [x, y] = P((z.r[0] + z.r[2]) / 2, (z.r[1] + z.r[3]) / 2), size = Math.round((area > 150 ? 15 : 11) * d);
      b.font = `${size}px "Pixelify Sans", monospace`; b.textAlign = 'center'; b.textBaseline = 'middle';
      const w = b.measureText(z.name.toUpperCase()).width, box = [x - w / 2 - 4, y - size / 2 - 3, x + w / 2 + 4, y + size / 2 + 3];
      if (boxes.some(o => !(box[2] < o[0] || box[0] > o[2] || box[3] < o[1] || box[1] > o[3]))) continue;
      boxes.push(box);
      b.fillStyle = '#000'; b.fillText(z.name.toUpperCase(), x + d, y + d); b.fillStyle = area > 150 ? INK : INK_DIM; b.fillText(z.name.toUpperCase(), x, y);
    }
    return c;
  }
  // Doors change while the map is closed, so they are drawn over the base each time.
  function drawDoors() {
    const u = fit.u;
    (M.doors || []).forEach((d, n) => {
      if (!d.cells.some(k => seen[k])) return;
      const cs = d.cells.map(k => [k % W, (k / W) | 0]), xs = cs.map(c => c[0]), ys = cs.map(c => c[1]);
      const along = new Set(ys).size === 1;                     // the run goes west–east
      const a = along ? [Math.min(...xs) + .1, ys[0] + .5] : [xs[0] + .5, Math.min(...ys) + .1], c = along ? [Math.max(...xs) + .9, ys[0] + .5] : [xs[0] + .5, Math.max(...ys) + .9];
      g.lineCap = 'butt'; g.lineWidth = Math.max(2, u * .6);
      g.strokeStyle = doorOpen(n) ? 'rgba(160,110,70,.45)' : '#a8703e'; g.setLineDash(doorOpen(n) ? [u * .5, u * .5] : []);
      g.beginPath(); g.moveTo(...P(...a)); g.lineTo(...P(...c)); g.stroke(); g.setLineDash([]);
    });
  }
  // The model: built once (a couple of seconds), again only if the screen changes size.
  let dio = null, dioKey = '', waiting = false;
  function names(b, d) {
    const boxes = [], seen = new Set(), zs = [...visited].sort((p, q) => (q.r[2] - q.r[0]) * (q.r[3] - q.r[1]) - (p.r[2] - p.r[0]) * (p.r[3] - p.r[1]));
    for (const z of zs) {
      if (seen.has(z.name)) continue; seen.add(z.name);
      const area = (z.r[2] - z.r[0]) * (z.r[3] - z.r[1]), [x, y] = dio.map((z.r[0] + z.r[2]) / 2 * CELL, (z.r[1] + z.r[3]) / 2 * CELL), size = Math.round((area > 250 ? 14 : 11) * d);
      b.font = `${size}px "Pixelify Sans", monospace`; b.textAlign = 'center'; b.textBaseline = 'middle';
      const txt = z.name.toUpperCase(), w = b.measureText(txt).width, box = [x - w / 2 - 4, y - size / 2 - 3, x + w / 2 + 4, y + size / 2 + 3];
      if (boxes.some(o => !(box[2] < o[0] || box[0] > o[2] || box[3] < o[1] || box[1] > o[3]))) continue; boxes.push(box);
      b.fillStyle = 'rgba(8,3,10,.55)'; b.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
      b.fillStyle = '#000'; b.fillText(txt, x + d, y + d); b.fillStyle = area > 250 ? INK : '#b8a888'; b.fillText(txt, x, y);
    }
  }
  function build() {
    const d = devicePixelRatio || 1, top = cv.height * .12, bottom = cv.height * .07;
    dio = model(cv.width * .94, cv.height - top - bottom);
    dio.x = Math.round((cv.width - dio.canvas.width) / 2); dio.y = Math.round(top + (cv.height - top - bottom - dio.canvas.height) / 2);
    const m = dio.map; dio.map = (x, y) => { const [a, b] = m(x, y); return [a + dio.x, b + dio.y]; };
    // what he hasn't seen stays dark, and the names
    const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const b = c.getContext('2d');
    b.drawImage(dio.canvas, dio.x, dio.y);
    if (!SHOW_ALL) { b.fillStyle = '#0b080d';
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = j * W + i; if (!M.floor[k] || seen[k]) continue;
        const p = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, bb]) => dio.map(a * CELL, bb * CELL)); b.beginPath(); p.forEach(([x, y], n) => n ? b.lineTo(x, y) : b.moveTo(x, y)); b.closePath(); b.fill(); } }
    names(b, d);
    dio.base = c; dirty = false;
  }
  function draw(px, py, k, name) {
    if (!open) return;
    const d = devicePixelRatio || 1, t = performance.now() / 1000, key = cv.width + 'x' + cv.height;
    if (!dio || dioKey !== key || dirty) {
      // The first time it takes a moment (seconds on a phone): say so, and build it on the next frame.
      if (!waiting) { waiting = true; g.clearRect(0, 0, cv.width, cv.height); g.fillStyle = 'rgba(8,3,5,.9)'; g.fillRect(0, 0, cv.width, cv.height);
        g.font = `${Math.round(18 * d)}px "Pixelify Sans", monospace`; g.textAlign = 'center'; g.fillStyle = INK_DIM; g.fillText('DIBUJANDO EL MAPA…', cv.width / 2, cv.height / 2); return; }
      waiting = false; dioKey = key; build();
    }
    g.clearRect(0, 0, cv.width, cv.height); g.fillStyle = 'rgba(8,3,5,.9)'; g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(dio.base, 0, 0);
    // him: a red arrow pointing the way he faces, pulsing
    const [x, y] = dio.map(px, py), a = k * Math.PI / 4, dir = [Math.cos(a) - Math.sin(a), (Math.cos(a) + Math.sin(a)) * .75], dl = Math.hypot(...dir);
    const fx = dir[0] / dl, fy = dir[1] / dl, s = 11 * d;
    g.fillStyle = `rgba(200,48,30,${.25 + .2 * Math.sin(t * 4)})`; g.beginPath(); g.arc(x, y, s * 1.6, 0, 7); g.fill();
    g.fillStyle = RED; g.strokeStyle = '#000'; g.lineWidth = d; g.beginPath();
    g.moveTo(x + fx * s, y + fy * s); g.lineTo(x - fx * s * .6 - fy * s * .6, y - fy * s * .6 + fx * s * .6); g.lineTo(x - fx * s * .25, y - fy * s * .25); g.lineTo(x - fx * s * .6 + fy * s * .6, y - fy * s * .6 - fx * s * .6); g.closePath(); g.fill(); g.stroke();
    // title, where he is, how to close
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const ts = Math.round(Math.min(cv.width / 22, 46 * d));
    g.font = `${ts}px "Jacquard 24", serif`; g.fillStyle = '#140103'; g.fillText(M.name || 'Catedral', cv.width / 2, cv.height * .065 + ts * .12); g.fillStyle = '#a3150f'; g.fillText(M.name || 'Catedral', cv.width / 2, cv.height * .065);
    g.font = `${Math.round(14 * d)}px "Pixelify Sans", monospace`; g.fillStyle = INK_DIM; g.fillText((name || '').toUpperCase(), cv.width / 2, cv.height * .065 + ts * .55);
    g.fillStyle = '#5e5246'; g.fillText(matchMedia('(pointer: coarse)').matches ? 'TOCA PARA CERRAR' : 'M · CERRAR', cv.width / 2, cv.height - 18 * d);
  }
  return {
    reveal, enter, draw,
    isOpen: () => open,
    setOpen(on) { open = on; el.classList.toggle('on', on); if (on) { resize(); } },
  };
}
