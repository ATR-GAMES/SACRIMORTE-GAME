// Sprite atlas: every baked frame is trimmed to the pixels it really uses and shelf-packed into shared pages, instead
// of keeping a full 144×136 cell (mostly empty) per frame. A frame can be repainted in place (the priest's blood) as
// long as its silhouette doesn't change, which holds: blood only changes colours, never the outline.
export class Sheet {
  constructor(page = 1024) { this.P = page; this.pages = []; this.frames = new Map(); this.cur = null; this.x = 0; this.y = 0; this.row = 0; }
  _page() {
    const c = document.createElement('canvas'); c.width = c.height = this.P;
    this.pages.push(c); this.cur = c; this.g = c.getContext('2d'); this.x = 0; this.y = 0; this.row = 0;
  }
  static bounds(s) {
    let x0 = s.w, y0 = s.h, x1 = -1, y1 = -1;
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.d[x + y * s.w]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
  }
  add(key, s) {
    const b = Sheet.bounds(s);
    if (!b) { this.frames.set(key, null); return; }
    const [bx, by, w, h] = b;
    if (!this.cur || this.x + w + 1 > this.P) { this.x = 0; this.y += this.row + 1; this.row = 0; }
    if (!this.cur || this.y + h + 1 > this.P) this._page();
    this.g.putImageData(new ImageData(new Uint8ClampedArray(s.d.buffer), s.w, s.h), this.x - bx, this.y - by, bx, by, w, h);
    this.frames.set(key, { c: this.cur, x: this.x, y: this.y, w, h, bx, by });
    this.x += w + 1; this.row = Math.max(this.row, h);
  }
  put(key, s) {
    const r = this.frames.get(key); if (!r) return;
    r.c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(s.d.buffer), s.w, s.h), r.x - r.bx, r.y - r.by, r.bx, r.by, r.w, r.h);
  }
  // (X, Y) is where the top-left of the full untrimmed sprite would go.
  draw(g, key, X, Y) { const r = this.frames.get(key); if (r) g.drawImage(r.c, r.x, r.y, r.w, r.h, X + r.bx, Y + r.by, r.w, r.h); }
  clone() {
    const o = new Sheet(this.P), map = new Map();
    for (const c of this.pages) { const n = document.createElement('canvas'); n.width = n.height = this.P; n.getContext('2d').drawImage(c, 0, 0); o.pages.push(n); map.set(c, n); }
    for (const [k, r] of this.frames) o.frames.set(k, r && { ...r, c: map.get(r.c) });
    return o;
  }
  get bytes() { return this.pages.length * this.P * this.P * 4; }
}
