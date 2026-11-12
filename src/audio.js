// Music (user-supplied tracks listed in music/TRACKLIST.txt) + synthesized sound effects (WebAudio).
// Missing music files are skipped silently, so the game is playable before any track exists.
const EXTS = ['.mp3', '.ogg', '.wav', '.m4a', '.flac', '.opus'];
// A level whose own track has not been made yet plays one of these instead, chosen at random each time (never the same one twice in a row, if there is another).
// The final boss, and a second boss theme, fall back to the ordinary boss track first.  Short stings and the title / intro / ending never fall back.
const GENERAL = ['general_track_1', 'general_track_2', 'general_track_3', 'general_track_4'];
const FALLBACK_FIRST = { boss_final: ['boss'], boss2: ['boss'] };
const isLevelTrack = id => /^(zone\d+|save|boss\w*)$/.test(id);

export const Audio_ = {
  ctx: null, master: null, sfxGain: null, noiseBuf: null,
  settings: { music: 0.7, sfx: 0.8, muted: false, hints: true, cloak: true },     // hints = show boss attack icons + names
  tracks: {},          // id -> { file, type }
  available: null,     // Map (lowercase name -> real name) of the files in music/, when they can be listed (a local server, or music/files.json)
  cur: null, outgoing: [], want: null, failed: new Set(), duck: 1, duckTarget: 1, stingEl: null, lastSfx: {}, unlocked: false, blurred: false,

  async init() {
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem('shadowkeep.audio') || '{}')); } catch {}
    try {
      const txt = await (await fetch('music/TRACKLIST.txt', { cache: 'no-cache' })).text();
      for (const raw of txt.split(/\r?\n/)) {
        const line = raw.trim(); if (!line || line.startsWith('#') || !line.includes('|')) continue;
        const parts = line.split('|').map(s => s.trim()); if (parts.length < 3 || parts[0].toUpperCase() === 'ID' || !/\.\w+$/.test(parts[1])) continue;
        this.tracks[parts[0]] = { file: parts[1], type: (parts[2] || 'LOOP').toUpperCase() };
      }
    } catch (e) { console.warn('TRACKLIST.txt not readable', e); }
    for (const g of GENERAL) this.tracks[g] ||= { file: g + '.mp3', type: 'LOOP' };          // (listed in TRACKLIST.txt too, but the files are found even if the lines are removed)
    // Which music files exist.  A local server can list them live (__music); a plain static host (GitHub Pages) has music/files.json, made by tools/music-manifest.mjs.
    // With neither, the names in TRACKLIST.txt are simply tried, and a file that is not there is skipped.
    const local = /^(localhost|127.|[::1]|::1)/.test(location.hostname);
    for (const src of local ? ['__music', 'music/files.json'] : ['music/files.json']) {
      try { const r = await fetch(src, { cache: 'no-cache' }); if (!r.ok) continue; const names = await r.json(); if (Array.isArray(names)) { this.available = new Map(names.map(s => [s.toLowerCase(), s])); break; } } catch {}
    }
    addEventListener('pointerdown', () => this.unlock()); addEventListener('keydown', () => this.unlock());
  },
  save() { try { localStorage.setItem('shadowkeep.audio', JSON.stringify(this.settings)); } catch {} },

  unlock() {
    if (this.unlocked && this.ctx && this.ctx.state === 'running') return;
    if (!this.ctx) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      this.ctx = new C(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.connect(this.master);
      const len = this.ctx.sampleRate * 2, b = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = b;
    }
    this.ctx.resume(); this.unlocked = true; this.applyVolumes();
    if (this.cur && this.cur.el.paused) this.cur.el.play().catch(() => {});
  },
  // The window lost focus (or the tab was hidden): silence everything.  This is separate from the player's own MUTE setting -
  // music is paused (not just turned down) so it resumes from the same spot, and no new sounds start until focus returns.
  focusLost() {
    if (this.blurred) return; this.blurred = true;
    try { if (this.ctx) this.ctx.suspend(); } catch {}
    for (const o of [this.cur, ...this.outgoing]) if (o) o.el.pause();
    if (this.stingEl) this.stingEl.pause();
  },
  focusGained() {
    if (!this.blurred) return; this.blurred = false;
    try { if (this.ctx && this.unlocked) this.ctx.resume(); } catch {}
    for (const o of [this.cur, ...this.outgoing]) if (o) o.el.play().catch(() => {});
    if (this.stingEl) this.stingEl.play().catch(() => {});
  },
  applyVolumes() { if (this.sfxGain) this.sfxGain.gain.value = this.settings.muted ? 0 : this.settings.sfx; },
  setVolume(kind, v) { this.settings[kind] = Math.max(0, Math.min(1, v)); this.applyVolumes(); this.save(); },
  toggleMute() { this.settings.muted = !this.settings.muted; this.applyVolumes(); this.save(); },

  // ---------------------------------------------------------------- music
  resolve(id) {
    const t = this.tracks[id]; if (!t) return null;
    if (this.available) {
      const base = t.file.replace(/\.\w+$/, '').toLowerCase();
      // try the listed name, then other audio extensions; also tolerate Windows' hidden-extension slip "name.mp3.mp3"
      for (const e of [t.file.match(/\.\w+$/)[0].toLowerCase(), ...EXTS]) for (const f of [base + e, base + e + e]) if (this.available.has(f)) return 'music/' + encodeURIComponent(this.available.get(f));
      return null;
    }
    return this.failed.has(id) ? null : 'music/' + encodeURIComponent(t.file);
  },

  // what actually plays for a track id: its own file, or - for a level / boss track that is missing - a stand-in (see GENERAL).  { real: the track that plays, url } or null.
  pick(id, avoid) {
    const own = this.resolve(id); if (own) return { real: id, url: own };
    if (!isLevelTrack(id)) return null;
    for (const f of FALLBACK_FIRST[id] || []) { const u = this.resolve(f); if (u) return { real: f, url: u }; }
    const have = GENERAL.map(g => ({ real: g, url: this.resolve(g) })).filter(c => c.url); if (!have.length) return null;
    const fresh = have.filter(c => c.real !== avoid); const from = fresh.length ? fresh : have; return from[Math.floor(Math.random() * from.length)];
  },
  play(id, { fade = 1.5 } = {}) {
    if (this.want === id) return; this.want = id;
    const prev = this.cur && this.cur.real;
    if (this.cur) { this.outgoing.push({ ...this.cur, fadeTime: fade }); this.cur = null; }
    const pk = this.pick(id, prev); if (!pk) return;
    const el = new window.Audio(pk.url); el.loop = this.tracks[pk.real].type !== 'STING'; el.preload = 'auto'; el.volume = 0;
    el.addEventListener('error', () => {                                                  // the file would not load: remember it, and look for something else to play
      const first = !this.failed.has(pk.real); this.failed.add(pk.real);
      if (this.cur && this.cur.el === el) { this.cur = null; if (first && this.want === id) { this.want = null; this.play(id, { fade }); } }
    });
    this.cur = { id, real: pk.real, el, vol: 0, fadeTime: fade };
    if (!this.blurred) el.play().catch(() => { /* blocked until first gesture; unlock() retries */ });       // while unfocused it starts when focus returns
  },
  stop(fade = 1.0) { this.want = null; if (this.cur) { this.outgoing.push({ ...this.cur, fadeTime: fade }); this.cur = null; } },
  sting(id) {
    if (this.blurred) return;
    const url = this.resolve(id); if (!url) return;
    const el = new window.Audio(url); el.volume = this.settings.muted ? 0 : this.settings.music; this.stingEl = el;
    this.duckTarget = 0.1; const done = () => { if (this.stingEl === el) { this.duckTarget = 1; this.stingEl = null; } };
    el.addEventListener('ended', done); el.addEventListener('error', done); el.play().catch(done);
  },
  update(dt) {
    const mv = this.settings.muted ? 0 : this.settings.music; this.duck += (this.duckTarget - this.duck) * Math.min(1, dt * 0.08);
    const step = dt / 60;
    if (this.cur) { const c = this.cur; c.vol = Math.min(1, c.vol + step / Math.max(0.05, c.fadeTime)); c.el.volume = Math.max(0, Math.min(1, c.vol * mv * this.duck)); }
    for (let i = this.outgoing.length - 1; i >= 0; i--) {
      const o = this.outgoing[i]; o.vol -= step / Math.max(0.05, o.fadeTime); o.el.volume = Math.max(0, Math.min(1, o.vol * mv));
      if (o.vol <= 0) { o.el.pause(); o.el.removeAttribute('src'); this.outgoing.splice(i, 1); }
    }
    if (this.stingEl) this.stingEl.volume = mv;
  },

  // ---------------------------------------------------------------- synthesized SFX
  _env(g, t0, a, d, v) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); },
  tone(f0, f1, dur, type = 'square', vol = 0.15, delay = 0, pan) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(Math.max(20, f0), t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this._env(g, t, 0.004, dur, vol); o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, f0, f1, vol = 0.2, type = 'bandpass', q = 1, delay = 0) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; s.loop = true; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    this._env(g, t, Math.min(0.02, dur / 3), dur, vol); s.connect(f); f.connect(g); g.connect(this.sfxGain); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  },
  bell(f = 220, vol = 0.18, dur = 2.4, delay = 0) {
    for (const [m, v, d] of [[1, 1, 1], [2.01, 0.5, 0.7], [2.76, 0.4, 0.5], [5.4, 0.2, 0.3]]) this.tone(f * m, f * m * 0.998, dur * d, 'sine', vol * v, delay);
  },
  sfx(name, o = {}) {
    if (!this.ctx || this.ctx.state !== 'running' || this.settings.muted || this.blurred) return;
    const now = performance.now(); const gap = { step: 90, hit: 30, coin: 30 }[name] ?? 24; if (now - (this.lastSfx[name] || 0) < gap) return; this.lastSfx[name] = now;
    const f = this.S[name]; if (f) f.call(this, o);
  },
  S: {
    jump() { this.tone(260, 560, 0.13, 'square', 0.07); },
    djump() { this.tone(420, 960, 0.16, 'triangle', 0.14); this.noise(0.18, 3000, 6000, 0.05, 'highpass', 1); },
    land() { this.noise(0.09, 500, 120, 0.12, 'lowpass', 0.7); },
    step() { this.noise(0.04, 400, 200, 0.03, 'lowpass', 0.7); },
    slash() { this.noise(0.14, 2200, 500, 0.16, 'bandpass', 1.2); this.tone(340, 110, 0.09, 'sawtooth', 0.05); },
    hit() { this.noise(0.1, 1600, 300, 0.2, 'bandpass', 1); this.tone(200, 60, 0.12, 'square', 0.14); },
    block() { this.tone(1000, 420, 0.1, 'square', 0.1); this.noise(0.08, 3600, 1800, 0.14, 'bandpass', 3); },
    hurt() { this.tone(340, 80, 0.3, 'sawtooth', 0.16); this.noise(0.18, 900, 200, 0.18, 'lowpass', 1); },
    kill() { this.noise(0.28, 1800, 160, 0.2, 'lowpass', 1); this.tone(220, 40, 0.3, 'sawtooth', 0.12); },
    coin() { this.tone(988, 988, 0.07, 'square', 0.08); this.tone(1318, 1318, 0.16, 'square', 0.08, 0.06); },
    heal() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.14, 'triangle', 0.12, i * 0.07)); },
    mana() { [392, 523, 659, 784].forEach((f, i) => this.tone(f, f * 1.01, 0.14, 'sine', 0.13, i * 0.07)); },
    item() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, f, 0.2, 'triangle', 0.13, i * 0.08)); this.bell(1047, 0.06, 1.2, 0.3); },
    ability() { [262, 330, 392, 523, 659, 784, 1047, 1319, 1568].forEach((f, i) => { this.tone(f, f * 1.005, 0.5, 'sawtooth', 0.06, i * 0.1); this.tone(f * 2, f * 2, 0.5, 'sine', 0.08, i * 0.1); }); this.noise(1.6, 400, 4000, 0.1, 'bandpass', 0.8, 0.2); },
    door() { this.noise(0.8, 220, 70, 0.3, 'lowpass', 0.8); this.tone(90, 50, 0.7, 'sawtooth', 0.1); },
    seal() { this.tone(90, 400, 0.6, 'sawtooth', 0.12); this.noise(0.6, 300, 3000, 0.12, 'bandpass', 1.5); },
    unseal() { this.tone(500, 80, 0.7, 'sawtooth', 0.1); this.noise(0.7, 3000, 300, 0.1, 'bandpass', 1.5); },
    break() { this.noise(0.4, 1200, 120, 0.3, 'lowpass', 0.8); this.tone(120, 40, 0.3, 'square', 0.14); },
    candle() { this.noise(0.12, 2500, 1200, 0.1, 'bandpass', 2); this.tone(1400, 900, 0.1, 'triangle', 0.07); },
    thunder(o) { const p = o.power || 1; this.noise(2.4, 700, 50, 0.5 * p, 'lowpass', 0.6, 0); this.noise(1.2, 300, 40, 0.4 * p, 'lowpass', 0.6, 0.35); this.tone(60, 28, 1.6, 'sine', 0.3 * p); },
    crack() { this.noise(0.3, 6000, 800, 0.35, 'highpass', 0.8); this.noise(0.5, 900, 80, 0.3, 'lowpass', 0.8, 0.05); },
    fire() { this.noise(0.5, 600, 1800, 0.14, 'bandpass', 0.8); },
    fireball() { this.tone(180, 900, 0.28, 'sawtooth', 0.09); this.noise(0.3, 500, 2500, 0.16, 'bandpass', 1); },
    cast() { this.tone(300, 1300, 0.3, 'sine', 0.14); this.tone(450, 1950, 0.3, 'triangle', 0.07); },
    zap() { this.tone(1500, 160, 0.25, 'sawtooth', 0.12); this.noise(0.25, 5000, 800, 0.2, 'highpass', 1); },
    roar() { this.tone(110, 50, 1.0, 'sawtooth', 0.22); this.tone(165, 70, 1.0, 'square', 0.08); this.noise(1.0, 800, 120, 0.25, 'lowpass', 1); },
    boom() { this.noise(0.6, 260, 40, 0.5, 'lowpass', 0.7); this.tone(80, 28, 0.6, 'sine', 0.5); },
    enchant() { [523, 659, 784, 1047, 1319].forEach((f, i) => { this.tone(f, f * 1.01, 0.22, 'triangle', 0.1, i * 0.05); this.tone(f * 2, f * 2, 0.3, 'sine', 0.05, i * 0.05); }); this.noise(0.6, 800, 5000, 0.08, 'bandpass', 1.2, 0.05); },    // sword imbued
    freeze() { this.tone(1800, 700, 0.18, 'triangle', 0.1); this.tone(2400, 1200, 0.25, 'sine', 0.08, 0.04); this.noise(0.25, 5000, 2500, 0.12, 'highpass', 1); },
    shield() { this.tone(300, 900, 0.3, 'sine', 0.12); this.tone(450, 1350, 0.3, 'triangle', 0.06, 0.04); },
    tell() { this.tone(520, 780, 0.09, 'square', 0.09); this.tone(780, 1040, 0.13, 'square', 0.09, 0.1); },      // boss is about to attack
    click() { this.tone(660, 600, 0.04, 'square', 0.06); },
    select() { this.tone(880, 1320, 0.09, 'square', 0.08); },
    back() { this.tone(500, 300, 0.08, 'square', 0.07); },
    save() { this.bell(523, 0.14, 2.2); this.bell(784, 0.1, 2.2, 0.15); this.bell(1047, 0.08, 2.2, 0.3); },
    toll() { this.bell(147, 0.4, 3.2); this.tone(73, 70, 2.6, 'sine', 0.3); },
    bone() { this.tone(520, 300, 0.07, 'square', 0.06); },
    steam() { this.noise(0.45, 3200, 1800, 0.14, 'highpass', 1); },
    gear() { this.tone(160, 120, 0.06, 'square', 0.07); this.noise(0.05, 1800, 900, 0.07, 'bandpass', 2); },
    dash() { this.noise(0.2, 700, 3200, 0.18, 'bandpass', 1.4); this.tone(200, 700, 0.15, 'sawtooth', 0.05); },
    shriek() { this.tone(900, 1700, 0.7, 'sawtooth', 0.1); this.tone(1350, 2500, 0.7, 'square', 0.05); this.noise(0.7, 2500, 5000, 0.12, 'bandpass', 2); },
    flap() { this.noise(0.06, 500, 250, 0.05, 'bandpass', 1); },
    pickup() { this.tone(660, 990, 0.1, 'triangle', 0.1); },
    levelup() { [392, 494, 587, 784, 988].forEach((f, i) => this.tone(f, f, 0.18, 'square', 0.08, i * 0.07)); },
    ghost() { this.tone(300, 220, 0.5, 'sine', 0.07); this.tone(305, 215, 0.5, 'sine', 0.07); },
    gameover() { this.tone(220, 55, 1.6, 'sawtooth', 0.15); this.noise(1.6, 400, 60, 0.2, 'lowpass', 1); },
  },
};
