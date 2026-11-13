// Static scenery drawn with the room (tombstones, torches, banners, doors ...) + the list of flames to light them.
import { KEYS } from './itemdata.js';
import { IMG, SHEET, drawSheet } from './assets.js';
import { extra } from './world.js';
import { T } from './util.js';
import { drawFramedPortrait, FH } from './portraitart.js';

const BACK_KINDS = new Set(['column', 'waterfall', 'portrait']);
// Is this piece of scenery drawn over a hazard (a spike tile)?  Nothing may stand in front of a hazard: the room drops such pieces when it loads.
export function decoCoversHazard(d, spikes) {
  if (isBack(d)) return false; let x0, y0, w, h;
  if (d.t === 'img') { const im = IMG[d.img]; if (!im) return false; const sc = d.scale || 1; w = Math.round(im.width * sc); h = Math.round(im.height * sc); x0 = d.x - w / 2; y0 = d.y - h + (d.sink || 0); }
  else if (d.t === 'cdl' || d.t === 'brazier') { const s = SHEET[d.t === 'cdl' ? 'candelabra' : 'brazier']; if (!s) return false; w = s.w; h = s.h; x0 = d.x - s.ax * w; y0 = d.y - s.ay * h; }
  else return false;
  return spikes.some(([tx, ty]) => x0 < tx * T + T - 1 && x0 + w > tx * T + 1 && y0 < ty * T + T && y0 + h > ty * T + 6);
}
export const isBack = d => BACK_KINDS.has(d.t) || (d.back && (d.t === 'img' || d.t === 'bookcase' || d.t === 'barwin'));

