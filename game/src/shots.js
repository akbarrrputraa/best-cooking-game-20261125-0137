// Hearth & Ladle — screenshot staging for the maker's own screenshots.
// ?shot=start shows the title screen, ?shot=play a busy mid-shift moment
// (orders on the board, a dish mid-assembly, food on the stove, a plate
// ready to serve), ?shot=end the shift-complete screen. A seed keeps the
// staged moment reproducible. This only stages a moment; the game plays
// the same way without it.

import { RECIPES } from './config.js';
import { createWorld } from './world.js';

function recipeById(id) {
  return RECIPES.find((r) => r.id === id);
}

export function stageShot(shot, seed) {
  const w = createWorld(seed);
  if (shot === 'start') {
    w.phase = 'title';
    // A lively kitchen behind the title: a couple of tickets waiting.
    w.orders = [
      { id: 1, recipe: recipeById('soup'), patience: 62, maxPatience: 80, born: 0 },
      { id: 2, recipe: recipeById('salad'), patience: 44, maxPatience: 80, born: 0 },
    ];
    w.stove = [{ ing: 'tomato', progress: 0.55, over: 0, state: 'cooking' }, null];
    return w;
  }
  if (shot === 'end') {
    w.phase = 'over';
    w.coins = 132;
    w.served = 9;
    w.bestStreak = 5;
    w.streak = 5;
    w.level = 4;
    w.orders = [];
    return w;
  }
  // The busy middle of a shift.
  w.phase = 'playing';
  w.elapsed = 96;
  w.timeLeft = 84;
  w.coins = 58;
  w.served = 5;
  w.streak = 3;
  w.bestStreak = 4;
  w.level = 3;
  w.orders = [
    { id: 4, recipe: recipeById('soup'), patience: 52, maxPatience: 80, born: 0 },
    { id: 5, recipe: recipeById('skewer'), patience: 30, maxPatience: 76, born: 0 },
    { id: 6, recipe: recipeById('fish'), patience: 68, maxPatience: 84, born: 0 },
  ];
  // A dish mid-assembly on the plating counter: grilled fish, herbs to add.
  w.plate = [{ ing: 'fish', state: 'cooked' }];
  // The chef carries chopped herbs toward the plate.
  w.carry = { kind: 'item', ing: 'herb', state: 'chopped' };
  w.chef.x = 640;
  w.chef.y = 560;
  w.chef.facing = 1;
  // A tomato simmers on the stove, a pepper sears on the grill.
  w.stove = [{ ing: 'tomato', progress: 0.62, over: 0, state: 'cooking' }, null];
  w.grill = [{ ing: 'pepper', progress: 0.8, over: 0, state: 'cooking' }, null];
  w.board = { ing: 'lettuce', progress: 0.45 };
  w.message = { text: 'Chopped herbs ready — finish the fish plate!', life: 99 };
  return w;
}
