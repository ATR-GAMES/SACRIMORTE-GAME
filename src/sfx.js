// Which sound engine plays the game: the synthesized voices (src/sound.js, the default), the retro one (src/retro.js), or none.
// Both answer the same calls; this passes each call to the one chosen. The choice is remembered.
import * as OLD from './sound.js?v=7b25778';
import * as RETRO from './retro.js?v=7b25778';

const MODES = ['anterior', 'retro', 'no'];
let mode = 'anterior';
try { const m = localStorage.getItem('sacrimorte_motor2'); if (MODES.includes(m)) mode = m; } catch {}
if (!OLD.isOn()) OLD.toggle();                       // the old engine's own switch stays on; this one decides
const eng = () => mode === 'retro' ? RETRO : mode === 'anterior' ? OLD : null;

// The browser lets sound start only after a key or a touch: wake the engine in use then.
const wake = () => eng()?.ensure();
for (const e of ['keydown', 'pointerdown', 'touchstart']) addEventListener(e, wake, { capture: true, passive: true });

export const label = () => mode;
export function cycle() {
  const was = eng(); was?.prayOn(false); was?.crossOn(false);
  mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
  try { localStorage.setItem('sacrimorte_motor2', mode); } catch {}
  wake();
  return mode;
}
const pass = name => (...a) => eng()?.[name](...a);
export const swing = pass('swing'), hit = pass('hit'), equip = pass('equip'), hurt = pass('hurt'), die = pass('die'), lowHp = pass('lowHp'),
  step = pass('step'), jump = pass('jump'), land = pass('land'), roll = pass('roll'), breath = pass('breath'), crossOn = pass('crossOn'),
  prayOn = pass('prayOn'), sizzle = pass('sizzle'), pain = pass('pain'), cry = pass('cry'), eswing = pass('eswing'), fire = pass('fire'),
  shatter = pass('shatter'), stomp = pass('stomp'), snort = pass('snort'), summon = pass('summon'), door = pass('door');
