// The stranger's white cloak.  The hero sprite is treated as a FLAT object (a paper doll) and the cloak as a sheet of cloth hung from the two ends of its
// shoulder line - the back and the front of the shoulders - that then falls backwards and down BEHIND the figure, so it drapes around the hero:
// it shows behind the back, flares out below the waist, and peeks past the front of the legs.  Because it hangs behind the sprite it is drawn into the
// 2D scene just before the hero (the sprite's own baked cape is removed in assets.js).
//
// The cloth is a small grid of Verlet points (NC across, NR down).  The top row is pinned to the shoulder line every frame; every other point is
// pulled toward where the cloth wants to hang (straight down, flaring wider toward the hem, streaming backwards when the hero runs, lifting when
// he falls), kept at its link lengths, and stopped by the floor.  It streams out when you run, lifts when you fall, bunches when you duck and
// swings round behind the body when you turn.  Stains (soot, mud, blood: see stain.js) gather toward the hem in patches.
// Toggle it in Options > White Cloak (or add ?cloak=0 to the URL to start with it off).

const NR = 10, NC = 4, LINK = 2.7;                 // rows down (about 24px of cloth), points across
const clamp01 = v => Math.max(0, Math.min(1, v));
const h21 = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const vn = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), m = (a, b, t) => a + (b - a) * t;
  return m(m(h21(ix, iy), h21(ix + 1, iy), u), m(h21(ix, iy + 1), h21(ix + 1, iy + 1), u), v); };

export class Cloak {
  constructor() {
    const n = NR * NC;
    this.x = new Float32Array(n); this.y = new Float32Array(n); this.px = new Float32Array(n); this.py = new Float32Array(n);
    this.tx = new Float32Array(n); this.ty = new Float32Array(n);                      // where each point wants to hang this frame
    this.t = 0; this.ready = false; this.visible = false; this.dir = 1; this.pb = 0; this.pf = 0; this.sil = null; this.st = { soot: 0, mud: 0, blood: 0 };
  }
  setStain(st) { this.st = st; }
  setVisible(v) { this.visible = !!v; }
  // the lowest row of the cloth (where it drips)
  hem() { const i = (NR - 1) * NC + Math.floor(NC / 2); return { x: this.x[i], y: this.y[i] }; }

