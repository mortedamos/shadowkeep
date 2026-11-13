# SHADOWKEEP

A gothic-fantasy, side-scrolling action-adventure for the browser, in the spirit of *Castlevania* and *Bloodstained*.
You are a nameless cloaked stranger with a sword, exploring a haunted castle: platforming, secrets, power-ups,
nine zones laid out as a branching map, ten bosses (one of them optional), throwable items, waystone travel, and a three.js effects layer (fire, flickering candles, lightning, auras, mist). Text is set in two
free gothic typefaces (Pirata One and Almendra, with Blackletter ExtraBold for the title and Eroded Motta for the gravestones) rather than a pixel font. The hero is Ansimuz's Gothic Hero (the hooded-warrior set is archived in `assets/archive/`), draped in an
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
| Jump (variable height) | Space / Z / K  - press again in mid-air once you own the **Aether Feather** |
| Attack (tap again for a 3-hit combo) | X / J  (works in the air too; the hero stays planted while swinging) |
| Duck | hold Down / S  - shrinks your hitbox; you can slash while ducking (a low cut that skims the floor) |
| Drop through one-way platforms | Down / S  + Jump |
| Dash (invulnerable) | Shift / L  - needs the **Quicksilver Step** |
| Use the selected spell or item | C / I |
| Move the selection box (top of the screen) | Q (left) / V (right) |
| Use altar, read tablet, open chest, enter door, use a waystone | Up / W / E |
| Map (arrow keys scroll it) / Pause | M or Tab / Esc, P or Enter |
| Mute | N  (the game also pauses and mutes by itself when the window loses focus) |

A gamepad also works (A jump, X attack, B dash, Y use selected, bumpers move the selection, Start pause, Back map).

**Phones and tablets:** on-screen controls appear by themselves on a touch screen (and go away when a key is pressed). A round **D-pad** at the bottom left: slide a thumb round it to run, duck, or go up a door (up is also USE). **JUMP** and **HIT** are the big buttons on the right (they are also OK and BACK in the menus); **DASH**, **ITEM** (uses the selected spell or item) and the two small arrows that change the selection sit above them, and **MAP**, **II** (pause) and a full-screen square run along the top. Tap a menu item to pick it, tap the item box in the corner to change the selection, tap to advance a dialogue. Turn the phone sideways for a bigger picture (held sideways, the picture gives up some width so the controls only overlap its edges a little; on a squarer tablet the controls take a strip under it instead). Add `?touch=1` to the address to force the pad on (or `?touch=0` to keep it off); Options > TOUCH PAD switches it by hand. On the iPhone, "Add to Home Screen" runs the game full screen.

## The story

*Prague, Bohemia, 1541* - the year of the great fire of Prague. The Stranger - we never learn his name - is found kneeling at a grave on a hill above the city, in the rain: the grave of a woman who was his wife, his sister, his lover (the game never says). She died to the
**Shadowkeep**, the castle that rose out of the countryside, took the **sun** and let the things of the shadow-realm walk the earth. As he kneels the city far below begins to burn. He rises, draws the sword **Silberzahn**
("the silver tooth") and goes down to it. Under his white cloak there is armour: a soldier's, or a monster-hunter's.

* **An opening scene** (once, at the start of a new game; any key skips it): rain, a tolling bell, the grave with a blue candle on it, the title card, the glow of fire rising over the roofs. It is a real room - **the Hill Above Prague**, west of Market Street - with a tablet of its own.
  Its music is the `intro` track.
* **Her ghost walks behind him** - pale, translucent, her lower half fading into nothing. She is invisible except in an **arcane (blue) light**: a waystone, a will-o'-the-wisp, a blue seal-flame, the candle on her grave, the **Ignis Fatuus**
  lantern - which is HER: the pale blue wisp you carry once the Mire Mother falls follows where the ghost used to float, and from then on the ghost is no longer seen. **Every tablet and gravestone is her voice** (the stones are a headstone from the Graveyard 400 Assets pack, with flowers at their feet), lettered in the Eroded Motta font, in mixed case (it has no colon, so colons become dashes): advice about the road ahead, and what it is to be a ghost. She shows for a while whenever one speaks. (Signposts are only signs.)
