// Hearth & Ladle — configuration: ingredients, recipes, levels, tuning.
// Every name, dish and number here is original to this game.

export const VIEW_W = 1280;
export const VIEW_H = 800;

export const SHIFT_SECONDS = 180;
export const RUSH_SECONDS = 30;

export const CHEF_SPEED = 270;
export const CHEF_RADIUS = 22;

export const INTERACT_DIST = 78;

// An ingredient: what the pantry hands out, what it can become, and how.
export const INGREDIENTS = {
  tomato: { name: 'Tomato', color: '#e2483d', dark: '#a92e26', chop: true, cook: 'stove', cookSecs: 6, shape: 'tomato' },
  lettuce: { name: 'Lettuce', color: '#5fbf4a', dark: '#3d8a2e', chop: true, cook: null, cookSecs: 0, shape: 'lettuce' },
  pepper: { name: 'Pepper', color: '#f08a1d', dark: '#b85f0e', chop: true, cook: 'grill', cookSecs: 7, shape: 'pepper' },
  fish: { name: 'Fish', color: '#5aa7d6', dark: '#2f6d94', chop: false, cook: 'grill', cookSecs: 8, shape: 'fish' },
  herb: { name: 'Herbs', color: '#3fae7a', dark: '#227a4f', chop: true, cook: null, cookSecs: 0, shape: 'herb' },
  dough: { name: 'Dough', color: '#e8c98f', dark: '#b3925a', chop: false, cook: 'stove', cookSecs: 7, shape: 'dough' },
  berry: { name: 'Berries', color: '#8a4fd0', dark: '#5e2f96', chop: false, cook: null, cookSecs: 0, shape: 'berry' },
};

// A finished component is an ingredient in a state: raw, chopped or cooked.
// A recipe is a multiset of finished components served on one plate.
export const RECIPES = [
  {
    id: 'soup',
    name: 'Sunset Tomato Soup',
    level: 1,
    price: 10,
    needs: [{ ing: 'tomato', state: 'cooked' }],
    blurb: 'Chop a tomato, simmer it on the stove.',
  },
  {
    id: 'salad',
    name: 'Garden Crisp Salad',
    level: 1,
    price: 12,
    needs: [
      { ing: 'lettuce', state: 'chopped' },
      { ing: 'tomato', state: 'chopped' },
    ],
    blurb: 'Chopped lettuce and tomato, fresh on a plate.',
  },
  {
    id: 'skewer',
    name: 'Ember Pepper Skewer',
    level: 2,
    price: 16,
    needs: [{ ing: 'pepper', state: 'cooked' }],
    blurb: 'Chop a pepper, sear it on the grill.',
  },
  {
    id: 'fish',
    name: 'Herb-Crusted Fish',
    level: 3,
    price: 20,
    needs: [
      { ing: 'fish', state: 'cooked' },
      { ing: 'herb', state: 'chopped' },
    ],
    blurb: 'Grilled fish with a sprinkle of chopped herbs.',
  },
  {
    id: 'tart',
    name: 'Berry Hearth Tart',
    level: 4,
    price: 24,
    needs: [
      { ing: 'dough', state: 'cooked' },
      { ing: 'berry', state: 'raw' },
    ],
    blurb: 'Baked dough shell topped with fresh berries.',
  },
];

// Level gates: score thresholds that unlock the next recipe tier.
export const LEVEL_SCORE = [0, 30, 70, 120, 180];

export const CHOP_SECONDS = 1.6;
export const BURN_AFTER_SECONDS = 9;
export const ORDER_PATIENCE_SECONDS = 80;
export const ORDER_SPAWN_SECONDS = 15;
export const ORDER_SPAWN_RUSH_SECONDS = 8;
export const MAX_ORDERS = 3;
export const TIP_MAX = 8;

export const STAR_THRESHOLDS = [60, 110, 170];