export function drawDeco(g, d, cx, cy, t, room) {
  const x = Math.round(d.x - cx), y = Math.round(d.y - cy);
  if (x < -150 || x > 540) return;
  switch (d.t) {
    case 'img': { const im = IMG[d.img], sc = d.scale || 1, w = Math.round(im.width * sc), h = Math.round(im.height * sc); g.drawImage(im, Math.round(x - w / 2), y - h + (d.sink || 0), w, h); break; }
    case 'hang': { const im = IMG[d.img], sc = d.scale || 1, w = Math.round(im.width * sc), h = Math.round(im.height * sc); g.drawImage(im, Math.round(x - w / 2), y, w, h); break; }       // hangs from the top edge (banners, a caged skeleton)
    case 'waterfall': {        // a waterfall: d.top = the world y it pours from (it may start above the room), d.y = where it lands, d.w = its width.  Drawn behind the ground and the hero.
      const w = d.w, top = Math.max(Math.round(d.top - cy), -2), bot = y, x0 = x - Math.round(w / 2), len = bot - top; if (bot <= 0 || top >= 216 || len <= 0) break;
      const hs = (a, b) => hash(d.x * 0.37 + a, b);
      g.fillStyle = 'rgba(88,146,160,0.42)'; g.fillRect(x0, top, w, len);                                      // the body of the water
      g.fillStyle = 'rgba(165,218,228,0.26)'; g.fillRect(x0 + 3, top, w - 6, len);                             // a paler heart
            // ragged foam down both edges (a dash here, a gap there, wavering a pixel or two)
      for (let yy = top; yy < bot; yy += 5) { const wy = Math.floor((yy + cy) / 5); if (hs(wy, 11) > 0.35) { g.fillStyle = 'rgba(232,250,252,' + (0.28 + 0.3 * hs(wy, 12)).toFixed(2) + ')'; const sw = Math.round(Math.sin((wy + t * 0.12) * 0.7) * 1.2); g.fillRect(x0 + sw, yy, 1 + (hs(wy, 13) > 0.7 ? 1 : 0), 4); g.fillRect(x0 + w - 1 - sw, yy, 1 + (hs(wy, 14) > 0.7 ? 1 : 0), 4); } }
      const n = Math.max(5, Math.floor(w / 2.4));
      for (let k = 0; k < n; k++) {                                                                            // streaks of white water racing down (anchored in the world, so they do not swim when the camera moves)
        const sx = x0 + 1 + Math.floor(hs(k, 1) * (w - 3)), sp = 1.8 + hs(k, 2) * 2.4, per = 38 + Math.floor(hs(k, 6) * 26), ph = hs(k, 3) * per, ln = 6 + Math.floor(hs(k, 4) * 20), wd = hs(k, 7) > 0.6 ? 2 : 1;
        g.fillStyle = 'rgba(240,253,255,' + (0.25 + 0.55 * hs(k, 5)).toFixed(2) + ')';
        for (let wy = Math.floor((cy + top) / per) * per - per; wy < cy + bot; wy += per) { const a = Math.round(wy + ((t * sp + ph) % per) - cy), b = Math.min(a + ln, bot), a2 = Math.max(a, top); if (b > a2) g.fillRect(sx, a2, wd, b - a2); }
      }
      { const gr = g.createLinearGradient(0, Math.max(top, bot - 44), 0, bot); gr.addColorStop(0, 'rgba(215,242,248,0)'); gr.addColorStop(1, 'rgba(215,242,248,0.30)'); g.fillStyle = gr; g.fillRect(x0 - 2, Math.max(top, bot - 44), w + 4, Math.min(len, 44)); }      // the water turns to mist as it nears the bottom
      if (top > 0) { g.fillStyle = 'rgba(210,240,246,0.30)'; g.fillRect(x0 - 2, top, w + 4, 2); }              // a lip where it leaves a ledge
      // where it lands: a boiling of foam and ripples on a small pool
      g.fillStyle = 'rgba(60,112,128,0.55)'; g.fillRect(x0 - 8, bot - 3, w + 16, 3); g.fillStyle = 'rgba(205,238,244,0.6)'; g.fillRect(x0 - 8, bot - 3, w + 16, 1);
      for (let i = 0; i < 6; i++) { const fx = x0 + ((i * 9 + Math.floor(t * 0.5)) % (w + 8)) - 4, fh = 2 + Math.floor(hs(i, Math.floor(t / 5)) * 4); g.fillStyle = 'rgba(240,252,255,0.7)'; g.fillRect(fx, bot - 3 - fh, 3, fh); }
      for (let i = 0; i < 2; i++) { const ph = ((t * 0.5 + i * 30) % 60) / 60, rw = Math.round((w + 10) * (0.5 + ph)); g.fillStyle = 'rgba(215,242,248,' + (0.5 * (1 - ph)).toFixed(2) + ')'; g.fillRect(x - Math.round(rw / 2), bot - 1, rw, 1); }
      break;
    }
    case 'portrait': drawFramedPortrait(g, x, y, { ci: d.ci, a: d.emo, frame: d.frame }); break;          // a framed portrait on the wall: x = its centre, y = the bottom edge of the frame (see portraitart.js)
    case 'dgtorch': drawSheet(g, 'dg_torch', Math.floor(t / 6 + d.x) % 4, x, y); break;
    case 'bookcase': {         // a tall bookcase drawn in code: oak frame, three shelves of books in a dozen colours (the same books every time for the same place)
      const W = 30, H = 46, x0 = x - 15, y0 = y - H, hh = n => { const s = Math.sin(d.x * 12.9898 + n * 78.233) * 43758.5453; return s - Math.floor(s); };
      const cols = ['#7a1e2a', '#2c4a6e', '#3c6a40', '#8a6a2a', '#5a2c6c', '#a8884a', '#2a2a3c', '#6a3a1a'];
      g.fillStyle = '#17100c'; g.fillRect(x0, y0, W, H);
      for (let s = 0; s < 3; s++) {
        const floor = y0 + 15 + s * 14; let bx = x0 + 2, k = 0;
        while (bx < x0 + W - 3) {
          const bw = 2 + Math.floor(hh(s * 40 + k) * 3), bh = 7 + Math.floor(hh(s * 40 + k + 100) * 5); k++;
          if (hh(s * 40 + k + 200) < 0.08) { bx += 3; continue; }                                           // a gap on the shelf
          g.fillStyle = cols[Math.floor(hh(s * 40 + k + 300) * cols.length)]; g.fillRect(bx, floor - bh, bw, bh); g.fillStyle = 'rgba(255,255,255,0.13)'; g.fillRect(bx, floor - bh, 1, bh); bx += bw;
        }
        g.fillStyle = '#5a3a22'; g.fillRect(x0 + 1, floor, W - 2, 2); g.fillStyle = '#7a5230'; g.fillRect(x0 + 1, floor, W - 2, 1);        // the shelf board
      }
      g.fillStyle = '#3a2418'; g.fillRect(x0, y0, 2, H); g.fillRect(x0 + W - 2, y0, 2, H); g.fillRect(x0 - 1, y0 - 2, W + 2, 3); g.fillStyle = '#7a5230'; g.fillRect(x0 - 1, y0 - 2, W + 2, 1);       // frame and cornice
      g.fillStyle = '#2a1a10'; g.fillRect(x0 - 1, y - 2, W + 2, 2); break;                                  // plinth
    }
    case 'barwin': {           // a barred window: dark glass with a streak of moonlight behind iron bars, in a stone arch
      const w = 20, h = 30, x0 = x - w / 2, top = y - h;
      g.fillStyle = '#4a4458'; g.beginPath(); g.moveTo(x0 - 2, y + 1); g.lineTo(x0 - 2, top + 8); g.arc(x, top + 8, w / 2 + 2, Math.PI, 0); g.lineTo(x0 + w + 2, y + 1); g.closePath(); g.fill();
      g.fillStyle = '#10141f'; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0, top + 8); g.arc(x, top + 8, w / 2, Math.PI, 0); g.lineTo(x0 + w, y); g.closePath(); g.fill();
      g.fillStyle = 'rgba(120,150,200,0.2)'; g.fillRect(x0 + 2, top + 5, 5, h - 7);
      g.fillStyle = '#2c2c3a'; for (let i = 0; i < 4; i++) g.fillRect(x0 + 2 + i * 5, top + 2, 2, h - 2);
      g.fillStyle = '#3a3a4c'; g.fillRect(x0, top + 14, w, 2); g.fillStyle = '#6a647a'; g.fillRect(x0 - 3, y, w + 6, 2); break;
    }
    case 'column': { const im = room.theme === 'throne' ? extra().throne_col : IMG.church_column; g.drawImage(im, Math.round(x - im.width / 2), y - im.height + 6); break; }
    case 'pool': {            // a shallow pool lying on the floor: standing in it washes the cloak
      const w = d.w, x0 = Math.round(x - w / 2); g.fillStyle = 'rgba(28,64,82,0.62)'; g.fillRect(x0, y - 3, w, 3); g.fillStyle = 'rgba(110,170,190,0.55)'; g.fillRect(x0, y - 3, w, 1);
      g.fillStyle = 'rgba(190,230,240,0.55)'; for (let i = 0; i < Math.floor(w / 24); i++) g.fillRect(x0 + Math.round(((t * 0.35 + i * 24 + d.x * 0.37) % (w - 6))), y - 2, 5, 1);
      g.fillStyle = 'rgba(28,64,82,0.62)'; g.fillRect(x0 + 1, y - 4, w - 2, 1); break;
    }
    case 'torch': drawSheet(g, 'torch', 0, x, y); break;
    case 'cdl': drawSheet(g, 'candelabra', 0, x, y); break;
    case 'brazier': drawSheet(g, 'brazier', 0, x, y); break;
    case 'banner': {
      const len = (d.len || 5) * T, w = 20, sway = Math.sin(t * 0.03 + d.x * 0.05) * 2, top = y - 0; g.fillStyle = d.color || '#7a1e2a';
      g.fillRect(x - w / 2, top, w, len - 6); g.beginPath(); g.moveTo(x - w / 2, top + len - 6); g.lineTo(x + w / 2, top + len - 6); g.lineTo(x + w / 2 + sway, top + len + 2); g.lineTo(x + sway * 0.5, top + len - 4); g.lineTo(x - w / 2 + sway, top + len + 2); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x + 2, top, w / 2 - 2, len - 6);
      g.fillStyle = '#c9a14a'; g.fillRect(x - w / 2 - 1, top, w + 2, 3); g.fillRect(x - 1, top + 12, 2, 10); g.fillRect(x - 4, top + 15, 8, 2); g.fillRect(x - 3, top + 24, 6, 1); break;
    }
    case 'door': {
      const sprite = d.kind === 'crypt' ? IMG.dg_arch : IMG.dg_door; if (sprite) { const w = Math.round(sprite.width * 0.5), h = Math.round(sprite.height * 0.5); g.drawImage(sprite, Math.round(x - w / 2), y - h, w, h); break; }
      const wood = d.kind === 'wood', w = 30, h = 44;
      g.fillStyle = '#0a0612'; g.fillRect(x - w / 2, y - h, w, h); g.beginPath(); g.arc(x, y - h, w / 2, Math.PI, 0); g.fill();
      g.strokeStyle = wood ? '#5d5470' : '#6a6458'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - w / 2 - 1, y); g.lineTo(x - w / 2 - 1, y - h); g.arc(x, y - h, w / 2 + 1, Math.PI, 0); g.lineTo(x + w / 2 + 1, y); g.stroke();
      if (wood) { g.fillStyle = '#4a2f18'; g.fillRect(x - w / 2 + 2, y - h + 4, w - 4, h - 4); g.fillStyle = '#6a4424'; for (let i = 0; i < 4; i++) g.fillRect(x - w / 2 + 3 + i * 7, y - h + 5, 1, h - 6); g.fillStyle = '#d9a93a'; g.fillRect(x + 6, y - 22, 3, 3); }
      else { g.fillStyle = '#1a1424'; g.fillRect(x - w / 2 + 3, y - h + 3, w - 6, h - 3); g.fillStyle = '#6a6458'; g.fillRect(x - 5, y - h + 8, 10, 2); g.fillRect(x - 1, y - h + 4, 2, 10); }
      break;
    }
    case 'grave': {          // HER grave: a mound of earth, a worn headstone, a few white flowers, and a candle burning with a blue flame - the one arcane light on the hill, where the ghost shows
      const flick = 0.85 + 0.15 * Math.sin(t * 0.3 + 1.7) + 0.08 * Math.sin(t * 0.8);
      g.fillStyle = '#17110e'; g.beginPath(); g.ellipse(x + 6, y - 1, 28, 7, 0, Math.PI, 0); g.fill(); g.fillStyle = '#2a1f17'; g.beginPath(); g.ellipse(x + 6, y - 1, 25, 5, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#4a4756'; g.beginPath(); g.moveTo(x - 22, y - 2); g.lineTo(x - 22, y - 28); g.quadraticCurveTo(x - 13, y - 39, x - 4, y - 28); g.lineTo(x - 4, y - 2); g.closePath(); g.fill();
      g.fillStyle = '#6c697c'; g.fillRect(x - 22, y - 28, 2, 26); g.fillStyle = 'rgba(20,18,30,0.55)'; for (let i = 0; i < 4; i++) g.fillRect(x - 18 + (i % 2), y - 24 + i * 5, 10 - ((i * 3) % 5), 1);          // the lettering, worn smooth
      for (const [fx, fy] of [[x + 1, y - 5], [x + 4, y - 8], [x + 8, y - 5], [x + 12, y - 7]]) { g.fillStyle = '#4a6a3a'; g.fillRect(fx, fy + 2, 1, 4); g.fillStyle = '#e4e0f2'; g.fillRect(fx - 1, fy, 3, 2); }
      g.fillStyle = '#ddd5c4'; g.fillRect(x + 17, y - 13, 3, 9); g.fillStyle = '#9a927f'; g.fillRect(x + 19, y - 13, 1, 9);
      g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x + 18.5, y - 18, 1, x + 18.5, y - 18, 26); gr.addColorStop(0, 'rgba(110,160,255,' + (0.5 * flick).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(110,160,255,0)'); g.fillStyle = gr; g.fillRect(x - 8, y - 44, 54, 54); g.restore();
      g.fillStyle = '#6a98ff'; g.beginPath(); g.moveTo(x + 17, y - 14); g.quadraticCurveTo(x + 15.5, y - 19, x + 18.5, y - 24 * flick + 2); g.quadraticCurveTo(x + 21.5, y - 19, x + 20, y - 14); g.closePath(); g.fill(); g.fillStyle = '#e8f2ff'; g.fillRect(x + 18, y - 18, 1, 3);
      break;
    }
    case 'padlock': {          // a padlock and crossed chains over a locked door, in the colour of its key (a faint glow); gone once the door has been opened
      const K = KEYS.find(k => k.id === d.key), F = (room && room.flags) || {}; if (F['unlocked_' + d.key]) break;
      const c = K ? K.rgb : [230, 200, 100], k = c.join(','), pulse = 0.5 + 0.5 * Math.sin(t * 0.07 + d.x), ly = y - 22;
      g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, ly, 1, x, ly, 20); gr.addColorStop(0, 'rgba(' + k + ',' + (0.32 + 0.14 * pulse).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(' + k + ',0)'); g.fillStyle = gr; g.fillRect(x - 20, ly - 20, 40, 40); g.restore();
      g.lineCap = 'butt'; for (const [col, w, off] of [['#1c1826', 3, 0], ['#8a86a2', 1, 0]]) { g.strokeStyle = col; g.lineWidth = w; g.setLineDash(w === 1 ? [2, 2] : []); g.beginPath(); g.moveTo(x - 15, y - 38 + off); g.lineTo(x + 15, y - 7 + off); g.moveTo(x + 15, y - 38 + off); g.lineTo(x - 15, y - 7 + off); g.stroke(); } g.setLineDash([]);
      g.fillStyle = '#12101a'; g.fillRect(x - 7, ly - 6, 14, 12); g.fillStyle = 'rgb(' + k + ')'; g.fillRect(x - 6, ly - 5, 12, 10); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x - 6, ly - 5, 12, 2);
      g.strokeStyle = '#b9c0d0'; g.lineWidth = 2; g.beginPath(); g.arc(x, ly - 6, 4.5, Math.PI, 0); g.stroke(); g.fillStyle = '#1a1020'; g.fillRect(x - 1, ly - 2, 2, 4);
      break;
    }
    case 'sigils': {          // the sigils of a door that is locked until bosses fall: a small diamond for each, lit once its boss is dead; the door is barred until they all burn
      const fl = d.flags || [], n = fl.length, F = (room && room.flags) || {}, lit = fl.filter(f => F[f]).length;
      if (lit < n) { g.fillStyle = 'rgba(8,4,16,0.55)'; g.fillRect(x - 15, y - 44, 30, 44); g.fillStyle = '#2c2838'; g.fillRect(x - 15, y - 36, 30, 3); g.fillRect(x - 15, y - 16, 30, 3); g.fillStyle = '#4a4458'; g.fillRect(x - 1, y - 44, 2, 44); }
      for (let i = 0; i < n; i++) {
        const sx = x + Math.round((i - (n - 1) / 2) * 13), sy = y - 58, on = !!F[fl[i]], pulse = 0.7 + 0.3 * Math.sin(t * 0.12 + i * 2);
        g.fillStyle = '#0a0612'; g.beginPath(); g.moveTo(sx, sy - 7); g.lineTo(sx + 6, sy); g.lineTo(sx, sy + 7); g.lineTo(sx - 6, sy); g.closePath(); g.fill();
        g.fillStyle = on ? 'rgba(255,214,110,' + pulse + ')' : '#3a3050'; g.beginPath(); g.moveTo(sx, sy - 5); g.lineTo(sx + 4, sy); g.lineTo(sx, sy + 5); g.lineTo(sx - 4, sy); g.closePath(); g.fill();
      }
      break;
    }
    case 'gate': { // closed iron gate at the start (flavour)
      g.fillStyle = '#181420'; g.fillRect(x - 8, y - 96, 56, 96);
      g.fillStyle = '#2c2838'; for (let i = 0; i < 7; i++) { g.fillRect(x - 6 + i * 8, y - 90, 3, 90); g.fillRect(x - 7 + i * 8, y - 94, 5, 5); }
      g.fillRect(x - 8, y - 60, 56, 3); g.fillRect(x - 8, y - 20, 56, 3); g.fillStyle = '#4a4458'; g.fillRect(x - 10, y - 100, 6, 100); g.fillRect(x + 44, y - 100, 6, 100); break;
    }
  }
}

