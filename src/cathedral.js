// Level 1: the Cathedral of Our Lady of the Souls (Catedral de Nuestra Señora de las Ánimas).
// Laid out like a diorama, compact: the nave in the middle, full of pews, its red runner climbing to the altar on a
// dais under the great rose window. Round it, wall to wall: the library upstairs and the study below it to the west;
// the organ loft upstairs and the sacristy below it to the east; a chapel and the stores; the courtyard with its
// fountain; the narthex between two towers; and outside the main doors, the terrace, its gardens, and the steps down
// to the street.
// One cell is about a metre. x runs west → east, y north → south. Floors stand at levels (one step = STEP_PX on
// screen): the street at 0, the church and terrace at 2, the dais at 5, the library and organ loft upstairs at 8.
import { footprint } from './props.js?v=f76c404';

export const CELL = 20 * Math.SQRT2;            // world units per cell
export const NAME = 'Catedral de Nuestra Señora de las Ánimas';

// Floors. PLAZA, GRASS, GRAVEL and DIRT are out under the sky.
export const F = { VOID: 0, STONE: 1, AISLE: 2, CARPET: 3, MARBLE: 4, MOSAIC: 5, WOOD: 6, GRASS: 7, TILE: 8, DIRT: 9, CHAPEL: 10, STEP: 11, GRAVEL: 12, CHECKER: 13, PLAZA: 14 };
export const OUTDOOR = new Set([F.PLAZA, F.GRASS, F.GRAVEL, F.DIRT]);
// What stands on a cell. PROP cells point into `props` through `pi`. LOW: a low wall round open ground.
export const B = { NONE: 0, WALL: 1, DOOR: 2, ARCH: 3, GREAT: 4, COLUMN: 6, PROP: 7, LOW: 8 };

