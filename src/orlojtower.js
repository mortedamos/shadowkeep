// The ORLOJ TOWER, as seen from the street in Prague (Smouldering Lane): a tall sandstone tower that rises from the ground behind the door's ledge, built in code around the two real dials -
// the calendar dial (below) and the astronomical dial (above) - after the Old Town Hall's tower: carved pilasters with little statues beside the dials, a band of ornament between them, the
// great arched awning of green copper with its two blue windows and a golden figure, the belfry shaft above, and the steep copper roof with its golden finial.  Drawn once on an off-screen
// canvas, 128 x 600 px, whose bottom edge is the ground; the dials are pictures made by tools/pixelate-orloj.ps1 and tools/pixelate-orloj-calendar.ps1.
import { IMG } from './assets.js';

export const TOWER_W = 128, TOWER_H = 600;
let cache = null;
const hs = (a, b) => { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); };

export function orlojTower() {
  if (cache) return cache;
  if (!IMG.orloj_small || !IMG.orloj_calendar) return null;
  const cv = document.createElement('canvas'); cv.width = TOWER_W; cv.height = TOWER_H; const c = cv.getContext('2d');
  const Y = h => TOWER_H - h;                                                       // the y of a height (in px) above the ground
  const P = { L: '#a18a66', S: '#7d6a52', D: '#5a4a3c', DD: '#2f271f', R: '#8e5848', G: '#dcb65c', GD: '#8c6c2e', C: '#3f6e5e', CL: '#72a68e', CD: '#244a3f', N: '#1a2038', B: '#5078be' };
  const rect = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  // masonry: courses of brick, a little different from one another, laid in the gaps of a dark mortar
  const wall = (x0, x1, h0, h1, seed) => {
    rect(x0, Y(h1), x1 - x0, h1 - h0, P.DD);
    for (let y = Y(h1), r = 0; y < Y(h0); y += 8, r++) for (let x = x0 - (r % 2 ? 8 : 0); x < x1; x += 16) {
      const bx = Math.max(x, x0), bw = Math.min(x + 16, x1) - bx, k = hs(x * 3.1 + seed, r), tone = k > 0.94 ? P.R : k > 0.62 ? P.L : k > 0.22 ? P.S : P.D;
      if (bw > 1) { rect(bx, y, bw - 1, 7, tone); rect(bx, y, bw - 1, 1, 'rgba(255,240,200,0.16)'); rect(bx, y + 6, bw - 1, 1, 'rgba(0,0,0,0.18)'); }
    }
  };
  const quoins = (x0, x1, h0, h1) => { for (let y = Y(h1), r = 0; y < Y(h0); y += 12, r++) { const w = r % 2 ? 9 : 13; rect(x0, y, w, 11, P.L); rect(x0, y, w, 1, 'rgba(255,240,200,0.3)'); rect(x0 + w - 1, y, 1, 11, P.D); rect(x1 - w, y, w, 11, P.L); rect(x1 - w, y, w, 1, 'rgba(255,240,200,0.3)'); rect(x1 - w, y, 1, 11, P.D); } };
  const figure = (x, h, body, cloak) => { rect(x - 3, Y(h), 7, 4, P.D); rect(x - 2, Y(h + 14), 5, 11, body); rect(x - 2, Y(h + 14), 2, 11, cloak); rect(x - 1, Y(h + 19), 3, 4, '#e6cba4'); rect(x - 1, Y(h + 20), 3, 1, P.DD); };
  const pilaster = (x, h0, h1) => { rect(x, Y(h1), 12, h1 - h0, P.D); rect(x, Y(h1), 2, h1 - h0, P.L); rect(x + 10, Y(h1), 2, h1 - h0, P.DD); rect(x - 2, Y(h1), 16, 5, P.S); rect(x - 2, Y(h0 + 5), 16, 5, P.S);
    for (let h = h0 + 14; h < h1 - 10; h += 13) { rect(x + 3, Y(h + 4), 6, 6, P.GD); rect(x + 5, Y(h + 2), 2, 2, P.G); } };
  const frame = (cx, r, h) => { rect(cx - r - 6, Y(h) - r - 6, 2 * r + 12, 2 * r + 12, P.DD); rect(cx - r - 5, Y(h) - r - 5, 2 * r + 10, 2 * r + 10, P.GD); rect(cx - r - 4, Y(h) - r - 4, 2 * r + 8, 2 * r + 8, P.N);
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { rect(cx + sx * (r + 2) - 2, Y(h) + sy * (r + 2) - 2, 4, 4, P.G); } };

  // ---------------------------------------------------------------- the body
  wall(4, 124, 22, 436, 1); quoins(4, 124, 22, 436);
  rect(0, Y(22), 128, 22, P.D); rect(0, Y(22), 128, 3, P.L); for (let x = 0; x < 128; x += 16) rect(x, Y(19), 1, 19, P.DD);             // the plinth
  // a pointed doorway at the foot, barred and dark
  c.fillStyle = P.L; c.beginPath(); c.moveTo(38, Y(22)); c.lineTo(38, Y(66)); c.quadraticCurveTo(38, Y(96), 64, Y(104)); c.quadraticCurveTo(90, Y(96), 90, Y(66)); c.lineTo(90, Y(22)); c.closePath(); c.fill();
  c.fillStyle = P.N; c.beginPath(); c.moveTo(43, Y(22)); c.lineTo(43, Y(66)); c.quadraticCurveTo(43, Y(90), 64, Y(97)); c.quadraticCurveTo(85, Y(90), 85, Y(66)); c.lineTo(85, Y(22)); c.closePath(); c.fill();
  for (let x = 48; x < 82; x += 6) rect(x, Y(88), 1, 66, P.GD); rect(43, Y(52), 42, 2, P.GD);
  // the calendar dial and the astronomical dial, each in a carved frame between two pilasters with their statues
  pilaster(8, 170, 396); pilaster(108, 170, 396);
  frame(64, 32, 214); c.drawImage(IMG.orloj_calendar, 64 - 32, Y(214) - 32);
  if (IMG.gy_angel) { const an = IMG.gy_angel; for (const [ax, flip] of [[15, false], [113, true]]) { rect(ax - 11, Y(184), 22, 6, P.D); rect(ax - 11, Y(184), 22, 1, P.L); c.save(); c.translate(ax, 0); if (flip) c.scale(-1, 1); c.drawImage(an, -Math.round(an.width / 2), Y(184) - an.height); c.restore(); } }          // the golden angels, one on each side of the calendar dial (the same statue, mirrored)
  rect(4, Y(284), 120, 18, P.DD); rect(4, Y(284), 120, 2, P.L); for (let x = 8; x < 120; x += 8) { rect(x + 1, Y(280), 5, 9, P.D); rect(x + 3, Y(278), 1, 5, P.G); }          // a band of carved ornament
  frame(64, 36, 332); c.drawImage(IMG.orloj_small, 64 - 36, Y(332) - 36);
  figure(28, 312, '#d9b45a', '#a07c32'); figure(36, 330, '#9a3a3a', '#5e2020'); figure(100, 312, '#3a5a9a', '#22386a'); figure(92, 330, '#4a7a4a', '#2a4a2a');
  rect(2, Y(398), 124, 12, P.D); rect(2, Y(398), 124, 2, P.L); rect(2, Y(388), 124, 1, P.DD);                                       // the cornice under the awning
  // ---------------------------------------------------------------- the awning: a great arch of green copper over a dark recess with two blue windows and a golden figure
  // (the shaft behind first: the awning is drawn over its foot)
  wall(16, 112, 420, 540, 7); quoins(16, 112, 420, 540);
  rect(16, Y(470), 96, 1, P.DD);
  for (let i = 0; i < 4; i++) { const k = hs(i, 9); rect(22 + Math.round(k * 56), Y(448 + i * 24), 16, 8, P.R); }          // the patches of red brick showing through the sandstone
  const ab = Y(398);
  c.fillStyle = P.C; c.beginPath(); c.ellipse(64, ab, 60, 50, 0, Math.PI, 2 * Math.PI); c.fill();
  c.strokeStyle = P.CL; c.lineWidth = 2; c.beginPath(); c.ellipse(64, ab, 59, 49, 0, Math.PI * 1.02, Math.PI * 1.98); c.stroke();
  c.fillStyle = P.N; c.beginPath(); c.ellipse(64, ab, 50, 38, 0, Math.PI, 2 * Math.PI); c.fill();
  c.strokeStyle = P.CD; c.lineWidth = 1; for (let k = 1; k < 6; k++) { c.beginPath(); c.moveTo(64, ab); c.lineTo(64 + Math.cos(Math.PI + k * Math.PI / 6) * 50, ab + Math.sin(Math.PI + k * Math.PI / 6) * 38); c.stroke(); }
  for (const x of [38, 82]) { rect(x, ab - 30, 12, 22, P.DD); rect(x + 2, ab - 28, 8, 18, P.B); rect(x + 6, ab - 28, 1, 18, P.DD); rect(x + 2, ab - 20, 8, 1, P.DD); rect(x + 3, ab - 27, 2, 5, 'rgba(255,255,255,0.35)'); }
  rect(57, ab - 33, 14, 25, P.DD); rect(59, ab - 31, 10, 21, '#3a2f22'); rect(62, ab - 24, 4, 11, P.G); rect(62, ab - 28, 4, 4, '#ead7a8'); rect(60, ab - 18, 8, 2, P.GD);       // a golden figure in his niche
  c.fillStyle = P.G; c.beginPath(); c.moveTo(0, ab); c.lineTo(8, ab - 12); c.lineTo(9, ab); c.closePath(); c.fill(); c.beginPath(); c.moveTo(128, ab); c.lineTo(120, ab - 12); c.lineTo(119, ab); c.closePath(); c.fill();   // the gilded points at either end
  // ---------------------------------------------------------------- the belfry shaft and the roof
  c.fillStyle = P.DD; c.beginPath(); c.moveTo(54, Y(488)); c.lineTo(54, Y(512)); c.quadraticCurveTo(54, Y(526), 64, Y(530)); c.quadraticCurveTo(74, Y(526), 74, Y(512)); c.lineTo(74, Y(488)); c.closePath(); c.fill();   // the belfry window
  for (let y = 492; y < 516; y += 4) rect(57, Y(y), 14, 1, P.D);
  rect(8, Y(552), 112, 12, P.D); rect(8, Y(552), 112, 2, P.L); rect(8, Y(541), 112, 1, P.DD);                                    // the cornice under the roof
  c.fillStyle = P.C; c.beginPath(); c.moveTo(10, Y(552)); c.lineTo(118, Y(552)); c.lineTo(64, Y(596)); c.closePath(); c.fill();
  c.fillStyle = 'rgba(114,166,142,0.38)'; c.beginPath(); c.moveTo(10, Y(552)); c.lineTo(64, Y(552)); c.lineTo(64, Y(596)); c.closePath(); c.fill();
  c.strokeStyle = P.CD; c.lineWidth = 1; for (let h = 558; h < 594; h += 5) { const half = 54 * (1 - (h - 552) / 44); c.beginPath(); c.moveTo(64 - half, Y(h) + 0.5); c.lineTo(64 + half, Y(h) + 0.5); c.stroke(); }
  rect(63, Y(600), 2, 8, P.GD); c.fillStyle = P.G; c.beginPath(); c.arc(64, Y(597), 3, 0, Math.PI * 2); c.fill();                  // the golden finial
  // ---------------------------------------------------------------- a little dusk over all of it: darker toward the far side, and lighter where the lamps and the fires reach
  c.globalCompositeOperation = 'source-atop';
  const gr = c.createLinearGradient(0, 0, TOWER_W, 0); gr.addColorStop(0, 'rgba(255,230,190,0.07)'); gr.addColorStop(1, 'rgba(10,6,20,0.3)'); c.fillStyle = gr; c.fillRect(0, 0, TOWER_W, TOWER_H);
  const gv = c.createLinearGradient(0, 0, 0, TOWER_H); gv.addColorStop(0, 'rgba(10,6,20,0.22)'); gv.addColorStop(0.7, 'rgba(0,0,0,0)'); gv.addColorStop(1, 'rgba(0,0,0,0.3)'); c.fillStyle = gv; c.fillRect(0, 0, TOWER_W, TOWER_H);
  c.globalCompositeOperation = 'source-over';
  return (cache = cv);
}
