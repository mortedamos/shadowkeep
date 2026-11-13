// Shared constants + tiny helpers
export const W = 384;          // internal render width  (pixels)
export const H = 216;          // internal render height (pixels)
export const T = 16;           // tile size

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
export const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const choice = arr => arr[Math.floor(Math.random() * arr.length)];
export const chance = p => Math.random() < p;
export const easeOut = t => 1 - (1 - t) * (1 - t);
export const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const TAU = Math.PI * 2;

// axis-aligned box overlap; boxes are {x,y,w,h} with x,y = top-left
export const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// deterministic noise for flicker etc.
export function hash1(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }
export function noise1(x) { const i = Math.floor(x), f = x - i; const u = f * f * (3 - 2 * f); return lerp(hash1(i), hash1(i + 1), u); }

// seeded RNG for scenery so backgrounds don't shimmer
export function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const fmtTime = s => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; };

// Speech is written in capitals in the source files (the game's font); characters (NPCs and bosses) are SPOKEN in sentence case: lower-case, a capital to begin each sentence, "I", and the proper names below.
// (An ellipsis does not end a sentence: "NO... ONE... PASSES." reads "No... one... passes.")
const NAMES = ['Prague', 'Bohemia', 'God', 'Stranger', 'Shadowkeep', 'Silberzahn', 'Vltava', 'Nigredo', 'Albedo', 'Citrinitas', 'Rubedo', 'Athanor', 'Azoth', 'Great Work'];
export function sentenceCase(str) {
  let o = String(str).toLowerCase();
  o = o.replace(/(^|[?!]\s+|(?<!\.)\.\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase());
  o = o.replace(/\bi\b/g, "I");
  for (const n of NAMES) o = o.replace(new RegExp("\\b" + n.toLowerCase() + "\\b", "g"), n);
  return o;
}