export function build() {
  const W = 116, H = 114, OX = 8, OY = 8;                // (room round the church: its grounds run five cells further every way)
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
  // the runner, from the altar down the nave (it stops at the great arch: none in the narthex or outside)
  rect(44, 12, 46, 67, k => { if (floor[k] || true) { floor[k] = F.CARPET; block[k] = 0; if (!level[k]) level[k] = 2; } });
  lvl(44, 12, 46, 16, 5); lvl(44, 16, 46, 17, 4); lvl(44, 17, 46, 18, 3); lvl(44, 18, 46, 67, 2);

  // ---------------------------------------------------------------- the grounds: lawns all round the church, a gravel walk
  // circling it from one end of the terrace to the other, past the graveyard on the west and the orchard on the east.
  // Every empty cell not right against a room is lawn, so the terrace, the courtyard and the grounds are one open place.
  { const indoorNear = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!inside(x + dx, y + dy)) continue; const f = floor[at(x + dx, y + dy)]; if (f && !OUTDOOR.has(f)) return true; } return false; };
    const lawn = []; for (let y = -7; y <= 88; y++) for (let x = -7; x <= 106; x++) if (inside(x, y) && !floor[at(x, y)] && !indoorNear(x, y)) lawn.push(at(x, y));
    for (const k of lawn) { floor[k] = F.GRASS; level[k] = 2; }
    const walk = (x0, y0, x1, y1, t = F.GRAVEL) => rect(x0, y0, x1, y1, k => { if (floor[k] === F.GRASS || floor[k] === F.GRAVEL) floor[k] = t; });
    // the ring walk, three cells wide, all round the church from one end of the terrace to the other
    walk(3, 0, 6, 84); walk(3, 0, 100, 3); walk(97, 0, 100, 84); walk(3, 81, 18, 84); walk(73, 81, 100, 84);
    // the graveyard's cross of paths and its round plaza, the way in from the walk
    walk(6, 49, 33, 52); walk(21, 37, 24, 65); walk(19, 47, 26, 54, F.PLAZA);
    // the orchard: a cross of paths round a fountain plaza, and on down into the courtyard
    walk(76, 3, 97, 30, F.GRASS); walk(85, 3, 88, 30); walk(76, 15, 97, 18); walk(82, 12, 91, 21, F.PLAZA);
    // south-east: a promenade of statues off the walk; south-west: a fountain plaza by the bell tower
    walk(74, 72, 97, 75, F.PLAZA); walk(6, 67, 17, 78, F.PLAZA); walk(6, 72, 18, 74);
  }

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
  // the stairs up to the library and the organ loft come out through the wall under an open arch (its top step the threshold)
  for (const x of [20, 64]) { doorway(x, 21, 'x', 4, 0); rect(x, 21, x + 4, 22, k => { floor[k] = F.STEP; level[k] = 7; }); }
  for (let x = 37; x < 53; x++) block[at(x, 5)] = B.GREAT;   // the great rose window behind the altar

  // ---------------------------------------------------------------- columns
  for (let y = 24; y <= 64; y += 6) { col(36, y, (y / 6) & 1 ? 2 : 0); col(53, y, (y / 6) & 1 ? 0 : 2); }   // the nave's piers, candles on some
  // engaged piers along the walls, some hung with a banner (never beside a doorway)
  const engaged = (x, y, n) => { if (!free(x, y)) return; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inside(x + dx, y + dy) && block[at(x + dx, y + dy)] === B.ARCH) return; col(x, y, n % 2 ? 4 : 3); };
  [8, 13, 20].forEach((y, n) => { engaged(34, y, n + 1); engaged(55, y, n); });
  [34, 40, 51, 55].forEach((x, n) => engaged(x, 73, n));
  [17, 23, 30].forEach((x, n) => engaged(x, 6, n));

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
  prop('desk', 15, 26); prop('chair', 16, 27, 2); prop('desk', 15, 31); prop('chair', 16, 32, 2);
  prop('bookshelf', 27, 22); prop('bookshelf', 30, 22); prop('chest', 31, 33); prop('chest', 29, 33); prop('candelabrum', 26, 29);
  prop('pedestal', 14, 22); prop('globe', 28, 29);
  for (const x of [15, 18]) prop('bookshelf', x, 6);
  for (const x of [25, 28, 31]) prop('bookshelf', x, 6);
  for (const y of [10, 14]) for (const x of [15, 18, 25, 28]) prop('bookshelf', x, y);
  prop('desk', 26, 18); prop('chair', 27, 17, 0); prop('desk', 15, 18); prop('chair', 16, 17, 0);
  prop('lectern', 22, 9); prop('candelabrum', 22, 13); prop('candelabrum', 31, 12); prop('chandelier', 22, 17); prop('rug', 20, 11);

  // ---------------------------------------------------------------- east: the sacristy, the organ loft upstairs, the chapel, the stores
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
  for (const [x, y] of [[79, 38], [92, 38], [79, 58], [92, 58], [83, 44], [88, 44], [83, 52], [88, 52]]) prop('bushm', x, y);
  for (const [x, y] of [[75, 36], [75, 60], [96, 36], [96, 60]]) prop('lamppost', x, y);
  prop('stonebench', 80, 47, 1); prop('stonebench', 90, 47, 3); prop('stonebench', 85, 44, 0); prop('stonebench', 85, 51, 2);

  // ---------------------------------------------------------------- the terrace and the street
  prop('pedestal', 40, 75); prop('pedestal', 49, 75);                  // saints either side of the doors
  for (const [x, y] of [[36, 77], [53, 77], [36, 86], [53, 86], [20, 77], [70, 77]]) prop('lamppost', x, y);
  for (const [x, y] of [[33, 76], [56, 76], [31, 87], [58, 87]]) prop('bannerpole', x, y);
  for (const [x, y] of [[20, 80], [28, 80], [20, 86], [28, 86], [62, 80], [70, 80], [62, 86], [70, 86]]) prop('bushm', x, y);
  for (const [x, y] of [[24, 83], [66, 83]]) prop('cypress', x, y);
  for (const [x, y] of [[22, 83], [26, 83], [64, 83], [68, 83]]) prop('pedestal', x, y);
  for (let x = 18; x < 38; x++) prop('railing', x, 88); for (let x = 53; x < 73; x++) prop('railing', x, 88);
  for (let x = 30; x < 61; x++) prop('railing', x, 96);                // the gate to the city, shut for now
  for (const x of [32, 58]) prop('lamppost', x, 92);

  // ---------------------------------------------------------------- the grounds
  // The ring walk: a lamp either side of it every eight cells, a broad tree between each pair on its outer side.
  for (let y = 6; y <= 78; y += 8) { prop('lamppost', 2, y); prop('lamppost', 6, y); }
  for (let y = 9; y <= 73; y += 8) prop('oak', -2, y);
  for (let x = 10; x <= 90; x += 8) { prop('lamppost', x, -1); prop('lamppost', x, 3); }
  for (let x = 13; x <= 85; x += 8) prop('oak', x, -2);
  for (let y = 6; y <= 78; y += 8) { prop('lamppost', 96, y); prop('lamppost', 100, y); }
  for (let y = 10; y <= 74; y += 8) prop('cypress', 101, y);
  for (const [x, y] of [[-2, -2], [100, -2], [-2, 85], [100, 85]]) prop('oak', x, y);   // the corners
  // flowers along the church's feet, a bush at every fourth
  for (let y = 7; y <= 34; y++) prop((y - 7) % 4 ? 'wildflowers' : 'bushm', 11, y);
  for (let x = 14; x <= 72; x++) prop((x - 14) % 4 ? 'wildflowers' : 'bushm', x, 4);
  // the graveyard: four even plots of tombs round a plaza with a saint at its middle, cypresses at the plots' corners
  for (const x0 of [13, 25]) for (const y0 of [38, 55]) for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) prop('tomb', x0 + c * 4, y0 + r * 3);
  prop('pedestal', 22, 50);
  for (const [x, y] of [[13, 37], [32, 37], [13, 64], [32, 64], [19, 46], [26, 46], [19, 54], [26, 54]]) prop('cypress', x, y);
  for (const [x, y] of [[20, 47], [25, 47], [20, 53], [25, 53]]) prop('lamppost', x, y);
  for (const [x, y, r] of [[21, 47, 0], [21, 53, 2]]) prop('stonebench', x + 1, y, r);
  for (let x = 8; x <= 18; x += 2) { prop('wildflowers', x, 48); prop('wildflowers', x, 53); }
  // the orchard: a fountain in its plaza, benches facing it, a lamp at each corner; broad trees in even rows in its four
  // quarters, beds of flowers along the paths
  prop('fountain', 85, 15);
  for (const [x, y, r] of [[85, 12, 0], [85, 20, 2]]) prop('stonebench', x, y, r);
  for (const [x, y, r] of [[82, 15, 1], [90, 15, 3]]) prop('stonebench', x, y, r);
  for (const [x, y] of [[82, 12], [90, 12], [82, 20], [90, 20]]) prop('lamppost', x, y);
  for (const x of [77, 80, 93]) for (const y of [5, 8, 22, 25]) prop('oak', x, y);
  for (const x of [76, 77, 78, 79, 80, 81, 92, 93, 94, 95, 96]) { prop('wildflowers', x, 14); prop('wildflowers', x, 18); }
  for (let y = 4; y <= 29; y++) if (y < 12 || y > 20) { prop('wildflowers', 84, y); prop('wildflowers', 88, y); }
  // south-east: a promenade of saints, a lamp between each, flowers before them, trees behind
  for (let x = 76; x <= 96; x += 4) { prop('pedestal', x, 71); prop('pedestal', x, 75); }
  for (let x = 78; x <= 94; x += 4) { prop('lamppost', x, 71); prop('lamppost', x, 75); }
  for (let x = 74; x <= 97; x++) prop('wildflowers', x, 70);
  for (let x = 76; x <= 92; x += 8) prop('oak', x, 77);
  // south-west: a fountain plaza by the bell tower, cypresses at its corners, lamps on its sides, flowers round it
  prop('fountain', 10, 71);
  for (const [x, y] of [[7, 68], [15, 68], [7, 76], [15, 76]]) prop('cypress', x, y);
  for (const [x, y] of [[11, 68], [11, 76]]) prop('lamppost', x, y);
  for (let x = 7; x <= 16; x++) { prop('wildflowers', x, 66); prop('wildflowers', x, 79); }

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
  zone('Jardines de la catedral', -8, -8, 108, 90);                    // everything else out under the sky

  // ---------------------------------------------------------------- the faithful at the midnight vigil
  // Most seats of the pews taken: [x, y] in cells (the middle of the seat), n: which of the faithful (src/enemies.js).
  const congregation = [];
  { let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let y = 25; y <= 43; y += 3) for (const x0 of [37, 47]) for (let i = 0; i < 6; i++) {
      if (congregation.length < 10 && rnd() < .6) congregation.push({ x: x0 + i + .5 + OX, y: y + .42 + OY, n: rnd() * 4 | 0 });
    } }
  // Where the demon comes in and where he stands.
  const windowAt = [45 + OX, 5 + OY + 1], demonAt = [45 + OX, 16 + OY];

  // ---------------------------------------------------------------- outside: for now nothing but grass
  // Every open-air cell (terrace, courtyard, street, grounds) is plain lawn at the church's level, with nothing on it.
  { const out = new Uint8Array(W * H);
    for (let k = 0; k < W * H; k++) if (OUTDOOR.has(floor[k])) { out[k] = 1; floor[k] = F.GRASS; level[k] = 2; }
    const gone = new Set(); for (let k = 0; k < W * H; k++) if (out[k] && block[k] === B.PROP) gone.add(pi[k]);
    const keep = [], map = new Map(); props.forEach((P, n) => { if (!gone.has(n)) { map.set(n, keep.length); keep.push(P); } });
    for (let k = 0; k < W * H; k++) if (block[k] === B.PROP) { if (gone.has(pi[k])) { block[k] = 0; pi[k] = -1; } else pi[k] = map.get(pi[k]); }
    props.length = 0; props.push(...keep); }
  // The gravel walks: one all round the church, three cells wide and four out from its walls, and from each door that
  // opens outside a walk straight out to it (the great doors to the south, the chapel's and the stores' to the east).
  { const walk = (x0, y0, x1, y1) => rect(x0, y0, x1, y1, k => { if (floor[k] === F.GRASS && !block[k]) floor[k] = F.GRAVEL; });
    walk(6, -2, 9, 83); walk(6, -2, 91, 1); walk(88, -2, 91, 83); walk(6, 80, 91, 83);   // the ring (the courtyard inside it)
    walk(43, 75, 47, 91);                                                                 // from the great doors on out to the street
    walk(74, 41, 88, 44); walk(74, 58, 88, 61);                                           // from the chapel and the stores
  }
  // The graveyard, west of the nave below the study: tombs in even rows.
  for (let y = 39; y <= 60; y += 3) for (let x = 11; x <= 27; x += 4) prop('tomb', x, y);
  // ---------------------------------------------------------------- the grounds laid out
  // (x, y in cells as the church is laid out; only open ground is touched, the church stays as it is)
  { const isGrass = (x, y) => inside(x, y) && floor[at(x, y)] === F.GRASS && !block[at(x, y)];
    const P = (k, x, y, rot = 0) => { if (isGrass(x, y)) prop(k, x, y, rot); };                     // on bare grass only
    const Q = (k, x, y, rot = 0) => prop(k, x, y, rot);                                               // anywhere free (on a walk too)
    const walk = (x0, y0, x1, y1) => rect(x0, y0, x1, y1, k => { if (floor[k] === F.GRASS && !block[k]) floor[k] = F.GRAVEL; });
    const turn = (ks, n) => ks[((n % ks.length) + ks.length) % ks.length];
    let sd = 29; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;

    // ---- the secondary walks and the squares
    walk(76, 46, 86, 48); walk(76, 54, 86, 56); walk(76, 46, 78, 56); walk(84, 46, 86, 56);         // a cloister walk round the east garden
    walk(80, 44, 82, 46); walk(80, 56, 82, 58);                                                     // joined to the chapel's and the stores' walks
    walk(9, 49, 32, 51);                                                                             // the graveyard's middle aisle
    walk(40, 1, 50, 4);                                                                              // a square behind the apse
    walk(12, 68, 21, 74); walk(9, 70, 12, 72);                                                       // the bell tower's garden square, and its way in
    walk(75, 67, 85, 75); walk(80, 61, 82, 67);                                                      // a square of the saints south of the stores
    walk(43, 84, 47, 89);                                                                            // (the way out to the street, cobbled through)

    // ---- the fountains, the saints, the crosses, the benches
    Q('fountain', 80, 50); Q('fountain', 15, 70);
    for (const [x, y] of [[78, 48], [83, 48], [78, 53], [83, 53]]) Q('pedestal', x, y);                  // round the east fountain
    for (const [x, y] of [[77, 68], [83, 68], [77, 74], [83, 74], [80, 71]]) Q('pedestal', x, y);          // the square of the saints
    Q('pedestal', 45, 2); Q('stonebench', 41, 3, 0); Q('stonebench', 48, 3, 0);                           // behind the apse
    for (const y of [78, 88]) { Q('pedestal', 41, y); Q('pedestal', 48, y); }                             // the great doors' walk
    for (const [x, y] of [[10, 2], [86, 2], [10, 78], [86, 78]]) Q('pedestal', x, y);                     // the inner corners of the ring
    for (const y of [8, 16, 24, 32]) Q('pedestal', 81, y);                                               // down the east lawn
    for (const y of [40, 46, 54, 60]) Q('stonecross', 31, y);                                            // the graveyard's crosses
    for (const x of [13, 17, 21, 25, 29]) Q('stonecross', x, 37);
    Q('stonebench', 13, 73, 0); Q('stonebench', 19, 73, 0); Q('stonebench', 79, 75, 0);
    Q('bannerpole', 39, 77); Q('bannerpole', 50, 77); Q('bannerpole', 40, 87); Q('bannerpole', 49, 87);

    // ---- light: a lamp either side of the ring walk every ten cells, at its corners, by every square and door walk
    { const L = (x, y) => Q('lamppost', x, y);
      for (let y = 5; y <= 75; y += 10) { L(5, y); L(9, y); L(87, y); L(91, y); }
      for (let x = 15; x <= 85; x += 10) { L(x, -3); L(x, 1); if (x < 40 || x > 50) { L(x, 79); L(x, 83); } }
      for (const [x, y] of [[5, -3], [91, -3], [5, 83], [91, 83]]) L(x, y);
      for (const y of [77, 86]) { L(42, y); L(47, y); }
      for (const x of [79, 84]) { L(x, 40); L(x, 44); L(x, 57); L(x, 61); }
      for (const [x, y] of [[75, 45], [87, 45], [75, 57], [87, 57], [11, 67], [22, 67], [11, 75], [22, 75], [74, 66], [86, 66], [74, 76], [86, 76], [39, 0], [51, 0], [10, 37], [10, 62]]) L(x, y);
    }

    // ---- borders: roses and flower beds along the inside of every walk, a clipped hedge along the outside of the ring
    const nextToWalk = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => inside(x + a, y + b) && floor[at(x + a, y + b)] === F.GRAVEL);
    const inRing = (x, y) => x > 8 && x < 88 && y > 0 && y < 80;
    for (let y = -7; y <= 89; y++) for (let x = -7; x <= 107; x++) { if (!isGrass(x, y) || !nextToWalk(x, y)) continue;
      if (inRing(x, y)) { if ((x + y) % 3) P((x * 7 + y) % 5 < 2 ? 'roses' : 'flowerbed', x, y); }
      else if ((x + y + 200) % 14 > 1) P('hedge', x, y); }                                       // (a gap now and then, into the wood)

    // ---- the east lawn: an orchard of broad trees and cypresses north of the garden, bushes between
    [3, 10, 17, 24, 31].forEach((y, n) => { P(turn(['oak', 'irregular', 'lowbranch'], n), 77, y); P(turn(['cypress', 'oak', 'cypress'], n), 85, y); });
    [64, 71, 78].forEach((y, n) => { P(turn(['oak', 'cypress'], n), 76, y - 1); });
    for (let y = 4; y <= 36; y += 4) { P('bushm', 79, y); P('bushl', 83, y + 2); }
    for (const [x, y] of [[79, 49], [82, 49], [79, 52], [82, 52]]) P('flowerbed', x, y);

    // ---- the narrow beds along the church's feet (west, north, south): cypresses, roses, flowers
    for (let y = 6; y <= 34; y += 7) P('cypress', 10, y);
    for (let x = 16; x <= 72; x += 8) if (x < 38 || x > 52) P('cypress', x, 2);
    for (const x of [12, 20, 28, 36, 54, 62, 70, 76]) P(turn(['cypress', 'oak'], x), x, 78);
    for (let y = 7; y <= 35; y++) P(y % 3 ? 'flowerbed' : 'roses', 11, y);
    for (let x = 14; x <= 72; x++) if (x < 39 || x > 51) P(x % 3 ? 'flowerbed' : 'roses', x, 3);
    for (let x = 9; x <= 87; x++) if (x < 39 || x > 51) P(x % 4 ? 'flowerbed' : 'bushs', x, 77);

    // ---- the graveyard: cypresses along its open side, an ancient tree and a dead one, rocks and scrub among the stones
    for (let x = 12; x <= 30; x += 3) P('cypress', x, 63);
    P('ancient', 30, 38); P('dead', 10, 58);
    for (let n = 0; n < 14; n++) P(turn(['scrub', 'mossrock', 'wildplant'], n), 9 + (rnd() * 23 | 0), 38 + (rnd() * 24 | 0));

    // ---- the bell tower's garden: a grove round its square
    for (const [k, x, y] of [['ancient', 10, 65], ['twisted', 22, 65], ['oak', 10, 77], ['lowbranch', 23, 76], ['dead', 17, 66]]) P(k, x, y);

    // ---- the wood round the grounds, between the ring and the boundary wall: trees thick on a loose grid, the biggest
    // at the corners, an understorey beneath
    const WOOD = ['oak', 'pine', 'bigoak', 'irregular', 'pinesm', 'ancient', 'oak', 'pine', 'lowbranch', 'oak', 'cypress', 'twisted'];
    const inWood = (x, y) => x < 4 || x > 92 || y < -2 || y > 84;
    for (const [x, y] of [[-5, -5], [104, -5], [-5, 86], [104, 86]]) P('bigoak', x, y);
    for (let y = -6; y <= 88; y += 4) for (let x = -6; x <= 106; x += 4) { const gx = x + (rnd() * 3 | 0), gy = y + (rnd() * 3 | 0);
      if (!inWood(gx, gy) || (gx > 36 && gx < 54 && gy > 84)) continue; P(WOOD[(rnd() * WOOD.length) | 0], gx, gy); }
    const UNDER = ['bushs', 'bushm', 'bushl', 'scrub', 'wildplant', 'wildflowers', 'ornamental', 'mossrock', 'roses', 'scrub', 'bushm', 'wildflowers'];
    for (let y = -7; y <= 89; y++) for (let x = -7; x <= 107; x++) if (inWood(x, y) && rnd() < .34) P(UNDER[(rnd() * UNDER.length) | 0], x, y);

    // ---- and scattered over the open lawns, now and then, a wild flower or a tuft of scrub
    for (let y = -7; y <= 89; y++) for (let x = -7; x <= 107; x++) if (!inWood(x, y) && rnd() < .04) P(rnd() < .6 ? 'wildflowers' : 'wildplant', x, y);
  }
  // Tufts of tall grass over the lawns (moved by the wind, src/world.js): one in each three-by-three square, somewhere in it.
  const grass = [];
  { let sd = 11; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let y = -7; y <= 88; y += 3) for (let x = -7; x <= 106; x += 3) { const gx = x + rnd() * 3, gy = y + rnd() * 3, v = rnd() * 3 | 0;
      const cx = Math.floor(gx), cy = Math.floor(gy); if (inside(cx, cy) && floor[at(cx, cy)] === F.GRASS && !block[at(cx, cy)]) grass.push([gx + OX, gy + OY, v]); } }
  // A little variety per floor cell: worn slabs, tombs set into the floor.
  for (let k = 0; k < W * H; k++) if (!block[k]) vari[k] = (Math.imul(k, 2654435761) >>> 27);
  return { grass, congregation, windowAt, demonAt, name: NAME, W, H, OX, OY, floor, block, vari, pi, props, skipped, zones, doors, level,
    start: [(44.5 + OX + .5) * CELL, (8 + OY + .6) * CELL], startK: 2,      // behind the altar, facing the people
    crossing: [45 + OX, 44 + OY] };
}
