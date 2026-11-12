# Credits

## Art - Luis Zuno ("Ansimuz"), CC0 / public domain

Downloaded from OpenGameArt.org. All three packs are released under CC0 ("public domain and free to use for personal or
commercial projects; credit appreciated"). The original license texts are in `assets/credits/`.

| Pack | Used for | Link |
|---|---|---|
| Gothicvania Patreon's Collection | ghost, fire skull, hell hound, wolf, Hell Beast, Nightmare, Demon, the Gothic Castle and Old Dark Castle tilesets/backgrounds | https://opengameart.org/content/gothicvania-patreons-collection |
| GothicVania Church Pack | burning ghoul, dark wizard, fireball, angel, enemy-death effect, chapel tileset/backgrounds/column | https://opengameart.org/content/gothicvania-church-pack |
| GothicVania Cemetery Pack | skeleton, shambling ghoul (zombie), lantern wraith, graveyard tileset, sky, mountains, trees and gravestones | https://opengameart.org/node/85024 |

More free art by the author: https://www.patreon.com/ansimuz  and  http://www.pixelgameart.org

Some sprites are recolored at load time (bone-white skeleton, green zombie, frost hound, etc.).

## The hero - Gothic Hero by Ansimuz

The cloaked stranger is the "Gothic Hero" from the Gothicvania Patreon's Collection above (CC0). The sword-enchantment arcs are recolors of its slash frames made at load time, and so is the Reflection (the boss in the Mirror Room): the same sheets with all 19 colours swapped for silver and violet.

An alternative hero, *Dark Hooded Warrior* by oliveiramiro2, is archived in `assets/archive/hooded-warrior/` and is not loaded.

### Archived: Dark Hooded Warrior - oliveiramiro2

"Dark Hooded Warrior - pixel art player character" (free to use), https://oliveiramiro2.itch.io/dark-hooded-warrior-pixel-art-player-character-free-2d-sprite
Not used right now. The pack ships without a formal license file; see `assets/archive/hooded-warrior/license-dark-hooded-warrior.txt`
(check the author's page again before any commercial release if you ever put it back).

## More art added later

| Pack | Author | License | Used for |
|---|---|---|---|
| [Gothicvania Town](https://opengameart.org/content/gothicvania-town) | Luis Zuno (Ansimuz) | CC0 | the Burning Village: houses, props, dusk sky and skyline, and the four villagers |
| [Gotthicvania Swamp](https://opengameart.org/content/gotthicvania-swamp) | Luis Zuno (Ansimuz) | CC0 | the Weeping Swamp zone: ground, backdrop layers, giant trees, ferns; swamp spider and swamp thing |
| [Mountain at Dusk Background](https://opengameart.org/content/mountain-at-dusk-background) | Luis Zuno (Ansimuz) | CC0 | the mountain ranges behind the burning village |
| [Haunted Forest Trees](https://opengameart.org/content/haunted-forest-trees) | ETTiNGRiNDER | CC0 | the gnarled dead trees in the graveyard rooms |
| [Castlevania-esque Tilemap (Stone and Bricks)](https://opengameart.org/content/castlevania-esque-tilemap-stone-and-bricks) | Chloe Wolfe | **CC-BY 4.0** (attribution required) | the village's cobbled street and brickwork |
| [Bosses and Monsters Spritesheets (Ars Notoria)](https://opengameart.org/content/bosses-and-monsters-spritesheets-ars-notoria) | Balmer, with Redshrike | **CC-BY 3.0** (attribution required) | the acolyte (disciple), archmage (mage-2), brass sorcerer (mage-1), and the three bosses: the Cinder Warden (gnu), the Brazen Hierophant (mage-1, drawn larger) and the Mire Mother (Andromalius + tentacles) |
| [Super Dead Gunner: Cyber-tooth (enemy)](https://opengameart.org/content/super-dead-gunner-cyber-tooth-enemy) | Emcee Flesher | **OGA-BY 3.0** (or CC0; attribution required under OGA-BY) | the bone / frost / ember wyrms (the sheet is sliced and re-assembled in code) |

### The newest packs

| Pack | Author | License | Used for |
|---|---|---|---|
| ["Final" graveyard set](https://anokolisa.itch.io/) | Anokolisa | free for commercial use, credit optional (shapes / colours changed = no credit owed) | the moonlit graveyard backdrop: moon and clouds, the mausoleum + chapel silhouette, ivy and headstone foliage (drawn at half size) |
| xxg_4_free (vampire character sheet) | xxg | **no licence file came with the download - confirm the terms with the author before a public release** | the Crimson Count (the optional boss in the Nave's crypt); the painted sheet is cut into strips and scaled down by the build step |
| Pixel Platformer Set 1 | Szadi art | public domain - may be edited, but the pack may not be sold | the sickle-fighter **zealot** and the sparkling diamond |
| The Sidescroller's Dungeon - Tileset [32x32] | (see the itch.io page of the same name) | **no license file came with the download - check the author's page before any public / commercial release** | the teal pillars, banners, urns, crates, stone arch and wooden door, and the animated torches |

The packs as downloaded are kept in `assets/sprites/source/` for reference; the game only uses the pieces it cuts out of them into `assets/env/` and `assets/sprites/`.
If you publish the game, ship the game's own files and **do not publish the `source/` folders** (several of these packs forbid redistributing them as packs).

Attribution: "Castlevania-esque Tilemap" by Chloe Wolfe, CC-BY 4.0 (https://creativecommons.org/licenses/by/4.0/); "Bosses and Monsters
Spritesheets" by Balmer, with Redshrike, CC-BY 3.0 (https://creativecommons.org/licenses/by/3.0/); "Cyber-tooth" by Emcee Flesher, OGA-BY 3.0.
The wyrm sheet, the Ars Notoria sheets and the tilemap were cropped / rearranged for use in the game; the only other change is load-time color shifts.

## Portraits

| What | Source | Licence |
|---|---|---|
| The fifteen painted portraits (five expressions each) in `assets/portraits/` | supplied by the game's author | **not recorded here - confirm the origin and that they may be published before a public release** |

The game does not ship the full-size pictures: `tools/pixelate-portraits.ps1` shrinks them to 26x33 pixels, gives each person one 32-colour palette, and packs them into `assets/portraits/pixel/portraits.png`.

## Fonts - SIL Open Font License 1.1

| Font | Used for | Source |
|---|---|---|
| **Pirata One** (Rodrigo Fuenzalida, Nicolas Massi) | the logo, banners, menus, HUD and floating text | https://fonts.google.com/specimen/Pirata+One |
| **Almendra Bold** (Ana Sanfelippo) | dialogue, lore tablets, the story crawl and descriptive text | https://fonts.google.com/specimen/Almendra |

The font files are in `assets/fonts/`; the licenses are in `assets/credits/license-pirata-one-OFL.txt` and `license-almendra-OFL.txt`.

| Font | Used for | Licence |
|---|---|---|
| **Blackletter ExtraBold** (`BLACEB__.TTF`, (c) 2001 Typographer Mediengestaltung) | the game title on the title screen | **no licence file came with it** - the font file says "All rights reserved"; confirm that it may be redistributed before a public release |

## Original art made for this project

The bat, item icons, props (candelabra, torch, bookcase, barred window,
brazier, altar, tablet, chest, pedestal, spikes, breakable/burnable/crystal/seal tiles) and projectiles are drawn
in code - see `src/procart.js`.

## Code and libraries

* **three.js** r187 - MIT license, https://threejs.org (`lib/three/`)
* Game code, shaders, level data, and synthesized sound effects: written for this project.
* Pixel font: a 5x7 bitmap font defined in `src/font.js`.

## Music

Created by the project owner - see `music/TRACKLIST.txt`.
