// Level 1: the Cathedral of Our Lady of the Souls (Catedral de Nuestra Señora de las Ánimas).
// Laid out like a diorama, compact: the nave in the middle, full of pews, its red runner climbing to the altar on a
// dais under the great rose window. Round it, wall to wall: the library upstairs and the study below it to the west;
// the organ loft upstairs and the sacristy below it to the east; a chapel and the stores; the courtyard with its
// fountain; the narthex between two towers; and outside the main doors, the terrace, its gardens, and the steps down
// to the street.
// One cell is about a metre. x runs west → east, y north → south. Floors stand at levels (one step = STEP_PX on
// screen): the street at 0, the church and terrace at 2, the dais at 5, the library and organ loft upstairs at 8.
import { footprint } from './props.js?v=78777f9';

export const CELL = 20 * Math.SQRT2;            // world units per cell
export const NAME = 'Catedral de Nuestra Señora de las Ánimas';

// Floors. PLAZA, GRASS, GRAVEL and DIRT are out under the sky.
export const F = { VOID: 0, STONE: 1, AISLE: 2, CARPET: 3, MARBLE: 4, MOSAIC: 5, WOOD: 6, GRASS: 7, TILE: 8, DIRT: 9, CHAPEL: 10, STEP: 11, GRAVEL: 12, CHECKER: 13, PLAZA: 14 };
export const OUTDOOR = new Set([F.PLAZA, F.GRASS, F.GRAVEL, F.DIRT]);
// What stands on a cell. PROP cells point into `props` through `pi`. LOW: a low wall round open ground.
export const B = { NONE: 0, WALL: 1, DOOR: 2, ARCH: 3, GREAT: 4, COLUMN: 6, PROP: 7, LOW: 8 };

