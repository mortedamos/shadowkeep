import { loadAll } from './assets.js';

const q = new URLSearchParams(location.search);
const setBar = f => { const b = document.getElementById('barfill'); if (b) b.style.width = Math.round(f * 100) + '%'; };

async function boot() {
  await loadAll(setBar);
  if (q.has('viewer')) { (await import('./viewer.js')).runViewer(q.get('viewer')); return; }
  const game = await import('./game.js');
  await game.start();
  document.getElementById('boot').classList.add('done');
}
boot().catch(e => { console.error(e); const m = document.getElementById('bootmsg'); if (m) m.innerHTML = 'Failed to start:<br><code>' + (e.message || e) + '</code>'; });