const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// A building fire drawn as a real flame: a fat body with a rounded foot that fades into the wall, and a leaping top edge - several sharp licks that rise and fall at
// their own pace, drift sideways and lean downwind. Three nested layers (red outer, orange middle, yellow-white core), each licking differently, add up to the glowing look.
function flameLayer(g, x, y, W, H, t, seed, lean, stops) {
  const N = Math.max(8, Math.min(22, Math.round(W))), nl = W > 20 ? 4 : W > 11 ? 3 : 2, L = [], foot = W * 0.2;
  for (let j = 0; j < nl; j++) { const hj = hash(seed, j + 11); L.push({ c: (hj - 0.5) * 1.2 + 0.3 * Math.sin(t * (0.045 + 0.025 * j) + hj * 6.28), w: 0.3 + 0.16 * hash(seed, j + 21), a: 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(t * (0.17 + 0.06 * j) + hj * 9)) }); }
  g.beginPath();
  for (let i = 0; i <= N; i++) {                                                                                // the top edge, left to right
    const u = (i / N) * 2 - 1, env = Math.max(0, 1 - Math.pow(Math.abs(u), 1.5)); let m = 0.3 * env;           // fat in the middle, tapering away at the sides
    for (const l of L) m = Math.max(m, env * l.a * Math.pow(Math.max(0, 1 - Math.abs(u - l.c) / l.w), 1.15));    // each lick is a sharp peak
    const px = x + u * W / 2 + lean * m * m, py = y - H * m; if (i) g.lineTo(px, py); else g.moveTo(px, py);
  }
  for (let i = N; i >= 0; i--) { const u = (i / N) * 2 - 1; g.lineTo(x + u * W / 2, y + foot * Math.sqrt(Math.max(0, 1 - u * u))); }     // the round foot, right to left
  g.closePath();
  const lg = g.createLinearGradient(0, y + foot, 0, y - H); for (const [o, c] of stops) lg.addColorStop(o, c);
  g.fillStyle = lg; g.fill();
}
function drawBlaze(g, x, y, S, seed, t, dx = 0) {
  const bend = dx * Math.min(1, 0.35 + S * 0.4);                                                      // a gust flattens and bends it (the small fires less far)
  S *= 1 - Math.min(0.25, Math.abs(dx) / 40);
  const W = 15 * S, H = 33 * S, lean = W * (0.16 + 0.1 * Math.sin(t * 0.05 + seed)) + bend * 1.1;
  g.save(); g.translate(x, y + S); g.scale(1, 0.34);                                                            // a bed of glowing embers the flame grows out of: soft and round
  const eb = 9 * S, bg = g.createRadialGradient(0, 0, 0, 0, 0, eb); bg.addColorStop(0, 'rgba(255,200,100,0.4)'); bg.addColorStop(0.55, 'rgba(255,120,30,0.22)'); bg.addColorStop(1, 'rgba(255,80,20,0)');
  g.fillStyle = bg; g.fillRect(-eb, -eb, eb * 2, eb * 2); g.restore();
  flameLayer(g, x, y, W, H, t, seed, lean, [[0, 'rgba(230,60,15,0)'], [0.14, 'rgba(235,75,20,0.6)'], [0.55, 'rgba(255,110,25,0.55)'], [1, 'rgba(190,35,10,0)']]);
  flameLayer(g, x, y, W * 0.68, H * 0.72, t * 1.1, seed + 5, lean * 0.7, [[0, 'rgba(255,160,40,0)'], [0.16, 'rgba(255,170,55,0.65)'], [0.6, 'rgba(255,195,80,0.55)'], [1, 'rgba(255,140,40,0)']]);
  flameLayer(g, x, y, W * 0.36, H * 0.42, t * 1.25, seed + 9, lean * 0.4, [[0, 'rgba(255,240,170,0)'], [0.2, 'rgba(255,245,190,0.75)'], [1, 'rgba(255,225,130,0)']]);
}

