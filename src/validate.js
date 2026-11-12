// Level validator: proves a generated room can actually be traversed, using the game's REAL movement physics.
//
// How it works:
//   1. Find every "surface" - a run of tiles you can stand on (3 free rows above, not spikes).
//   2. From sample points on each surface, simulate jumps / walk-offs / drops (single jump, double jump, dash, short hops,
//      full-speed and standing starts) with the same constants and collision code the player uses (physics.js, entity.js).
//   3. Each simulation that lands on another surface is an edge.  Breadth-first search then tells us exactly which surfaces are
//      reachable with a given set of abilities.
//   4. validateRoom() checks the things a level MUST guarantee: entry <-> exit connected (both directions), the save door,
//      altar, tablets and anything the generator promised are reachable; ability-locked items are reachable ONLY with their
//      ability; gated secret cells open only when the gate is destroyed; the dash gulf really needs Double Jump + Dash.
import { Room, TILE, isSolid } from './world.js';
import { moveX, moveY } from './entity.js';
import { RUN, GRAV, MAXFALL, JUMP, DJUMP, AIRACC, DASH_V, DASH_T, PW, PH } from './physics.js';
import { T } from './util.js';

const approach = (v, t, s) => (v < t ? Math.min(v + s, t) : Math.max(v - s, t));

export function roomOf(def, broken) {
  const tiles = Uint8Array.from(def.tiles);
  if (broken) for (const [x, y] of broken) tiles[y * def.w + x] = 0;
  return new Room({ ...def, tiles });
}

// ------------------------------------------------------------------------------------------------ surfaces
export function surfaces(room) {
  const { w, h } = room, id = new Int32Array(w * h).fill(-1), list = [];
  const free = (x, y) => { const v = room.get(x, y); return !isSolid(v) && v !== TILE.SPIKE; };
  for (let ty = 3; ty < h; ty++) {
    let cur = null;
    for (let tx = 0; tx < w; tx++) {
      const v = room.get(tx, ty), stand = (isSolid(v) || v === TILE.PLAT) && free(tx, ty - 1) && free(tx, ty - 2) && free(tx, ty - 3);
      if (stand) { if (!cur) { cur = { id: list.length, ty, x0: tx, x1: tx, allPlat: true }; list.push(cur); } cur.x1 = tx; if (v !== TILE.PLAT) cur.allPlat = false; id[ty * w + tx] = cur.id; }
      else cur = null;
    }
  }
  return { id, list, w, h, memo: new Map() };
}
function surfaceAt(room, S, x, y) {
  const ty = Math.round(y / T); if (ty < 0 || ty >= S.h) return -1;
  const c = Math.floor(x / T); let id = S.id[ty * S.w + c]; if (id >= 0) return id;
  for (const tx of [Math.floor((x - 6) / T), Math.floor((x + 6) / T)]) if (tx >= 0 && tx < S.w) { id = S.id[ty * S.w + tx]; if (id >= 0) return id; }
  return -1;
}

// ------------------------------------------------------------------------------------------------ physics simulation
function inSpikes(room, e) {
  const bx = e.x - e.w / 2, by = e.y - e.h, x0 = Math.floor(bx / T), x1 = Math.floor((bx + e.w) / T), y0 = Math.floor((by + e.h * 0.5) / T), y1 = Math.floor((by + e.h - 1) / T);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (room.get(tx, ty) === TILE.SPIKE) { const sy = ty * T + 6; if (by + e.h > sy && bx + e.w > tx * T + 1 && bx < tx * T + T - 1) return true; }
  return false;
}
// o: x,y (feet), dir, scale (air speed as a fraction of RUN), vx0, jump, hold (steps jump is held), dj (step of double jump), dash (step of air dash), drop
export function simulate(room, o) {
  const e = { x: o.x, y: o.y, w: PW, h: PH, vx: o.vx0 || 0, vy: o.jump ? JUMP : 0, dropThrough: o.drop ? 10 : 0, onGround: false, hitX: 0, hitCeil: false };
  let dashT = 0, canDouble = true, dashed = false; const target = (o.dir || 0) * RUN * (o.scale === undefined ? 1 : o.scale);
  for (let step = 0; step < 240; step++) {
    if (o.jump && step >= (o.hold === undefined ? 1e9 : o.hold) && e.vy < -2.4 && !dashT) e.vy = -2.4;          // short hop
    if (step === o.dj && canDouble) { e.vy = DJUMP; canDouble = false; }
    if (step === o.dash && !dashed && o.dir) { dashT = DASH_T; dashed = true; }
    if (dashT > 0) { dashT--; e.vx = o.dir * DASH_V; e.vy = 0; if (dashT === 0) e.vx = approach(o.dir * 2.2, o.dir * RUN, 0.06); }
    else {
      e.vx = approach(e.vx, target, target ? AIRACC : 0.05); if (Math.abs(e.vx) > RUN) e.vx = approach(e.vx, Math.sign(e.vx) * RUN, 0.06);
      e.vy = Math.min(e.vy + GRAV, MAXFALL);
    }
    moveX(e, room); moveY(e, room); if (e.dropThrough > 0) e.dropThrough--;
    if (e.onGround && (step > 0 || !o.jump)) return { x: e.x, y: e.y, step };
    if (e.y > room.ph + 40 || inSpikes(room, e)) return null;
  }
  return null;
}

