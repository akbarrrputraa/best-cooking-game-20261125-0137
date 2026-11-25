// Hearth & Ladle — the kitchen itself: chef, stations, orders, cooking.
// One carried item at a time. Ingredients flow: pantry -> chop -> cook ->
// plate -> serve. A plate matches an order when its components equal a
// recipe's needs, whatever order they were added in.

import {
  BURN_AFTER_SECONDS,
  CHEF_RADIUS,
  CHEF_SPEED,
  CHOP_SECONDS,
  INGREDIENTS,
  INTERACT_DIST,
  LEVEL_SCORE,
  MAX_ORDERS,
  ORDER_PATIENCE_SECONDS,
  ORDER_SPAWN_RUSH_SECONDS,
  ORDER_SPAWN_SECONDS,
  RECIPES,
  RUSH_SECONDS,
  SHIFT_SECONDS,
  TIP_MAX,
  VIEW_H,
  VIEW_W,
} from './config.js';
import { makeRng, pick } from './random.js';
import { sfx } from './audio.js';

// Station rectangles (x, y, w, h) in canvas space.
export const STATIONS = {
  pantry: { id: 'pantry', name: 'Pantry', x: 36, y: 138, w: 210, h: 84, label: 'Pantry' },
  board: { id: 'board', name: 'Chopping Board', x: 276, y: 138, w: 210, h: 84, label: 'Chop' },
  stove: { id: 'stove', name: 'Stove', x: 516, y: 138, w: 230, h: 84, label: 'Stove' },
  grill: { id: 'grill', name: 'Grill', x: 776, y: 138, w: 230, h: 84, label: 'Grill' },
  window: { id: 'window', name: 'Serving Window', x: 1150, y: 300, w: 94, h: 220, label: 'Serve' },
  plates: { id: 'plates', name: 'Plating Counter', x: 420, y: 636, w: 440, h: 84, label: 'Plate' },
  bin: { id: 'bin', name: 'Bin', x: 920, y: 636, w: 130, h: 84, label: 'Bin' },
};

// Pantry shelves: click a shelf (or press 1-7) to take that ingredient.
export const PANTRY_ITEMS = ['tomato', 'lettuce', 'pepper', 'fish', 'herb', 'dough', 'berry'];

// Every solid counter the chef cannot walk through.
export function obstacles() {
  return Object.values(STATIONS).map((s) => ({ x: s.x, y: s.y, w: s.w, h: s.h }));
}