// A flame drawn into the 2D scene (additive tongues + a soft glow), so sprites drawn after it - the hero, enemies - stand in FRONT of it.
// (The three.js layer sits on top of every sprite, so fires made there always burn over the hero.)
export function drawFlames2D(g, flames, cx, cy, t) {
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const f of flames) {
    if (!f.behind) continue; const x = f.x - cx, y = f.y - cy; if (x < -80 || x > 464 || y < -90 || y > 300) continue;
    const big = !!f.big, sc = big ? (f.fs || 1) : (f.scale || 1) * 0.42, seed = f.seed || 0, fl = 0.85 + 0.15 * Math.sin(t * 0.37 + seed) + 0.08 * Math.sin(t * 0.91 + seed * 2.3);
    if (f.blaze) {            // building fires swell and die back slowly, so neighbours are rarely the same size at the same moment
      const S = sc * (1 + 0.2 * Math.sin(t * 0.04 + seed * 1.9) + 0.08 * Math.sin(t * 0.13 + seed * 0.7)), R = 24 * S * fl, gy = y - 8 * S, gr = g.createRadialGradient(x, gy, 1, x, gy, R);
      gr.addColorStop(0, 'rgba(255,150,60,' + (f.small ? 0.26 : 0.32) + ')'); gr.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = gr; g.fillRect(x - R, gy - R, R * 2, R * 2);
      drawBlaze(g, x, y, S, seed, t, f.dx || 0); continue;
    }
    const R = (big ? 30 : 16) * sc * fl, gy = y - 9 * sc, gr = g.createRadialGradient(x, gy, 1, x, gy, R);       // soft glow
    gr.addColorStop(0, 'rgba(255,150,60,' + (big ? 0.34 : 0.3) + ')'); gr.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = gr; g.fillRect(x - R, gy - R, R * 2, R * 2);
    const n = big ? 4 : 1;
    for (let i = 0; i < n; i++) {                                                                                   // flame tongues
      const ph = seed * 1.7 + i * 1.9, h = (big ? 18 + 12 * Math.sin(t * 0.21 + ph) + 6 * Math.sin(t * 0.53 + ph * 1.3) + i * 3 : 10 + 3 * Math.sin(t * 0.4 + ph)) * sc * (big ? 0.95 : 1), w = (big ? 7 - i : 3.4) * sc, sway = Math.sin(t * 0.17 + ph) * (big ? 3 : 1) * sc + (f.dx || 0) * 0.6, bx = x + (big ? (i - 1.5) * 3 * sc : 0);
      const lg = g.createLinearGradient(0, y, 0, y - h); lg.addColorStop(0, 'rgba(255,235,160,0.95)'); lg.addColorStop(0.35, 'rgba(255,140,40,0.85)'); lg.addColorStop(1, 'rgba(190,40,10,0)');
      g.fillStyle = lg; g.beginPath(); g.moveTo(bx - w, y); g.quadraticCurveTo(bx - w * 0.9 + sway * 0.5, y - h * 0.55, bx + sway, y - h); g.quadraticCurveTo(bx + w * 0.9 + sway * 0.5, y - h * 0.55, bx + w, y); g.closePath(); g.fill();
    }
  }
  g.restore();
}

