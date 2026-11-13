// Main game: state machine, room loading/transitions, combat resolution, boss flow, rendering.
import { W, H, T, clamp, lerp, rand, overlap, dist } from './util.js';
import { FX, COLORS } from './fx.js';
import { Input } from './input.js';
import { Touch } from './touch.js';
import { loadFonts } from './font.js';
import { Audio_ as A } from './audio.js';
import { ZONES } from './rooms.js';
import { buildWorld, randomSeed, GEN_VERSION } from './levelgen.js';
import { Room, TILE, drawBackground, discoBeams } from './world.js';
import { Player, SPELLS } from './player.js';
import { ENEMY_TYPES } from './enemies.js';
import { BEAST_TYPES } from './beasts.js';
import { randomItemId } from './itemdata.js';
import { BOSS_TYPES, Column } from './bosses.js';
import { MirrorView } from './mirror.js';
import { VillageScene, OpeningScene } from './scenes.js';
import { STORY } from './story.js';
import { Ghost } from './ghost.js';
import { Gears } from './gears.js';
import { KEYS } from './itemdata.js';
import { Projectile, Shockwave, FirePatch } from './projectiles.js';
import { Statue, Barrel, Altar, Waystone, Tablet, Chest, Upgrade, Relic, Pickup, ABILITIES, UPGRADES } from './props.js';
import { drawDeco, isBack, roomFlames, drawFlames2D, decoCoversHazard, drawCurrents } from './decor.js';
import { drawIce } from './enchant.js';
import { drawSheet } from './assets.js';
import { HUD, drawBanner, drawPopups, drawPrompt, drawExitArrow, Dialog, TitleScreen, PauseMenu, MapScreen, IntroCrawl, GameOver, Ending } from './ui.js';

const SAVE_KEY = 'shadowkeep.save.v1';
const DOOR_CLEAR = 200;          // px: no enemy starts within this distance of a door you have just come through (about half a screen)
const FLYERS = new Set(['bat', 'ghost', 'wraith', 'fireskull', 'wyrm', 'frostwyrm', 'emberwyrm']);
const ITEM_IDS = ['g2_hp', 'g2_atk', 'h2_mp', 'h2_hp', 'c1_chest_u', 'u1_hp', 'u2_atk', 't1_mp', 'v2_atk', 'v3_mp', 'g4_mp', 'w1_hp', 'w2_mp', 'w3_atk', 'bu_vb', 'bu_wb', 'got_djump', 'got_dash', 'got_ember', 'got_thunder'];

const newSave = world => ({
  seed: world.seed, room: world.start.room, spawnX: world.start.x * 16 + 8, spawnY: world.start.gy * 16, hp: 60, maxHp: 60, mp: 40, maxMp: 40, atk: 8, level: 1, xp: 0, gold: 0,
  abilities: { djump: false, dash: false, ember: false, thunder: false }, flags: {}, visited: {}, time: 0, kills: 0, v: 1, gv: GEN_VERSION,
  items: { dagger: 6 }, sel: 'dagger',                // carried disposable items (see items.js) and the hotbar selection
});

// the tint of a room's ground fog, by its look (the darkness overlay dims it further in dark rooms)
const FOG_COL = { default: [0.64, 0.7, 0.8], graveyard: [0.66, 0.72, 0.84], swamp: [0.56, 0.7, 0.56], chapel: [0.68, 0.68, 0.88], throne: [0.5, 0.4, 0.6], hall: [0.7, 0.66, 0.6] };

// Monsters get tougher the deeper you go (you keep gaining sword power as you climb): their hit points are multiplied by their zone's number, and so is what they are worth.
// Zone ids are not in story order (6 = the village, the first; 5 = the throne, the last).
const hsl2rgb = h => { const k = h / 60, i = Math.floor(k) % 6, f = k - Math.floor(k); return [[1, f, 0], [1 - f, 1, 0], [0, 1, f], [0, 1 - f, 1], [f, 0, 1], [1, 0, 1 - f]][i]; };          // a full-strength colour from a hue in degrees (the disco lights)
const ZONE_HP = { 6: 1, 1: 1.1, 7: 1.3, 9: 1.5, 2: 1.7, 3: 2.0, 4: 2.4, 8: 2.8, 5: 3.3 };

class Game {
  async init() {
    this.noAutoPause = new URLSearchParams(location.search).has('nopause');
    this.canvas = document.getElementById('game'); this.ctx = this.canvas.getContext('2d'); this.ctx.imageSmoothingEnabled = false; this.K = 3;
    this.topCanvas = document.getElementById('top'); this.top = this.topCanvas.getContext('2d');       // a clear layer above the effects (fog, darkness): the arrows that say 'you can use this' / 'this way out' are drawn here so nothing hides them
    // The game is drawn in 384x216 'logical' pixels onto a K-times larger canvas (so the gothic text can be smooth and crisp);
    // sprites are snapped to the logical grid so pixel art looks exactly as before.
    for (const c of [this.ctx, this.top]) { const di = c.drawImage; c.drawImage = function (img, ...a) { if (a.length === 2 || a.length === 4) { a[0] = Math.round(a[0]); a[1] = Math.round(a[1]); } else if (a.length === 8) { a[4] = Math.round(a[4]); a[5] = Math.round(a[5]); } return di.call(this, img, ...a); }; }
    this.fx = new FX(document.getElementById('fx')); this.fx.onThunder = p => A.sfx('thunder', { power: p });
    Input.init(); Touch.init(this); await A.init(); if (new URLSearchParams(location.search).get('cloak') === '0') A.settings.cloak = false; if (new URLSearchParams(location.search).get('hair') === '0') A.settings.hair = false; await loadFonts(); this.resize(); addEventListener('resize', () => this.resize());
    // Losing focus (clicking another window, switching tabs/apps) mutes all sound and pauses a running game; sound returns when focus does.
    // (`?nopause` in the URL turns this off - handy for automated testing in a background tab.)
    const lose = () => { if (this.noAutoPause) return; A.focusLost(); if (this.state === 'play') this.pause(); };
    const gain = () => { if (this.noAutoPause) return; A.focusGained(); };
    addEventListener('blur', lose); addEventListener('focus', gain);
    document.addEventListener('visibilitychange', () => (document.hidden ? lose() : gain()));
    if ((document.hidden || !document.hasFocus()) && !this.noAutoPause) A.focusLost();      // opened in a background window: start silent until it is focused
    this.state = 'title'; this.frame = 0; this.kills = 0; this.attackCounter = 0; this.hitstop = 0; this.shakeT = 0; this.shakeA = 0; this.slow = 0; this.save = null;
    this.enemies = []; this.projectiles = []; this.pickups = []; this.props = []; this.popups = []; this.flames = []; this.camera = { x: 0, y: 0 };
    this.bannerObj = null; this.dialog = null; this.boss = null; this.cutscene = null; this.trans = null; this.delayed = []; this.fade = 0; this.playerFrozen = false; this.zone = 0; this.room = null;
    this.ghost = new Ghost(this); this.player = new Player(this, 0, 0); this.toTitle(true);
  }

