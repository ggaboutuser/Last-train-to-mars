# Last Train to Mars To-Do Plan

## Completed in this cleanup pass

- Removed the Art Creator tab from the game UI.
- Reworked battle into one focused combat screen.
- Moved crew status to the bottom-left of the battle screen.
- Moved the command console to the bottom-right of the battle screen.
- Moved sprites upward into the central battlefield area.
- Converted the item menu into a popup that appears only after clicking `Item`.
- Added a continuous canvas animation loop so idle sprites animate.
- Added temporary attack, skill, hurt, and defeat animation states.
- Applied the sci-fi UI font, panel, button, and bar assets from `D:\AiCE\Creative AI Studio\Project\ui`.
- Copied the required UI pack files into `assets/ui-pack` so the project is more portable.

## Phaser 3 Migration

1. Add Phaser 3 to the project with a proper local dev setup.
2. Create Phaser scenes: `BootScene`, `MapScene`, `BattleScene`, `UIScene`, and `ResultScene`.
3. Move battle sprites from HTML canvas drawing into Phaser sprite objects.
4. Move turn logic into plain game systems that Phaser scenes call.
5. Replace DOM-based sprite animation with Phaser animations and spritesheets.
6. Keep HUD controls in either Phaser UI containers or a clean DOM overlay, then choose one direction.
7. Add asset preloading for sprites, UI pack images, backdrops, and fonts.

## Battle System

1. Add proper target selection modes for attacks, ally skills, enemy skills, and items.
2. Make each action resolve with visible timing instead of resolving the whole turn instantly.
3. Add floating damage numbers and healing numbers.
4. Add enemy intent indicators before the player confirms a turn.
5. Add boss-specific mechanics for each stage.
6. Add status icons for poison, shield, breach, attack boost, and locked.
7. Tune HP, damage, item drops, and skill charge per stage.

## UI And UX

1. Add a clear selected-character highlight on the battlefield sprite.
2. Add target reticles using the UI pack crosshair assets.
3. Add item popup categories for healing, boost, shield, and skill charge.
4. Add confirmation feedback after each crew member chooses an action.
5. Add a stage-clear and defeat result screen.
6. Improve responsive layout after the Phaser canvas size is finalized.
7. Replace temporary text-heavy panels with compact icon-based controls.

## Art And Animation

1. Replace procedural placeholder sprites with real pixel spritesheets.
2. Create separate animations for each crew member: idle, attack, skill, hurt, defeat.
3. Create separate animations for each enemy and boss.
4. Add stage backdrop art for all 5 stages.
5. Add item icons for all consumables.
6. Add screen shake, hit flashes, and skill effects.
7. Add train/map visual assets for the tactical rail map.

## Project Structure

1. Split `src/main.js` into smaller modules.
2. Create folders for `scenes`, `systems`, `data`, `ui`, and `sprites`.
3. Move stage, enemy, item, and crew data into JSON or typed JS modules.
4. Add save/load through local storage.
5. Add a simple settings menu for volume and text speed.
6. Add automated smoke tests for stage start, action selection, item popup, and victory flow.

## Audio And Polish

1. Add ambient Mars rail background music.
2. Add UI click, hover, confirm, and cancel sounds.
3. Add attack, skill, heal, and damage sound effects.
4. Add transitions between map and battle.
5. Add intro story cards for each stage.
6. Add final ending screens based on the player outcome.
