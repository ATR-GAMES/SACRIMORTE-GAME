// The camera's angle, in one place. Everything that draws (figures, floor, walls, furniture, light, blood) projects
// through this, so changing it changes the whole view.
// A cell (CELL world units square) is a diamond 2·DX wide and 2·GY tall on screen. GY = 10 was the classic 2:1
// isometric; a larger GY looks down from higher up, the way Diablo does.
export const DX = 20, GY = 15, DH = GY * 2;
export const K = GY / DX;                          // how much of the ground's depth shows: the sine of the camera's height
export const V = Math.sqrt(1 - K * K);             // how much of an upright height shows: its cosine
// Heights written in pixels for the old 2:1 camera (furniture, walls) are scaled by this.
export const ZS = V / Math.cos(Math.PI / 6);
const S2 = Math.SQRT1_2;
export const toScreen = (x, y, z = 0) => [(x - y) * S2, (x + y) * S2 * K - z * V];

// Inside, there is no ceiling to see: whatever rises fades into the dark above (the vault is lost in the night), the
// way Diablo shows its interiors. Pixels between VAULT[0] and VAULT[1] above the floor sink toward black; things that
// give their own light (glass, flames) don't.
export const VAULT = [52, 96], DARK = [11, 9, 10];
// A step up is this many pixels on screen (the altar's dais rises three of them).
export const STEP_PX = 6;
export function fadeUp(col, z) {
  if (z <= VAULT[0]) return col;
  const t = Math.min(1, (z - VAULT[0]) / (VAULT[1] - VAULT[0])), e = t * t * (3 - 2 * t);
  return [col[0] + (DARK[0] - col[0]) * e, col[1] + (DARK[1] - col[1]) * e, col[2] + (DARK[2] - col[2]) * e];
}
// Inside a room, a pier or a chain doesn't turn black as it rises (the floor further back would show it as a black
// shape): it thins into the air instead. The opacity left at height z.
export function thinUp(z) {
  if (z <= VAULT[0]) return 1;
  const t = Math.min(1, (z - VAULT[0]) / (VAULT[1] - VAULT[0])); return 1 - t * t * (3 - 2 * t);
}