export function build() {
  const W = 106, H = 104, OX = 3, OY = 3;
  const floor = new Uint8Array(W * H), block = new Uint8Array(W * H), vari = new Uint8Array(W * H), pi = new Int16Array(W * H).fill(-1);
  const level = new Uint8Array(W * H);
  const props = [], skipped = [];
  const at = (x, y) => (y + OY) * W + (x + OX), inside = (x, y) => x + OX >= 0 && y + OY >= 0 && x + OX < W && y + OY < H;
  const rect = (x0, y0, x1, y1, fn) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (inside(x, y)) fn(at(x, y), x, y); };
  const fill = (x0, y0, x1, y1, t, lv = 2) => rect(x0, y0, x1, y1, k => { floor[k] = t; block[k] = 0; level[k] = lv; });
  const lvl = (x0, y0, x1, y1, lv) => rect(x0, y0, x1, y1, k => { level[k] = lv; });
  const free = (x, y) => inside(x, y) && floor[at(x, y)] && !block[at(x, y)];
  // A piece of furniture: its footprint must be clear floor.
  const prop = (type, x, y, rot = 0) => {
    const [w, h] = footprint(type, rot); let ok = true;
    rect(x, y, x + w, y + h, k => { if (!floor[k] || block[k]) ok = false; });
    if (!ok) { skipped.push(type + '@' + x + ',' + y); return false; }
    const n = props.length; props.push({ type, x: x + OX, y: y + OY, rot, seed: (Math.imul(n + 1, 2654435761) >>> 24) });
    rect(x, y, x + w, y + h, k => { block[k] = B.PROP; pi[k] = n; });
    return true;
  };
  const col = (x, y, v = 0) => { if (free(x, y)) { const k = at(x, y); block[k] = B.COLUMN; vari[k] = v; } };

  // ---------------------------------------------------------------- the church
  fill(34, 6, 56, 22, F.MARBLE);                     // the sanctuary
  fill(34, 6, 56, 18, F.STEP); lvl(34, 6, 56, 16, 5); lvl(34, 16, 56, 17, 4); lvl(34, 17, 56, 18, 3);   // the dais, three steps up
  fill(34, 22, 56, 67, F.CHECKER);                   // the nave: great squares of black and white marble
  fill(34, 68, 56, 74, F.STONE);                     // the narthex
  fill(25, 66, 33, 75, F.STONE); fill(57, 66, 65, 75, F.STONE);   // the two towers
  // west: the library upstairs, the study below it, its stair climbing north between balustrades
  fill(14, 6, 33, 21, F.WOOD, 8);
  fill(14, 22, 33, 35, F.TILE);
  fill(20, 21, 24, 26, F.STEP); lvl(20, 21, 24, 22, 7); lvl(20, 22, 24, 23, 6); lvl(20, 23, 24, 24, 5); lvl(20, 24, 24, 25, 4); lvl(20, 25, 24, 26, 3);
  // east: the organ loft upstairs, the sacristy below it; the chapel; the stores
  fill(57, 6, 73, 21, F.WOOD, 8);
  fill(57, 22, 73, 35, F.TILE);
  fill(64, 21, 68, 26, F.STEP); lvl(64, 21, 68, 22, 7); lvl(64, 22, 68, 23, 6); lvl(64, 23, 68, 24, 5); lvl(64, 24, 68, 25, 4); lvl(64, 25, 68, 26, 3);
  fill(57, 36, 73, 49, F.CHAPEL);
  fill(57, 50, 73, 67, F.STONE);
  // the courtyard: paving round a garden, gravel paths crossing at the fountain
  fill(74, 30, 98, 67, F.PLAZA); fill(77, 33, 95, 64, F.GRASS); fill(85, 33, 87, 64, F.GRAVEL); fill(77, 47, 95, 49, F.GRAVEL);
  // outside the doors: the terrace, its gardens, two steps down to the street
  fill(34, 75, 56, 76, F.PLAZA); fill(18, 76, 73, 89, F.PLAZA);
  fill(19, 79, 30, 88, F.GRASS); fill(61, 79, 72, 88, F.GRASS);
  fill(38, 89, 53, 90, F.PLAZA, 1);
  fill(30, 90, 61, 97, F.DIRT, 0);
  // the runner, from the altar out through the doors and down the steps
  rect(44, 12, 46, 90, k => { if (floor[k] || true) { floor[k] = F.CARPET; block[k] = 0; if (!level[k]) level[k] = 2; } });
  lvl(44, 12, 46, 16, 5); lvl(44, 16, 46, 17, 4); lvl(44, 17, 46, 18, 3); lvl(44, 18, 46, 89, 2); lvl(44, 89, 46, 90, 1);

  // ---------------------------------------------------------------- walls: every empty cell touching a floor; round open ground only a low wall
  const edge = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x; if (floor[k] || block[k]) continue;
    let any = false, indoor = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
      const f = floor[yy * W + xx]; if (f) { any = true; if (f !== F.PLAZA && f !== F.GRASS && f !== F.GRAVEL && f !== F.DIRT) indoor = true; }
    }
    if (any) edge[k] = indoor ? B.WALL : B.LOW;
  }
  for (let k = 0; k < W * H; k++) if (edge[k]) block[k] = edge[k];
  // Doorways: n cells of wall opened under one pointed arch, with a pair of wooden doors in it or none.
  const doors = [];
  const doorway = (x, y, along, n, door) => {
    const cells = [];
    for (let d = 0; d < n; d++) {
      const xx = along === 'x' ? x + d : x, yy = along === 'y' ? y + d : y, k = at(xx, yy);
      // the threshold takes the floor and level of the side it opens from
      const [ax, ay] = along === 'x' ? [xx, yy - 1] : [xx - 1, yy], [bx, by] = along === 'x' ? [xx, yy + 1] : [xx + 1, yy];
      const from = inside(ax, ay) && floor[at(ax, ay)] ? at(ax, ay) : at(bx, by);
      block[k] = B.ARCH; floor[k] = floor[from] === F.STEP ? F.STONE : floor[from]; level[k] = level[from]; cells.push(k);
    }
    if (door) doors.push({ cells });
  };
  doorway(33, 27, 'y', 3, 1);                        // nave → study
  doorway(56, 27, 'y', 3, 1); doorway(56, 41, 'y', 3, 1); doorway(56, 57, 'y', 3, 1);   // nave → sacristy, chapel, stores
  doorway(73, 41, 'y', 3, 1); doorway(73, 58, 'y', 3, 0);   // chapel, stores → courtyard
  doorway(41, 67, 'x', 8, 0);                        // nave → narthex: one great open arch
  doorway(33, 70, 'y', 3, 1); doorway(56, 70, 'y', 3, 1);   // narthex → towers
  doorway(43, 74, 'x', 4, 1);                        // the main doors, out onto the terrace
  for (let x = 37; x < 53; x++) block[at(x, 5)] = B.GREAT;   // the great rose window behind the altar

  // ---------------------------------------------------------------- columns
  for (let y = 24; y <= 64; y += 6) { col(36, y, (y / 6) & 1 ? 2 : 0); col(53, y, (y / 6) & 1 ? 0 : 2); }   // the nave's piers, candles on some
  // engaged piers along the walls, some hung with a banner (never beside a doorway)
  const engaged = (x, y, n) => { if (!free(x, y)) return; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inside(x + dx, y + dy) && block[at(x + dx, y + dy)] === B.ARCH) return; col(x, y, n % 2 ? 4 : 3); };
  [8, 13, 20].forEach((y, n) => { engaged(34, y, n + 1); engaged(55, y, n); });
  [34, 40, 51, 55].forEach((x, n) => engaged(x, 73, n));
  [17, 23, 30].forEach((x, n) => engaged(x, 6, n)); [58, 71].forEach((x, n) => engaged(x, 6, n + 1));

  // ---------------------------------------------------------------- the sanctuary
  prop('altar', 42, 10);
  prop('cathedra', 45, 7);
  prop('credence', 40, 7); prop('credence', 49, 7);
  for (const [x, y] of [[38, 7], [52, 7], [39, 12], [51, 12], [39, 18], [51, 18]]) prop('candelabrum', x, y);
  prop('vase', 41, 14); prop('vase', 49, 14); prop('lectern', 42, 19);
  prop('grate', 36, 19);
  prop('chandelier2', 44, 21); prop('chandelier2', 44, 31);
  // the nave: seven rows of pews either side of the runner, a pulpit, chandeliers
  for (let y = 25; y <= 43; y += 3) { prop('pew', 37, y); prop('pew', 47, y); }
  prop('pulpit', 54, 22);
  for (const y of [42, 53, 63]) prop('chandelier2', 44, y);
  for (const y of [40, 52]) { prop('votives', 34, y, 1); prop('pedestal', 55, y); }
  // narthex and towers
  prop('font', 37, 70); prop('font', 51, 70); prop('bench', 34, 69, 0); prop('candelabrum', 41, 72); prop('candelabrum', 48, 72); prop('chandelier2', 44, 69);
  prop('stairs', 28, 67); prop('crate', 26, 73); prop('barrel', 27, 73); prop('stairs', 58, 67); prop('crate', 63, 73); prop('chest', 62, 73);

  // ---------------------------------------------------------------- west: the study, the library upstairs
  for (const y of [22, 23, 24, 25]) { prop('parapet', 19, y, 1); prop('parapet', 24, y, 1); }    // balustrades either side of the stair
  prop('desk', 15, 26); prop('chair', 16, 27, 2); prop('desk', 15, 31); prop('chair', 16, 32, 2);
  prop('bookshelf', 27, 22); prop('bookshelf', 30, 22); prop('chest', 31, 33); prop('chest', 29, 33); prop('candelabrum', 26, 29);
  prop('pedestal', 14, 22); prop('globe', 28, 29);
  for (const x of [15, 18]) prop('bookshelf', x, 6);
  for (const x of [25, 28, 31]) prop('bookshelf', x, 6);
  for (const y of [10, 14]) for (const x of [15, 18, 25, 28]) prop('bookshelf', x, y);
  prop('desk', 26, 18); prop('chair', 27, 17, 0); prop('desk', 15, 18); prop('chair', 16, 17, 0);
  prop('lectern', 22, 9); prop('candelabrum', 22, 13); prop('candelabrum', 31, 12); prop('chandelier', 22, 17); prop('rug', 20, 11);

  // ---------------------------------------------------------------- east: the sacristy, the organ loft upstairs, the chapel, the stores
  for (const y of [22, 23, 24, 25]) { prop('parapet', 63, y, 1); prop('parapet', 68, y, 1); }
  prop('wardrobe', 57, 22); prop('wardrobe', 59, 22); prop('wardrobe', 69, 22); prop('wardrobe', 71, 22);
  prop('table', 59, 29); prop('chair', 60, 28, 0); prop('chair', 62, 28, 0); prop('chair', 61, 30, 2); prop('chair', 63, 30, 2);
  prop('chest', 70, 32); prop('chest', 71, 30); prop('kneeler', 57, 33); prop('candelabrum', 70, 27);
  prop('organ', 60, 6); prop('bench', 62, 9, 0); prop('candelabrum', 58, 11); prop('candelabrum', 70, 11); prop('chandelier', 64, 15);
  prop('bookshelf', 57, 16, 3); prop('chest', 71, 18); prop('chair', 59, 18, 0);
  // the chapel of Saint Lucy: her altar against the north wall, kneelers, candles for the dead
  prop('sidealtar', 63, 36); prop('pedestal', 61, 36); prop('pedestal', 66, 36);
  for (const y of [40, 42, 44]) for (const x of [60, 62, 66, 68]) prop('kneeler', x, y, 2);
  prop('votives', 57, 38, 1); prop('votives', 57, 44, 1); prop('candelabrum', 71, 37); prop('chandelier', 64, 41);
  // the stores
  for (const x of [57, 60]) prop('bookshelf', x, 50);
  for (const [x, y] of [[57, 53], [58, 53], [57, 54], [57, 60], [58, 61], [71, 64], [70, 65]]) prop('barrel', x, y);
  for (const [x, y] of [[64, 51], [66, 51], [68, 51], [70, 51], [63, 64], [65, 65]]) prop('crate', x, y);
  for (const [x, y] of [[61, 64], [60, 65], [70, 55]]) prop('sacks', x, y);
  prop('table', 62, 57); prop('candelabrum', 71, 52);

  // ---------------------------------------------------------------- the courtyard
  prop('fountain', 85, 47);
  for (const [x, y] of [[78, 34], [93, 34], [78, 62], [93, 62], [81, 40], [90, 40], [81, 56], [90, 56]]) prop('cypress', x, y);
  for (const [x, y] of [[79, 38], [92, 38], [79, 58], [92, 58], [83, 44], [88, 44], [83, 52], [88, 52]]) prop('bush', x, y);
  for (const [x, y] of [[75, 36], [75, 60], [96, 36], [96, 60]]) prop('lamppost', x, y);
  prop('stonebench', 80, 47, 1); prop('stonebench', 90, 47, 3); prop('stonebench', 85, 44, 0); prop('stonebench', 85, 51, 2);

  // ---------------------------------------------------------------- the terrace and the street
  prop('pedestal', 40, 75); prop('pedestal', 49, 75);                  // saints either side of the doors
  for (const [x, y] of [[36, 77], [53, 77], [36, 86], [53, 86], [20, 77], [70, 77]]) prop('lamppost', x, y);
  for (const [x, y] of [[33, 76], [56, 76], [31, 87], [58, 87]]) prop('bannerpole', x, y);
  for (const [x, y] of [[20, 80], [28, 80], [20, 86], [28, 86], [62, 80], [70, 80], [62, 86], [70, 86]]) prop('bush', x, y);
  for (const [x, y] of [[24, 83], [66, 83]]) prop('cypress', x, y);
  for (const [x, y] of [[22, 83], [26, 83], [64, 83], [68, 83]]) prop('pedestal', x, y);
  for (let x = 18; x < 38; x++) prop('railing', x, 88); for (let x = 53; x < 73; x++) prop('railing', x, 88);
  for (let x = 30; x < 61; x++) prop('railing', x, 96);                // the gate to the city, shut for now
  for (const x of [32, 58]) prop('lamppost', x, 92);

  // ---------------------------------------------------------------- places, their names, how the camera sees them
  // r: [x0, y0, x1, y1] (cells, end exclusive); cam: { at: point the camera leans toward, w: how much (0..1),
  // axis: [x, w] hold it on a north–south line }. The first rectangle holding the priest wins: small places first.
  const zones = [];
  const zone = (name, x0, y0, x1, y1, cam) => zones.push({ name, r: [x0 + OX, y0 + OY, x1 + OX, y1 + OY], cam: cam && { ...cam, at: cam.at && [cam.at[0] + OX + .5, cam.at[1] + OY + .5], axis: cam.axis && [cam.axis[0] + OX + .5, cam.axis[1]] } });
  const framed = (name, x0, y0, x1, y1, w = .55) => zone(name, x0, y0, x1, y1, { at: [(x0 + x1) / 2 - .5, (y0 + y1) / 2 - .5], w });
  framed('Torre de las campanas', 25, 66, 33, 75); framed('Torre del reloj', 57, 66, 65, 75);
  framed('Nártex', 34, 67, 56, 75, .4);
  zone('Presbiterio', 34, 6, 56, 22, { at: [45, 9], w: .4 });
  zone('Nave central', 34, 22, 56, 67, { axis: [45, .7] });
  framed('Biblioteca', 14, 6, 33, 21, .45); framed('Sala de estudio', 14, 21, 33, 35, .45);
  framed('Coro alto del órgano', 57, 6, 73, 21, .45); framed('Sacristía', 57, 21, 73, 35, .45);
  framed('Capilla de Santa Lucía', 57, 36, 73, 49, .45); framed('Almacén', 57, 50, 73, 67, .45);
  zone('Patio de la fuente', 74, 30, 98, 67, { at: [86, 48], w: .3 });
  zone('Atrio', 18, 75, 73, 90, { at: [45, 79], w: .3 });
  framed('Calle de los Penitentes', 30, 90, 61, 97, .4);

  // ---------------------------------------------------------------- the faithful at the midnight vigil
  // Most seats of the pews taken: [x, y] in cells (the middle of the seat), n: which of the faithful (src/enemies.js).
  const congregation = [];
  { let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let y = 25; y <= 43; y += 3) for (const x0 of [37, 47]) for (let i = 0; i < 6; i++) {
      if (rnd() < .6) congregation.push({ x: x0 + i + .5 + OX, y: y + .42 + OY, n: rnd() * 4 | 0 });
    } }
  // Where the demon comes in and where he stands.
  const windowAt = [45 + OX, 5 + OY + 1], demonAt = [45 + OX, 16 + OY];

  // A little variety per floor cell: worn slabs, tombs set into the floor.
  for (let k = 0; k < W * H; k++) if (!block[k]) vari[k] = (Math.imul(k, 2654435761) >>> 27);
  return { congregation, windowAt, demonAt, name: NAME, W, H, OX, OY, floor, block, vari, pi, props, skipped, zones, doors, level,
    start: [(44.5 + OX + .5) * CELL, (8 + OY + .6) * CELL], startK: 2,      // behind the altar, facing the people
    crossing: [45 + OX, 44 + OY] };
}