  // -------------------------------------------------------------------------------- sizing / loop
  resize() {
    const gut = Touch.layout();                                                            // (on a phone held sideways the game gives up some width to the on-screen controls)
    let s = Math.min((innerWidth - gut.l - gut.r) / W, gut.h / H); const fl = Math.floor(s); if (fl >= 1 && s - fl < 0.4 && !Input.touchOn) s = fl;                  // (a desktop window snaps down to a whole scale for the crispest pixels; a phone needs every pixel it can get)
    const st = document.getElementById('stage'); st.style.width = Math.floor(W * s) + 'px'; st.style.height = Math.floor(H * s) + 'px';
    const devW = Math.floor(W * s) * (window.devicePixelRatio || 1), K = clamp(Math.ceil(devW / W - 0.02), 2, Input.touchOn ? 3 : 5);                // (a phone gets at most 3x: the sharper canvas is not worth the heat)
    if (K !== this.K || this.canvas.width !== W * K) { this.K = K; this.canvas.width = W * K; this.canvas.height = H * K; }
    if (this.topCanvas.width !== W * K) { this.topCanvas.width = W * K; this.topCanvas.height = H * K; }
    this.canvas.style.imageRendering = Math.abs(devW - W * K) < 1.5 ? 'pixelated' : 'auto';
  }
  run() {
    let last = performance.now(), acc = 0; const STEP = 1000 / 60;
    const loop = now => {
      acc += Math.min(100, now - last); last = now; let n = 0;
      if (this.freeze) acc = 0;                                           // test hook: game.freeze = true holds the current frame
      while (acc >= STEP && n < 5) { this.step(); acc -= STEP; n++; } if (n === 5) acc = 0;
      this.draw(); requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // -------------------------------------------------------------------------------- helpers used by entities
  popup(x, y, text, color = '#fff') { this.popups.push({ x, y, text, color, life: 55 }); }
  banner(title, sub = '', dur = 190, o = {}) { this.bannerObj = { title, sub, t: 0, dur, ...o }; }
  shake(a, frames) { this.shakeA = Math.max(this.shakeA, a); this.shakeT = Math.max(this.shakeT, frames); }
  addProjectile(p) { this.projectiles.push(p); return p; }
  after(frames, fn) { this.delayed.push({ t: frames, fn }); }
  showDialog(text, o) { this.dialog = new Dialog(text, o); this.state = 'dialog'; }
  // a short exchange of words: lines = [[speaker, text], ...], each in a box of its own; done() runs when the last box is closed
  talk(lines, done) {
    const next = i => { if (i >= lines.length) { if (done) done(); return; } const [who, text] = lines[i]; this.showDialog(text, { name: who, onClose: () => next(i + 1) }); };
    next(0);
  }
  itemPercent() { const f = this.save.flags; return Math.round(ITEM_IDS.filter(k => f[k]).length / ITEM_IDS.length * 100); }
  spawnEnemy(type, tx, gy, o = {}) {
    const C = ENEMY_TYPES[type] || BEAST_TYPES[type] || BOSS_TYPES[type]; if (!C) { console.warn('unknown enemy', type); return null; }
    const x = tx * 16 + 8, y = FLYERS.has(type) || type === 'boss_angel' || type === 'boss_shadow' || type === 'boss_bramble' ? gy * 16 + 8 : gy * 16;
    const e = new C(this, x, y, o);
    const m = !e.isBoss && !e.talk && !e.calm ? ZONE_HP[this.room && this.room.zone] || 1 : 1; if (m !== 1) { e.hp = e.maxHp = Math.round(e.maxHp * m); e.xp = Math.max(1, Math.round(e.xp * Math.sqrt(m))); }
    this.enemies.push(e); return e;
  }

  // -------------------------------------------------------------------------------- save / load
  hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } }
  saveGame() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch (e) { console.warn('save failed', e); } }
  loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.v === 1) return s; } catch {} return null; }

  // -------------------------------------------------------------------------------- state changes
  toTitle(first = false) {
    this.state = 'title'; this.save = null; this.boss = null; this.cutscene = null; this.playerFrozen = false; this.trans = null; this.room = null; this.title = new TitleScreen(this);
    A.setIndoor(false, true); this.fx.reset(); this.fx.setAmbient(0.0, [0, 0, 0], 0.5); this.fx.setAmbientFx('rain'); this.fx.setStorm(true, 0.004); this.fx.setCamera(0, 0); this.fx.setShake(0, 0); A.play('title', { fade: 1.5 });
  }
  newGame(seed) {
    if (seed === undefined) { const q = new URLSearchParams(location.search).get('seed'); seed = q !== null && /^d{1,9}$/.test(q) ? +q : randomSeed(); }
    this.world = buildWorld(seed); this.save = newSave(this.world); this.kills = 0; this.player = new Player(this, 0, 0); this.fx.setStorm(false); this.beginPlay(false); }          // (a new game begins on the hill above Prague: see checkOpening)
  continueGame() {
    const s = this.loadSave(); if (!s) return; this.useSave(s); this.kills = 0; this.player = new Player(this, 0, 0); this.beginPlay(true);
  }
  beginPlay(cont = false) {
    const S = this.save; this.state = 'play'; this.slow = 0; this.cutscene = null;
    this.loadRoom(S.room, { x: S.spawnX, y: S.spawnY }, 1); S.hp = cont ? S.hp : S.hp; this.fade = 1; this.fadeDir = -1;
  }
  respawn() { // after death: back to the last save
    const s = this.loadSave(); if (s) this.useSave(s); else { this.save = newSave(this.world); this.save.flags.opening_seen = true; } this.player = new Player(this, 0, 0); this.boss = null; this.slow = 0; this.save.hp = this.save.maxHp; this.save.mp = this.save.maxMp; this.beginPlay(true);
  }
  useSave(s) { s.items ||= {}; delete s.items.caltrops; if (s.sel === 'caltrops') s.sel = 'dagger'; this.save = s; this.world = buildWorld(s.seed || 0);
    if (s.gv !== GEN_VERSION || !this.world.rooms[s.room]) { s.gv = GEN_VERSION; s.room = this.world.start.room; s.spawnX = this.world.start.x * 16 + 8; s.spawnY = this.world.start.gy * 16; s.visited = {}; s.flags.opening_seen = true; }          // (a save made before the castle's layout last changed: the rooms are not where they were, so the hero wakes at the start with everything they carry; the maps fill in again)
  }                       // (caltrops were removed from the game)
  pause() { this.state = 'pause'; this.pauseMenu = new PauseMenu(this); A.sfx('select'); }
  resume() { if (this.state === 'pause' || this.state === 'map') { this.state = 'play'; A.sfx('back'); } }
  openMap(o = {}) { this.state = 'map'; this.mapScreen = new MapScreen(this, o); A.sfx('select'); }
  // waystone travel: appear beside the destination's stone (the room you wake in is NOT a save point - altars still are)
  teleportTo(id) {
    const def = this.world.rooms[id], w = def && def.spawns.find(s => s.type === 'waystone'); if (!w) return;
    this.state = 'play'; A.sfx('ability'); this.fx.flash([0.45, 0.85, 1], 0.5); this.fx.burst(this.player.x, this.player.y - 16, 18, COLORS.blue, { speed: 2 });
    this.changeRoom({ room: id, x: w.x * 16 + 8 + 34, y: w.y * 16 }, -1);
  }
  onPlayerDeath() { A.stop(0.8); this.slow = 90; this.boss && (this.boss.harmless = true); this.after(95, () => { this.state = 'dead'; this.gameOver = new GameOver(this); this.slow = 0; }); }

  // -------------------------------------------------------------------------------- rooms
  loadRoom(id, pos, dir = 1) {
    const def = this.world.rooms[id], S = this.save, tiles = Uint8Array.from(def.tiles);
    for (let ty = 0; ty < def.h; ty++) for (let tx = 0; tx < def.w; tx++) { const v = tiles[ty * def.w + tx]; if ((v === 4 || v === 5 || v === 6) && S.flags[`b_${id}_${tx}_${ty}`]) tiles[ty * def.w + tx] = 0; }
    const prevZone = this.zone; this.room = new Room({ ...def, tiles }); this.room.flags = S.flags; this.room.ignited = new Set(); if (S.flags.boss_vb) S.flags.village_fire = true; S.visited[id] = true; this.zone = def.zone;          // (the room can see the save's flags: scenery such as the sigils over a locked door reads them)
    { const spk = []; for (let ty = 0; ty < def.h; ty++) for (let tx = 0; tx < def.w; tx++) if (tiles[ty * def.w + tx] === TILE.SPIKE) spk.push([tx, ty]); if (spk.length) this.room.decos = def.decos.filter(d => !decoCoversHazard(d, spk)); }          // nothing may stand in front of a hazard
    this.enemies = []; this.projectiles = []; this.pickups = []; this.props = []; this.popups = []; this.boss = null; this.delayed = []; this.fx.reset(); this.fx.setWisps(def.wisps || 0); this.flames = roomFlames(this.room); this.falls = this.room.decos.filter(d => d.t === 'waterfall'); this.mirrorView = def.mirror ? new MirrorView(def.mirror, !!S.flags['boss_' + id]) : null;          // (the Mirror Room: a great mirror - whole until you walk up to it)
    const dusk = def.zone === 6 && !S.flags.village_fire && !def.keepLook;          // Prague before the Cinder Warden's torches: a calm violet dusk, with golden dust in the air - the monsters are loose, but nothing burns yet
    this.fx.setAmbient(dusk ? Math.max(def.ambient, 0.42) : def.ambient, dusk ? [0.05, 0.03, 0.12] : def.tint, def.vig); this.fx.setAmbientFx(dusk ? 'dust' : def.weather); A.setIndoor(def.indoor); this.fx.setStorm(def.storm, 0.0035);
    this.fx.setFog(def.fog * (def.theme === 'swamp' ? 0.8 : 1), def.horizon + 4, FOG_COL[def.theme] || FOG_COL.default, def.fogH);          // rolling ground fog in the damp, dead places
    this.room.gears = def.gears ? new Gears(def.gears) : null; this.player.ride = null; this.vents = this.room.decos.filter(d => d.t === 'img' && d.img === 'sp_vent'); this.graves = this.room.decos.filter(d => d.t === 'grave'); this.ghost.snap();
    if (def.disco) { this.room.discoState = { mode: S.flags.disco_done ? 'gone' : 'party', t0: 0 }; A.preload('record_scratch'); }
    const bossDone = !!S.flags['boss_' + id];
    for (let si = 0; si < def.spawns.length; si++) {
      const s = def.spawns[si], o = s.o || {}, x = s.x * 16 + 8, y = s.y * 16;
      if (s.type === 'statue') this.props.push(new Statue(x, y, o));
      else if (s.type === 'altar') this.props.push(new Altar(x, y));
      else if (s.type === 'barrel') this.props.push(new Barrel(x, y, o));
      else if (s.type === 'waystone') this.props.push(new Waystone(x, y, { id: 'tp_' + id }));
      else if (s.type === 'itemspawn') { if (!S.flags[o.id]) { const pk = new Pickup('it_' + o.item, x, y - 6, 0, 0); pk.qty = o.qty || pk.qty; pk.flagId = o.id; pk.life = 1e9; this.pickups.push(pk); } }
      else if (s.type === 'tablet') this.props.push(new Tablet(x, y, o));
      else if (s.type === 'chest') { const c = new Chest(x, y, o); if (S.flags[o.id]) { c.open = true; if (!S.flags[o.id + '_u']) this.props.push(new Upgrade(x, y - 22, { kind: o.contents, id: o.id + '_u' })); } this.props.push(c); }
      else if (s.type === 'upgrade') { if (!S.flags[o.id]) this.props.push(new Upgrade(x, y - 12 + 0, o)); }
      else if (s.type.startsWith('boss_')) {
        if (bossDone) { if (UPGRADES[o.reward]) { if (!S.flags['bu_' + id]) this.props.push(new Upgrade(this.roomCenterX(def), this.groundBelow(this.roomCenterX(def), 6 * 16) - 12, { kind: o.reward, id: 'bu_' + id })); }
          else if (o.reward && o.reward !== 'dawn' && !S.abilities[this.rewardKey(o.reward)]) this.props.push(new Relic(this.roomCenterX(def), this.groundBelow(this.roomCenterX(def), 6 * 16), o.reward === 'djump' ? 'djump' : o.reward)); }
        else { const b = this.spawnEnemy(s.type, s.x, s.y, o); b.reward = o.reward; this.pendingBoss = b; }
      } else {
        const e = this.spawnEnemy(s.type, s.x, s.y, s.type === 'villager' ? { ...o, uid: id + '#' + si } : o);
        if (e && pos.door && s.type !== 'villager' && Math.hypot(e.x - pos.x, e.y - pos.y) < DOOR_CLEAR) this.enemies.splice(this.enemies.indexOf(e), 1);          // coming out of a door: nothing waits for you on the other side (measured from where it really stands)
      }
    }
    // player
    const dirp = pos.dir || dir; this.player.place(pos.x, pos.y, dirp); this.player.invT = Math.max(this.player.invT, 40);
    this.snapCamera();
    // music + banners
    const zm = ZONES[def.zone].music, mus = def.boss ? zm : def.music;
    if (def.disco && S.flags.disco_done) A.stop(0.4); else A.play(mus, { fade: 1.2 });          // (the empty disco is silent)
    if (def.zone !== prevZone && !def.save) this.banner(ZONES[def.zone].name.toUpperCase(), def.name.toUpperCase(), 200, { y: 52 });
    else this.banner(def.name.toUpperCase(), '', 130, { y: 52, color: '#cfc2a0' });
    if (bossDone && def.seals.length) { /* arena stays open */ }
  }
  rewardKey(r) { return r; }
  roomCenterX(def) { return def.w * 8; }
  groundBelow(x, y0) { const r = this.room; let ty = Math.floor(y0 / T); while (ty < r.h && !r.solid(Math.floor(x / T), ty)) ty++; return ty * T; }

  changeRoom(target, dir) {
    if (this.trans) return; this.trans = { phase: 'out', t: 0, target, dir };
  }
  updateTrans() {
    const tr = this.trans; if (!tr) return; tr.t++;
    if (tr.phase === 'out') { this.fade = Math.min(1, tr.t / 14); if (tr.t >= 16) { const tg = tr.target; this.loadRoom(tg.room, { x: tg.x, y: tg.y, door: tg.door }, tr.dir); tr.phase = 'in'; tr.t = 0; } }
    else { this.fade = Math.max(0, 1 - tr.t / 16); if (tr.t >= 16) { this.trans = null; this.fade = 0; } }
  }
  checkExits() {
    const p = this.player, r = this.room; if (this.trans || p.dead) return;
    const row = Math.floor((p.y - 12) / T);
    if (p.x < 3) { const e = r.exitRows.L[row]; if (e && p.vx <= 0) this.changeRoom({ room: e.room, x: e.tx * 16 + 8, y: e.gy * 16 }, -1); }
    else if (p.x > r.pw - 3) { const e = r.exitRows.R[row]; if (e && p.vx >= 0) this.changeRoom({ room: e.room, x: e.tx * 16 + 8, y: e.gy * 16 }, 1); }
    if (p.y > r.ph + 48 && !p.dead) { p.hurt(10, p.x, { kb: 0 }); this.respawnAtSafe(p); }
  }
  respawnAtSafe(p) { this.after(0, () => { p.x = p.lastSafe.x; p.y = p.lastSafe.y; p.vx = p.vy = 0; p.invT = 90; this.fx.flash([0.6, 0.4, 1], 0.3); this.fx.burst(p.x, p.y - 16, 10, COLORS.purple, { speed: 1.5 }); }); }

  // -------------------------------------------------------------------------------- interaction
  nearInteractable() {
    const p = this.player, pb = { x: p.x - 14, y: p.y - 40, w: 28, h: 44 };
    for (const o of this.props) if (o.interact && !o.dead && overlap(pb, o.box) && !(o.open === true)) return { kind: 'prop', o, x: o.x, y: o.y - (o.box.h + 8) };
    if (!(this.boss && this.boss.active && !this.boss.dying)) for (const d of this.room.doors) if (Math.abs(p.x - (d.x * 16 + 8)) < 14 && Math.abs(p.y - d.gy * 16) < 10) return { kind: 'door', d, x: d.x * 16 + 8, y: d.gy * 16 - 54 };
    for (const e of this.enemies) if (e.talk && !e.dead && Math.abs(p.x - e.x) < 26 && Math.abs(p.y - e.y) < 24) return { kind: 'npc', e, x: e.x, y: e.y - 58 };            // people you can talk to
    return null;
  }
  interact() {
    const n = this.nearInteractable(); if (!n) return false;
    if (n.kind === 'prop') return n.o.interact(this);
    if (n.kind === 'npc') { n.e.talk(this); return true; }
    if (n.d.key && !this.save.flags['unlocked_' + n.d.key]) {          // a locked door: it opens (for good) if you carry its key
      const K = KEYS.find(k => k.id === n.d.key);
      if (!this.save.flags['has_' + n.d.key]) { A.sfx('back'); this.showDialog('THE DOOR IS LOCKED. IT NEEDS THE ' + (K ? K.name : 'KEY') + '.'); return true; }
      this.save.flags['unlocked_' + n.d.key] = true; A.sfx('door'); this.fx.burst(n.d.x * 16 + 8, n.d.gy * 16 - 22, 12, K ? [K.rgb.map(v => v / 255), [1, 1, 0.9]] : COLORS.gold, { speed: 1.6 }); this.banner('UNLOCKED', K ? K.name + ' USED' : '', 110, { y: 52, color: '#ffe9a0' });
    }
    if (n.d.lock) {                                          // a door sealed until bosses fall: one sigil for each
      const left = n.d.lock.filter(f => !this.save.flags[f]);
      if (left.length) { A.sfx('back'); this.showDialog('THE DOOR WILL NOT OPEN. ' + (n.d.lock.length - left.length) + ' OF ' + n.d.lock.length + ' SIGILS BURN. ' + (n.d.lockText || '')); return true; }
    }
    A.sfx('door'); this.changeRoom({ room: n.d.room, x: n.d.tx * 16 + 8, y: n.d.tgy * 16, door: true }, 1); return true;
  }

  // -------------------------------------------------------------------------------- combat resolution
  // the Tide Blade: a dash cuts through whatever it passes through (each foe once per dash)
  dashHit(p) {
    const box = { x: p.x - 16, y: p.y - 38, w: 32, h: 38 }; let hit = false;
    for (const e of this.enemies) {
      if (e.dead || e.calm || e.talk || !e.hitBy(box)) continue;
      if (e.hurt(Math.round(p.swordDamage() * 0.9) + 2, p.dir, { id: p.dashAtkId, kb: 1.5 })) { hit = true; this.fx.sparks(e.x, e.cy, 6, [[0.55, 0.88, 1], [0.2, 0.5, 1]], 3, {}); this.fx.ring(e.x, e.cy, 26, [0.5, 0.85, 1], 12, 0.2); }
    }
    if (hit && !p.dashHitDone) { p.dashHitDone = true; this.hitstop = 2; A.sfx('hit'); }
    if (p.t % 2 === 0) this.fx.burst(p.x - p.dir * 8, p.y - 14, 2, [[0.6, 0.88, 1], [0.3, 0.55, 1]], { speed: 0.8, s0: 8, s1: 2, l0: 10, l1: 18 });
  }
  // the Mirror Shard: an enemy's arrow, bone, orb or thrown item is sent back (at the nearest foe in front, else straight back), faster, and now it hurts them
  reflectable(pr) { return pr.owner === 'enemy' && !pr.reflected && typeof pr.vx === 'number' && typeof pr.vy === 'number' && !(pr instanceof Column) && !(pr instanceof Shockwave) && !(pr instanceof FirePatch) && pr.kind !== 'wisp'; }
  reflect(pr, p) {
    const sp = Math.max(2.6, Math.hypot(pr.vx, pr.vy) * 1.25); let ang = Math.atan2(-pr.vy, -pr.vx), best = 1e9;
    for (const e of this.enemies) { if (e.dead || e.calm || e.talk) continue; const dx = e.x - pr.x, dy = e.cy - pr.y, d = Math.hypot(dx, dy); if (d < 280 && d < best && Math.sign(dx || 1) === p.dir) { best = d; ang = Math.atan2(dy, dx); } }
    pr.owner = 'player'; pr.reflected = true; pr.vx = Math.cos(ang) * sp; pr.vy = Math.sin(ang) * sp; pr.grav = 0; pr.pierce = false; pr.life = Math.max(pr.life || 0, 140); pr.dmg = Math.max(pr.dmg || 6, Math.round(p.swordDamage() * 0.8)) + 2;
    A.sfx('block'); this.fx.ring(pr.x, pr.y, 22, [0.8, 0.9, 1], 12, 0.25); this.fx.sparks(pr.x, pr.y, 8, [[1, 1, 1], [0.7, 0.85, 1]], 3, {}); this.popup(pr.x, pr.y - 12, 'REFLECTED', '#cfe2ff');
  }
  swordHit(p) {
    const box = p.attackBox(), dir = p.dir; let hit = false;
    for (const e of this.enemies) {
      if (e.dead || !e.hitBy(box)) continue;
      if (e.hurt(p.swordDamage(), dir, { id: p.atkId, kb: p.seq.kb })) {
        hit = true; p.gainMp(1.2); this.fx.sparks(e.x, e.cy, 4, COLORS.white, 3, { dir: dir > 0 ? 0 : Math.PI, spread: 0.6 });
        if (!e.dead) p.onSwordHit(e);                          // enchantment procs: freeze / shield
        else if (p.ench && p.ench.type === 'aegis' && p.ench.shield <= 0 && Math.random() < 0.35) p.raiseShield();
      }
    }
    for (const o of this.props) if (o.hit && !o.dead && overlap(box, o.box)) { if (o.hit(this, p.swordDamage(), dir)) { hit = true; p.gainMp(2); } }
    // breakable walls
    const tx0 = Math.floor(box.x / T), tx1 = Math.floor((box.x + box.w) / T), ty0 = Math.floor(box.y / T), ty1 = Math.floor((box.y + box.h) / T);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (this.room.get(tx, ty) === TILE.CRACK) { this.breakTile(tx, ty); hit = true; }
    for (const pr of this.projectiles) {
      if (pr.dead || pr.reflected || !overlap(box, pr.box)) continue;          // (a reflected one is already on its way: the rest of the swing must not cut it down)
      if (this.save.flags.got_shard && this.reflectable(pr)) { this.reflect(pr, p); hit = true; continue; }          // the Mirror Shard: it goes back where it came from
      if (pr.k && (pr.kind === 'bone' || pr.kind === 'ember' || pr.destructible)) { pr.explode(this); hit = true; }
    }
    if (hit && p.hitsThisSwing++ === 0) { this.hitstop = 3; this.shake(1.5, 5); }
  }
  breakTile(tx, ty) {
    const r = this.room, v = r.get(tx, ty); if (v !== TILE.CRACK && v !== TILE.BARRICADE && v !== TILE.CRYSTAL) return;
    r.set(tx, ty, TILE.EMPTY); this.save.flags[`b_${r.id}_${tx}_${ty}`] = true; const x = tx * 16 + 8, y = ty * 16 + 8;
    if (v === TILE.CRACK) { this.fx.burst(x, y, 10, [[0.7, 0.65, 0.8], [0.3, 0.28, 0.4]], { speed: 2, s0: 12, up: -0.5, gy: 0.05 }); this.fx.sparks(x, y, 8, [[0.8, 0.8, 0.9], [0.4, 0.4, 0.5]], 2.5, { gy: 0.2 }); }
    else if (v === TILE.BARRICADE) { this.fx.burst(x, y, 14, COLORS.fire, { speed: 2, s0: 16 }); this.fx.sparks(x, y, 10, COLORS.fire, 3, { gy: 0.15 }); this.fx.glow(x, y, 50, [1, 0.5, 0.2], 0.8, 14); }
    else { this.fx.burst(x, y, 12, COLORS.ice, { speed: 2.5, s0: 14 }); this.fx.sparks(x, y, 14, COLORS.white, 4, { gy: 0.2 }); this.fx.flash([0.6, 0.8, 1], 0.25); }
    A.sfx('break'); this.shake(2, 8);
  }
  burnBarricade(tx, ty) { const q = [[tx, ty]], seen = new Set(); while (q.length) { const [x, y] = q.pop(), k = x + ',' + y; if (seen.has(k) || this.room.get(x, y) !== TILE.BARRICADE) continue; seen.add(k); this.breakTile(x, y); q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]); } }
  castThunder(p) {
    const S = this.save, dmg = 20 + Math.round(p.atkPower * 1.3), cam = this.camera;
    const targets = this.enemies.filter(e => !e.dead && !e.invuln && e.x > cam.x - 20 && e.x < cam.x + W + 20 && e.cy > cam.y - 10 && e.cy < cam.y + H + 10).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x)).slice(0, 4);
    A.sfx('crack'); A.sfx('thunder', { power: 0.6 }); this.fx.flash([0.7, 0.85, 1], 0.55); this.shake(4, 14);
    const id = -(++this.attackCounter);
    targets.forEach((e, i) => this.after(i * 5, () => { if (e.dead) return; this.fx.bolt(e.x + rand(-5, 5), cam.y - 20, e.x, e.cy, { width: 18, life: 24 }); e.hurt(dmg, p.dir, { id: id - i * 1000, color: '#9cf', kb: 1 }); }));
    if (!targets.length) this.fx.bolt(p.x + p.dir * 90, cam.y - 20, p.x + p.dir * 90, p.y - 2, { width: 18, life: 24 });
    // crystals within reach
    const r = this.room, px = Math.floor(p.x / T), py = Math.floor((p.y - 16) / T);
    for (let ty = py - 5; ty <= py + 5; ty++) for (let tx = px - 11; tx <= px + 11; tx++) if (r.get(tx, ty) === TILE.CRYSTAL) { this.fx.bolt(tx * 16 + 8, cam.y - 20, tx * 16 + 8, ty * 16 + 8, { width: 16, life: 20, impact: false }); this.after(6, () => this.breakTile(tx, ty)); }
  }
  // the barrier that shuts you in with a boss: a wall of spectral blue flame (its tiles are solid; the flames are the effects layer's)
  sealFlames() {
    const r = this.room, cam = this.camera, fx = this.fx; if (!r || !r.anim || !r.anim.length) return;
    for (const [tx, ty, v] of r.anim) {
      if (v !== TILE.SEAL) continue; const x = tx * T + 8; if (x < cam.x - 24 || x > cam.x + W + 24) continue; const y = ty * T + 16;
      fx.fire(x, y, { scale: 1.3, color: 'blue', n: 2 }); fx.glow(x, y - 8, 30, [0.35, 0.6, 1], 0.3); fx.light(x, y - 8, 58, 0.55, [0.4, 0.6, 1]);
      if (this.frame % 4 === 0) fx.emit({ x: x + rand(-4, 4), y: y - 12, vx: rand(-0.25, 0.25), vy: -rand(0.6, 1.2), life: rand(26, 46), s0: 9, s1: 2, c0: [0.7, 0.88, 1], c1: [0.2, 0.35, 1], a0: 0.9, a1: 0, kind: 2 });
    }
  }
  updateProjectiles() {
    const p = this.player;
    for (const pr of this.projectiles) {
      pr.update(this); if (pr.dead) continue;
      if (pr instanceof Column) continue;
      const box = pr.box;
      if (pr.owner === 'player') {
        for (const e of this.enemies) if (!e.dead && e.hitBy(box)) { if (e.hurt(pr.dmg, pr.vx >= 0 ? 1 : -1, { id: -(this.attackCounter + 5000 + Math.floor(Math.random() * 1e6)), color: '#ffb060', kb: 1.4 })) { pr.explode(this); break; } }
        for (const o of this.props) if (o.hit && !o.dead && overlap(box, o.box)) { o.hit(this, pr.dmg, 1); pr.explode(this); break; }
      } else if (!p.dead && overlap(box, p.hurtbox)) {
        if (p.hurt(pr.dmg, pr.x, { kb: pr instanceof FirePatch ? 1 : 2 })) { if (!(pr instanceof Shockwave) && !(pr instanceof FirePatch) && !pr.pierce) pr.explode ? pr.explode(this) : (pr.dead = true); }
      }
    }
    this.projectiles = this.projectiles.filter(p => !p.dead);
  }

  // -------------------------------------------------------------------------------- bosses
  startBoss(b) {
    const def = this.room, S = this.save; this.boss = b; HUD.lagBoss = 1;
    for (const s of def.seals) for (let y = s.y0; y <= s.y1; y++) if (def.get(s.x, y) === TILE.EMPTY) def.set(s.x, y, TILE.SEAL);
    A.sfx('seal'); this.fx.flash([0.6, 0.4, 1], 0.3); this.shake(3, 20);
    A.play(def.id === 't2' ? 'boss_final' : 'boss', { fade: 0.4 }); this.banner(b.bossName, b.sub, 210, { y: 60, color: '#ff9a7a' });
    const tk = STORY.talk[b.bossName]; if (tk && !S.flags["talk_" + b.bossName]) { S.flags["talk_" + b.bossName] = true; this.talk(tk.before); }          // a few words before the fight (once)
  }
  bossDying(b) {
    this.slow = 150; A.stop(1.5); this.player.invT = 999; this.fx.flash([1, 1, 1], 0.5);
    for (const pr of this.projectiles) pr.dead = true; for (const e of this.enemies) if (!e.isBoss && !e.dead) e.die();
  }
  bossDefeated(b) {
    const S = this.save, r = this.room; S.flags['boss_' + r.id] = true; this.slow = 0; this.player.invT = 90; this.boss = null;
    for (let ty = 0; ty < r.h; ty++) for (let tx = 0; tx < r.w; tx++) if (r.get(tx, ty) === TILE.SEAL) r.set(tx, ty, TILE.EMPTY);
    A.sfx('unseal'); A.sting('sting_victory'); this.shake(5, 30);
    if (b.reward === 'dawn') { const toEnding = () => { this.state = 'ending'; this.ending = new Ending(this); A.play('ending', { fade: 2 }); this.fx.setAmbient(0, [0, 0, 0], 0); this.fx.setStorm(false); this.fx.setAmbientFx('dust'); S.kills = (S.kills || 0) + this.kills; }; const tk = STORY.talk[b.bossName]; this.after(120, () => { if (tk && tk.after) this.talk(tk.after, toEnding); else toEnding(); }); return; }          // (his dying words, then the sun)
    const gy = this.groundBelow(b.x, b.y - 8);
    if (UPGRADES[b.reward]) this.props.push(new Upgrade(b.x, gy - 12, { kind: b.reward, id: 'bu_' + r.id })); else this.props.push(new Relic(b.x, gy, b.reward));
    for (const [kind, dx] of [['it_bandage', -26], ['it_' + randomItemId(), 26], ['it_dagger', 38]]) this.pickups.push(new Pickup(kind, b.x + dx, b.cy - 20));       // a boss leaves supplies behind
    { const tk = STORY.talk[b.bossName]; if (tk && tk.after) this.after(110, () => { if (this.state === "play") this.talk(tk.after); }); }          // and a few more as it dies
    this.after(420, () => { if (this.state === 'play' && !this.boss) A.play(ZONES[r.zone].music, { fade: 2 }); });
  }
  gainAbility(kind, x, y) {
    const S = this.save, a = ABILITIES[kind]; S.abilities[kind] = true; S.flags['got_' + kind] = true; this.cutscene = { t: 0, kind, x, y }; this.playerFrozen = true; this.player.invT = 999;
    A.sfx('ability'); A.sting('sting_ability'); A.play(ZONES[this.room.zone].music, { fade: 0.2 });
    this.fx.flash(a.color, 0.9); this.fx.ring(x, y, 150, a.color, 60, 0.1); this.fx.quad({ kind: 'rays', x, y, w: 300, h: 300, color: a.color, life: 150, spin: 0.02, p: [0, 10], a0: 0.8, a1: 0 }); this.fx.sparks(x, y, 40, [[1, 1, 0.9], a.color], 5, { gy: -0.02 });
    this.banner(a.name, Input.hint(a.desc), 330, { y: 70, color: '#ffe9a0' });
    if (kind === 'ember' || kind === 'thunder') { this.player.spell = kind; }
  }
  // the disco: while the party lasts, coloured pools of light sweep the floor; when the hero reaches the middle of the room the music dies
  discoStep() {
    const r = this.room, st = r && r.discoState; if (!st || st.mode === 'gone') return;
    const p = this.player, t = this.frame;
    for (const b of discoBeams(r, t)) { const rgb = b.white ? [1, 1, 1] : hsl2rgb(b.hue); this.fx.light(b.tx, r.horizon - 6, 70, b.white ? 0.9 : 0.75, rgb); }
    if (st.mode === 'party' && !p.dead && p.x > r.pw / 2) this.discoStop();
  }
  discoStop() {
    const r = this.room, st = r.discoState; st.mode = 'stopped'; st.t0 = this.frame; this.save.flags.disco_done = true;
    A.stop(0.02); A.sample('record_scratch'); this.fx.flash([1, 1, 1], 0.2); this.shake(2, 8); this.saveGame();
  }
  // the story begins on a hill above Prague: the Stranger kneels at a grave and watches the city catch fire (scenes.js OpeningScene).  Played once.
  checkOpening() {
    const r = this.room, S = this.save; if (this.cutscene || this.trans || this.state !== 'play' || !r || r.id !== 'v0' || S.flags.opening_seen) return;
    this.cutscene = { scene: new OpeningScene(this) };
  }
  // the Cinder Warden sets Prague alight: once, as you reach the east end of Market Street
  checkVillageScene() {
    const r = this.room, p = this.player, S = this.save;
    if (this.cutscene || this.trans || this.state !== 'play' || !r || r.id !== 'v1' || S.flags.village_fire || S.flags.boss_vb || p.dead || !p.onGround || this.fade > 0.1) return;
    if (p.x > r.pw - 12 * T) this.cutscene = { scene: new VillageScene(this) };
  }
  updateCutscene() {
    const c = this.cutscene; if (c.scene) { c.scene.update(); return; } c.t++; this.fx.glow(c.x, c.y, 70 + Math.sin(c.t * 0.2) * 8, ABILITIES[c.kind].color, 0.6); this.fx.light(this.player.x, this.player.y - 20, 120, 1);
    if (c.t % 4 === 0) this.fx.souls(this.player.x, this.player.y - 16, 1, COLORS.gold);
    if (c.t > 260) { this.cutscene = null; this.playerFrozen = false; this.player.invT = 60; this.saveGame(); }
  }

  // -------------------------------------------------------------------------------- logic step
  step() {
    this.frame++; Input.poll(); Touch.sync(this); A.update(1);
    if (Input.pressed.mute) A.toggleMute();
    for (let i = this.delayed.length - 1; i >= 0; i--) { const d = this.delayed[i]; if (--d.t <= 0) { this.delayed.splice(i, 1); d.fn(); } }
    switch (this.state) {
      case 'title': this.title.update(); this.titleFx(); this.fx.update(1); break;
      case 'intro': this.intro.update(); this.fx.update(1); break;
      case 'play': this.stepPlay(); break;
      case 'dialog': this.dialog.update(); if (this.dialog.closed) { const dlg = this.dialog, cb = dlg.onClose; this.state = 'play'; this.dialog = null; if (cb) cb(dlg.choice); } this.fx.update(0.0); break;
      case 'pause': this.pauseMenu.update(); break;
      case 'map': this.mapScreen.update(); break;
      case 'dead': this.gameOver.update(); this.fx.update(1); break;
      case 'ending': this.ending.update(); this.fx.update(1); break;
    }
    this.updateTrans(); if (this.fadeDir && !this.trans) { this.fade = clamp(this.fade + this.fadeDir * 0.04, 0, 1); if (this.fade <= 0 || this.fade >= 1) this.fadeDir = 0; }
  }
  titleFx() {
    const fx = this.fx; fx.setCamera(0, 0);
    for (const x of [46, W - 46]) { fx.fire(x, H - 30, { scale: 1.5, n: 2 }); fx.light(x, H - 40, 90, 1); }
  }
  stepPlay() {
    const S = this.save, p = this.player, fx = this.fx;
    if (this.hitstop > 0) { this.hitstop--; fx.update(0.5); return; }
    if (this.slow && (this.frame & 1)) { fx.update(0.5); return; }
    if (this.trans && this.trans.phase === 'out') { fx.update(1); return; }
    if (Input.pressed.pause && !this.cutscene && !p.dead) { this.pause(); return; }
    if (Input.pressed.map && !this.cutscene && !p.dead) { this.openMap(); return; }
    S.time += 1 / 60; fx.clearLights();
    this.checkVillageScene(); this.checkOpening(); this.discoStep();
    if (this.room.gears) { this.room.gears.step(); for (const d of this.room.gears.defs) fx.light(d.cx, d.cy - d.R * 0.55, 130, 0.55, [1, 0.8, 0.45]); }          // the wheels turn, and glow a little
    for (const d of this.vents || []) if (this.frame % 9 === 0 && d.x > this.camera.x - 20 && d.x < this.camera.x + W + 20) fx.smoke(d.x, d.y - 40, 1, { c0: [0.62, 0.6, 0.58], c1: [0.4, 0.38, 0.36], s0: 5, s1: 20, l: 0.8 });          // steam
    if (this.cutscene) this.updateCutscene();
    p.update();
    const cam = this.camera, ccx = cam.x + W / 2, ccy = cam.y + H / 2;
    const still = !!(this.cutscene && this.cutscene.scene);          // (during a scripted scene the monsters neither move nor attack)
    if (!still) for (const e of this.enemies) { if (e.dead) continue; if (e.isBoss || (Math.abs(e.x - ccx) < 380 && Math.abs(e.cy - ccy) < 240)) e.update(); }
    this.enemies = this.enemies.filter(e => !e.dead || (e.isBoss && false));
    if (!still) this.updateProjectiles();
    for (const o of this.pickups) o.update(this); this.pickups = this.pickups.filter(o => !o.dead);
    for (const o of this.props) o.update(this); this.props = this.props.filter(o => !o.dead);
    if (this.mirrorView) this.mirrorView.update(this);
    this.sealFlames();
    for (const o of this.popups) o.life--; this.popups = this.popups.filter(o => o.life > 0);
    // lights & flames (only near the camera).  A gust of air (the swish of the sword, a dash) bends a flame away from it, and it springs back, wobbling
    for (const f of this.flames) {
      if (f.x < cam.x - 60 || f.x > cam.x + W + 60) continue; let force = 0;
      for (const gu of fx.gusts) { const d = Math.hypot(f.x - gu.x, f.y - gu.y), R = gu.r * 1.3; if (d < R) { const q = 1 - d / R; force += gu.vx * q * q * gu.k; } }
      f.vdx = ((f.vdx || 0) + force * 0.4) * 0.82 - (f.dx || 0) * 0.12; f.dx = Math.max(-9, Math.min(9, (f.dx || 0) + f.vdx));
    }
    for (const f of this.flames) { if (f.x < cam.x - 60 || f.x > cam.x + W + 60) continue; if (f.lightOnly) { fx.light(f.x, f.y, f.light, 0.75); continue; } if (f.behind) { if (f.smoke) { const fs = f.fs || 1, ph = f.ph || 0; if (f.small) { if ((p.t + ph) % 9 === 0) fx.smoke(f.x + rand(-1, 1), f.y - 7 * fs, 1, { s0: 3 + 4 * fs, s1: 14 + 16 * fs, c0: [0.5, 0.3, 0.2], c1: [0.12, 0.1, 0.11], a: 0.85, l: 1.9, drift: 0.1 }); } else if ((p.t + ph) % 6 === 0) fx.smoke(f.x, f.y - 12 * fs, 1, { s0: 6 + 3 * fs, s1: 22 + 10 * fs, c0: [0.45, 0.27, 0.17], c1: [0.1, 0.085, 0.09], a: 0.9, drift: 0.08 }); } if (f.big && Math.random() < (f.small ? 0.03 : 0.1)) fx.emit({ x: f.x + rand(-4, 4), y: f.y - 8, vx: rand(-0.3, 0.3), vy: -rand(0.5, 1.2), life: rand(30, 60), s0: 2, s1: 0.5, c0: [1, 0.7, 0.3], c1: [1, 0.4, 0.1], a0: 1, a1: 0, kind: 1 }); } else if (f.big) { fx.fire(f.x, f.y + 6, { scale: f.fs || 1.0, n: 2 }); if (f.smoke && p.t % 7 === 0) fx.smoke(f.x, f.y - 8, 1, { s0: 8, s1: 30, c0: [0.28, 0.22, 0.22], c1: [0.1, 0.08, 0.08], a: 0.5 }); } else fx.flame(f.x + (f.dx || 0) * 0.5, f.y, { scale: f.scale, seed: f.seed }); if (f.light) fx.light(f.x, f.y, f.light, 0.75); }
    for (let i = 0; i < (this.falls ? this.falls.length : 0); i++) {                                       // the spray where a waterfall lands (only the ones near the camera)
      const f = this.falls[i]; if (f.x < cam.x - 60 || f.x > cam.x + W + 60 || f.y < cam.y - 20 || f.y > cam.y + H + 40) continue;
      if ((this.frame + i * 5) % 3 === 0) fx.emit({ layer: 'alpha', x: f.x + rand(-f.w / 2, f.w / 2), y: f.y - 3, vx: rand(-0.35, 0.35), vy: -rand(0.15, 0.6), life: rand(36, 70), s0: 10, s1: 30, c0: [0.82, 0.93, 0.97], c1: [0.7, 0.85, 0.92], a0: 0.34, a1: 0, kind: 5, drag: 0.99 });
      if ((this.frame + i * 3) % 4 === 0) fx.emit({ x: f.x + rand(-f.w / 2, f.w / 2), y: f.y - 4, vx: rand(-0.9, 0.9), vy: -rand(0.8, 2.0), gy: 0.1, life: rand(16, 28), s0: 2, s1: 1, c0: [0.85, 0.96, 1], a0: 0.85, a1: 0, kind: 1 });
    }
    fx.light(p.x, p.y - 20, 54, 0.5); fx.focus = { x: p.x, y: p.y - 20 };
    this.ghost.update(); for (const d of this.graves || []) fx.light(d.x + 12, d.y - 12, 100, 1.2, [0.4, 0.62, 1]);          // (her grave's candle: the blue light in which she can be seen)
    this.checkExits();
    // camera
    this.updateCamera();
    if (this.bannerObj && ++this.bannerObj.t > this.bannerObj.dur) this.bannerObj = null;
    if (this.shakeT > 0) { this.shakeT--; if (this.shakeT === 0) this.shakeA = 0; }
    fx.update(1);
  }
  snapCamera() { const p = this.player, r = this.room; this.camera.x = this.camTargetX(p, r); this.camera.y = this.camTargetY(p, r); }
  camTargetX(p, r) { return r.pw <= W ? (r.pw - W) / 2 : clamp(p.x + p.dir * 18 - W / 2, 0, r.pw - W); }
  camTargetY(p, r) { return r.ph <= H ? (r.ph - H) / 2 : clamp(p.y - 30 - H / 2, 0, r.ph - H); }
  updateCamera() {
    const p = this.player, r = this.room, c = this.camera; c.x += (this.camTargetX(p, r) - c.x) * 0.1; c.y += (this.camTargetY(p, r) - c.y) * 0.12;
  }

  // -------------------------------------------------------------------------------- drawing
  draw() {
    const ctx = this.ctx, t = this.frame; ctx.setTransform(this.K, 0, 0, this.K, 0, 0); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const top = this.top; if (this.topCanvas.width !== W * this.K) { this.topCanvas.width = W * this.K; this.topCanvas.height = H * this.K; } top.setTransform(this.K, 0, 0, this.K, 0, 0); top.imageSmoothingEnabled = false; top.globalAlpha = 1; top.clearRect(0, 0, W, H);
    const fx = this.fx;
    if (this.state === 'title') { this.title.draw(ctx); fx.setCamera(0, 0); this.finishFrame(); return; }
    if (this.state === 'intro') { ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, W, H); this.intro.draw(ctx); fx.setCamera(0, 0); this.finishFrame(); return; }
    if (this.state === 'ending') { this.ending.draw(ctx); this.finishFrame(); return; }
    if (!this.room) { this.finishFrame(); return; }
    const r = this.room, p = this.player;
    let sx = 0, sy = 0; if (this.shakeT > 0) { const a = this.shakeA * Math.min(1, this.shakeT / 6); sx = (Math.random() * 2 - 1) * a; sy = (Math.random() * 2 - 1) * a; }
    const cx = Math.round(this.camera.x + sx), cy = Math.round(this.camera.y + sy);
    { const n = this.state === 'play' ? this.nearInteractable() : null; r.nearDoor = n && n.kind === 'door' ? n.d : null; r.playerX = p.x; }          // (room.nearDoor / room.playerX: scenery can react to the player)
    drawBackground(ctx, r, cx, cy, t);
    for (const d of r.decos) if (isBack(d) && d.t !== 'waterfall') drawDeco(ctx, d, cx, cy, t, r);
    if (r.gears) r.gears.draw(ctx, cx, cy);                                                         // the great gears' wheels (their teeth carry the hero)
    if (this.falls) for (const d of this.falls) drawDeco(ctx, d, cx, cy, t, r);                    // waterfalls: in front of the far trees, behind the ground and the hero
    if (this.mirrorView) this.mirrorView.draw(ctx, cx, cy);                                          // the mirror hangs on the back wall: frame and glass, behind the ground and the hero (the reflection is the boss's, drawn over the glass)
    r.drawTiles(ctx, cx, cy, t);
    for (const d of r.decos) if (!isBack(d)) drawDeco(ctx, d, cx, cy, t, r);
    drawFlames2D(ctx, this.flames, cx, cy, t);                       // braziers, burning windows, candelabra flames: in the scene, behind the hero
    for (const o of this.props) o.draw(ctx, cx, cy);
    for (const o of this.pickups) o.draw(ctx, cx, cy);
    for (const e of this.enemies) if (!e.isBoss) e.draw(ctx, cx, cy);
    for (const e of this.enemies) if (e.isBoss) { e.drawWarn(ctx, cx, cy); e.draw(ctx, cx, cy); }     // danger zones go under the boss
    for (const e of this.enemies) if (e.freezeT > 0) drawIce(ctx, e, cx, cy, t);                       // Frost enchant: frozen foes sit in ice
    this.ghost.draw(ctx, cx, cy);                                                                    // (she floats a little behind the hero - and is only seen in a blue light)
    if (this.cutscene && this.cutscene.scene) this.cutscene.scene.drawWorld(ctx, cx, cy);
    p.draw(ctx, cx, cy);
    if (r.currents && r.currents.length) drawCurrents(ctx, r.currents, cx, cy, t);                       // (flowing water laps over the hero's legs)
    for (const e of this.enemies) if (e.isBoss) e.drawIntent(ctx, cx, cy);                              // attack icon + name over its head
    for (const o of this.projectiles) o.draw(ctx, cx, cy);
    if (this.state === 'play' && !this.cutscene && this.fade < 0.05) { const n = this.nearInteractable(); if (n) drawPrompt(top, n.x - cx, n.y - cy, t, n.kind === 'npc' ? 'TALK' : n.kind === 'door' ? 'UP' : (n.o.constructor.name === 'Altar' ? 'SAVE' : n.o.constructor.name === 'Waystone' ? 'TRAVEL' : 'UP')); }
    if (this.state === 'play' && !this.cutscene && this.fade < 0.05) for (const e of r.exits) {                                // an arrow where the room opens onto the next one, on the edge of the screen
      if (e.side !== 'L' && e.side !== 'R') continue;
      const L = e.side === 'L', wx = L ? 10 : r.pw - 10, sx = wx - cx, sy = (e.from + e.to + 1) / 2 * T - cy; if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
      let sealed = false; for (let k = 0; k < 8 && !sealed; k++) for (let row = e.from; row <= e.to; row++) if (r.get(L ? k : r.w - 1 - k, row) === TILE.SEAL) { sealed = true; break; }
      if (!sealed) drawExitArrow(top, sx, sy, t, L ? -1 : 1);
    }
    fx.setCamera(cx, cy);
    if (r.spikes && r.spikes.length) { top.globalAlpha = 0.95; for (const [tx, ty] of r.spikes) { const sx = tx * T - cx, sy = ty * T - cy; if (sx < -16 || sx > W || sy < -16 || sy > H) continue; drawSheet(top, 'spikes', 0, sx, sy, { ax: 0, ay: 0 }); } top.globalAlpha = 1; }          // hazards are drawn again above the fog and the dark: they must always be seen
    // everything the player READS - messages, the HUD, banners, dialogue, the pause and game-over screens - is drawn on the clear layer above the effects (fog, darkness), never under them
    drawPopups(top, this.popups, cx, cy);
    if (this.cutscene && this.cutscene.scene) this.cutscene.scene.drawTop(top); else HUD.draw(top, this);
    if (!(this.cutscene && this.cutscene.scene)) drawBanner(top, this.bannerObj);
    if (this.state === 'dialog') this.dialog.draw(top);
    if (this.state === 'dead') this.gameOver.draw(top);
    if (this.state === 'pause') this.pauseMenu.draw(top);
    if (this.state === 'map') this.mapScreen.draw(ctx);                // (the map is a full sheet of its own: it hides the effects layer and this one)
    this.finishFrame();
  }
  finishFrame() {
    const cl = this.fx.cloak, pl = this.player; if (cl) cl.setVisible(A.settings.cloak && !!pl && !!this.room && (this.state === 'play' || this.state === 'dialog' || this.state === 'dead' || this.state === 'gameover'));
    for (const c of [this.ctx, this.top]) if (this.fade > 0) { c.fillStyle = `rgba(0,0,0,${this.fade})`; c.fillRect(0, 0, W, H); }          // the fade to black covers the interface too
    if (this.state === 'title' || this.state === 'intro' || this.state === 'ending') this.fx.setShake(0, 0);
    this.fx.canvas.style.opacity = this.topCanvas.style.opacity = this.state === 'map' ? '0' : '1';       // the map is a full-screen sheet: hide the effects layer (it sits above the 2D canvas)
    this.fx.render();
  }
}

