// Disposable-item data and the pure helpers around it (no browser imports, so the level generator and the node tests can use it too).
export const ITEMS = {
  dagger: { name: 'THROWING DAGGER', short: 'DAGGER', price: 25, max: 30, pack: 5, icon: 'dagger', weight: 5, desc: 'FAST AND WEAK. ONE DAGGER PER THROW.' },
  marrow: { name: 'MAGIC ARROW', short: 'ARROW', price: 40, max: 20, pack: 4, icon: 'marrow', weight: 4, desc: 'LIKE A DAGGER, BUT IT SEEKS OUT THE NEAREST FOE, TRAILING WHITE SPARKS.' },
  axe: { name: 'THROWING AXE', short: 'AXE', price: 60, max: 12, pack: 3, icon: 'axe', weight: 2, desc: 'A SLOW, HEAVY ARC THAT CUTS THROUGH EVERY FOE IT MEETS.' },
  torch: { name: 'TORCH', short: 'TORCH', price: 35, max: 10, pack: 2, icon: 'torchi', weight: 3, desc: 'THROW IT TO SET A FOE ABLAZE. IT ALSO BURNS WOODEN BARRICADES.' },
  holy: { name: 'AQUA VITAE', short: 'AQUA VITAE', price: 55, max: 6, pack: 1, icon: 'holy', weight: 2, desc: 'SHATTERS INTO A POOL OF LIGHT. THE UNDEAD BURN IN IT.' },
  bandage: { name: 'PANACEA', short: 'PANACEA', price: 80, max: 3, pack: 1, icon: 'bandage', weight: 1, desc: 'HEALS A THIRD OF YOUR LIFE. VERY FEW CAN BE CARRIED.' },
};
// what a merchant asks for one pack of an item, in coins (gold): about two or three coin drops
export const ITEM_ORDER = ['dagger', 'marrow', 'axe', 'torch', 'holy', 'bandage'];

export const itemCount = (S, id) => (S.items && S.items[id]) || 0;
// add n of an item (capped at its maximum); returns how many were actually added
export function addItem(S, id, n) { const it = ITEMS[id]; S.items ||= {}; const have = S.items[id] || 0, add = Math.max(0, Math.min(n, it.max - have)); S.items[id] = have + add; return add; }
export const randomItemId = () => { const t = ITEM_ORDER.reduce((s, k) => s + ITEMS[k].weight, 0); let x = Math.random() * t; for (const k of ITEM_ORDER) if ((x -= ITEMS[k].weight) < 0) return k; return 'dagger'; };

// the keys of the locked doors: id (the save flag 'has_<id>' says it is held, 'unlocked_<id>' that its door has been opened), what it is called, and the colour of its padlock
export const KEYS = [
  { id: 'key_grave', name: 'KEY OF LEAD', rgb: [150, 200, 120] },
  { id: 'key_hall', name: 'KEY OF IRON', rgb: [230, 170, 90] },
  { id: 'key_chapel', name: 'KEY OF SILVER', rgb: [170, 150, 240] },
  { id: 'key_crypt', name: 'KEY OF TIN', rgb: [110, 205, 215] },
  { id: 'key_mire', name: 'KEY OF COPPER', rgb: [90, 215, 150] },
  { id: 'key_gear', name: 'KEY OF MERCURY', rgb: [205, 125, 75] },
];