// flowing water on the floor (the Cistern): a translucent knee-deep sheet drawn OVER the hero's legs, with streaks of foam sliding along it the way the water runs
export function drawCurrents(g, list, cx, cy, t) {
  for (const c of list) {
    const x0 = Math.round(c.x0 - cx), x1 = Math.round(c.x1 - cx); if (x1 < 0 || x0 > 384) continue;
    const y = Math.round(c.y - cy), a = Math.max(0, x0), b = Math.min(384, x1), h = 20, len = c.x1 - c.x0;
    g.fillStyle = 'rgba(70,150,185,0.30)'; g.fillRect(a, y - h, b - a, h + 2);
    g.fillStyle = 'rgba(160,220,240,0.40)'; g.fillRect(a, y - h, b - a, 1);
    for (let i = 0; i < Math.round(len / 14); i++) {
      const w = 5 + (i % 4) * 4, yy = y - 3 - ((i * 7) % (h - 5)), xw = c.x0 + ((((i * 53 + t * c.vx * 1.5) % len) + len) % len), xs = Math.round(xw - cx);
      if (xs + w < a || xs > b) continue; g.fillStyle = 'rgba(200,240,250,' + (0.22 + 0.2 * ((i * 3) % 3) / 2).toFixed(2) + ')'; g.fillRect(Math.max(a, xs), yy, Math.min(w, b - xs), 1);
    }
    for (let i = 0; i < 8; i++) { const xw = c.x0 + ((((i * 97 + t * c.vx * 2.2) % len) + len) % len), xs = Math.round(xw - cx); if (xs < a || xs > b) continue; g.fillStyle = 'rgba(235,250,255,0.5)'; g.fillRect(xs, y - h - 1 + (i % 2), 3, 1); }          // foam on the surface
  }
}