export async function start() {
  const g = new Game(); window.game = g; await g.init(); g.run();
  // debug helpers (handy for testing from the console)
  g.debug = {
    seed: n => { g.world = buildWorld(n); g.save = newSave(g.world); g.save.flags.opening_seen = true; g.player = new Player(g, 0, 0); g.state = 'play'; g.fade = 0; g.loadRoom(g.world.start.room, { x: g.world.start.x * 16 + 8, y: g.world.start.gy * 16 }, 1); return g.world.report; },
    tp: (room, tx, gy) => { if (!g.save) { g.world = g.world || buildWorld(1); g.save = newSave(g.world); g.save.flags.opening_seen = true; g.player = new Player(g, 0, 0); } g.state = 'play'; g.fade = 0; g.loadRoom(room, { x: tx * 16 + 8, y: gy * 16 }, 1); },
    give: k => { g.save.abilities[k] = true; }, giveAll: () => { for (const k of Object.keys(g.save.abilities)) g.save.abilities[k] = true; },
    god: () => { g.player.invT = 1e9; }, heal: () => { g.save.hp = g.save.maxHp; g.save.mp = g.save.maxMp; },
    // run n logic steps synchronously (the preview pane throttles requestAnimationFrame), then draw once
    stepN: (n = 1) => { for (let i = 0; i < n; i++) g.step(); g.draw(); },
    // hold keys (codes) down for n steps, then release: await-free helper for scripted tests
    press: (codes, n = 1, after = 0) => { const k = (c, d) => window.dispatchEvent(new KeyboardEvent(d ? 'keydown' : 'keyup', { code: c })); codes.forEach(c => k(c, true)); for (let i = 0; i < n; i++) g.step(); codes.forEach(c => k(c, false)); for (let i = 0; i < after; i++) g.step(); g.draw(); },
  };
  g.noAutoPause = new URLSearchParams(location.search).has('nopause');
}
