# SHADOWKEEP

A gothic-fantasy, side-scrolling action-adventure for the browser, in the spirit of *Castlevania* and *Bloodstained*.
You are a nameless cloaked stranger with a sword, exploring a haunted castle: platforming, secrets, power-ups,
seven zones, nine bosses (two of them optional), throwable items, waystone travel, and a three.js effects layer (fire, flickering candles, lightning, auras, mist). Text is set in two
free gothic typefaces (Pirata One and Almendra, with Blackletter ExtraBold for the title) rather than a pixel font. The hero is Ansimuz's Gothic Hero (the hooded-warrior set is archived in `assets/archive/`), draped in an
experimental animated **white cloak** (a cloth hung from both shoulders that drapes behind him; Options > White Cloak turns it off, or start with `?cloak=0`).

## Play it

The game is **plain static files** - no server-side code at all - so it runs on any web host, **GitHub Pages included** (see below).
Browsers will not run ES modules from a double-clicked `index.html` (`file://`), so to try it on your own computer something has to hand the files over; a tiny local server does that:

* **Windows:** double-click **`play.bat`** (uses Node.js if installed, otherwise a built-in PowerShell server).
* **Anywhere with Node:** `node server.js` and open <http://localhost:8080>  (add `--open` to launch the browser).

No install step, no dependencies - three.js is vendored in `lib/three/`, so it also works offline.

### Putting it on GitHub Pages

1. Push the game folder to a GitHub repository (the `.gitignore` already keeps the downloaded art packs in `assets/sprites/source/` out - their licences do not allow redistributing them).
2. In the repository: **Settings > Pages > Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Open the address Pages gives you. Nothing else is needed: every path in the game is relative, so it also works from a sub-folder address like `https://you.github.io/shadowkeep/`.

Before you publish:
* `node tools/music-manifest.mjs` - rewrites `music/files.json` (a static host cannot list a folder; the game reads this file instead). Run it again whenever you add, remove or rename a track.
* `node tools/check-paths.mjs` - Windows ignores capital letters in file names but Pages does not; this checks that every file the game asks for is spelled exactly right.
* `.nojekyll` (already here) stops Pages from running Jekyll over the folder.

The published repository holds only what the game needs to run. `.gitignore` keeps `play.bat`, `play.ps1`, `server.js`, `tools/` (the launchers, the local server and the test scripts mentioned in this file), `assets/source/`, `assets/sprites/source/` (the art packs as downloaded) and `.claude/` out of it - they stay in the author's working copy.

## Controls

| Action | Keys |
|---|---|
| Move | Arrow keys / WASD |
| Jump (variable height) | Space / Z / K  - press again in mid-air once you own the **Raven Feather** |
| Attack (tap again for a 3-hit combo) | X / J  (works in the air too; the hero stays planted while swinging) |
| Duck | hold Down / S  - shrinks your hitbox; you can slash while ducking (a low cut that skims the floor) |
| Drop through one-way platforms | Down / S  + Jump |
| Dash (invulnerable) | Shift / L  - needs **Shadow Step** |
| Use the selected spell or item | C / I |
| Move the selection box (top of the screen) | Q (left) / V (right) |
| Use altar, read tablet, open chest, enter door, use a waystone | Up / W / E |
| Map (arrow keys scroll it) / Pause | M or Tab / Esc, P or Enter |
| Mute | N  (the game also pauses and mutes by itself when the window loses focus) |

A gamepad also works (A jump, X attack, B dash, Y use selected, bumpers move the selection, Start pause, Back map).

**Phones and tablets:** on-screen controls appear by themselves on a touch screen (and go away when a key is pressed). A round **D-pad** at the bottom left: slide a thumb round it to run, duck, or go up a door (up is also USE). **JUMP** and **HIT** are the big buttons on the right (they are also OK and BACK in the menus); **DASH**, **ITEM** (uses the selected spell or item) and the two small arrows that change the selection sit above them, and **MAP**, **II** (pause) and a full-screen square run along the top. Tap a menu item to pick it, tap the item box in the corner to change the selection, tap to advance a dialogue. Turn the phone sideways for a bigger picture. Add `?touch=1` to the address to force the pad on (or `?touch=0` to keep it off); Options > TOUCH PAD switches it by hand. On the iPhone, "Add to Home Screen" runs the game full screen.

