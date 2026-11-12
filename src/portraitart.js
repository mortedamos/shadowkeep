// Framed portraits: the painted portraits, pixelated (tools/pixelate-portraits.ps1 -> assets/portraits/pixel/portraits.png: 15 people x 5 expressions, 26x33 each), in a frame drawn here.
// Used for the plain portraits that hang on castle walls (decor kind 'portrait') and for the haunted ones that are secretly alive (portraits.js).
import { PORTRAIT } from './assets.js';

const FB0 = 4;
export const PW = 26, PH = 33, FB = FB0, FW = PW + FB * 2, FH = PH + FB * 2;        // the picture, the frame's width, and the whole framed thing (34 x 41)
export const EMO = { happy: 0, neutral: 1, sad: 2, angry: 3, extra: 4 };         // columns of the atlas (the fifth is that person's own: wistful, proud, uncanny...)
export const CHARS = 15, FRAME_N = 5;
export const PERSON = ['aelthir', 'aldric', 'barnaby', 'brunna', 'corvin', 'gnash', 'grukka', 'kazra', 'maren', 'oskar', 'sigrun', 'skarra', 'vaelis', 'varg', 'ysolde'];
// where the eyes are in each person's ANGRY picture: the glow and the fire come from here.  (Read off the 48 x 60 version of the pictures, then scaled to the picture size.)
const EYES48 = [[[19, 9], [22, 9]], [[23, 13.5], [27, 13.5]], [[25, 15.5], [30, 15.5]], [[15, 13.5], [20, 13.5]], [[19, 8.5], [23, 8.5]], [[19, 12], [23, 12]], [[25, 12], [29, 12]], [[18, 12], [22.5, 12]],
  [[22, 9.5], [24.5, 9.5]], [[20, 9.5], [23.5, 9.5]], [[25, 18.5], [28.5, 18.5]], [[18, 14.5], [22, 14.5]], [[20, 7], [23, 7]], [[19, 9.5], [22.5, 9.5]], [[23.5, 8.5], [27, 8.5]]];
export const EYES = EYES48.map(pair => pair.map(([x, y]) => [x * PW / 48, y * PH / 60]));

const FRAMES = [
  { out: '#1a0e08', hi: '#fff0a0', mid: '#e0b040', lo: '#8a5a14', stud: '#fff8c8' },        // gilt
  { out: '#120a06', hi: '#9a6a3c', mid: '#6a4524', lo: '#3a2312', stud: '#c9a14a' },        // oak
  { out: '#10121a', hi: '#ffffff', mid: '#bcc6da', lo: '#6a728a', stud: '#e8f0ff' },        // silver
  { out: '#160c06', hi: '#f0b878', mid: '#b87a3a', lo: '#5a3414', stud: '#ffe0a0' },        // bronze
  { out: '#08060c', hi: '#5a4a70', mid: '#2e2438', lo: '#14101c', stud: '#e0b040' },        // ebony
];
function drawFrame(g, x, y, w, h, F, FB = FB0) {
  const r = (c, a, b, ww, hh) => { g.fillStyle = c; g.fillRect(x + a, y + b, ww, hh); };
  r(F.out, 0, 0, w, h); r(F.mid, 1, 1, w - 2, h - 2);                                         // outline, body of the moulding
  r(F.hi, 1, 1, w - 2, 1); r(F.hi, 1, 1, 1, h - 2); r(F.lo, 1, h - 2, w - 2, 1); r(F.lo, w - 2, 1, 1, h - 2);          // lit top and left, shaded bottom and right
  r(F.lo, FB - 1, FB - 1, w - 2 * (FB - 1), h - 2 * (FB - 1)); r(F.out, FB, FB, w - 2 * FB, h - 2 * FB);                // the lip against the picture
  r(F.hi, 2, 2, w - 4, 1); r(F.lo, 2, FB - 2, w - 4, 1);                                       // a groove along the moulding
  for (const [a, b] of [[1, 1], [w - 4, 1], [1, h - 4], [w - 4, h - 4]]) { r(F.stud, a, b, 3, 3); r(F.lo, a + 2, b + 2, 1, 1); }       // corner studs
  r(F.stud, (w >> 1) - 3, 0, 6, 2); r(F.hi, (w >> 1) - 2, 0, 4, 1);                           // a crest at the top
}

export const drawFrameRect = (g, x, y, w, h, style = 0, band = FB0) => drawFrame(g, x, y, w, h, FRAMES[style % FRAMES.length], band);          // (the mirror in the Mirror Room has one)

// p: { ci (person), a, b (two expressions), t (0..1: how far from a toward b), frame }.  cx, bottom: the frame's bottom-centre on screen.
// o: { rot, alpha, flash, tint (css colour laid over the picture) }
export function drawFramedPortrait(g, cx, bottom, p, o = {}) {
  g.save(); g.translate(Math.round(cx), Math.round(bottom - FH / 2)); if (o.rot) g.rotate(o.rot); if (o.alpha !== undefined) g.globalAlpha *= o.alpha; g.imageSmoothingEnabled = false;
  drawFrame(g, -FW / 2, -FH / 2, FW, FH, FRAMES[p.frame % FRAMES.length]);
  const ix = -PW / 2, iy = -PH / 2;
  if (PORTRAIT.img) {
    g.drawImage(PORTRAIT.img, p.a * PW, p.ci * PH, PW, PH, ix, iy, PW, PH);
    if (p.b !== undefined && p.t > 0.01) { const ga = g.globalAlpha; g.globalAlpha = ga * Math.min(1, p.t); g.drawImage(PORTRAIT.img, p.b * PW, p.ci * PH, PW, PH, ix, iy, PW, PH); g.globalAlpha = ga; }
  } else { g.fillStyle = '#3a2c3a'; g.fillRect(ix, iy, PW, PH); }
  if (o.tint) { g.fillStyle = o.tint; g.fillRect(ix, iy, PW, PH); }
  g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(ix, iy, PW, 1); g.fillRect(ix, iy, 1, PH);                                       // the picture sits a little way back in its frame
  g.fillStyle = 'rgba(255,255,255,0.07)'; g.beginPath(); g.moveTo(ix, iy); g.lineTo(ix + 12, iy); g.lineTo(ix, iy + 17); g.closePath(); g.fill();       // a glint of glass
  if (o.flash) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(-FW / 2, -FH / 2, FW, FH); }
  g.restore();
}

// the world position of the two eyes of person `ci`, for a portrait whose frame's bottom-centre is (x, y) and which is turned by `rot`
export function eyePoints(x, y, ci, rot = 0) {
  const c = Math.cos(rot), s = Math.sin(rot), cy = y - FH / 2;
  return EYES[ci % EYES.length].map(([ex, ey]) => { const lx = ex - PW / 2, ly = ey - PH / 2; return [x + lx * c - ly * s, cy + lx * s + ly * c]; });
}
