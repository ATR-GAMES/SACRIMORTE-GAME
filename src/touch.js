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
const C = { fill: 'rgba(22,8,10,.62)', down: 'rgba(150,24,18,.85)', rim: '#6e1610', rimDark: '#2a0608', hi: 'rgba(255,230,210,.14)', ink: '#eadcc4', inkDim: '#7a6c60', shade: '#0a0204' };

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
    const w = view.w, h = view.h, s = Math.min(1.25, Math.max(.85, h / 200));   // a little larger on bigger screens
    const R = v => Math.round(v * s);
    B = [
      { id: 'atk', code: 'Mouse0', x: w - R(36), y: h - R(36), r: R(24), big: 1 },
      { id: 'roll', code: 'KeyQ', x: w - R(86), y: h - R(22), r: R(15) },
      { id: 'jump', code: 'Space', x: w - R(26), y: h - R(88), r: R(15) },
      { id: 'cross', code: 'KeyF', hold: 1, x: w - R(76), y: h - R(70), r: R(14) },
      { id: 'pray', code: 'KeyR', x: w - R(118), y: h - R(56), r: R(12) },
      { id: 'crouch', code: 'KeyC', x: w - R(128), y: h - R(20), r: R(11) },
      { id: 'pause', code: 'Escape', x: w - R(16), y: R(16), r: R(11), sq: 1 },
      { id: 'wpn', x: w - R(44), y: R(16), r: R(11), sq: 1, wide: R(14) },
      { id: 'map', code: 'KeyM', x: w - R(74), y: R(16), r: R(11), sq: 1 },
      { id: 'use', code: 'KeyE', x: w - R(70), y: h - R(116), r: R(13), only: 'door' },
    ];
    const gy = h - R(20), gs = R(26);
    G = [['left', 'ArrowLeft'], ['right', 'ArrowRight'], ['up', 'ArrowUp'], ['down', 'ArrowDown'], ['exit', 'Tab']].map(([id, code], i) =>
      ({ id, code, x: Math.round(w / 2 + (i - 2) * gs), y: gy, r: R(11), sq: 1 }));
    stickHome = { x: R(48), y: h - R(46) }; stickR = R(24);
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
  const button = (g, b, name, dim) => {
    const fill = b.down ? C.down : C.fill, rim = b.down ? '#c8301e' : C.rim;
    if (b.sq) box(g, b.x, b.y, b.wide || b.r, b.r, fill, rim); else disc(g, b.x, b.y, b.r, fill, rim);
    if (!b.down && !b.sq) { g.fillStyle = C.hi; g.fillRect(b.x - Math.round(b.r * .55), b.y - Math.round(b.r * .7), Math.round(b.r * .5), 1); }
    icon(g, name, b.x, b.y, b.big ? 3 : 2, dim ? C.inkDim : C.ink);
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
      disc(g, Math.round(stick.ox), Math.round(stick.oy), stickR, 'rgba(22,8,10,.35)', C.rim);
      disc(g, Math.round(stick.x), Math.round(stick.y), Math.round(stickR * .42), 'rgba(150,24,18,.8)', C.rimDark);
    } else {
      g.globalAlpha = .45; disc(g, stickHome.x, stickHome.y, stickR, 'rgba(22,8,10,.25)', C.rim); disc(g, stickHome.x, stickHome.y, Math.round(stickR * .42), 'rgba(110,22,16,.5)', C.rimDark); g.globalAlpha = 1;
    }
    for (const b of B) if (!b.only || st[b.only]) button(g, b, b.id === 'wpn' ? st.wid : b.id, (b.id === 'atk' && !st.wid) || ((b.id === 'roll' || b.id === 'cross') && st.st < 10));
  }
  layout();
  return { draw };
}
