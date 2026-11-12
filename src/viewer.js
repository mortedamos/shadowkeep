// Debug tool:  http://localhost:8080/?viewer=PREFIX   shows every sprite sheet whose id starts with PREFIX
// (frames at scale, cell borders, and the anchor point as a green cross).
import { SHEET, IMG } from './assets.js';

export function runViewer(filter = '') {
  document.getElementById('boot').style.display = 'none';
  document.getElementById('wrap').style.display = 'none';
  document.body.style.cssText = 'overflow:auto;background:#1b1626;color:#ddd;font:12px monospace;margin:0';
  const ids = Object.keys(SHEET).filter(id => !filter || filter === '1' || filter.split(',').some(f => id.startsWith(f)));
  const maxW = Math.min(1500, innerWidth - 40);
  const rows = ids.map(id => { const s = SHEET[id]; const sc = Math.max(1, Math.min(4, Math.floor(maxW / (s.n * s.w)))); return { id, s, sc, h: s.h * sc + 16 }; });
  const total = rows.reduce((a, r) => a + r.h + 6, 10);
  const c = document.createElement('canvas'); c.width = maxW + 20; c.height = total; document.body.appendChild(c);
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.font = '12px monospace';
  let y = 8;
  for (const r of rows) {
    const { s, sc, id } = r;
    g.fillStyle = '#d8c89a'; g.fillText(`${id}  (${s.n} x ${s.w}x${s.h})  face=${s.face} ax=${s.ax.toFixed(2)} ay=${s.ay.toFixed(2)}`, 6, y + 10);
    for (let i = 0; i < s.n; i++) {
      const x = 6 + i * s.w * sc, yy = y + 14;
      g.fillStyle = (i % 2) ? '#2a2238' : '#241d30'; g.fillRect(x, yy, s.w * sc, s.h * sc);
      g.drawImage(s.img, i * s.w, 0, s.w, s.h, x, yy, s.w * sc, s.h * sc);
      g.strokeStyle = '#5a4a78'; g.strokeRect(x + 0.5, yy + 0.5, s.w * sc - 1, s.h * sc - 1);
      const ax = x + s.w * s.ax * sc, ay = yy + s.h * s.ay * sc;
      g.strokeStyle = '#3f3'; g.beginPath(); g.moveTo(ax - 5, ay); g.lineTo(ax + 5, ay); g.moveTo(ax, ay - 5); g.lineTo(ax, ay + 5); g.stroke();
    }
    y += r.h + 6;
  }
  window.SHEET = SHEET; window.IMG = IMG;
}