* **Every boss speaks to the Stranger before the fight** (once), and some say a last word as they fall; the Shadow Lord's come just before the sun rises. The ending returns to the grave.
* **Alchemy, as Prague loved it.** The sun is the **Azoth**, the light that wakes it. The spells are **Sulphur** and **Vitriol**; the feather is **Aether**, the dash **Quicksilver**; the containers are the **Elixir Vitae** and the **Quintessence**;
  the whetstone is **Sal Martis**; the boss rewards are the **Salamander Mantle**, the **Ignis Fatuus Lantern**, the **Speculum Shard**, the **Perpetuum**, the **Aqua Regia** and the **Shoes of Hermes**; holy water is **Aqua Vitae**, the bandage **Panacea**.
  The six keys are the **Keys of Lead, Iron, Silver, Tin, Copper and Mercury** (the metals of the old planets; gold, the Sun, is what was stolen). The four stages of the Great Work - Nigredo, Albedo, Citrinitas, Rubedo - are the frame the text hangs on.
* **All the words are in one file, `src/story.js`:** the opening, her tablets, each boss's exchange and the ending. Edit it freely - it is plain text in capitals, nothing else needs to change.

## The game

* **9 zones in a branching castle - one look per zone.** The story is set in **Bohemia**; you begin in its capital, **Prague**. A level never mixes tilesets; each look gets its own level.
  It is a graph, not a corridor: after the Graveyard the way splits at **the Three Roads** (a crossroads with a waystone) into the **Weeping Mire** (a door high on a ledge - it needs the Double Jump), which runs on into **the Cistern**,
  the **Great Hall**, and the **Moonlit Chapel** (its door is sealed until the masters of the Hall and of the Cistern are dead). The Chapel leads to a second crossroads, **the Crossing Hall**, where the way splits again into **the Crypts**
  (barricaded: burn it) and the **Shadow Throne** (sealed by crystal - Thunder - and by the Crimson Count and the Hierophant). The **Clockwork Dungeon** is not on the crossroads at all: its way in is back in **Prague** - a locked door high above Smouldering Lane (it needs the **Key of Tin** from the top of the Bone Stair, and the double jump) leads up **the Orloj Tower** (Smouldering Lane is a tall street, and the tower itself - a pixelated picture of the real Prague Orloj tower - rises behind that door), where the great astronomical clock hangs in a shaft of turning cogwheels (with a few faded, animated gear clusters from the Animated Gears pack among them) and swinging pendulums, and the door to the Clockwork Dungeon stands on the landing beside it. You must go back for it. Every door at a
  crossroads has a signpost, every branch ends in a door that drops you back at its crossroads, and the order in which you do the branches is yours. `tools/test-world.mjs` proves, for every castle, that it can be finished
  and that each of those locks really needs its key. Open room edges (marked by a small arrow on the screen edge), **doors** (UP) and fade transitions connect the rooms; the zone name appears when you cross into a new one.
  The map draws every line from where its doorway really is (a tower is entered at its foot and left at its top, so it is plainly a way through), a gold mark where the way is a door, and a dotted line for the one-way doors that
  bring you back to a crossroads; unexplored doorways show as short stubs. Up / Down scroll it as well as Left / Right.
* **Prague is calm at dusk - until the Cinder Warden arrives.** The village starts as a violet dusk with the monsters already loose; as you start up Smouldering Lane, the first street beyond the Waystone Square, a short scene plays (you cannot move or strike, and the monsters
  freeze): the Warden steps out of the dark, hurls three torches that set the houses alight one by one, turns to look at you, and vanishes in flame. From then on Prague burns (Market Street too).
* **Moving gears.** The Clockwork Dungeon has brass-and-iron rooms and a background of gears behind gears, from ones half a hero tall to ones the size of the room. In **the Great Gear** you cross a pit on the *teeth* of three great turning
  wheels: every tooth on a wheel's upper side is a moving one-way platform that carries you with it - ride one up, over and down, and hop to the next.
* **Flowing water.** In the Cistern streams of water run along the floor and **carry the hero** the way they flow (wading: fully; in the air: a little), under waterfalls; the Drowned Warden keeps the gate at the end, and leaves the **Aqua Regia**:
  from then on a **dash cuts through** whatever it passes through (it wakes the moment you can dash).
* **The Disco.** A joke room off the Nave's upper floor: skeletons dance in the background, at three depths, under sweeping coloured spotlights and a mirror ball, to a track of its own. The **Shoes of Hermes** (+10% movement speed) wait at the far
  end. When you reach the middle of the floor the music dies with a record scratch, every skeleton stops and turns to look at you, and the lights swing round to find you. Come back later and the room is dark and empty.
