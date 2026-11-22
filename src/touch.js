// Phone controls. They don't drive the game themselves: they press the same keys the keyboard would (the stick
// holds W/A/S/D and Shift, the buttons tap or hold Q, Space, F…), so the game logic stays the same on every device.
export function initTouch({ keys, hit, state, weapons, weaponName }) {
  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!isTouch) return false;
  document.body.classList.add('touch');
  const el = (tag, cls, html = '', parent = root) => { const e = document.createElement(tag); e.className = cls; e.innerHTML = html; parent.appendChild(e); return e; };
  const root = document.createElement('div'); root.id = 'touch'; document.body.appendChild(root);
  const rot = document.createElement('div'); rot.id = 'rotate'; rot.innerHTML = '<div>Gira el teléfono</div><small>Sacrimorte se juega en horizontal</small>'; document.body.appendChild(rot);

  // The first touch goes full screen and, where the browser allows it, locks the screen sideways.
  let full = false;
  const goFull = () => {
    if (full) return; full = true;
    const d = document.documentElement;
    try { (d.requestFullscreen || d.webkitRequestFullscreen)?.call(d)?.then?.(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {}); } catch {}
  };
  addEventListener('touchstart', () => { window.__lastTouch = performance.now(); }, { capture: true, passive: true });

  // ---------------------------------------------------------------- the stick
  const zone = el('div', 't-zone'), base = el('div', 't-base'), knob = el('div', 't-knob', '', base);
  const STICK = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft'];
  let sid = null, ox = 0, oy = 0;
  const R = () => Math.min(64, innerHeight * .14);
  const stickTo = (x, y) => {
    let dx = x - ox, dy = y - oy; const l = Math.hypot(dx, dy), r = R();
    if (l > r) { dx *= r / l; dy *= r / l; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    for (const k of STICK) keys.delete(k);
    if (l < r * .22) return;
    const sx = dx / Math.hypot(dx, dy), sy = dy / Math.hypot(dx, dy);
    if (sx > .38) keys.add('KeyD'); if (sx < -.38) keys.add('KeyA'); if (sy > .38) keys.add('KeyS'); if (sy < -.38) keys.add('KeyW');
    if (l >= r * .92) keys.add('ShiftLeft');
  };
  zone.addEventListener('pointerdown', e => {
    goFull(); if (sid !== null) return;
    sid = e.pointerId; try { zone.setPointerCapture(sid); } catch {} ox = e.clientX; oy = e.clientY;
    base.style.left = ox + 'px'; base.style.top = oy + 'px'; base.classList.add('on'); stickTo(ox, oy);
  });
  zone.addEventListener('pointermove', e => { if (e.pointerId === sid) stickTo(e.clientX, e.clientY); });
  const stickUp = e => { if (e.pointerId !== sid) return; sid = null; base.classList.remove('on'); knob.style.transform = ''; for (const k of STICK) keys.delete(k); };
  zone.addEventListener('pointerup', stickUp); zone.addEventListener('pointercancel', stickUp);

  // ---------------------------------------------------------------- buttons
  const btn = (cls, label, code, hold = false) => {
    const b = el('div', 't-btn ' + cls, label);
    b.addEventListener('pointerdown', e => { goFull(); e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch {} b.classList.add('down'); hit.add(code); if (hold) keys.add(code); });
    const up = () => { b.classList.remove('down'); if (hold) keys.delete(code); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    return b;
  };
  btn('t-atk', 'Golpe', 'Mouse0');
  btn('t-roll', 'Rodar', 'KeyQ');
  btn('t-jump', 'Saltar', 'Space');
  btn('t-cross', '✝', 'KeyF', true);
  btn('t-pray', 'Rezar', 'KeyR');
  btn('t-crouch', 'Agach.', 'KeyC');
  btn('t-pause', 'II', 'Escape');
  const wb = el('div', 't-btn t-wpn', '');
  wb.addEventListener('pointerdown', e => {
    e.preventDefault(); goFull();
    const cur = weapons.indexOf(state().wid), next = weapons[(cur + 1) % weapons.length];
    const i = weapons.indexOf(next); hit.add(i === 0 ? 'Digit0' : 'Digit' + i); wb.classList.add('down');
  });
  wb.addEventListener('pointerup', () => wb.classList.remove('down'));

  // ---------------------------------------------------------------- the gallery's own arrows
  const gal = el('div', 't-gal');
  for (const [lab, code] of [['◀', 'ArrowLeft'], ['▶', 'ArrowRight'], ['▲', 'ArrowUp'], ['▼', 'ArrowDown'], ['Salir', 'Tab']]) {
    const b = el('div', 't-btn', lab, gal);
    b.addEventListener('pointerdown', e => { e.preventDefault(); hit.add(code); b.classList.add('down'); });
    b.addEventListener('pointerup', () => b.classList.remove('down'));
  }

  // Dead: a touch anywhere gets him up again.
  addEventListener('pointerdown', () => { if (state().mode === 'dead') hit.add('Enter'); });

  // Show what fits the moment.
  const tick = () => {
    const s = state();
    root.dataset.mode = s.gallery ? 'gallery' : s.paused ? 'paused' : s.mode === 'dead' ? 'dead' : 'play';
    root.classList.toggle('armed', !!s.wid);
    const name = weaponName(s.wid); if (wb.dataset.n !== name) { wb.dataset.n = name; wb.innerHTML = `<small>arma</small>${name}`; }
    if (root.dataset.mode !== 'play' && sid !== null) { sid = null; base.classList.remove('on'); for (const k of STICK) keys.delete(k); }
    requestAnimationFrame(tick);
  };
  tick();
  return true;
}
