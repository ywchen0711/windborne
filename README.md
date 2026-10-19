# 風息之地 · Windborne

An open-world action adventure in the browser, in the spirit of *Breath of the Wild*: wake on a plateau, glide down to a wide island, and go anywhere. Climb anything, cook what you gather, solve shrines with four runes, and free the four great shrines before you face the Gloomshade in the castle. Chinese and English; keyboard and mouse or touch.

Play: https://ywchen0711.github.io/windborne/

## The land
A 1.6 km island shaped by noise and hand-placed landmarks:
- **Dawn Plateau**, where you wake, ringed by cliffs you can only leave by gliding.
- **The Heartland**, with the castle at its centre, guarded by ancient sentinels.
- **Frostspire Peaks** in the north, where it is cold enough to hurt.
- **Emberpeak**, a volcano with a lava crater.
- **The Azure Shore** with its lake and eastern sea, and **Windhollow Village**.
- **The Goldsand Desert** and **Mistwood**, where a sword waits.

## What you can do
- **Move anywhere.** Walk, run, sprint, swim and climb any steep slope, wall, tree or tower while your stamina wheel lasts. Rain makes rock slippery.
- **Glide.** The paraglider opens with jump in mid-air.
- **Towers (7).** Climbing one and waking it reveals its region on the map and lets you fast travel there. Its ledges let you rest on the way up.
- **Shrines (16).** Each is a puzzle corridor ending in a Spirit Orb. The four on the plateau teach the runes:
  - **Magnet**: carry metal.
  - **Bomb**: break cracked walls and ore.
  - **Ice**: raise climbable pillars from water.
  - **Stasis**: freeze mechanisms and objects; hits store force.
- **Spirit Orbs.** Four orbs at the goddess statue buy a heart or more stamina.
- **Great shrines (4).** Each ends with a Blight to defeat. Freeing one grants a champion's gift and weakens the final foe by 20%:
  - **Gale**: an updraft.
  - **Guardian**: blocks a hit.
  - **Grace**: revives you.
  - **Thunder**: lightning around you.
- **Fighting.**
  - **Weapons** break as you use them: one-handed, two-handed and spears.
  - **Bows** have arrows and slow time while you aim in mid-air.
  - **Shields** block, and a perfect guard sends a sentinel's laser back.
  - **Enemies**: goblin camps with archers on lookouts, ogres, sentinels that charge a laser, and shrine scouts. Clearing a camp leaves a chest.
- **Gathering and cooking.** Apples (shake the tree), mushrooms, heart radishes, vigor mushrooms, fire peppers, meat from boars, and ore to smash. Cook up to five ingredients in a pot: one effect gets stronger, mixed effects cancel.
- **Leaf sprite seeds (42).** Lift an odd little rock or reach a lonely peak. Grandpa Leaf trades them for bigger pouches.
- **The village.** A shop (arrows, outfits, gear), an inn, a goddess statue and the elder.
- **Outfits.** Warm Doublet for the cold, Climbing Gear, Soldier's Armour.
- **Time and weather.** A day lasts 24 minutes, with rain, and a Blood Moon every third night that brings monsters back.

## Controls
- **Keyboard and mouse:**
  - WASD: move. Mouse: look (click to lock). Shift: sprint / swim dash / let go while climbing.
  - Space: jump / climb-jump / open the glider.
  - Left click: attack. Hold right click: aim the bow. Hold Q: shield.
  - E: interact. R: rune. 1-4: choose rune. Tab: inventory. M: map. G / F: gifts.
  - Wheel or [ ]: switch weapons (magnet distance while holding something). C: let go while climbing.
  - Attacks turn you toward the targeted enemy (yellow arrow). Hints in the corner change with what you are doing, and tips appear the first time you get a weapon, bow, shield or the glider.
- **Touch:** a stick on the left, drag on the right to look, and buttons.

## Code
Plain ES modules and three.js (from the CDN):
- `js/world.js`: the land and every place. Pure math, so it is shared with the tests.
- `js/physics.js`: movement and climbing.
- `js/gfx.js`: drawing.
- `js/models.js`: characters.
- `js/entities.js`: enemies, props and runes.
- `js/shrine.js`: shrine layouts.
- `js/items.js`: items and cooking.
- `js/ui.js`: the HUD and menus.
- `js/audio.js`: sound.
- `js/main.js`: the game.

`npm test` checks the world, the physics (walking, climbing a tower, gliding, swimming), cooking and the shrines.
