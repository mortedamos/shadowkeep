// The woman who walks behind the Stranger.  She is a ghost: pale and see-through, her lower half fading into nothing, floating a step behind him and a little above the ground (she is never
// quite where she was a moment ago).  She is normally INVISIBLE.  She can only be seen in an arcane light - any BLUE light: a waystone's glow, a will-o'-the-wisp, spectral blue flames, the
// Ignis Fatuus lantern, the candle on her grave - and she is seen, briefly, whenever a gravestone speaks with her voice.  Her picture is the villager woman's, washed to moonlight and faded
// from the waist down (assets.js buildLady).
import { drawSheet } from './assets.js';
import { W, H } from './util.js';

const isBlue = c => !!c && c[2] >= 0.7 && c[2] > c[0] + 0.22;                    // a light's colour [r, g, b] (0..1): is it a cold, arcane one?

export class Ghost {
  constructor(g) { this.g = g; this.x = 0; this.y = 0; this.a = 0; this.t = 0; this.force = 0; this.snapped = false; }
  snap() { this.snapped = false; }                                            // (on entering a room: she is simply beside him again)
  reveal(frames = 240) { this.force = Math.max(this.force, frames); }          // a gravestone speaks: for a while she can be seen
  update() {
    const g = this.g, p = g.player; this.t++; if (this.force > 0) this.force--;
    const tx = p.x - p.dir * 22 + Math.sin(this.t * 0.031) * 5, ty = p.y - 5 + Math.sin(this.t * 0.047) * 3;
    if (!this.snapped || Math.hypot(this.x - tx, this.y - ty) > 160) { this.x = tx; this.y = ty; this.snapped = true; }
    this.x += (tx - this.x) * 0.045; this.y += (ty - this.y) * 0.06;
  }
  // how strongly the light round her is blue, this frame: every blue light adds in proportion to how near she is to its heart
  sense() {
    let v = 0; const fx = this.g.fx, cx = this.x, cy = this.y - 22;
    for (const l of fx.lights) { if (!isBlue(l[4])) continue; const d = Math.hypot(l[0] - cx, l[1] - cy); if (d < l[2]) v += l[3] * (1 - d / l[2]); }
    if (this.force > 0) v = Math.max(v, Math.min(1, this.force / 40) * 0.95);
    return Math.min(1, v);
  }
  draw(ctx, cx, cy) {
    const g = this.g, p = g.player; if (!g.room || !g.save || p.dead) return;
    const v = this.sense(); this.a += (v - this.a) * (v > this.a ? 0.07 : 0.045); if (this.a < 0.02) return;
    const x = this.x - cx, y = this.y - cy, flick = 0.9 + 0.1 * Math.sin(this.t * 0.21) + 0.05 * Math.sin(this.t * 0.53);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(x, y - 22, 2, x, y - 22, 34); gr.addColorStop(0, 'rgba(150,190,255,' + (0.20 * this.a).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(150,190,255,0)'); ctx.fillStyle = gr; ctx.fillRect(x - 34, y - 56, 68, 68);          // a faint halo
    ctx.restore();
    drawSheet(ctx, 'ghost_lady', Math.floor(this.t / 10) % 7, x, y, { dir: p.dir, alpha: this.a * 0.82 * flick });
  }
}