function stationCenter(s) {
  return { x: s.x + s.w / 2, y: s.y + s.h / 2 };
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// A carried thing: { kind: 'item', ing, state } or { kind: 'plate', items: [...] }.
function makeItem(ing, state) {
  return { kind: 'item', ing, state };
}

export function itemLabel(it) {
  if (!it) return '';
  if (it.kind === 'plate') {
    if (it.items.length === 0) return 'Empty plate';
    return `Plate: ${it.items.map((c) => componentName(c)).join(', ')}`;
  }
  return componentName(it);
}

export function componentName(c) {
  const ing = INGREDIENTS[c.ing];
  if (c.state === 'chopped') return `Chopped ${ing.name}`;
  if (c.state === 'cooked') return `Cooked ${ing.name}`;
  if (c.state === 'burnt') return `Burnt ${ing.name}`;
  return ing.name;
}

// The components a recipe needs, as a sorted key, for plate matching.
function recipeKey(needs) {
  return needs.map((n) => `${n.ing}:${n.state}`).sort().join('|');
}

function plateKey(items) {
  return items.map((c) => `${c.ing}:${c.state}`).sort().join('|');
}

export function recipeForPlate(items) {
  const key = plateKey(items);
  return RECIPES.find((r) => recipeKey(r.needs) === key) ?? null;
}

export function unlockedRecipes(level) {
  return RECIPES.filter((r) => r.level <= level);
}

export function levelForScore(score) {
  let level = 1;
  for (let i = 0; i < LEVEL_SCORE.length; i++) {
    if (score >= LEVEL_SCORE[i]) level = i + 1;
  }
  return Math.min(level, 5);
}

export function createWorld(seed = 1) {
  const rng = makeRng(seed);
  return {
    seed,
    rng,
    phase: 'title', // title | playing | over
    timeLeft: SHIFT_SECONDS,
    elapsed: 0,
    coins: 0,
    served: 0,
    bestStreak: 0,
    streak: 0,
    level: 1,
    rush: false,
    chef: { x: VIEW_W / 2, y: 580, vx: 0, vy: 0, facing: 1, moving: false, walkPhase: 0 },
    carry: null,
    board: null, // { ing, progress } chopping in progress
    stove: [null, null], // { ing, state, progress, over } per burner
    grill: [null, null],
    plate: [], // components on the plating counter's plate
    orders: [], // { id, recipe, patience, maxPatience, born }
    nextOrderId: 1,
    spawnIn: 6,
    floaters: [], // { x, y, text, color, life }
    banner: null, // { text, life }
    message: null, // { text, life } hint / error line
    chopHeld: 0,
    sizzleAt: 0,
    walkTarget: null,
    pantryPick: null,
  };
}

function addFloater(w, x, y, text, color) {
  w.floaters.push({ x, y, text, color, life: 1.6 });
}

function showMessage(w, text) {
  w.message = { text, life: 2.2 };
}

function nearestStation(w) {
  let best = null;
  let bestD = Infinity;
  for (const s of Object.values(STATIONS)) {
    const c = stationCenter(s);
    const d = dist(w.chef.x, w.chef.y, c.x, c.y);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return bestD <= INTERACT_DIST + 60 ? { station: best, dist: bestD } : { station: null, dist: bestD };
}

function spawnOrder(w) {
  const unlocked = unlockedRecipes(w.level);
  const recipe = pick(w.rng, unlocked);
  const patience = ORDER_PATIENCE_SECONDS * (0.9 + w.rng() * 0.25);
  w.orders.push({
    id: w.nextOrderId++,
    recipe,
    patience,
    maxPatience: patience,
    born: w.elapsed,
  });
  sfx.order();
}

function servePlate(w) {
  const recipe = recipeForPlate(w.carry.items);
  const win = STATIONS.window;
  if (!recipe) {
    sfx.error();
    showMessage(w, 'No order wants this plate — check the ticket board!');
    return;
  }
  const order = w.orders.find((o) => o.recipe.id === recipe.id);
  if (!order) {
    sfx.error();
    showMessage(w, `No one ordered ${recipe.name} right now.`);
    return;
  }
  const patienceLeft = Math.max(0, order.patience / order.maxPatience);
  const tip = Math.round(TIP_MAX * patienceLeft * (w.rush ? 1.5 : 1));
  const earned = recipe.price + tip;
  w.coins += earned;
  w.served += 1;
  w.streak += 1;
  w.bestStreak = Math.max(w.bestStreak, w.streak);
  w.orders = w.orders.filter((o) => o.id !== order.id);
  addFloater(w, win.x - 30, win.y + 30, `+$${earned}`, '#ffd34d');
  if (tip > 0) addFloater(w, win.x - 30, win.y + 58, `Tip $${tip}!`, '#8be28b');
  sfx.serve();
  w.carry = null;
  const level = levelForScore(w.coins);
  if (level > w.level) {
    w.level = level;
    const unlocked = RECIPES.find((r) => r.level === level);
    w.banner = { text: unlocked ? `New recipe unlocked: ${unlocked.name}!` : `Level ${level}!`, life: 3 };
    sfx.rush();
  }
}

// Interact with the station the chef stands by. `held` is true while E is held
// (chopping needs a hold); `pressed` fires once per key press.
function interact(w, station, held, pressed) {
  const chef = w.chef;
  if (station.id === 'pantry') {
    if (w.carry) {
      if (pressed) {
        sfx.error();
        showMessage(w, 'Hands full — serve or bin what you carry first.');
      }
      return;
    }
    const ing = w.pantryPick ?? 'tomato';
    if (pressed) {
      w.carry = makeItem(ing, 'raw');
      sfx.pickup();
    }
    return;
  }

  if (station.id === 'board') {
    if (w.board === null) {
      if (w.carry && w.carry.kind === 'item' && INGREDIENTS[w.carry.ing].chop && w.carry.state === 'raw') {
        if (pressed) {
          w.board = { ing: w.carry.ing, progress: 0 };
          w.carry = null;
          sfx.place();
        }
      } else if (pressed) {
        showMessage(w, 'Bring a raw ingredient you can chop (tomato, lettuce, pepper, herbs).');
      }
      return;
    }
    if (held) {
      w.board.progress += 1 / 60 / CHOP_SECONDS;
      w.chopHeld += 1 / 60;
      if (w.chopHeld > 0.22) {
        sfx.chop();
        w.chopHeld = 0;
      }
      if (w.board.progress >= 1) {
        w.carry = makeItem(w.board.ing, 'chopped');
        w.board = null;
        sfx.chopped();
        showMessage(w, 'Chopped! Take it to the stove, grill or plate.');
      }
    }
    return;
  }

  if (station.id === 'stove' || station.id === 'grill') {
    const slots = station.id === 'stove' ? w.stove : w.grill;
    const want = station.id;
    if (w.carry && w.carry.kind === 'item') {
      const ing = INGREDIENTS[w.carry.ing];
      if (ing.cook === want && (w.carry.state === 'chopped' || w.carry.state === 'raw')) {
        if (pressed) {
          const free = slots.findIndex((s) => s === null);
          if (free === -1) {
            sfx.error();
            showMessage(w, `The ${want} is full — wait for a burner.`);
            return;
          }
          slots[free] = { ing: w.carry.ing, progress: 0, over: 0, state: 'cooking' };
          w.carry = null;
          sfx.sizzle();
        }
      } else if (pressed) {
        sfx.error();
        showMessage(w, `That does not go on the ${want}. Check the recipe.`);
      }
      return;
    }
    if (pressed) {
      const ready = slots.findIndex((s) => s && s.state === 'done');
      if (ready !== -1) {
        w.carry = makeItem(slots[ready].ing, 'cooked');
        slots[ready] = null;
        sfx.pickup();
      } else if (slots.some((s) => s && s.state === 'burnt')) {
        const burnt = slots.findIndex((s) => s && s.state === 'burnt');
        w.carry = makeItem(slots[burnt].ing, 'burnt');
        slots[burnt] = null;
        sfx.pickup();
        showMessage(w, 'Burnt! Bin it — nobody eats charcoal.');
      } else if (slots.some((s) => s !== null)) {
        showMessage(w, 'Still cooking — watch the ring fill up.');
      } else {
        showMessage(w, `Bring something to cook on the ${want}.`);
      }
    }
    return;
  }

  if (station.id === 'plates') {
    if (pressed) {
      if (w.carry && w.carry.kind === 'plate') {
        // Put the plate back down (its items stay on it).
        w.plate = w.carry.items;
        w.carry = null;
        sfx.place();
      } else if (w.carry && w.carry.kind === 'item') {
        if (w.carry.state === 'burnt') {
          sfx.error();
          showMessage(w, 'Burnt food never reaches a plate. Bin it!');
          return;
        }
        w.plate.push({ ing: w.carry.ing, state: w.carry.state });
        w.carry = null;
        sfx.place();
      } else if (!w.carry) {
        w.carry = { kind: 'plate', items: w.plate };
        w.plate = [];
        sfx.pickup();
      }
    }
    return;
  }

  if (station.id === 'bin') {
    if (pressed) {
      if (w.carry) {
        w.carry = null;
        sfx.place();
        showMessage(w, 'Binned.');
      } else if (w.plate.length > 0) {
        w.plate = [];
        sfx.place();
        showMessage(w, 'Plate cleared.');
      }
    }
    return;
  }

  if (station.id === 'window') {
    if (pressed) {
      if (w.carry && w.carry.kind === 'plate') {
        if (w.carry.items.length === 0) {
          sfx.error();
          showMessage(w, 'An empty plate earns nothing — build a dish first.');
          return;
        }
        servePlate(w);
      } else if (pressed) {
        showMessage(w, 'Bring a finished plate to the window to serve.');
      }
    }
  }
}

function collide(w, nx, ny) {
  const r = CHEF_RADIUS;
  const x = Math.max(16 + r, Math.min(VIEW_W - 16 - r, nx));
  const y = Math.max(118 + r, Math.min(VIEW_H - 16 - r, ny));
  for (const o of obstacles()) {
    const cx = Math.max(o.x, Math.min(x, o.x + o.w));
    const cy = Math.max(o.y, Math.min(y, o.y + o.h));
    if (dist(x, y, cx, cy) < r - 2) return { x: w.chef.x, y: w.chef.y, blocked: true };
  }
  return { x, y, blocked: false };
}

export function updateWorld(w, input, dt) {
  if (w.phase !== 'playing') return;

  w.elapsed += dt;
  w.timeLeft = Math.max(0, SHIFT_SECONDS - w.elapsed);
  if (!w.rush && w.timeLeft <= RUSH_SECONDS && w.timeLeft > 0) {
    w.rush = true;
    w.banner = { text: 'DINNER RUSH! Tips x1.5 — keep the plates moving!', life: 3 };
    sfx.rush();
  }
  if (w.timeLeft <= 0) {
    w.phase = 'over';
    sfx.done();
    return;
  }

  // Orders arrive on a timer; the rush doubles the pace.
  w.spawnIn -= dt;
  if (w.spawnIn <= 0) {
    if (w.orders.length < MAX_ORDERS) spawnOrder(w);
    w.spawnIn = (w.rush ? ORDER_SPAWN_RUSH_SECONDS : ORDER_SPAWN_SECONDS) * (0.85 + w.rng() * 0.3);
  }
  for (const o of w.orders) o.patience -= dt;
  const lost = w.orders.filter((o) => o.patience <= 0);
  if (lost.length > 0) {
    w.orders = w.orders.filter((o) => o.patience > 0);
    w.streak = 0;
    sfx.error();
    showMessage(w, `A customer walked out — ${lost[0].recipe.name} was too slow.`);
  }

  // Cooking progresses; done food burns if left alone.
  for (const slots of [w.stove, w.grill]) {
    for (const s of slots) {
      if (!s) continue;
      if (s.state === 'cooking') {
        s.progress += dt / INGREDIENTS[s.ing].cookSecs;
        if (s.progress >= 1) {
          s.state = 'done';
          s.progress = 1;
          sfx.done();
        }
      } else if (s.state === 'done') {
        s.over += dt;
        if (s.over >= BURN_AFTER_SECONDS) {
          s.state = 'burnt';
          sfx.burn();
          showMessage(w, `The ${INGREDIENTS[s.ing].name} burnt! Grab it and bin it.`);
        }
      }
    }
  }
  w.sizzleAt += dt;

  // Chef movement: keys, or a click target to walk to.
  const axes = input.axes();
  let mx = axes.x;
  let my = axes.y;
  const click = input.takeClick();
  if (click) {
    w.walkTarget = { x: click.x, y: click.y };
  }
  if (mx === 0 && my === 0 && w.walkTarget) {
    const dx = w.walkTarget.x - w.chef.x;
    const dy = w.walkTarget.y - w.chef.y;
    const d = Math.hypot(dx, dy);
    if (d < 8) {
      w.walkTarget = null;
    } else {
      mx = dx / d;
      my = dy / d;
    }
  }
  if (mx !== 0 || my !== 0) {
    w.walkTarget = null;
    const len = Math.hypot(mx, my) || 1;
    const nx = w.chef.x + (mx / len) * CHEF_SPEED * dt;
    const ny = w.chef.y + (my / len) * CHEF_SPEED * dt;
    const step = collide(w, nx, ny);
    if (!step.blocked) {
      w.chef.x = step.x;
      w.chef.y = step.y;
    } else {
      const sx = collide(w, nx, w.chef.y);
      if (!sx.blocked) w.chef.x = sx.x;
      const sy = collide(w, w.chef.x, ny);
      if (!sy.blocked) w.chef.y = sy.y;
    }
    w.chef.moving = true;
    w.chef.walkPhase += dt * 10;
    if (mx !== 0) w.chef.facing = mx > 0 ? 1 : -1;
  } else {
    w.chef.moving = false;
  }

  // Pantry picking: number keys 1-7 choose the shelf.
  for (let i = 0; i < PANTRY_ITEMS.length; i++) {
    if (input.consume(String(i + 1))) w.pantryPick = PANTRY_ITEMS[i];
  }

  // Interaction with the nearest station.
  const { station } = nearestStation(w);
  const held = input.interactHeld();
  const pressed = input.interactPressed();
  if (station && (held || pressed)) interact(w, station, held, pressed);

  // Clicking a station walks there; a click close to a station interacts at once.
  if (click && station) {
    const c = stationCenter(station);
    if (dist(click.x, click.y, c.x, c.y) < 90) interact(w, station, false, true);
  }

  for (const f of w.floaters) {
    f.life -= dt;
    f.y -= 34 * dt;
  }
  w.floaters = w.floaters.filter((f) => f.life > 0);
  if (w.banner) {
    w.banner.life -= dt;
    if (w.banner.life <= 0) w.banner = null;
  }
  if (w.message) {
    w.message.life -= dt;
    if (w.message.life <= 0) w.message = null;
  }
}

export function nearestStationInfo(w) {
  return nearestStation(w);
}

export function startShift(w) {
  w.phase = 'playing';
  w.orders = [];
  w.spawnIn = 4;
  spawnOrder(w);
  spawnOrder(w);
}

export function starsEarned(w) {
  const [one, two, three] = [60, 110, 170];
  if (w.coins >= three) return 3;
  if (w.coins >= two) return 2;
  if (w.coins >= one) return 1;
  return 0;
}
