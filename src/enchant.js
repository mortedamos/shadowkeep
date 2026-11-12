// Sword enchantments: data, tuning numbers, and the small drawing helpers they need (ice block, energy shield).
// Enemies sometimes drop an enchantment gem; picking one up imbues the sword for a couple of minutes.
// Only one enchantment is active at a time (a different gem replaces it, the same gem adds time).
export const ENCH_TYPES = ['fire', 'ice', 'sun', 'aegis'];

export const ENCH = {
  fire: { name: 'FLAME', title: 'FLAME BLADE', desc: 'MORE DAMAGE. EVERY SLASH HURLS A FIREBALL.', dmg: 1.3, rgb: [1, 0.55, 0.15], icon: 'e_fire', pal: { bright: [255, 228, 120], mid: [255, 112, 30], dark: [150, 34, 10] } },
  ice: { name: 'FROST', title: 'FROST BLADE', desc: 'HITS CAN FREEZE FOES SOLID FOR A FEW SECONDS.', dmg: 1.15, rgb: [0.55, 0.85, 1], icon: 'e_ice', pal: { bright: [240, 252, 255], mid: [110, 200, 255], dark: [40, 104, 190] } },
  sun: { name: 'SUN', title: 'SUNBRAND', desc: 'GREATLY INCREASED DAMAGE. SHEDS HOLY LIGHT.', dmg: 1.5, rgb: [1, 0.88, 0.4], icon: 'e_sun', pal: { bright: [255, 252, 226], mid: [255, 214, 84], dark: [190, 122, 22] } },
  aegis: { name: 'AEGIS', title: 'AEGIS BLADE', desc: 'HITS CAN RAISE A SHIELD THAT BLOCKS ONE ATTACK.', dmg: 1.2, rgb: [0.5, 0.7, 1], icon: 'e_aegis', pal: { bright: [232, 244, 255], mid: [104, 154, 255], dark: [42, 72, 172] } },
};

// every balance knob in one place (all times are in 60ths of a second)
export const TUNE = {
  time: 120 * 60,            // how long a fresh enchantment lasts
  addTime: 60 * 60,          // picking up the same gem again adds this much...
  maxTime: 240 * 60,         // ...up to this cap
  // ICE - chance to freeze per sword hit.  Stun-lock protection: a thawed enemy is immune to freezing for a while.
  freezeChance: 0.2, freezeMin: 60, freezeMax: 180, freezeImmune: 240,                  // normal enemies: 1-3s frozen, then 4s immune
  bossFreezeChance: 0.06, bossFreezeMin: 60, bossFreezeMax: 100, bossFreezeImmune: 480,  // bosses: rare, 1-1.7s, then 8s immune
  frozenBonus: 1.2,          // frozen things take 20% extra damage
  // FIRE
  fireballFrac: 0.4, fireballLife: 30,        // fireball damage = 40% of the swing; flies ~100px
  // AEGIS
  shieldChance: 0.2, shieldTime: 900,          // per successful hit; an unused shield fades after 15s
  // DROPS
  dropBase: 0.035, dropElite: 0.06, dropPity: 0.005, dropPityMax: 0.08,
};

// enemies tend to drop a fitting element (55% of the time), otherwise any
export const ENCH_BIAS = { fireskull: 'fire', ghoul: 'fire', hound: 'fire', wizard: 'fire', ghost: 'ice', wraith: 'ice', acolyte: 'ice', archmage: 'fire', gnuknight: 'aegis', swampthing: 'sun', swampspider: 'sun', frostwyrm: 'ice', emberwyrm: 'fire', wyrm: 'sun', armor: 'aegis', sorcerer: 'fire', skeleton: 'sun', zombie: 'sun' };

// ------------------------------------------------------------------------------------------ frozen enemy overlay
export function drawIce(ctx, e, cx, cy, t) {
  const w = e.ice ? e.ice.w : e.w + 8, h = e.ice ? e.ice.h : e.h + 8;
  const x = Math.round(e.x - cx - w / 2), y = Math.round(e.y - cy - h + 3), fade = e.freezeT < 30 ? 0.55 + 0.45 * Math.sin(e.freezeT * 0.9) : 1;
  ctx.save(); ctx.globalAlpha = fade;
  ctx.fillStyle = 'rgba(120,200,255,0.42)'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(235,250,255,0.55)'; ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y, 2, h);                 // lit top/left edges
  ctx.fillStyle = 'rgba(40,110,200,0.65)'; ctx.fillRect(x, y + h - 2, w, 2); ctx.fillRect(x + w - 2, y, 2, h);  // shaded bottom/right edges
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 3; i++) ctx.fillRect(x + 4 + i * 6, y + 6 + i * 9, 2, 8);   // glints
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; const gl = (t * 0.5) % (w + h); ctx.fillRect(x + Math.min(w - 2, gl), y + Math.max(0, gl - w), 2, 2);   // travelling sparkle
  if (e.freezeT < 40) { ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + w * 0.3, y); ctx.lineTo(x + w * 0.45, y + h * 0.4); ctx.lineTo(x + w * 0.35, y + h * 0.7); ctx.lineTo(x + w * 0.6, y + h); ctx.moveTo(x + w * 0.45, y + h * 0.4); ctx.lineTo(x + w * 0.8, y + h * 0.55); ctx.stroke(); }   // about to shatter
  ctx.restore();
}

// ------------------------------------------------------------------------------------------ energy shield bubble
export function drawShield(ctx, x, y, t, fading) {
  const a = fading ? 0.45 + 0.35 * Math.sin(t * 0.8) : 0.9, cy = y - 19, rx = 17, ry = 26;
  ctx.save(); ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(x, cy, 4, x, cy, ry); g.addColorStop(0, 'rgba(120,180,255,0.04)'); g.addColorStop(0.75, 'rgba(120,180,255,0.16)'); g.addColorStop(1, 'rgba(170,220,255,0.42)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(205,235,255,0.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(160,210,255,0.55)'; for (let i = 0; i < 3; i++) { const s = t * 0.05 + i * 2.1; ctx.beginPath(); ctx.ellipse(x, cy, rx - 3, ry - 3, 0, s, s + 0.9); ctx.stroke(); }   // rotating arcs
  ctx.restore();
}
