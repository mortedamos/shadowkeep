// Text for the game.  Two free (SIL OFL) gothic fonts are drawn as real vector text on the high-resolution game canvas:
//   * Pirata One   - blackletter-flavoured display face for titles, banners and the logo   (assets/fonts/PirataOne-Regular.ttf)
//   * Almendra Bold - calligraphic medieval face for menus, HUD, dialogue                     (assets/fonts/Almendra-Bold.ttf)
// If the font files can't be loaded the old 5x7 bitmap font below is used instead, so the game never breaks.
// Public API (unchanged): drawText(ctx, str, x, y, opts), textWidth(str, scale), wrapText(str, maxW, scale)  -  y is the top of a 7*scale-px cap box.
// opts: color, scale, align ('left'|'center'|'right'), outline (color), shadow (color), alpha, font ('display'|'body')
const GLYPHS = {
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#', B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.###./#...#/#..../#..../#..../#...#/.###.', D: '####./#...#/#...#/#...#/#...#/#...#/####.',
  E: '#####/#..../#..../####./#..../#..../#####', F: '#####/#..../#..../####./#..../#..../#....',
  G: '.###./#...#/#..../#.###/#...#/#...#/.####', H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  I: '.###./..#../..#../..#../..#../..#../.###.', J: '..###/...#./...#./...#./...#./#..#./.##..',
  K: '#...#/#..#./#.#../##.../#.#../#..#./#...#', L: '#..../#..../#..../#..../#..../#..../#####',
  M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#', N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
  O: '.###./#...#/#...#/#...#/#...#/#...#/.###.', P: '####./#...#/#...#/####./#..../#..../#....',
  Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#', R: '####./#...#/#...#/####./#.#../#..#./#...#',
  S: '.####/#..../#..../.###./....#/....#/####.', T: '#####/..#../..#../..#../..#../..#../..#..',
  U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.', V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
  W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#', X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  Y: '#...#/#...#/.#.#./..#../..#../..#../..#..', Z: '#####/....#/...#./..#../.#.../#..../#####',
  0: '.###./#...#/#..##/#.#.#/##..#/#...#/.###.', 1: '..#../.##../..#../..#../..#../..#../.###.',
  2: '.###./#...#/....#/...#./..#../.#.../#####', 3: '.###./#...#/....#/..##./....#/#...#/.###.',
  4: '...#./..##./.#.#./#..#./#####/...#./...#.', 5: '#####/#..../####./....#/....#/#...#/.###.',
  6: '..##./.#.../#..../####./#...#/#...#/.###.', 7: '#####/....#/...#./..#../.#.../.#.../.#...',
  8: '.###./#...#/#...#/.###./#...#/#...#/.###.', 9: '.###./#...#/#...#/.####/....#/...#./.##..',
  '.': '...../...../...../...../...../.##../.##..', ',': '...../...../...../...../.##../..#../.#...',
  '!': '..#../..#../..#../..#../..#../...../..#..', '?': '.###./#...#/....#/...#./..#../...../..#..',
  ':': '...../.##../.##../...../.##../.##../.....', ';': '...../.##../.##../...../.##../..#../.#...',
  "'": '.##../..#../.#.../...../...../...../.....', '"': '.#.#./.#.#./...../...../...../...../.....',
  '-': '...../...../...../#####/...../...../.....', '+': '...../..#../..#../#####/..#../..#../.....',
  '/': '....#/....#/...#./..#../.#.../#..../#....', '(': '...#./..#../.#.../.#.../.#.../..#../...#.',
  ')': '.#.../..#../...#./...#./...#./..#../.#...', '%': '##..#/##..#/...#./..#../.#.../#..##/#..##',
  '=': '...../...../#####/...../#####/...../.....', '<': '...#./..#../.#.../#..../.#.../..#../...#.',
  '>': '.#.../..#../...#./....#/...#./..#../.#...', _: '...../...../...../...../...../...../#####',
  '*': '...../.#.#./..#../#####/..#../.#.#./.....', '&': '.##../#..#./#.#../.#.../#.#.#/#..#./.##.#',
  '[': '.###./.#.../.#.../.#.../.#.../.#.../.###.', ']': '.###./...#./...#./...#./...#./...#./.###.',
  '#': '.#.#./#####/.#.#./.#.#./#####/.#.#./.....', ' ': '...../...../...../...../...../...../.....',
  '^': '..#../.#.#./#...#/...../...../...../.....', '~': '...../.#..#/#.##./...../...../...../.....',
};

