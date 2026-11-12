// The white cloak remembers what happened to it.  Three stains, each 0..1:
//   soot  - singed by fire (fire breath, flame pillars, fireballs, burning things)
//   mud   - dirtied by filth (zombies, swamp creatures, thrown bones, shockwaves that throw up dirt)
//   blood - splashed by things that bite and cut (hounds, bats, wyrms, knights, spikes)
// A hit adds a little (never a lot - "slightly discolored"), every stain fades on its own over a minute or two, and WATER washes it off:
// standing in the rain, or wading through a pool, strips it in seconds.
export const STAINS = {
  soot: { color: '#26201f', rgb: [0.15, 0.125, 0.125], fade: 1 / (110 * 60), label: 'SINGED' },
  mud: { color: '#6f4d2c', rgb: [0.43, 0.3, 0.17], fade: 1 / (100 * 60), label: 'MUDDY' },
  blood: { color: '#a3101a', rgb: [0.64, 0.05, 0.08], fade: 1 / (80 * 60), label: 'BLOODIED' },
};
export const STAIN_KEYS = Object.keys(STAINS);
export const RAIN_WASH = 1 / (14 * 60), POOL_WASH = 1 / (2.5 * 60);     // per frame

const BY_NAME = { fireskull: 'soot', ghoul: 'soot', emberwyrm: 'soot', zombie: 'mud', swampthing: 'mud', swampspider: 'mud', skeleton: 'mud', hound: 'blood', bat: 'blood', wyrm: 'blood', frostwyrm: 'blood', gnuknight: 'blood', armor: 'blood', automaton: 'soot' };
const BY_PROJ = { fire: 'soot', ember: 'soot', bone: 'mud', gear: 'soot' };
const BOSS = { BossBeast: s => (s === 'breath' || s === 'pillars' ? 'soot' : 'blood'), BossNightmare: () => 'soot', BossColossus: () => 'soot', BossShadow: () => 'soot' };

// what hit the hero?  (the hurt() callers all pass the attacker's x, which matches the attacker exactly)
export function stainSource(g, fromX) {
  for (const pr of g.projectiles) {
    if (pr.dead || pr.owner === 'player' || Math.abs(pr.x - fromX) > 0.6) continue;
    const n = pr.constructor.name;
    if (n === 'FirePatch') return 'soot'; if (n === 'Shockwave') return 'mud';
    if (n === 'Column') return pr.kind === 'fire' || pr.kind === 'bolt' ? 'soot' : null;
    return BY_PROJ[pr.kind] || null;
  }
  let best = null, bd = 40;
  for (const e of g.enemies) { if (e.dead || e.harmless) continue; const d = Math.abs(e.x - fromX); if (d < bd) { bd = d; best = e; if (d < 0.6) break; } }
  if (!best) return null;
  const b = BOSS[best.constructor.name]; if (b) return b(best.state);
  return BY_NAME[best.name] || null;
}