## The game

* **7 zones, 38 main rooms (plus up to eight small rooms behind doors) - one look per zone.** A level never mixes tilesets; each look gets its own level instead:
  the **Burning Village** (a town under attack, houses ablaze, monsters in the street, villagers running about in a panic - they can't be hurt,
  and they cheer when you cut something down near them) -> the **Graveyard Approach** (a moonlit cemetery) -> the **Weeping Swamp** ->
  the **Great Hall** (a library of bookcases and teal pillars) -> the **Moonlit Chapel** -> the **Underworks** -> the **Shadow Throne**.
  Open room edges (marked by a small arrow on the screen edge), **doors** (UP) and fade transitions connect them; the zone name appears when you cross into a new one. In a generated castle several neighbouring areas are joined by a door at each end instead of an open edge (the village lane and the bell tower, the Iron Gate and Grave Hollow, the boardwalks, the hall, the nave, the boiler corridor and the gear shaft), and the map draws a line between every pair of joined rooms - with a little door mark where the way is a door.
* **Two floors.** Seven of the generated areas (Iron Gate, the Mourning Fields, Weeping Hollow, the Drowned Boardwalk, the Entrance Hall, the Nave, the Hall of Shadows) are tall rooms with a lower floor and an upper floor: a staircase of one-way platforms climbs to the upper floor, which has its own gaps, blocks and loot, and comes down again at the far end. Four of them hide a **door on the upper floor** to a small room of its own (the gravedigger's shed, the fisherman's hut, the servants' quarters, the scribe's study).
* **Waystones (teleport rooms).** Every zone opens with a *waystone chamber*, a calm room with a glowing stone. Walk up to attune it, then press
  **Up** at any attuned stone to open the map: pick any other waystone you have already found with Left / Right and press Enter to travel there
  (Esc cancels). Waystones are not save points - altars still are. Which ones you have found is part of your save.
* **Throwable items** (top-right of the screen, beside your spells; **Q / V** move the selection box, **C / I** uses what is selected). They are
  found lying about, in statues and barrels, dropped by enemies and left behind by bosses. Each can be found again and again and adds to your stack, up to its limit:
  **throwing dagger** (fast, weak, up to 30), **throwing axe** (slow heavy arc that cuts through everything, 12), **torch** (sets a foe ablaze for
  damage over time, and burns wooden barricades, 10), **magic arrow** (a dagger that homes in on the nearest foe, trailing white sparks, 20 - caltrops are gone), **holy water**
  (a pool of light that burns the undead, 6) and **bandages** (heal a third of your life, at most 3 - and not usable at full health).
