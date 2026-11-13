// The great gears of the Clockwork Dungeon's gear room.  Each wheel turns steadily, and each of its TEETH is a small moving one-way platform: the teeth on the upper side can be stood
// on (the ones underneath are inside the wheel's shadow and are not), and whoever stands on one is carried along with it - up, over and down the far side.  Hop from tooth to tooth,
// and from wheel to wheel, to cross the pit.   (Player.update calls land() after its normal movement, and carries a rider with the tooth before it moves.)
import { gearSprite } from './world.js';

const TAU = Math.PI * 2, TOOTH_W = 13;

export class Gears {
  // defs: [{ cx, cy, R, n, spin, a0, style }] - centre and tip radius in pixels, tooth count, radians turned per frame (negative = anticlockwise), starting angle
  constructor(defs) {
    this.defs = defs; this.t = 0; this.teeth = [];
    defs.forEach((d, gi) => { for (let k = 0; k < d.n; k++) this.teeth.push({ d, gi, k, x: 0, y: 0, dx: 0, dy: 0, active: false, w: TOOTH_W }); });
    this.step(true);
  }
  angle(d) { return (d.a0 || 0) + d.spin * this.t; }
  step(init) {
    if (!init) this.t++;
    for (const m of this.teeth) {
      const d = m.d, a = this.angle(d) + m.k * TAU / d.n, px = d.cx + Math.cos(a) * d.R, py = d.cy + Math.sin(a) * d.R;
      m.dx = init ? 0 : px - m.x; m.dy = init ? 0 : py - m.y; m.x = px; m.y = py;
      m.active = Math.sin(a) < -0.2;                                        // only the upper teeth can be stood on
    }
  }
  // a falling (or standing) hero touches the top of a tooth: stand on it, and ride it
  land(p) {
    if (p.dropThrough > 0 || p.dead) { p.ride = null; return; }
    let best = null;
    if (p.vy >= 0) for (const m of this.teeth) {
      if (!m.active || Math.abs(p.x - m.x) > m.w / 2 + 3) continue;
      const top = m.y, prevFeet = p.y - p.vy, prevTop = top - m.dy;
      if (p.y >= top - 1 && p.y <= top + Math.max(6, p.vy + 2 + Math.abs(m.dy)) && prevFeet <= prevTop + 3 && (!best || m.y < best.y)) best = m;
    }
    if (best) { p.y = best.y; p.vy = 0; p.onGround = true; p.ride = best; } else p.ride = null;
  }
  draw(ctx, cx, cy) {
    for (const d of this.defs) {
      const s = gearSprite(d.R, d.n, d.style || 0); if (d.cx + d.R < cx - 4 || d.cx - d.R > cx + 388 || d.cy + d.R < cy - 4 || d.cy - d.R > cy + 220) continue;
      ctx.save(); ctx.translate(Math.round(d.cx - cx), Math.round(d.cy - cy)); ctx.rotate(this.angle(d)); ctx.drawImage(s, -s.width / 2, -s.height / 2); ctx.restore();
    }
  }
}
