// Phone controls, drawn into the game's own pixel canvas so they look like the rest of it. They press the same keys
// the keyboard would (the stick holds W/A/S/D and Shift, the buttons tap or hold Q, Space, F…), so the game logic is
// the same on every device.

// 9×9 pixel icons.
const ICON = {
  atk: ['........#', '.......##', '......##.', '.....##..', '.#..##...', '..###....', '..##.....', '.#..#....', '#........'],
  roll: ['...####..', '..#....#.', '.#......#', '.#.......', '.#....#..', '.#...###.', '..#.#####', '...#.....', '.........'],
  jump: ['....#....', '...###...', '..#####..', '.#######.', '...###...', '...###...', '...###...', '.........', '.#######.'],
  cross: ['....#....', '....#....', '..#####..', '....#....', '....#....', '....#....', '....#....', '....#....', '...###...'],
  pray: ['....#....', '...###...', '...###...', '..##.##..', '..##.##..', '.##...##.', '.##...##.', '##.....##', '.........'],
  crouch: ['#.......#', '.#.....#.', '..#...#..', '...#.#...', '#...#...#', '.#.....#.', '..#...#..', '...#.#...', '....#....'],
  pause: ['.........', '.##...##.', '.##...##.', '.##...##.', '.##...##.', '.##...##.', '.##...##.', '.##...##.', '.........'],
  left: ['.....#...', '....##...', '...###...', '..####...', '.#####...', '..####...', '...###...', '....##...', '.....#...'],
  right: ['...#.....', '...##....', '...###...', '...####..', '...#####.', '...####..', '...###...', '...##....', '...#.....'],
  up: ['.........', '.........', '....#....', '...###...', '..#####..', '.#######.', '#########', '.........', '.........'],
  down: ['.........', '.........', '#########', '.#######.', '..#####..', '...###...', '....#....', '.........', '.........'],
  use: ['..#####..', '.#.....#.', '.#.....#.', '.#.....#.', '.#...#.#.', '.#.....#.', '.#.....#.', '.#.....#.', '#########'],
  map: ['.........', '##..##..#', '#.##..##.', '#..#...#.', '#..#...#.', '#..#...#.', '#..#...#.', '##.##.##.', '.........'],
  exit: ['#.......#', '.#.....#.', '..#...#..', '...#.#...', '....#....', '...#.#...', '..#...#..', '.#.....#.', '#.......#'],
  '': ['.........', '..####...', '.######..', '.#######.', '.#######.', '.######..', '..#####..', '...###...', '.........'],
  daga: ['........#', '.......#.', '......#..', '.....#...', '....#....', '..##.....', '..##.....', '.#.......', '#........'],
  machete: ['.......##', '......###', '.....###.', '....###..', '...###...', '..##.....', '..#......', '.#.......', '#........'],
  hacha: ['.....###.', '....####.', '...#####.', '....##...', '...#.....', '..#......', '.#.......', '#........', '.........'],
  candelabro: ['#...#...#', '#...#...#', '#########', '....#....', '....#....', '....#....', '....#....', '...###...', '..#####..'],
  horca: ['#.#.#....', '#.#.#....', '#####....', '..#......', '..#......', '..#......', '..#......', '..#......', '..#......'],
};
// Dark glass in a thin bronze ring, as the church's lamps and reliquaries: quiet until pressed, then a red glow.
const C = { fill: 'rgba(12,8,14,.42)', down: 'rgba(120,26,20,.62)', rim: '#8c6a3e', rimHi: '#d8b070', rimDark: 'rgba(6,3,6,.75)', hi: 'rgba(255,236,200,.16)', ink: '#e8dcc4', inkDim: 'rgba(232,220,196,.35)', shade: 'rgba(6,2,4,.8)', glow: 'rgba(200,60,40,.35)' };