// flames that must be lit for this room's decor
export function roomFlames(room) {
  const out = [];
  for (const d of room.decos) {
    if (d.t === 'torch') out.push({ x: d.x, y: d.y - 15, scale: 1.1, seed: d.x, light: 80 });
    else if (d.t === 'cdl') for (const [ox, oy, s] of [[-5.5, -26, 0.8], [0.5, -31, 1], [6.5, -26, 0.8]]) out.push({ x: d.x + ox, y: d.y + oy, scale: s, seed: d.x + ox, light: ox === 0.5 ? 60 : 0, behind: true });
    else if (d.t === 'blaze') {      // a building fire
      if (d.burn && !(room.flags && room.flags.village_fire) && !(room.ignited && room.ignited.has(d.burn))) continue;          // (a house's fires are unlit until a torch lands on it, or the village burns) (no sprite - just fire): windows burn big, and many small fires burn all over the walls and roof. Each is a little bigger or smaller than its scale says
      const sc = d.scale || 1.5, small = !!d.small, j = 0.82 + 0.36 * hash(d.x, d.y);
      out.push({ x: d.x, y: d.y, fs: sc * 1.35 * j, seed: d.x + d.y, ph: Math.floor(hash(d.y, d.x) * 97), light: small ? 0 : Math.round(130 * (0.75 + 0.25 * j)), big: true, blaze: true, small, smoke: true, behind: true });
    }
    else if (d.t === 'dgtorch') out.push({ x: d.x, y: d.y - 44, light: 90, lightOnly: true });      // the flame is part of the sprite: it only needs to light the room
    else if (d.t === 'brazier') out.push({ x: d.x, y: d.y - 17, fs: 0.95, seed: d.x, light: 110, big: true, blaze: true, behind: true });      // the bowl's rim is 18px above the base of its sprite: the fire sits IN the bowl (a real flame outline - no flat edge - a little smaller than it used to be)
  }
  return out;
}