* **Houses and people.** Three houses on Market Street and one on the lane can be entered (UP at the door - the shop sign hangs over the ones that matter). Inside, calm villagers stand about or amble slowly. **Talk to anyone with UP** (a little arrow appears over everything you can use): street villagers cry out and press a gift into your hands the first time; the people indoors and in the small rooms give you something too - or **sell** it. A merchant makes an offer; if you can pay, a YES / NO box asks (LEFT / RIGHT or the d-pad to choose, ENTER / A to answer, ESC / B means no); if you cannot, he tells you to come back. Coins (15 each, 50 for a gem) are the money; a merchant has three of a thing to sell and will not sell what you cannot carry.
* **Barrels and crates** shatter in one hit for a small treat; the larger **statues** still take 2-3 hits and pay 2-3 items - they glow softly (gold; rose or blue when a heart or mana is inside) so you can tell a treasure statue from the scenery.
* **The air moves.** The swish of your sword (and your dash) flings smoke, embers and fog along its path and bends nearby flames away. **Rolling ground fog** lies in the graveyard's hollows, the swamp, the nave and the Hall of Shadows: thick, wispy and translucent, it hides most of what is in it and parts where you cut through it.
* **Will-o'-the-wisps** drift through the Weeping Swamp: cold blue lights that float in and out of the background, shed real light and thin the mist wherever they go. You can never get near one - it bolts away into the background, and winks out if you keep coming.
* **Portraits** hang on the walls of the halls, chapels and the throne room - painted faces (fifteen people, five moods each, pixelated to 26x33 by `tools/pixelate-portraits.ps1`) in gilt, oak, silver, bronze or ebony frames. **Some are haunted.** They begin with a hopeful face, but as you walk up to one the picture turns - happy, neutral, sad, furious - and then it wakes and fights: some **spit fire from their eyes** (the eyes burn first), some release **wisps of blue fire that follow you** (cut them down with the sword), some **tear off the wall and fly at you**, and some fly *and* shoot. Until one wakes it cannot be hurt, and it cannot hurt you.
* **Waterfalls** pour through the tall rooms of the Weeping Swamp - from the sky, through the holes in the upper floor, down to the lower one - with spray where they land.
* **3D hair:** the hero's hair is a short scalp and just a few loose strands that fall behind his head and beside his face, drawn as a little textured mesh that is simulated like his cloak: it streams back when he runs, lifts when he falls, is pressed flat when he rises (Options > 3D Hair, or `?hair=0`).
* **Hazards are always seen:** spikes are drawn again above the fog and the dark, and live only at the bottom of pits. Nothing stands in front of a door.
* **Candelabras** are scenery now (indoors only - never in the graveyard or the mire): they flank doors and waystones, stand beside tablets and at the foot of walls and steps, and are spaced along the floor - never on top of loot.
* **21 monster types:** bats, rising zombies, bone-throwing skeletons, phasing ghosts, orb-casting wraiths, charging fire skulls, hell hounds,
  burning ghouls and teleporting dark wizards - plus **bone / frost / ember wyrms** (skull-headed serpents whose whole body follows
  the head; they gape and rear back before they strike - a clean hit breaks the attack - and the ember kind spits fire),
  **swamp spiders** (they squat before they spring), **swamp things**, blue-robed **acolytes**, staff-wielding **archmages**, bronze-robed **brass sorcerers** (fire-hurling casters who slip away when you close in), red-robed **zealots** (Szadi's sickle fighter: he plants his feet, then lunges through a slash) and the **haunted portraits** on the walls.
* **9 bosses** with two phases each (two are optional: the Crimson Count - a door on the upper floor of the Nave leads down to his crypt, and he leaves a heart container - and the **Reflection**, below): the Cinder Warden (the village's keeper - ember volleys, a staff slam, a leap, flame pillars once he is hurt; he leaves a heart container), the Gatekeeper (his fire breath is a tall arch of flame overhead - duck in the pocket right beside him, or stay out of its reach), the Mire Mother (a floating head of tentacles: marked holes in the ground, spore fans, spider summons; she leaves a mana crystal), the Phantom Steed, the Seraph of Ash, the Brazen Hierophant (master of the Underworks: he rises, then crashes down) the Shadow Lord, and
  the optional **Reflection**: a second door on the upper floor of the Entrance Hall opens on the Mirror Room, where a great gilt mirror hangs on the back wall and shows you, mirrored, doing whatever you do. Walk in front of it and meet your reflection in the middle: the glass
  cracks and your reflection crashes out of it in silver and violet, with red eyes. It fights with a sword (a two-blow combo, three in the second half), a **shadow dash** that cuts as it ends, a leap,
  and the same items you carry: **daggers** (duck under them), an **axe**, a **torch** and **holy water** (lobbed at where you stand: the landing spot is marked) and a homing **magic arrow**
  (cut it down, or outrun it) - and it binds its wounds with a **bandage** when it can find a quiet moment: that is your opening. It leaves a mana container. Every attack is telegraphed: an **icon and name** appear over the boss about a second before it
  acts, then a coloured aura, a warning sound and a **danger zone** (charge lane, breath sweep, landing marker, slam
  area, lightning/flame columns) show during the windup. The boss is open to counter-attack after each move.
  Turn the icons/names off in Options > Boss Hints if you want a purer challenge (zones and sounds stay).
* **Metroidvania progression:** Double Jump, Shadow Step (dash), Ember (fire - burns barricades) and Thunder
  (lightning - shatters crystal). Several secrets (heart containers, mana crystals, whetstones) are only reachable once
  you own the right power, so backtracking pays off. Levels, XP and item drops included. **Stone statues** are the breakable
  treasure: 2-3 sword hits to shatter, paying out 2-3 items instead of one, and they stand about 2.5x less often than the
  old candles did. Candelabras are scenery only.
* **Sword enchantments:** enemies (and more often bosses) sometimes drop a glowing rune that imbues your blade for a couple
  of minutes - **fire** (flaming sword, more damage, shoots short fireballs), **ice** (frost blade, chance to freeze foes
  for 1-3 s; rarer and shorter on bosses, with a thaw immunity so nothing can be stun-locked), **radiant** (sunlight blade,
  big damage boost, glowing aura) and **defending** (the blade sometimes raises an energy shield that blocks one hit).
* **A different castle every game:** the rooms are generated from a seed (see below), but every room is *proven*
  beatable before you ever see it.
* **The white cloak remembers.** Fire singes it grey-black, filth (zombies, swamp things, thrown bones) dirties it brown, and teeth, claws and spikes
  splash it red - a little per hit, patchiest at the hem. Stains fade by themselves over a minute or two, and **water washes them off**: stand in the
  rain (the graveyard) or wade through a shallow pool (the village street, the swamp) and they run off in seconds.
* **Save altars** (candle shrines in small sanctuary rooms) heal you and save to the browser's localStorage.
  Dying returns you to your last altar.

## Procedural castle

Each new game builds its castle from a **seed**: the zones, boss order, abilities, save sanctuaries and secrets are always
where they should be, but every room's insides are re-rolled - ground height, pits, bridges, spike runs, steps, ledges,
the layout of the climbing towers, arena platforms, where the enemies stand and where the statues, barrels and scenery go. (The opening Market Street
  is hand-built and the same every time.)

* New game = a random seed.  **Choose Seed** on the title screen lets you type one (the same seed always builds the same
  castle, so you can share them).  `0` is the classic castle (the original hand-built rooms, plus the newer zones built from seed 1).  `?seed=1234` in the URL also works.
* The seed is shown on the map and pause screens and is stored in your save, so Continue always loads the same castle.
* **Nothing impossible ever ships.** Each generated room is simulated with the game's *real* movement code (same physics
  constants and collision routines as the player - checked jump-for-jump against the live player): a search over
  every jump / double jump / dash the player can make must prove that
  entrance and exit connect **both ways**, the save door, altar and lore tablets can be reached, ability secrets
  (e.g. the Double Jump ledges, the dash gulf) need exactly the ability they're meant to, sealed cells open only once their
  gate is destroyed, and nothing spawns inside a wall. Doorways between rooms are checked too. A room that fails is
  re-rolled (usually 1-2 tries); if it somehow can't be fixed it falls back to its hand-built version.
* Generating a castle takes about half a second.

## Music

Put your tracks in **`music/`** and list them in **`music/TRACKLIST.txt`**.
That file is both your to-do list (each track has a mood description *and a Suno prompt*, all sharing five recurring
leitmotifs) and the config the game reads: each line maps an ID to a file name. Missing tracks are skipped silently,
so you can add them one at a time and just refresh - except that a **level** (or boss) with no track of its own plays one of **`general_track_1` ... `general_track_4`** instead, picked at random (the final boss and the second boss theme try the ordinary boss track first; stings, the title, intro and ending never borrow one). `.mp3`, `.ogg` and `.wav` all work. Edit the FILE NAME column to
point a track at any file (spaces and brackets are fine).

## Project layout

```
index.html          page + canvases (2D sprite canvas with the three.js effects canvas stacked on top)
server.js           zero-dependency static server for local play (+ a live /__music file listing; not needed on GitHub Pages)
 credits.txt        what the title screen's CREDITS option shows (plain text, yours to edit)
play.bat / play.ps1 Windows launchers
src/
  main.js game.js   boot + the game state machine, room loading, combat, bosses, rendering
  stain.js          cloak stains: what singes / dirties / bloodies the cloak, and how fast they fade or wash off
  player.js         the stranger (movement, ducking, sword, dash, spells)      cloak.js   the white cloak: a hanging cloth drawn behind the sprite
  enemies.js        regular monsters + the wyrms      beasts.js   villagers, swamp creatures, cultists, zealots
  bosses.js         the nine bosses + telegraphed hazard columns
  mirror.js         the Mirror Room: the mirror (frame, glass, cracks) and the items the Reflection throws
  items.js itemdata.js   throwable items: the data (limits, pack sizes) and the thrown objects / effects
  projectiles.js    fireballs, bones, shockwaves, fire patches     props.js   pickups, statues, barrels, altar, waystones, relics
  world.js          tile themes (auto-tiled from the tilesets), parallax backgrounds, collision queries
  rooms.js          the hand-built castle (the builder DSL, zone themes, and the seed-0 / fallback layouts)
  levelgen.js       procedural castle: seeded room generators + the world builder (validation, retries, linking)
  validate.js       reachability prover (jump simulation + search)       physics.js   movement constants shared with the player
  enchant.js        sword enchantment data + effects
  fx.js             three.js effects: particles, flame shaders, lightning, rings, magic circles, light/darkness
  procart.js        code-drawn pixel art: bat, icons, props
  audio.js          music manager + synthesized sound effects      ui.js   HUD, menus, map, story screens
  touch.js          the on-screen controls for phones and tablets (HTML buttons that hold the same actions as the keys)
  font.js           gothic text: Pirata One + Almendra (+ Blackletter for the title) drawn as vector text on the hi-res canvas (bitmap fallback if the fonts are missing)
  assets.js input.js util.js decor.js viewer.js     decor.js also draws the bookcases and barred windows in code, and animates the torches
assets/             sprites + environment art (+ sprites.json frame manifest, original licenses), fonts/ (the two gothic TTFs)
                    (assets/sprites/source/ holds the art packs as downloaded - keep that folder out of anything you publish, see CREDITS.md)
lib/three/          three.js r187 (MIT)
music/              your tracks + TRACKLIST.txt
```

### Testing the generator

```
node tools/test-levels.mjs 300 1       # build 300 castles; reports retries, fallbacks, doorway problems
node tools/test-fallback.mjs           # mixes hand-built rooms into generated castles; links must stay sound
node tools/dbg-room.mjs h2 7 0         # ASCII picture of room h2 for seed 7 (attempt 0)
```

To change what can be generated edit the `SPEC` table (names, sizes, secrets, enemy mixes) or a room generator in
`src/levelgen.js`; the validator rejects anything unbeatable, so experimenting is safe.

### Editing levels

The classic castle (seed 0) is authored in `src/rooms.js` with a tiny builder - coordinates are in 16-px tiles:

```js
const b = new B('g1', 'Iron Gate', 1, 60, 14, { weather: 'rain', storm: true });
b.floor(0, 60, 12).block(30, 10, 4, 2).plat(14, 4, 9);      // ground, a raised block, a one-way platform
b.many('zombie', [18, 28, 42], 12).e('bat', 38, 5);        // enemies (x tile, ground row)
b.candle(12, 12);                                          // a lit candelabra (scenery only)
b.e('statue', 40, 12, { drop: 'heart' });                  // breakable statue: 2-3 hits, a heart plus extras
b.exit('R', 9, 11, 'g2', 1, 12);                           // walk off the right edge -> room g2, tile (1,12)
```

The header comment in that file lists the movement budget (jump height/distance with and without abilities) so gaps
can be designed to require - or not require - a power-up.

### Debug helpers

* `http://localhost:8080/?viewer=hero,vampire` - sprite sheet viewer (any sheet-id prefix).
* In the browser console: `game.debug.seed(1234)` jumps into the castle for a seed, `game.world.report` shows how it was
  generated, `game.debug.tp('c2', 4, 12)` teleports to a room, `game.debug.giveAll()` grants every
  ability, `game.debug.god()` makes you invulnerable.

## Credits

The title screen has a **CREDITS** option. What it shows is the plain text file **[credits.txt](credits.txt)** - edit it freely (the format is explained at the top of the file), save, and reopen the screen. Full details and licence links are in [CREDITS.md](CREDITS.md) (some of the art requires attribution - it is all listed there). Most sprites and tiles are CC0 art by Luis Zuno (Ansimuz) from OpenGameArt; the bat,
icons and props are original pixel art drawn in code for this project; sound effects are
synthesized live.