export function initTouch({ keys, hit, state, weapons, view }) {
  document.body.classList.add('touch');
  const rot = document.createElement('div'); rot.id = 'rotate'; rot.innerHTML = '<div>Gira el teléfono</div><small>Sacrimorte se juega en horizontal</small>'; document.body.appendChild(rot);

  let full = false;
  const goFull = () => {
    if (full) return; full = true;
    const d = document.documentElement;
    try { const p = (d.requestFullscreen || d.webkitRequestFullscreen)?.call(d); p?.then?.(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch?.(() => {}); } catch {}
  };

  // ---------------------------------------------------------------- layout, in canvas pixels
  let B = [];
  const layout = () => {
    const w = view.w, h = view.h, s = Math.min(1.15, Math.max(.8, h / 330));   // (a phone's whole screen at one game pixel a CSS pixel)
    const R = v => Math.round(v * s);
    // the attack in the corner, the other actions in an arc round it (the thumb rolls from one to the next)
    const ax = w - R(46), ay = h - R(44), arc = (deg, d) => [Math.round(ax + Math.cos(deg * Math.PI / 180) * R(d)), Math.round(ay + Math.sin(deg * Math.PI / 180) * R(d))];
    const at = (id, code, deg, d, r, more = {}) => { const [x, y] = arc(deg, d); return { id, code, x, y, r: R(r), ...more }; };
    B = [
      { id: 'atk', code: 'Mouse0', x: ax, y: ay, r: R(22), big: 1 },
      at('roll', 'KeyQ', 180, 44, 12), at('cross', 'KeyF', 222, 44, 12, { hold: 1 }), at('jump', 'Space', 266, 44, 12),
      at('crouch', 'KeyC', 196, 76, 10), at('pray', 'KeyR', 236, 76, 10), at('use', 'KeyE', 272, 80, 11, { only: 'door' }),
      { id: 'pause', code: 'Escape', x: w - R(14), y: R(13), r: R(8), sq: 1 },
      { id: 'wpn', x: w - R(40), y: R(13), r: R(8), sq: 1, wide: R(11) },
      { id: 'map', code: 'KeyM', x: w - R(66), y: R(13), r: R(8), sq: 1 },
    ];
    const gy = h - R(20), gs = R(26);
    G = [['left', 'ArrowLeft'], ['right', 'ArrowRight'], ['up', 'ArrowUp'], ['down', 'ArrowDown'], ['exit', 'Tab']].map(([id, code], i) =>
      ({ id, code, x: Math.round(w / 2 + (i - 2) * gs), y: gy, r: R(11), sq: 1 }));
    stickHome = { x: R(52), y: h - R(50) }; stickR = R(26);
  };
  let G = [], stickHome = { x: 40, y: 150 }, stickR = 24;

  // ---------------------------------------------------------------- input
  const STICK = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft'];
  const owned = new Map();            // pointerId → what it holds
  let stick = null;                   // { id, ox, oy, x, y }
  const toView = e => [e.clientX / view.s, e.clientY / view.s];
  const find = (list, x, y) => list.find(b => b.sq ? Math.abs(x - b.x) <= (b.wide || b.r) + 3 && Math.abs(y - b.y) <= b.r + 3 : Math.hypot(x - b.x, y - b.y) <= b.r + 5);
  const stickTo = (x, y) => {
    let dx = x - stick.ox, dy = y - stick.oy; const l = Math.hypot(dx, dy);
    if (l > stickR) { dx *= stickR / l; dy *= stickR / l; }
    stick.x = stick.ox + dx; stick.y = stick.oy + dy;
    for (const k of STICK) keys.delete(k);
    if (l < stickR * .25) return;
    const sx = dx / Math.hypot(dx, dy), sy = dy / Math.hypot(dx, dy);
    if (sx > .38) keys.add('KeyD'); if (sx < -.38) keys.add('KeyA'); if (sy > .38) keys.add('KeyS'); if (sy < -.38) keys.add('KeyW');
    if (l >= stickR * .9) keys.add('ShiftLeft');
  };
  const releaseStick = () => { stick = null; for (const k of STICK) keys.delete(k); };
  addEventListener('pointerdown', e => {
    window.__lastTouch = performance.now();
    const st = state(); if (st.paused) return;            // the pause menu takes its own taps
    goFull(); e.preventDefault();
    if (st.mode === 'dead' && !st.gallery) { hit.add('Enter'); return; }
    if (st.map) { hit.add('KeyM'); return; }                // a tap anywhere closes the map
    const [x, y] = toView(e);
    const b = find(st.gallery ? G : B.filter(b => !b.only || st[b.only]), x, y);
    if (b) {
      if (b.id === 'wpn') { const cur = weapons.indexOf(st.wid), i = (cur + 1) % weapons.length; hit.add(i ? 'Digit' + i : 'Digit0'); }
      else { hit.add(b.code); if (b.hold) keys.add(b.code); }
      owned.set(e.pointerId, b); b.down = true; return;
    }
    if (!st.gallery && x < view.w * .55 && !stick) { stick = { id: e.pointerId, ox: x, oy: y, x, y }; owned.set(e.pointerId, 'stick'); stickTo(x, y); }
  }, { passive: false });
  addEventListener('pointermove', e => { if (stick && e.pointerId === stick.id) { const [x, y] = toView(e); stickTo(x, y); } }, { passive: true });
  const up = e => {
    const o = owned.get(e.pointerId); if (!o) return; owned.delete(e.pointerId);
    if (o === 'stick') releaseStick(); else { o.down = false; if (o.hold) keys.delete(o.code); }
  };
  addEventListener('pointerup', up); addEventListener('pointercancel', up);

  // ---------------------------------------------------------------- drawing (pixel by pixel, like everything else)
  // A pixel circle with a one-pixel rim (no erasing: what is under the button must still show through).
  const W = (r, j) => Math.abs(j) > r ? -1 : Math.floor(Math.sqrt(r * r - j * j) + .5);
  const disc = (g, cx, cy, r, fill, rim) => {
    for (let j = -r; j <= r; j++) {
      const wo = W(r, j), wi = W(r - 1, j);
      g.fillStyle = rim;
      if (wi < 0) g.fillRect(cx - wo, cy + j, wo * 2 + 1, 1);
      else { g.fillRect(cx - wo, cy + j, wo - wi, 1); g.fillRect(cx + wi + 1, cy + j, wo - wi, 1); g.fillStyle = fill; g.fillRect(cx - wi, cy + j, wi * 2 + 1, 1); }
    }
  };
  const box = (g, cx, cy, hw, hh, fill, rim) => {
    g.fillStyle = fill; g.fillRect(cx - hw + 1, cy - hh + 1, hw * 2 - 1, hh * 2 - 1);
    g.fillStyle = rim; g.fillRect(cx - hw + 1, cy - hh, hw * 2 - 1, 1); g.fillRect(cx - hw + 1, cy + hh, hw * 2 - 1, 1); g.fillRect(cx - hw, cy - hh + 1, 1, hh * 2 - 1); g.fillRect(cx + hw, cy - hh + 1, 1, hh * 2 - 1);
  };
  const icon = (g, name, cx, cy, sc, col) => {
    const I = ICON[name]; if (!I) return;
    const x0 = Math.round(cx - 4.5 * sc), y0 = Math.round(cy - 4.5 * sc);
    for (const [c, o] of [[C.shade, 1], [col, 0]]) { g.fillStyle = c; I.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') g.fillRect(x0 + i * sc + o, y0 + j * sc + o, sc, sc); }); }
  };
  // a ring: a dark line outside, the bronze inside it, lit on its upper left
  const ring = (g, cx, cy, r, col, hi) => {
    for (let a = 0; a < 360; a += 360 / (r * 7)) { const t = a * Math.PI / 180, x = Math.round(cx + Math.cos(t) * r), y = Math.round(cy + Math.sin(t) * r);
      g.fillStyle = C.rimDark; g.fillRect(x + Math.sign(Math.cos(t)) * (Math.abs(Math.cos(t)) > .5 ? 1 : 0), y + Math.sign(Math.sin(t)) * (Math.abs(Math.sin(t)) > .5 ? 1 : 0), 1, 1);
      g.fillStyle = (a > 170 && a < 280) ? hi : col; g.fillRect(x, y, 1, 1); }
  };
  const button = (g, b, name, dim) => {
    const r = b.r;
    if (b.sq) { const hw = b.wide || r; box(g, b.x, b.y, hw, r, b.down ? C.down : C.fill, b.down ? C.rimHi : C.rim); g.fillStyle = C.hi; g.fillRect(b.x - hw + 2, b.y - r + 1, hw * 2 - 3, 1); }
    else {
      if (b.down) { g.fillStyle = C.glow; disc(g, b.x, b.y, r + 2, C.glow, C.glow); }
      disc(g, b.x, b.y, r - 1, b.down ? C.down : C.fill, b.down ? C.down : C.fill);
      ring(g, b.x, b.y, r, b.down ? C.rimHi : C.rim, b.down ? '#fff0c8' : C.rimHi);
      if (b.big) ring(g, b.x, b.y, r - 3, 'rgba(140,106,62,.45)', 'rgba(216,176,112,.45)');   // the attack's inner ring
    }
    icon(g, name, b.x, b.y, b.big ? 2 : b.sq ? 1 : (r >= 11 ? 2 : 1), dim ? C.inkDim : C.ink);
  };
  let lastW = 0, lastH = 0;
  function draw(g) {
    if (view.w !== lastW || view.h !== lastH) { lastW = view.w; lastH = view.h; layout(); }
    const st = state();
    if (st.paused || st.map) return;
    if (st.gallery) { for (const b of G) button(g, b, b.id); return; }
    if (st.mode === 'dead') return;
    // The stick: where the thumb landed, or a faint hint of where it goes.
    if (stick) {
      disc(g, Math.round(stick.ox), Math.round(stick.oy), stickR - 1, 'rgba(12,8,14,.28)', 'rgba(12,8,14,.28)'); ring(g, Math.round(stick.ox), Math.round(stick.oy), stickR, C.rim, C.rimHi);
      const kr = Math.round(stickR * .4); disc(g, Math.round(stick.x), Math.round(stick.y), kr - 1, 'rgba(120,26,20,.6)', 'rgba(120,26,20,.6)'); ring(g, Math.round(stick.x), Math.round(stick.y), kr, C.rimHi, '#fff0c8');
    } else {
      g.globalAlpha = .5; ring(g, stickHome.x, stickHome.y, stickR, C.rim, C.rimHi); ring(g, stickHome.x, stickHome.y, Math.round(stickR * .4), C.rim, C.rimHi); g.globalAlpha = 1;
    }
    for (const b of B) if (!b.only || st[b.only]) button(g, b, b.id === 'wpn' ? st.wid : b.id, (b.id === 'atk' && !st.wid) || ((b.id === 'roll' || b.id === 'cross') && st.st < 10));
  }
  layout();
  return { draw };
}