  // where the two pins are: the back and the front of the shoulder line, tucked just inside the sprite's outline so the cloth starts out of sight behind it
  pins(o) {
    const sh = o.sil && o.sil(o.ay), d = o.dir;
    return { b: (sh ? sh.back : o.x - d * 5) + d * 1.4, f: (sh ? sh.front : o.x + d * 5) - d * 3 };
  }
  // the rest shape: each column hangs from its pin as a chain of links that swings back from the vertical - hardly at all when he stands still, nearly flat out when he sprints,
  // and the whole sheet widens toward the hem so it flares past both shoulders.  (Swinging whole links keeps the cloth's length, so it never bunches up.)
  targets(o, sp, fall, rise) {
    const d = o.dir, w = this.pf - this.pb;
    for (let c = 0; c < NC; c++) {
      const u = c / (NC - 1); let x = this.pb + w * u, y = o.ay;
      for (let r = 0; r < NR; r++) {
        const s = r / (NR - 1), i = r * NC + c;
        if (r) {
          const a = Math.max(0, Math.min(1.75, (0.1 + 1.2 * sp + 0.9 * fall - 0.3 * rise) * (0.3 + 0.7 * s) * (1.15 - 0.3 * u) + 0.05 * (1 - u)));      // how far this link swings back; the back edge swings furthest
          x -= d * Math.sin(a) * LINK; y += Math.cos(a) * LINK;
        }
        this.tx[i] = x + w * (u - 0.5) * 0.65 * s; this.ty[i] = y;
      }
    }
  }
  // lay the cloak flat down the hero's back (used on spawn / teleport so there is no streak)
  reset(o) {
    this.dir = o.dir; this.sil = o.sil || null; const p = this.pins(o); this.pb = p.b; this.pf = p.f;
    this.targets(o, 0, 0, 0);
    for (let i = 0; i < NR * NC; i++) { this.x[i] = this.px[i] = this.tx[i]; this.y[i] = this.py[i] = this.ty[i]; }
    this.ready = true;
  }
  // o: { x, ay (shoulder row), dir, vx, vy, floorY, sil }   - sil(row) -> {back, front} | null: the sprite's body outline this frame
  step(o) {
    this.sil = o.sil; this.dir = o.dir; if (!this.ready) this.reset(o);
    this.t++;
    const sp = Math.min(1, Math.abs(o.vx) / 1.6), fall = clamp01(o.vy / 5), rise = clamp01(-o.vy / 4), p = this.pins(o);
    this.pb += (p.b - this.pb) * 0.6; this.pf += (p.f - this.pf) * 0.6;                    // smoothed, so the run-cycle bob doesn't jitter the pins
    this.targets(o, sp, fall, rise);
    for (let c = 0; c < NC; c++) { const i = c, u = c / (NC - 1); this.x[i] = this.px[i] = this.pb + (this.pf - this.pb) * u; this.y[i] = this.py[i] = o.ay; }     // row 0: pinned at the shoulders
    for (let r = 1; r < NR; r++) {
      const s = r / (NR - 1), k = 0.11 * (1 - 0.35 * s);
      for (let c = 0; c < NC; c++) {
        const i = r * NC + c;
        let vx = (this.x[i] - this.px[i]) * 0.9, vy = (this.y[i] - this.py[i]) * 0.9; this.px[i] = this.x[i]; this.py[i] = this.y[i];
        vx += (this.tx[i] - this.x[i]) * k; vy += (this.ty[i] - this.y[i]) * k * 0.7 + 0.075;                                        // spring toward the rest shape + a little gravity
        vy += Math.sin(this.t * 0.33 + r * 0.95 + c * 1.3) * 0.05 * s * (0.3 + sp + 0.6 * fall);                                      // flutter that grows with speed
        vx += Math.sin(this.t * 0.21 + r * 0.7 + c * 1.9) * 0.04 * s * (0.15 + sp);
        this.x[i] += vx; this.y[i] += vy;
      }
    }
    for (let pass = 0; pass < 3; pass++) for (let r = 1; r < NR; r++) {
      for (let c = 0; c < NC; c++) {
        const i = r * NC + c, a = i - NC;                                                                                             // keep the link to the point above its length
        let dx = this.x[i] - this.x[a], dy = this.y[i] - this.y[a], d = Math.hypot(dx, dy) || 1;
        this.x[i] = this.x[a] + dx / d * LINK; this.y[i] = this.y[a] + dy / d * LINK;
        if (o.floorY !== undefined && this.y[i] > o.floorY - 0.5) this.y[i] = o.floorY - 0.5;                                        // don't sink through the floor
        if (c) {                                                                                                                      // and keep the sheet from tearing sideways
          const j = i - 1, rest = Math.abs(this.tx[i] - this.tx[j]) + 0.4; dx = this.x[i] - this.x[j]; dy = this.y[i] - this.y[j]; d = Math.hypot(dx, dy) || 1;
          const diff = (d - rest) / d * 0.5; if (Math.abs(d - rest) > 0.01) { this.x[i] -= dx * diff * 0.6; this.y[i] -= dy * diff * 0.6; this.x[j] += dx * diff * 0.6 * (r > 0 ? 1 : 0); this.y[j] += dy * diff * 0.6; }
        }
      }
    }
    for (let c = 0; c < NC; c++) { this.x[c] = this.pb + (this.pf - this.pb) * (c / (NC - 1)); this.y[c] = o.ay; }                       // the pins don't move
  }
  // paint the cloth (call just before drawing the hero: it hangs behind him)
  draw(g, cx, cy, alpha = 1) {
    if (!this.visible || !this.ready) return;
    const st = this.st, P = (r, c) => [this.x[r * NC + c] - cx, this.y[r * NC + c] - cy];
    g.save(); g.globalAlpha *= alpha; g.lineJoin = 'round'; g.lineWidth = 0.7;
    for (let r = 0; r < NR - 1; r++) for (let c = 0; c < NC - 1; c++) {
      const a = P(r, c), b = P(r, c + 1), d = P(r + 1, c + 1), e = P(r + 1, c), s = (r + 0.5) / (NR - 1), u = (c + 0.5) / (NC - 1);
      // folds catch the light where the sheet bends
      const i0 = r * NC + c, up = r ? i0 - NC : i0, dn = (r + 2 < NR) ? i0 + 2 * NC : i0 + NC;
      const px = this.x[i0] - this.x[up], py = this.y[i0] - this.y[up], qx = this.x[dn] - this.x[i0 + NC], qy = this.y[dn] - this.y[i0 + NC];
      const bend = Math.abs((px * qy - py * qx) / ((Math.hypot(px, py) * Math.hypot(qx, qy)) || 1)), shade = (0.82 + 0.20 * clamp01(0.5 + bend * 4.5)) * (1 - 0.18 * s) * (0.9 + 0.1 * Math.sin(this.t * 0.04 + r + c * 2));
      let R = 247 * shade, G = 247 * shade, B = 255 * shade;
      const rim = (1 - u) * (1 - u) * 0.5 + u * u * 0.18; R += (153 - R) * rim; G += (163 - G) * rim; B += (209 - B) * rim;           // cool, shadowed edges so the white reads against pale backgrounds
      const hem = 0.3 + 0.7 * clamp01((s - 0.05) / 0.9), n = 0.55 + 0.9 * vn(c * 1.7 + 0.3, r * 0.8 + 0.1);                       // stains gather toward the hem, in patches
      const mix = (cr, cg, cb, amt, cap) => { const m = Math.min(cap, amt * hem * n); R += (cr - R) * m; G += (cg - G) * m; B += (cb - B) * m; };
      if (st.soot > 0) mix(38, 32, 32, st.soot, 0.8); if (st.mud > 0) mix(110, 77, 43, st.mud * 0.95, 0.72); if (st.blood > 0) mix(163, 13, 20, st.blood, 0.78);
      const col = 'rgb(' + Math.round(R) + ',' + Math.round(G) + ',' + Math.round(B) + ')';
      g.fillStyle = g.strokeStyle = col; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(d[0], d[1]); g.lineTo(e[0], e[1]); g.closePath(); g.fill(); g.stroke();
    }
    g.strokeStyle = 'rgba(34,30,56,0.6)'; g.lineWidth = 0.9; g.beginPath();                                                           // a faint dark edge round the whole sheet
    for (let r = 0; r < NR; r++) { const p = P(r, 0); r ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }
    for (let c = 1; c < NC; c++) { const p = P(NR - 1, c); g.lineTo(p[0], p[1]); }
    for (let r = NR - 2; r >= 0; r--) { const p = P(r, NC - 1); g.lineTo(p[0], p[1]); }
    g.stroke(); g.restore();
  }
}