function variants(abil, runUp) {
  const out = [], dj = abil.has('djump'), dash = abil.has('dash');
  for (const s of [0.4, 1]) for (const hold of [999, 9]) {
    const base = { scale: s, hold, vx0: runUp >= 40 ? s * RUN : 0 };
    out.push(base);
    if (dj) out.push({ ...base, dj: 22 }, { ...base, dj: 36 });
    if (dash) out.push({ ...base, dash: 14 }, { ...base, dash: 30 });
    if (dj && dash) out.push({ ...base, dj: 22, dash: 40 }, { ...base, dj: 14, dash: 34 });
  }
  return out;
}
function samplePoints(sf) {
  const L = sf.x0 * T, R = (sf.x1 + 1) * T, pts = [L + 8, L + 14, R - 14, R - 8];
  for (let tx = sf.x0 + 2; tx < sf.x1 - 1; tx += 3) pts.push(tx * T + 8);
  return pts;
}

function expand(room, S, sf, abil, akey) {
  const key = sf.id + '|' + akey; if (S.memo.has(key)) return S.memo.get(key);
  const out = new Set(), L = sf.x0 * T, R = (sf.x1 + 1) * T, y = sf.ty * T;
  const land = r => { if (!r) return; const id = surfaceAt(room, S, r.x, r.y); if (id >= 0 && id !== sf.id) out.add(id); };
  for (const dir of [-1, 1]) { const x = dir < 0 ? L - 7.5 : R + 7.5; for (const s of [0, 0.4, 1]) land(simulate(room, { x, y, dir, vx0: dir * s * RUN, scale: s, jump: false })); }     // walk off an end
  const pts = samplePoints(sf);
  if (sf.allPlat) for (const px of pts) for (const [dir, s] of [[0, 0], [-1, 0.4], [1, 0.4]]) land(simulate(room, { x: px, y: y + 2, dir, vx0: dir * s * RUN, scale: s, jump: false, drop: true }));   // drop through
  for (const px of pts) for (const dir of [-1, 1]) {
    const runUp = dir > 0 ? px - L : R - px;
    for (const v of variants(abil, runUp)) land(simulate(room, { x: px, y, dir, jump: true, ...v, vx0: dir * v.vx0 }));
  }
  const arr = [...out]; S.memo.set(key, arr); return arr;
}
export function reach(room, S, starts, abilities) {
  const abil = new Set(abilities), akey = [...abil].sort().join(','), seen = new Set(starts), q = [...starts];
  while (q.length) { const sid = q.pop(); for (const n of expand(room, S, S.list[sid], abil, akey)) if (!seen.has(n)) { seen.add(n); q.push(n); } }
  return seen;
}

