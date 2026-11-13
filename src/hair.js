// The stranger's HOOD (the file keeps its old name: it began as his hair).  It is not in his sprite: buildHair (assets.js) takes the baked quiff out of every frame and paints a new style on a sheet of its own - hair that sweeps over the
// forehead and FALLS around his face: behind the head and past the shoulder blades, and in a lock beside the cheek.  This file draws that picture as a small TEXTURED MESH simulated like
// the cloak's cloth: the rows of points at the crown are pinned to the head (so the hair always sits on his head), the rows below are springs that want to hang where the picture has them,
// so at rest it looks exactly like the painted hair - and it lags when he sets off, streams back when he runs, is lifted by the air when he falls, is pressed down when he rises, and sways
// when he stands.  Same colours, same pixels: only the shape moves.
// Toggle it in Options > 3D Hair (or ?hair=0 in the URL): off draws the hair as a still picture.

export const HAIR_NC = 4, HAIR_NR = 7;             // points across x down the hair's picture
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Hair {
  constructor() {
    const n = HAIR_NC * HAIR_NR;
    this.x = new Float32Array(n); this.y = new Float32Array(n); this.px = new Float32Array(n); this.py = new Float32Array(n);
    this.rx = new Float32Array(n); this.ry = new Float32Array(n);          // where each point would be if the hair were stiff (this frame)
    this.ready = false; this.box = null; this.t = 0; this.lift = 0;
  }
  reset() { this.ready = false; }
  // o: { box: {bx, by, bw, bh} | null (the hair's picture in the sheet this frame), rest(sx, sy) -> [worldX, worldY], vx, vy, dir }
  step(o) {
    this.t++; this.box = o.box || null; if (!this.box) return;
    const { bx, by, bw, bh } = this.box, NC = HAIR_NC, NR = HAIR_NR;
    this.lift += ((o.vy > 1.4 ? Math.min(1, (o.vy - 1.4) / 2) : 0) - this.lift) * 0.2;          // falling: the brim of the hood lifts off his eyes
    for (let j = 0; j < NR; j++) for (let i = 0; i < NC; i++) {
      const k = j * NC + i, r = o.rest(bx + bw * i / (NC - 1), by + bh * j / (NR - 1)); this.rx[k] = r[0]; this.ry[k] = r[1];
      if ((j === 2 || j === 3) && i >= NC - 2) this.ry[k] -= 3.2 * this.lift * (j === 2 ? 1 : 0.9);          // (the brim over the eyes - the front of the second and third rows - rides up)
    }
    let far = 0; if (this.ready) for (let k = 0; k < NC * NR; k++) far = Math.max(far, Math.abs(this.x[k] - this.rx[k]), Math.abs(this.y[k] - this.ry[k]));
    if (!this.ready || far > 40) { for (let k = 0; k < NC * NR; k++) { this.x[k] = this.px[k] = this.rx[k]; this.y[k] = this.py[k] = this.ry[k]; } this.ready = true; return; }          // (first frame / a teleport: no streak)
    const sp = Math.min(1, Math.abs(o.vx) / 1.6), t = this.t;
    for (let j = 0; j < NR; j++) {
      const free = clamp((j - 1) / (NR - 2), 0, 1);                                // 0 across the crown (rows 0 and 1), 1 at the tips
      for (let i = 0; i < NC; i++) {
        const k = j * NC + i;
        if (j <= 1) { this.x[k] = this.px[k] = this.rx[k]; this.y[k] = this.py[k] = this.ry[k]; continue; }          // the crown moves with the head
        let vx = (this.x[k] - this.px[k]) * (0.76 - 0.04 * free), vy = (this.y[k] - this.py[k]) * (0.76 - 0.04 * free); this.px[k] = this.x[k]; this.py[k] = this.y[k];
        const st = 0.07 + 0.25 * (1 - free) * (1 - free);                          // stiffer toward the crown
        vx += (this.rx[k] - this.x[k]) * st; vy += (this.ry[k] - this.y[k]) * st;
        vy += 0.014 * free;                                                         // (the picture already hangs: just a touch of weight)
        vx -= o.vx * 0.05 * free;                                                    // the air: against the direction he runs, so it streams back
        vy -= o.vy * 0.012 * free;                                                   // falling lifts it, rising presses it down
        vx += Math.sin(t * 0.33 + i * 1.7 + j * 0.9) * 0.016 * free * (0.2 + sp * 1.0);                       // flutter, stronger the faster he goes
        vy += Math.cos(t * 0.27 + i * 2.1 + j * 0.7) * 0.012 * free * (0.15 + sp + Math.abs(o.vy) * 0.15);
        vx += Math.sin(t * 0.045 + i * 0.8 + j * 0.4) * 0.006 * free;               // and a slow sway at rest
        this.x[k] += vx; this.y[k] += vy;
        const dx = this.x[k] - this.rx[k], dy = this.y[k] - this.ry[k], d = Math.hypot(dx, dy), md = 0.6 + 3 * free;          // it never strays far from the head
        if (d > md) { this.x[k] = this.rx[k] + dx / d * md; this.y[k] = this.ry[k] + dy / d * md; }
      }
    }
  }
  // paint the hair: tex = the hair-only picture (sheet image), (tx, ty) = the frame's origin in it.  Each little square of the mesh is two triangles, each drawn with the
  // matching triangle of the picture (an affine map) - so the pixel art itself bends.
  draw(g, cx, cy, tex, tx, ty, alpha = 1) {
    if (!this.box || !this.ready || !tex) return;
    const { bx, by, bw, bh } = this.box, NC = HAIR_NC, NR = HAIR_NR;
    g.save(); if (alpha !== 1) g.globalAlpha *= alpha; g.imageSmoothingEnabled = false;
    const P = (i, j) => { const k = j * NC + i; return [this.x[k] - cx, this.y[k] - cy]; };
    const tri = (s0, s1, s2, d0, d1, d2) => {
      const det = (s1[0] - s0[0]) * (s2[1] - s0[1]) - (s2[0] - s0[0]) * (s1[1] - s0[1]); if (Math.abs(det) < 1e-6) return;
      const a = ((d1[0] - d0[0]) * (s2[1] - s0[1]) - (d2[0] - d0[0]) * (s1[1] - s0[1])) / det, c = ((d2[0] - d0[0]) * (s1[0] - s0[0]) - (d1[0] - d0[0]) * (s2[0] - s0[0])) / det;
      const b = ((d1[1] - d0[1]) * (s2[1] - s0[1]) - (d2[1] - d0[1]) * (s1[1] - s0[1])) / det, d = ((d2[1] - d0[1]) * (s1[0] - s0[0]) - (d1[1] - d0[1]) * (s2[0] - s0[0])) / det;
      const e = d0[0] - a * s0[0] - c * s0[1], f = d0[1] - b * s0[0] - d * s0[1];
      const mx = (d0[0] + d1[0] + d2[0]) / 3, my = (d0[1] + d1[1] + d2[1]) / 3, grow = p => { const dx = p[0] - mx, dy = p[1] - my, l = Math.hypot(dx, dy) || 1; return [p[0] + dx / l * 0.55, p[1] + dy / l * 0.55]; };      // (a hair's breadth bigger: no seams)
      const q0 = grow(d0), q1 = grow(d1), q2 = grow(d2);
      g.save(); g.beginPath(); g.moveTo(q0[0], q0[1]); g.lineTo(q1[0], q1[1]); g.lineTo(q2[0], q2[1]); g.closePath(); g.clip();
      g.transform(a, b, c, d, e, f); g.drawImage(tex, tx + bx, ty + by, bw, bh, 0, 0, bw, bh); g.restore();
    };
    for (let j = 0; j < NR - 1; j++) for (let i = 0; i < NC - 1; i++) {
      const u0 = bw * i / (NC - 1), u1 = bw * (i + 1) / (NC - 1), v0 = bh * j / (NR - 1), v1 = bh * (j + 1) / (NR - 1);
      const A = P(i, j), B = P(i + 1, j), C = P(i + 1, j + 1), D = P(i, j + 1);
      tri([u0, v0], [u1, v0], [u0, v1], A, B, D); tri([u1, v0], [u1, v1], [u0, v1], B, C, D);
    }
    g.restore();
  }
}
