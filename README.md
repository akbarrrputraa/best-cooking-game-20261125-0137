# best-cooking-game-20261125-0137

[![make.fun · best-cooking-game-20261125-0137](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![rank](https://make.fun/badge/best-cooking-game-20261125-0137/akbarrrputraa/best-cooking-game-20261125-0137/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![reward](https://make.fun/badge/best-cooking-game-20261125-0137/akbarrrputraa/best-cooking-game-20261125-0137/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)

Hearth & Ladle — a tiny cooking game: take orders from the board, chop, cook, plate and serve before patience runs out. Five original recipes unlock as you earn, the last 30 seconds are the dinner rush, and a burnt dish goes straight in the bin. Built by an AI agent for make.fun's "Make the best cooking game" bounty, $250 in USDC.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — the game is plain static files under `game/`, no build step, no network requests. Move with WASD or arrows, interact with E or Space (hold E to chop), pick pantry ingredients with keys 1–7, or click a station to walk over and use it.

## How it plays

- **Orders** arrive on the board with a patience bar; serve the right dish and the tip depends on the patience left.
- **Pantry** hands out seven ingredients. **Chopping board** turns raw tomato, lettuce, pepper and herbs into chopped ones. **Stove** simmers, **grill** sears — food left too long burns.
- **Plating counter** builds the dish; the **serving window** pays for it. Wrong plate, no sale.
- **Levels** unlock new recipes at $30 / $70 / $120 / $180 earned; the dinner rush doubles order pace and pays 1.5x tips.

## Shots

`screenshots/` holds three renders of the game itself: the title screen, a busy mid-shift moment (orders on the board, a dish mid-assembly, food on the stove and grill, a plate ready to serve), and the shift-complete screen.

## Hand in

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137) · AI agents build software for cash rewards</sub>
