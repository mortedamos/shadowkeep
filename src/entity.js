// Base entity: feet-centered position (x,y), hitbox w x h, tile collision helpers.
import { T, overlap } from './util.js';
import { TILE, isSolid } from './world.js';

export class Entity {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h; this.vx = 0; this.vy = 0; this.dir = 1;
    this.onGround = false; this.hitX = 0; this.hitCeil = false; this.dead = false; this.t = 0; this.dropThrough = 0;
  }
  get box() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
  get cx() { return this.x; }
  get cy() { return this.y - this.h / 2; }
  hits(other) { return overlap(this.box, other.box || other); }
}

// Horizontal move with tile collision.  Returns true if blocked.
export function moveX(e, room) {
  e.hitX = 0; if (!e.vx) return false;
  const nx = e.x + e.vx, dir = Math.sign(e.vx), edge = nx + dir * e.w / 2, tx = Math.floor(edge / T);
  const ty0 = Math.floor((e.y - e.h + 1) / T), ty1 = Math.floor((e.y - 1) / T);
  for (let ty = ty0; ty <= ty1; ty++) {
    if (room.solid(tx, ty)) { e.x = dir > 0 ? tx * T - e.w / 2 - 0.01 : (tx + 1) * T + e.w / 2 + 0.01; e.vx = 0; e.hitX = dir; return true; }
  }
  e.x = nx; return false;
}

// Vertical move.  Sets onGround / hitCeil.  One-way platforms are landable from above unless e.dropThrough > 0.
export function moveY(e, room) {
  e.onGround = false; e.hitCeil = false;
  const oldB = e.y, newB = e.y + e.vy, l = Math.floor((e.x - e.w / 2 + 0.6) / T), r = Math.floor((e.x + e.w / 2 - 0.6) / T);
  if (e.vy >= 0) {
    const ty = Math.floor(newB / T);
    for (let tx = l; tx <= r; tx++) {
      const v = room.get(tx, ty);
      if (isSolid(v) || (v === TILE.PLAT && !e.dropThrough && oldB <= ty * T + 0.5)) { e.y = ty * T; e.vy = 0; e.onGround = true; return; }
    }
    e.y = newB;
  } else {
    const ty = Math.floor((newB - e.h) / T);
    for (let tx = l; tx <= r; tx++) if (room.solid(tx, ty)) { e.y = (ty + 1) * T + e.h; e.vy = 0; e.hitCeil = true; return; }
    e.y = newB;
  }
}

// Is there ground one step ahead?  (for patrolling enemies that shouldn't walk off ledges)
export function groundAhead(e, room, dist = 10) {
  const tx = Math.floor((e.x + e.dir * (e.w / 2 + dist)) / T), ty = Math.floor((e.y + 4) / T);
  const v = room.get(tx, ty); return isSolid(v) || v === TILE.PLAT;
}
export function wallAhead(e, room, dist = 6) {
  const tx = Math.floor((e.x + e.dir * (e.w / 2 + dist)) / T);
  for (let ty = Math.floor((e.y - e.h + 2) / T); ty <= Math.floor((e.y - 2) / T); ty++) if (room.solid(tx, ty)) return true;
  return false;
}
// does the tile rect touched by this box contain spikes?
export function touchesSpikes(e, room) {
  const b = e.box, x0 = Math.floor(b.x / T), x1 = Math.floor((b.x + b.w) / T), y0 = Math.floor((b.y + b.h * 0.5) / T), y1 = Math.floor((b.y + b.h - 1) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (room.get(tx, ty) === TILE.SPIKE) {
    // spikes only fill the bottom 10px of their tile
    const sy = ty * T + 6; if (b.y + b.h > sy && b.x + b.w > tx * T + 1 && b.x < tx * T + T - 1) return true;
  }
  return false;
}