* **Every boss leaves a power-up.** The four bosses that used to leave a heart or mana container now leave something that changes how you play: the **Cinder Warden** the **Salamander Mantle** (fire hurts half as much and soot never
  stains the cloak), the **Mire Mother** the **Ignis Fatuus Lantern** (a wisp follows you - it lights the dark, clears the fog around you and draws loot from much further off), the optional **Reflection** the **Speculum Shard** (your sword
  turns arrows, bones, orbs and thrown items back at their throwers, faster and now hurting them) and the **Hierophant** the **Perpetuum** (your dash recharges twice as fast). The other bosses already give a power (double jump, dash, Ember,
  Thunder, the Aqua Regia, the Azoth). The containers they used to carry are now on a high ledge in Prague, in a hidden cell in the Portrait Gallery and in two new locked vaults (below).
* **Keys and locked doors.** Six doors are **locked** - a padlock and chains are drawn over them, in the colour of their key - and lead to optional **vaults** (the Gravekeeper's, the Steward's, the Verger's, the
  Ferryman's and the Engineer's) with a chest inside - and to the **Orloj Tower**, which is not optional.  (The Count's Treasury, once locked, is open.) Each key is found earlier in the same zone: in a chest in a hidden cell of the Iron Gate, at the top of the Belfry Stairs, in a chest in the Nave, at the top of the Bone Stair, in a cell
  of Mire Edge, in a barricaded cell of the Escapement. Walk up to a locked door and press
  Up: without its key it tells you which one it needs; with it the door opens for good (the key is used up). Vaults are optional, and the Key of Tin lies on the way through the Crypts, so no key can ever lock you out of the game - `tools/test-world.mjs` proves every key is
  reachable and every locked door is shut without its key.
* **The pause screen shows what you have found:** the four powers (dim and unnamed until you find them), the Shoes of Hermes, the Aqua Regia and the rest once found, and the keys you carry. (They are no longer on the main screen.)
* **Breakable things glow faintly** - barrels and crates (in the colour of what they hold), cracked walls (lilac), barricades (embers) and crystals (ice); statues, which hold treasure, glow a little more.
* **Scenery stands on the ground.** On levels drawn over a parallax picture nothing hangs in the air: wall torches become braziers on the floor (fewer of them, clear of doors), barred windows are gone, and every framed portrait - painted
  or haunted - hangs on a freestanding pillar. Banners stay: they are fixed to the ceiling. (Towers have a brick shaft that does not slide, so they keep their wall torches.)
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
* **3D hood:** the hero wears the hood of his white cloak - a rounded cowl over the crown, a brim over the brow and the eyes (the opening is dark inside; only the nose, mouth and chin show), and the cloth gathered on his shoulders - drawn as a little textured mesh that is simulated like his cloak: it streams back when he runs, the brim **lifts off his eyes when he falls**, it is pressed flat when he rises (Options > 3D Hood, or `?hair=0`).
* **Hazards are always seen:** spikes are drawn again above the fog and the dark, and live only at the bottom of pits. Nothing stands in front of a door.
* **Candelabras** are scenery now (indoors only - never in the graveyard or the mire): they flank doors and waystones, stand beside tablets and at the foot of walls and steps, and are spaced along the floor - never on top of loot.
* **21 monster types:** bats, rising zombies, bone-throwing skeletons, phasing ghosts, orb-casting wraiths, charging fire skulls, hell hounds,
  burning ghouls and teleporting dark wizards - plus **bone / frost / ember wyrms** (skull-headed serpents whose whole body follows
  the head; they gape and rear back before they strike - a clean hit breaks the attack - and the ember kind spits fire),
  **swamp spiders** (they squat before they spring), **swamp things**, blue-robed **acolytes**, staff-wielding **archmages**, bronze-robed **brass sorcerers** (fire-hurling casters who slip away when you close in), red-robed **zealots** (Szadi's sickle fighter: he plants his feet, then lunges through a slash) and the **haunted portraits** on the walls.
* **10 bosses** with two phases each (one is optional: the **Reflection**, below; the Crimson Count now rules the Crypts and leaves Thunder): the Cinder Warden (the village's keeper - ember volleys, a staff slam, a leap, flame pillars once he is hurt; he leaves a heart container), the Gatekeeper (his fire breath is a tall arch of flame overhead - duck in the pocket right beside him, or stay out of its reach), the Mire Mother (a floating head of tentacles: marked holes in the ground, spore fans, spider summons; she leaves a mana crystal), the Phantom Steed, the Seraph of Ash, the Brazen Hierophant (master of the Clockwork Dungeon: he rises, then crashes down), the Drowned Warden (a blue many-armed thing over the flooded gate: tidal waves, water orbs, geysers, and a dive that comes up somewhere else), the Shadow Lord, and
  the optional **Reflection**: a second door on the upper floor of the Entrance Hall opens on the Mirror Room, where a great gilt mirror hangs on the back wall and shows you, mirrored, doing whatever you do. Walk in front of it and meet your reflection in the middle: the glass
  cracks and your reflection crashes out of it in silver and violet, with red eyes. It fights with a sword (a two-blow combo, three in the second half), a **shadow dash** that cuts as it ends, a leap,
  and the same items you carry: **daggers** (duck under them), an **axe**, a **torch** and **holy water** (lobbed at where you stand: the landing spot is marked) and a homing **magic arrow**
  (cut it down, or outrun it) - and it binds its wounds with a **bandage** when it can find a quiet moment: that is your opening. It leaves a mana container. Every attack is telegraphed: an **icon and name** appear over the boss about a second before it
  acts, then a coloured aura, a warning sound and a **danger zone** (charge lane, breath sweep, landing marker, slam
  area, lightning/flame columns) show during the windup. The boss is open to counter-attack after each move.
  Turn the icons/names off in Options > Boss Hints if you want a purer challenge (zones and sounds stay).
* **Metroidvania progression:** Double Jump (Aether), Quicksilver Step (dash), Sulphur (fire - burns barricades) and Vitriol
  (lightning - shatters crystal). Several secrets (Elixirs Vitae, Quintessences, Sal Martis) are only reachable once
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
  is hand-built and the same every time; everything else is generated, whatever the seed.)

* New game = a random seed.  **Choose Seed** on the title screen lets you type one (the same seed always builds the same
  castle, so you can share them).  `?seed=1234` in the URL also works. (A save made before the castle's layout last changed wakes at the start with everything it carries.)
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
  rooms.js          Market Street, the builder DSL (B), the zone table (ZONES) and the old hand-built rooms (no longer used, kept as a reference)
  levelgen.js       procedural castle: the room table (SPEC), the graph (CHAINS, PAIRS, RETURNS, PROGRESS), the room generators and the world builder (validation, retries, linking, map layout)
  gears.js          the turning gears of the gear room: each tooth is a moving platform that carries the hero      scenes.js   scripted scenes (the Cinder Warden setting Prague alight)
  validate.js       reachability prover (jump simulation + search)       physics.js   movement constants shared with the player
  enchant.js        sword enchantment data + effects
  fx.js             three.js effects: particles, flame shaders, lightning, rings, magic circles, light/darkness
  procart.js        code-drawn pixel art: bat, icons, props
  audio.js          music manager + synthesized sound effects      ui.js   HUD, menus, map, story screens
  touch.js          the on-screen controls for phones and tablets (HTML buttons that hold the same actions as the keys)
  font.js           gothic text: Pirata One + Almendra (+ Blackletter for the title, Eroded Motta for her gravestones) drawn as vector text on the hi-res canvas (bitmap fallback if the fonts are missing)
  assets.js input.js util.js decor.js viewer.js     decor.js also draws the bookcases and barred windows in code, and animates the torches
assets/             sprites + environment art (+ sprites.json frame manifest, original licenses), fonts/ (the two gothic TTFs)
                    (assets/sprites/source/ holds the art packs as downloaded - keep that folder out of anything you publish, see CREDITS.md)
lib/three/          three.js r187 (MIT)
music/              your tracks + TRACKLIST.txt
```

### Testing the generator

```
node tools/test-levels.mjs 300 1       # build 300 castles; reports retries, fallbacks, doorway problems
node tools/test-world.mjs 60 1         # plays every castle as a graph: each can be finished, and each lock really needs its key
node tools/dbg-room.mjs h2 7 0         # ASCII picture of room h2 for seed 7 (attempt 0)
```

To change what can be generated edit the `SPEC` table (names, sizes, secrets, enemy mixes) or a room generator in
`src/levelgen.js`; the validator rejects anything unbeatable, so experimenting is safe.

### Editing levels

Market Street (and the older hand-built rooms, kept as a reference) are authored in `src/rooms.js` with a tiny builder - coordinates are in 16-px tiles:

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