// ------------------------------------------------------------------------------------------------ whole-room validation
const GROUND_SPAWN = new Set(['zombie', 'skeleton', 'armor', 'hound', 'ghoul', 'wizard', 'sorcerer', 'knight', 'acolyte', 'archmage', 'swampspider', 'swampthing', 'villager', 'candle', 'statue', 'itemspawn', 'altar', 'waystone', 'boss_cinder', 'boss_vampire', 'barrel', 'zealot', 'tablet', 'chest', 'boss_beast', 'boss_nightmare', 'boss_colossus', 'upgrade']);
// everything spawned in the room must stand on open ground (or float in open air) - never inside a wall
export function checkSpawns(def) {
  const room = roomOf(def), errs = [];
  for (const sp of def.spawns) {
    if (GROUND_SPAWN.has(sp.type)) { const v = room.get(sp.x, sp.y), a = room.get(sp.x, sp.y - 1), b = room.get(sp.x, sp.y - 2); if (!(isSolid(v) || v === TILE.PLAT) || isSolid(a) || isSolid(b)) errs.push(`${sp.type} at (${sp.x},${sp.y}) is not on open ground`); }
    else if (isSolid(room.get(sp.x, sp.y)) || isSolid(room.get(sp.x, sp.y - 1))) errs.push(`${sp.type} at (${sp.x},${sp.y}) is inside a wall`);
  }
  return errs;
}
export function validateRoom(def, opts = {}) {
  const errs = [], meta = def.meta || {}, base = meta.abilities || [];
  const room = roomOf(def), S = surfaces(room), at = (tx, gy) => (tx >= 0 && tx < def.w && gy >= 0 && gy < def.h ? S.id[gy * def.w + tx] : -1);
  const node = (p, name) => { const id = at(p.tx, p.gy); if (id < 0) errs.push(`${name} at (${p.tx},${p.gy}) is not standable`); return id; };

  // ---- static sanity
  for (const d of def.doors) { const id = at(d.x, d.gy); if (id < 0) errs.push(`door at (${d.x},${d.gy}) is not standable`); }

  // ---- entry pads must be flat standable ground
  const entries = meta.entry || {};
  for (const k of ['L', 'R']) if (entries[k]) { const p = entries[k]; for (let i = -1; i <= 1; i++) if (at(p.tx + i, p.gy) < 0) errs.push(`entry ${k} pad not flat/standable near (${p.tx},${p.gy})`); }

  // ---- main path: entry <-> exit with the room's baseline abilities, gates closed
  const startP = meta.start || entries.L || entries.R; if (!startP) { errs.push('no start'); return { ok: false, errs }; }
  const start = node(startP, 'start'), seen = start >= 0 ? reach(room, S, [start], base) : new Set();
  const must = [];
  if (entries.L && entries.R) must.push(['entry R', node(entries.R, 'entry R')], ['entry L', node(entries.L, 'entry L')]);
  for (const d of def.doors) must.push(['door', at(d.x, d.gy)]);
  for (const p of meta.must || []) must.push([p.name || 'target', node(p, p.name || 'target')]);
  for (const [name, id] of must) if (id >= 0 && !seen.has(id)) errs.push(`${name} unreachable from start with [${base}]`);
  // coming back the other way
  if (entries.L && entries.R && at(entries.R.tx, entries.R.gy) >= 0 && at(entries.L.tx, entries.L.gy) >= 0) { const back = reach(room, S, [at(entries.R.tx, entries.R.gy)], meta.back || base); if (!back.has(at(entries.L.tx, entries.L.gy))) errs.push('cannot walk back from the exit to the entrance'); }

  // ---- items that need an ability: reachable with it, NOT without it
  for (const it of meta.items || []) {
    if (it.needs) {
      const id = node(it, it.id); if (id < 0) continue;
      if (reach(room, S, [start], base.filter(a => a !== it.needs)).has(id)) errs.push(`${it.id} is reachable without ${it.needs}`);
      if (!reach(room, S, [start], [...new Set([...base, it.needs])]).has(id)) errs.push(`${it.id} is unreachable even with ${it.needs}`);
    }
    if (it.gate) {                                   // sealed cell: unreachable while closed, reachable once the gate is destroyed
      const open = roomOf(def, it.gate), So = surfaces(open), id = So.id[it.gy * def.w + it.tx];
      if (id < 0) { errs.push(`${it.id} cell interior not standable`); continue; }
      if (S.id[it.gy * def.w + it.tx] >= 0 && reach(room, S, [start], [...base, 'djump', 'dash']).has(S.id[it.gy * def.w + it.tx])) errs.push(`${it.id} cell is open without breaking its gate`);
      const s2 = surfaceAt(open, So, startP.tx * T + 8, startP.gy * T); if (s2 < 0 || !reach(open, So, [s2], base).has(id)) errs.push(`${it.id} unreachable even with its gate destroyed`);
    }
  }
  // ---- the dash gulf: must need Double Jump AND Dash
  if (meta.gap) {
    const rid = at(entries.R.tx, entries.R.gy);
    for (const a of [['djump'], ['dash'], []]) if (rid >= 0 && reach(room, S, [start], a).has(rid)) errs.push(`gulf crossable with only [${a}]`);
    if (rid >= 0 && !reach(room, S, [start], ['djump', 'dash']).has(rid)) errs.push('gulf not crossable even with Double Jump + Dash');
  }
  return { ok: errs.length === 0, errs, seen, S, room };
}
