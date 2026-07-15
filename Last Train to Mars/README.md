# Last Train to Mars

A self-contained browser vertical slice for the turn-based pixel RPG concept.

## What is implemented

- Tactical Mars rail map with 5 stages
- 2 hordes per stage plus boss battle
- 4 crew members with one unique skill each
- Turn planning for the whole crew before resolution
- Battle screen HUD with crew status bottom-left and command UI bottom-right
- Item popup that opens only when the player clicks `Item`
- Character info panels with HP, skill bar, and glowing skill-ready state
- Enemy weaknesses, drops, scrap rewards, and checkpoint progression
- Sci-fi UI styling adapted from the provided `ui` asset pack
- Continuous canvas redraw loop for simple sprite animation

## Open in VS Code

1. Open this folder in VS Code.
2. Open [index.html](./index.html) in a browser or use Live Server if you prefer.
3. No install step is required.

## Project structure

- `index.html` bootstraps the app
- `src/main.js` contains the game loop and art preview logic
- `TODO.md` tracks the Phaser 3 migration and next production tasks
- `src/gameData.js` contains stages, units, items, and enemy data
- `src/styles.css` contains the full visual system

## Next recommended steps

- Move the current vertical slice into Phaser 3 scenes
- Replace placeholder canvas sprites with real spritesheets
- Add action timing, target reticles, and battle result screens
- Save progress to local storage