const CW = 6, CH = 8;               // cell pitch in the atlas
const CHARS = Object.keys(GLYPHS);
const IDX = {}; CHARS.forEach((c, i) => (IDX[c] = i));
let white = null;
const tinted = new Map();

function build() {
  white = document.createElement('canvas');
  white.width = CHARS.length * CW; white.height = CH;
  const g = white.getContext('2d'); g.fillStyle = '#fff';
  CHARS.forEach((ch, i) => {
    GLYPHS[ch].split('/').forEach((row, y) => { for (let x = 0; x < 5; x++) if (row[x] === '#') g.fillRect(i * CW + x, y, 1, 1); });
  });
}
function atlas(color) {
  if (!white) build();
  if (color === '#fff' || color === '#ffffff') return white;
  let c = tinted.get(color);
  if (!c) {
    c = document.createElement('canvas'); c.width = white.width; c.height = white.height;
    const g = c.getContext('2d'); g.drawImage(white, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    tinted.set(color, c);
  }
  return c;
}

function bmWidth(str, scale = 1) { return Math.max(0, String(str).length * CW - 1) * scale; }

function bmDraw(ctx, str, x, y, o = {}) {
  str = String(str).toUpperCase();
  const scale = o.scale || 1, color = o.color || '#e8dcc0';
  let w = bmWidth(str, scale);
  if (o.align === 'center') x -= w / 2; else if (o.align === 'right') x -= w;
  x = Math.round(x); y = Math.round(y);
  const prevA = ctx.globalAlpha;
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  const pass = (col, ox, oy) => {
    const a = atlas(col);
    for (let i = 0; i < str.length; i++) {
      const k = IDX[str[i]]; if (k === undefined || str[i] === ' ') continue;
      ctx.drawImage(a, k * CW, 0, 5, 7, x + i * CW * scale + ox, y + oy, 5 * scale, 7 * scale);
    }
  };
  if (o.outline) { const s = scale; for (const [dx, dy] of [[-s, 0], [s, 0], [0, -s], [0, s], [-s, -s], [s, s], [-s, s], [s, -s]]) pass(o.outline, dx, dy); }
  else if (o.shadow) pass(o.shadow, scale, scale);
  pass(color, 0, 0);
  ctx.globalAlpha = prevA;
  return w;
}

// ---------------------------------------------------------------------------------------------- gothic vector text
let vec = null;                                   // { body, display } once the fonts are loaded
const FONT_FILES = [['body', 'SK Almendra', '../assets/fonts/Almendra-Bold.ttf', 1.06], ['display', 'SK Pirata', '../assets/fonts/PirataOne-Regular.ttf', 1.12]];
const HAND_FONT = ['hand', 'SK Eroded', '../assets/fonts/erodedmotta.regular.ttf', 1.0];        // "Eroded Motta" (lirkiv AC): the lettering on the gravestones and tablets (font: 'hand'), in mixed case
const TITLE_FONT = ['title', 'SK Blackletter', '../assets/fonts/BLACEB__.TTF', 1.0];       // "Blackletter ExtraBold" (Typographer Mediengestaltung): the game title only
export async function loadFonts() {
  try {
    const m = document.createElement('canvas').getContext('2d'), spec = {};
    for (const [key, fam, file, fit] of FONT_FILES) {
      const f = new FontFace(fam, `url(${new URL(file, import.meta.url).href})`); await f.load(); document.fonts.add(f);
      m.font = `100px "${fam}"`; const cap = m.measureText('H').actualBoundingBoxAscent / 100;
      if (!(cap > 0.3 && cap < 1)) throw new Error('bad font metrics for ' + fam);
      spec[key] = { fam, cap, fit };
    }
    try {                                                    // the title face is optional: if it cannot load, the logo uses the display face
      const f = new FontFace(TITLE_FONT[1], `url(${new URL(TITLE_FONT[2], import.meta.url).href})`); await f.load(); document.fonts.add(f);
      m.font = `100px "${TITLE_FONT[1]}"`; const cap = m.measureText('H').actualBoundingBoxAscent / 100;
      if (cap > 0.3 && cap < 1) spec.title = { fam: TITLE_FONT[1], cap, fit: TITLE_FONT[3] };
    } catch (e) { console.warn('Title font unavailable - using the display font.', e); }
    try {                                                    // so is the handwriting face: without it the stones are written in the body face, in capitals
      const f = new FontFace(HAND_FONT[1], `url(${new URL(HAND_FONT[2], import.meta.url).href})`); await f.load(); document.fonts.add(f);
      m.font = `100px "${HAND_FONT[1]}"`; const cap = m.measureText('H').actualBoundingBoxAscent / 100;
      if (cap > 0.3 && cap < 1) spec.hand = { fam: HAND_FONT[1], cap, fit: HAND_FONT[3] };
    } catch (e) { console.warn('Handwriting font unavailable - using the body font.', e); }
    vec = spec; widths.clear(); return true;
  } catch (e) { console.warn('Gothic fonts unavailable - using the bitmap font.', e); vec = null; return false; }
}
const measureCtx = document.createElement('canvas').getContext('2d'), widths = new Map();
// Pirata One (display) for big text and anything outlined (HUD, menus, banners, floating text); Almendra (body) for dialogue and descriptive text.
const pick = (scale, o) => { let k = (o && o.font) || (scale >= 2 || (o && o.outline) ? 'display' : 'body'); if (k === 'mixed') k = 'body'; return vec[k] || (k === 'hand' ? vec.body : vec.display); };          // ('mixed' = the body face, but keeping the text's own upper and lower case)
const sizeOf = (F, scale) => 7 * scale * F.fit / F.cap;                       // font-size that gives caps ~7*fit px tall
function vecWidth(str, scale, o) {
  const F = pick(scale, o), size = sizeOf(F, scale), key = F.fam + size + '|' + str; let w = widths.get(key);
  if (w === undefined) { measureCtx.font = `${size}px "${F.fam}"`; w = measureCtx.measureText(str).width; if (widths.size > 4000) widths.clear(); widths.set(key, w); }
  return w;
}
// Eroded Motta has no colon or semicolon: they become a dash and a comma.  Call this on a gravestone's text before it is wrapped or typed out; it does nothing if the face did not load.
export const handText = str => vec && vec.hand ? String(str).replace(/\s*:\s*/g, ' - ').replace(/\s*;\s*/g, ', ') : String(str);
const casing = (str, font) => font === 'title' || font === 'mixed' || (font === 'hand' && vec && vec.hand) ? String(str) : String(str).toUpperCase();      // (the game draws capitals - except the blackletter title and the handwriting, which read far better in mixed case)
export function textWidth(str, scale = 1, font) { const f = typeof font === 'object' ? font : { font }; str = casing(str, f.font); return vec ? vecWidth(str, scale, f) : bmWidth(str.toUpperCase(), scale); }

export function drawText(ctx, str, x, y, o = {}) {
  if (!vec) return bmDraw(ctx, str, x, y, o);
  str = casing(str, o.font);
  const scale = o.scale || 1, color = o.color || '#e8dcc0', F = pick(scale, o), size = sizeOf(F, scale), w = vecWidth(str, scale, o);
  if (o.align === 'center') x -= w / 2; else if (o.align === 'right') x -= w;
  const base = y + 3.5 * scale + F.cap * size / 2;                            // caps are centred in the 7*scale box
  const prevA = ctx.globalAlpha; if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.font = `${size}px "${F.fam}"`; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  if (o.outline) { ctx.lineJoin = 'round'; ctx.miterLimit = 2; ctx.lineWidth = 2.1 * Math.max(1, scale * 0.8); ctx.strokeStyle = o.outline; ctx.strokeText(str, x, base); }
  else if (o.shadow) { ctx.fillStyle = o.shadow; ctx.fillText(str, x + scale, base + scale); }
  ctx.fillStyle = color; ctx.fillText(str, x, base);
  ctx.globalAlpha = prevA;
  return w;
}

// word-wrap helper -> array of lines that fit maxW pixels
export function wrapText(str, maxW, scale = 1, font) {
  const words = String(str).split(' '), lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (textWidth(t, scale, font) > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
