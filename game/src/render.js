// Hearth & Ladle — every pixel the game draws: the kitchen, the chef,
// the food, the order board and the screens. All art is drawn in code;
// the game loads no image, font or sound file.

import { INGREDIENTS, LEVEL_SCORE, RECIPES, RUSH_SECONDS, SHIFT_SECONDS, VIEW_H, VIEW_W } from './config.js';
import { STATIONS, componentName, itemLabel, nearestStationInfo, recipeForPlate, starsEarned } from './world.js';

// Warm hearth palette.
const C = {
  floorA: '#e8b06a',
  floorB: '#df9f52',
  wall: '#8a4b2d',
  wallTop: '#a05a35',
  counter: '#7a4a26',
  counterTop: '#c98d4e',
  steel: '#b9c2c9',
  steelDark: '#8b959d',
  cream: '#fff6e6',
  ink: '#3a2415',
  gold: '#ffd34d',
  red: '#d84a3a',
  green: '#4da34d',
  ticket: '#fff3d6',
};

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function text(ctx, s, x, y, size, color, align = 'left', weight = '700') {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px "Trebuchet MS", "Segoe UI", Verdana, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(s, x, y);
}

// ---------------------------------------------------------------- food

export function drawIngredient(ctx, ingId, state, x, y, r, t = 0) {
  const ing = INGREDIENTS[ingId];
  const bob = state === 'cooked' ? Math.sin(t * 3 + x) * 1.5 : 0;
  ctx.save();
  ctx.translate(x, y + bob);
  if (state === 'burnt') {
    ctx.fillStyle = '#241a12';
    circle(ctx, 0, 0, r);
    ctx.fillStyle = '#3a2c1e';
    circle(ctx, -r * 0.3, -r * 0.3, r * 0.4);
    ctx.strokeStyle = '#5a4632';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, r * 0.4);
    ctx.lineTo(r * 0.5, -r * 0.4);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const color = state === 'cooked' ? shade(ing.color) : ing.color;
  const dark = ing.dark;
  if (ing.shape === 'tomato') {
    ctx.fillStyle = color;
    circle(ctx, 0, 0, r);
    ctx.fillStyle = '#3d8a2e';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * r * 0.55, -r * 0.55 + Math.sin(a) * r * 0.2, r * 0.32, r * 0.16, a, 0, Math.PI * 2);
      ctx.fill();
    }
    if (state === 'chopped') {
      ctx.strokeStyle = dark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(r, 0);
      ctx.stroke();
    }
  } else if (ing.shape === 'lettuce') {
    ctx.fillStyle = color;
    circle(ctx, -r * 0.35, r * 0.15, r * 0.62);
    circle(ctx, r * 0.35, r * 0.15, r * 0.62);
    circle(ctx, 0, -r * 0.35, r * 0.66);
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.6);
    ctx.lineTo(0, r * 0.6);
    ctx.stroke();
  } else if (ing.shape === 'pepper') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI * 0.15, Math.PI * 0.85);
    ctx.arc(r * 0.55, -r * 0.35, r * 0.5, Math.PI * 0.9, Math.PI * 1.9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3d8a2e';
    ctx.fillRect(-r * 0.12, -r * 1.15, r * 0.24, r * 0.4);
  } else if (ing.shape === 'fish') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, 0);
    ctx.lineTo(-r * 1.35, -r * 0.55);
    ctx.lineTo(-r * 1.35, r * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    circle(ctx, r * 0.45, -r * 0.15, r * 0.14);
    ctx.fillStyle = dark;
    circle(ctx, r * 0.48, -r * 0.15, r * 0.07);
  } else if (ing.shape === 'herb') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.45, r * 0.7);
      ctx.quadraticCurveTo(i * r * 0.6, 0, i * r * 0.9, -r * 0.7);
      ctx.stroke();
    }
    ctx.fillStyle = dark;
    circle(ctx, 0, r * 0.7, r * 0.18);
  } else if (ing.shape === 'dough') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.7, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.25, -r * 0.25, r * 0.45, r * 0.25, 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (ing.shape === 'berry') {
    ctx.fillStyle = color;
    circle(ctx, -r * 0.4, r * 0.2, r * 0.55);
    circle(ctx, r * 0.4, r * 0.2, r * 0.55);
    circle(ctx, 0, -r * 0.45, r * 0.55);
    ctx.fillStyle = '#c9a7ef';
    circle(ctx, -r * 0.5, 0, r * 0.14);
    circle(ctx, r * 0.3, -r * 0.55, r * 0.14);
  }
  if (state === 'cooked') {
    // Golden sear marks and a wisp of steam.
    ctx.strokeStyle = 'rgba(120,60,10,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.6, -r * 0.2);
    ctx.lineTo(r * 0.6, -r * 0.2);
    ctx.moveTo(-r * 0.6, r * 0.25);
    ctx.lineTo(r * 0.6, r * 0.25);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r * 0.25, -r * 1.1);
    ctx.quadraticCurveTo(-r * 0.45, -r * 1.5, -r * 0.25, -r * 1.9);
    ctx.moveTo(r * 0.25, -r * 1.1);
    ctx.quadraticCurveTo(r * 0.45, -r * 1.5, r * 0.25, -r * 1.9);
    ctx.stroke();
  }
  ctx.restore();
}

function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + 28);
  const g = Math.min(255, ((n >> 8) & 255) + 10);
  const b = Math.max(0, (n & 255) - 18);
  return `rgb(${r},${g},${b})`;
}

// ---------------------------------------------------------------- stations

function drawPantry(ctx, s, w, t) {
  ctx.fillStyle = C.counter;
  rr(ctx, s.x, s.y, s.w, s.h, 10);
  ctx.fill();
  ctx.fillStyle = C.counterTop;
  rr(ctx, s.x + 4, s.y + 4, s.w - 8, 20, 6);
  ctx.fill();
  const items = ['tomato', 'lettuce', 'pepper', 'fish', 'herb', 'dough', 'berry'];
  items.forEach((ing, i) => {
    const x = s.x + 22 + i * 28;
    const y = s.y + 52;
    const picked = w.pantryPick === ing;
    if (picked) {
      ctx.fillStyle = C.gold;
      circle(ctx, x, y, 15);
    }
    drawIngredient(ctx, ing, 'raw', x, y, 11, t);
  });
  text(ctx, 'PANTRY  ·  press 1-7, E to take', s.x + 8, s.y + 78, 11, C.cream);
}

function drawBoard(ctx, s, w, t) {
  ctx.fillStyle = C.counter;
  rr(ctx, s.x, s.y, s.w, s.h, 10);
  ctx.fill();
  ctx.fillStyle = '#e8d3a7';
  rr(ctx, s.x + 30, s.y + 14, s.w - 60, 44, 8);
  ctx.fill();
  ctx.strokeStyle = '#b3925a';
  ctx.lineWidth = 2;
  ctx.stroke();
  if (w.board) {
    drawIngredient(ctx, w.board.ing, 'raw', s.x + s.w / 2, s.y + 36, 16, t);
    // Chop progress ring.
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(s.x + s.w / 2, s.y + 36, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = C.green;
    ctx.beginPath();
    ctx.arc(s.x + s.w / 2, s.y + 36, 26, -Math.PI / 2, -Math.PI / 2 + w.board.progress * Math.PI * 2);
    ctx.stroke();
    text(ctx, 'HOLD E TO CHOP', s.x + s.w / 2, s.y + 74, 11, C.cream, 'center');
  } else {
    text(ctx, 'CHOPPING BOARD', s.x + s.w / 2, s.y + 74, 12, C.cream, 'center');
  }
}

function drawCooker(ctx, s, slots, label, w, t, kind) {
  ctx.fillStyle = kind === 'stove' ? '#3d3d46' : '#4a3220';
  rr(ctx, s.x, s.y, s.w, s.h, 10);
  ctx.fill();
  slots.forEach((slot, i) => {
    const cx = s.x + 58 + i * 114;
    const cy = s.y + 42;
    ctx.fillStyle = '#222';
    circle(ctx, cx, cy, 30);
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.stroke();
    if (slot) {
      if (slot.state === 'cooking') {
        ctx.fillStyle = '#ff9d2e';
        for (let f = 0; f < 3; f++) {
          const a = t * 6 + f * 2.1;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * 18, cy + 12 + Math.sin(a * 1.7) * 3, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      drawIngredient(ctx, slot.ing, slot.state === 'done' || slot.state === 'burnt' ? slot.state : 'raw', cx, cy - 4, 17, t);
      // Progress ring.
      ctx.strokeStyle = slot.state === 'burnt' ? '#d84a3a' : slot.state === 'done' ? C.green : C.gold;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, 36, -Math.PI / 2, -Math.PI / 2 + slot.progress * Math.PI * 2);
      ctx.stroke();
      if (slot.state === 'done') text(ctx, 'READY!', cx, cy + 52, 11, C.green, 'center');
      if (slot.state === 'burnt') text(ctx, 'BURNT!', cx, cy + 52, 11, C.red, 'center');
    }
  });
  text(ctx, label, s.x + s.w / 2, s.y + 78, 12, C.cream, 'center');
}

function drawWindow(ctx, s, w) {
  ctx.fillStyle = C.wall;
  rr(ctx, s.x, s.y, s.w, s.h, 10);
  ctx.fill();
  ctx.fillStyle = '#2c1a0e';
  rr(ctx, s.x + 8, s.y + 8, s.w - 16, s.h - 60, 8);
  ctx.fill();
  ctx.fillStyle = C.gold;
  ctx.beginPath();
  ctx.arc(s.x + s.w / 2, s.y + 52, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.ink;
  circle(ctx, s.x + s.w / 2, s.y + 46, 4);
  text(ctx, 'SERVE', s.x + s.w / 2, s.y + 96, 13, C.cream, 'center');
  text(ctx, 'WINDOW', s.x + s.w / 2, s.y + 114, 13, C.cream, 'center');
  ctx.fillStyle = C.counterTop;
  rr(ctx, s.x, s.y + s.h - 44, s.w, 44, 8);
  ctx.fill();
}

function drawPlates(ctx, s, w) {
  ctx.fillStyle = C.counter;
  rr(ctx, s.x, s.y, s.w, s.h, 10);
  ctx.fill();
  ctx.fillStyle = C.counterTop;
  rr(ctx, s.x + 4, s.y + 4, s.w - 8, 20, 6);
  ctx.fill();
  // The plate on the counter.
  const cx = s.x + s.w / 2;
  const cy = s.y + 48;
  ctx.fillStyle = '#f4f1e8';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 62, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#c9c2ae';
  ctx.lineWidth = 2;
  ctx.stroke();
  w.plate.forEach((c, i) => {
    drawIngredient(ctx, c.ing, c.state, cx - 34 + i * 34, cy - 6, 13, 0);
  });
  const match = w.plate.length > 0 ? recipeForPlate(w.plate) : null;
  if (match) {
    text(ctx, `${match.name} — ready to serve!`, cx, s.y + 78, 12, '#8be28b', 'center');
  } else if (w.plate.length > 0) {
    text(ctx, 'Keep building — match a ticket above.', cx, s.y + 78, 11, C.cream, 'center');
  } else {
    text(ctx, 'PLATING COUNTER  ·  E adds food, E picks up the plate', cx, s.y + 78, 11, C.cream, 'center');
  }
}

function drawBin(ctx, s) {
  ctx.fillStyle = '#5a5f66';
  rr(ctx, s.x, s.y, s.w, s.h, 10);
  ctx.fill();
  ctx.fillStyle = '#3c4046';
  rr(ctx, s.x + 12, s.y + 12, s.w - 24, 40, 6);
  ctx.fill();
  text(ctx, 'BIN', s.x + s.w / 2, s.y + 74, 12, C.cream, 'center');
}

// ---------------------------------------------------------------- chef

function drawChef(ctx, w, t) {
  const c = w.chef;
  const bob = c.moving ? Math.sin(c.walkPhase) * 2 : Math.sin(t * 2) * 1;
  ctx.save();
  ctx.translate(c.x, c.y + bob);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, 26 - bob, 24, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body / apron.
  ctx.fillStyle = '#f4f1e8';
  rr(ctx, -20, -8, 40, 34, 12);
  ctx.fill();
  ctx.fillStyle = '#d84a3a';
  rr(ctx, -20, 12, 40, 14, 6);
  ctx.fill();
  // Head.
  ctx.fillStyle = '#f2c89b';
  circle(ctx, 0, -22, 15);
  // Chef hat.
  ctx.fillStyle = '#fff';
  circle(ctx, -9, -34, 9);
  circle(ctx, 0, -38, 11);
  circle(ctx, 9, -34, 9);
  ctx.fillRect(-13, -36, 26, 8);
  // Eyes.
  ctx.fillStyle = '#2b1a10';
  circle(ctx, -5 * c.facing, -24, 1.8);
  circle(ctx, 5 * c.facing, -24, 1.8);
  // Carried item floats above the hat.
  if (w.carry) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    circle(ctx, 0, -58, 20);
    ctx.strokeStyle = '#d8cbb2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -58, 20, 0, Math.PI * 2);
    ctx.stroke();
    if (w.carry.kind === 'plate') {
      ctx.fillStyle = '#f4f1e8';
      ctx.beginPath();
      ctx.ellipse(0, -56, 15, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      w.carry.items.forEach((it, i) => {
        drawIngredient(ctx, it.ing, it.state, -10 + i * 10, -60, 5, t);
      });
    } else {
      drawIngredient(ctx, w.carry.ing, w.carry.state, 0, -58, 12, t);
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- order board

function drawOrders(ctx, w) {
  ctx.fillStyle = C.wallTop;
  rr(ctx, 24, 12, VIEW_W - 48, 96, 12);
  ctx.fill();
  ctx.fillStyle = C.wall;
  rr(ctx, 24, 12, VIEW_W - 48, 26, 12);
  ctx.fill();
  text(ctx, 'ORDER BOARD', 44, 31, 15, C.cream);
  text(ctx, 'Serve the ticket before its bar runs out — tips shrink as patience fades.', 180, 31, 12, '#ffd9a8');
  if (w.orders.length === 0) {
    text(ctx, 'No orders yet — the lunch crowd is coming…', 44, 74, 14, C.cream);
  }
  w.orders.forEach((o, i) => {
    const x = 44 + i * 330;
    const y = 46;
    const frac = Math.max(0, o.patience / o.maxPatience);
    ctx.fillStyle = C.ticket;
    rr(ctx, x, y, 310, 52, 8);
    ctx.fill();
    ctx.strokeStyle = frac < 0.3 ? C.red : '#c9a86a';
    ctx.lineWidth = frac < 0.3 ? 3 : 1.5;
    ctx.stroke();
    text(ctx, `#${o.id}  ${o.recipe.name}`, x + 10, y + 19, 13, C.ink);
    o.recipe.needs.forEach((n, j) => {
      drawIngredient(ctx, n.ing, n.state, x + 24 + j * 30, y + 36, 10, 0);
    });
    text(ctx, `$${o.recipe.price}`, x + 300, y + 19, 13, C.ink, 'right');
    // Patience bar.
    ctx.fillStyle = '#e0cfa8';
    rr(ctx, x + 110, y + 34, 150, 8, 4);
    ctx.fill();
    ctx.fillStyle = frac < 0.3 ? C.red : frac < 0.6 ? '#e8a13a' : C.green;
    rr(ctx, x + 110, y + 34, 150 * frac, 8, 4);
    ctx.fill();
  });
}

// ---------------------------------------------------------------- HUD + screens

function fmtTime(secs) {
  const s = Math.max(0, Math.ceil(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function drawHud(ctx, w) {
  // Timer bar across the top of the floor.
  const frac = w.timeLeft / SHIFT_SECONDS;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  rr(ctx, 24, 116, VIEW_W - 48, 14, 7);
  ctx.fill();
  ctx.fillStyle = w.rush ? C.red : C.gold;
  rr(ctx, 24, 116, (VIEW_W - 48) * frac, 14, 7);
  ctx.fill();
  text(ctx, `TIME ${fmtTime(w.timeLeft)}`, 30, 112, 13, C.cream, 'left', '700');
  text(ctx, `Coins  $${w.coins}`, VIEW_W - 30, 112, 15, C.gold, 'right');
  text(ctx, `Level ${w.level}  ·  Served ${w.served}  ·  Streak x${w.streak}`, VIEW_W / 2, 112, 13, C.cream, 'center');

  // Context prompt: what E does at the nearest station.
  const { station } = nearestStationInfo(w);
  if (station && w.phase === 'playing') {
    const label = station.id === 'pantry'
      ? `E: take ${w.pantryPick ? INGREDIENTS[w.pantryPick].name : 'Tomato'} (1-7 picks)`
      : station.id === 'board'
        ? w.board ? 'Hold E: chop' : 'E: place ingredient to chop'
        : station.id === 'stove' || station.id === 'grill'
          ? 'E: cook / take food'
          : station.id === 'plates'
            ? 'E: add food / pick up plate'
            : station.id === 'bin'
              ? 'E: bin it'
              : 'E: serve the plate';
    ctx.fillStyle = 'rgba(30,16,6,0.85)';
    rr(ctx, VIEW_W / 2 - 190, VIEW_H - 44, 380, 30, 15);
    ctx.fill();
    text(ctx, `${station.name} — ${label}`, VIEW_W / 2, VIEW_H - 24, 13, '#fff', 'center');
  }

  if (w.message) {
    ctx.fillStyle = 'rgba(30,16,6,0.85)';
    const tw = ctx.measureText(w.message.text).width;
    rr(ctx, VIEW_W / 2 - tw / 2 - 130, 238, tw + 260, 30, 15);
    ctx.fill();
    text(ctx, w.message.text, VIEW_W / 2, 258, 13, '#ffd9a8', 'center');
  }
  if (w.banner) {
    ctx.fillStyle = 'rgba(216,74,58,0.92)';
    rr(ctx, VIEW_W / 2 - 320, 190, 640, 44, 10);
    ctx.fill();
    text(ctx, w.banner.text, VIEW_W / 2, 219, 18, '#fff', 'center');
  }
  for (const f of w.floaters) {
    ctx.globalAlpha = Math.min(1, f.life);
    text(ctx, f.text, f.x, f.y, 20, f.color, 'center');
    ctx.globalAlpha = 1;
  }
  // Rush vignette.
  if (w.rush && w.phase === 'playing') {
    const pulse = 0.1 + 0.06 * Math.sin(w.elapsed * 5);
    ctx.strokeStyle = `rgba(216,74,58,${pulse})`;
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, VIEW_W - 10, VIEW_H - 10);
    text(ctx, 'DINNER RUSH — tips x1.5', VIEW_W - 30, VIEW_H - 24, 13, '#ffb3a6', 'right');
  }
  // Carried item label.
  if (w.carry) {
    text(ctx, itemLabel(w.carry), w.chef.x, w.chef.y - 84, 12, C.cream, 'center');
  }
}

function drawTitle(ctx, w, t) {
  ctx.fillStyle = 'rgba(24,10,4,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text(ctx, 'HEARTH & LADLE', VIEW_W / 2, 250, 64, C.gold, 'center');
  text(ctx, 'A tiny kitchen, a hungry town, one very busy chef.', VIEW_W / 2, 292, 20, C.cream, 'center');
  text(ctx, 'Take orders from the board. Chop, cook, plate, serve — before patience runs out.', VIEW_W / 2, 330, 16, '#ffd9a8', 'center');
  const pulse = 0.75 + 0.25 * Math.sin(t * 3);
  ctx.globalAlpha = pulse;
  text(ctx, 'Press ENTER or click to start your 3-minute shift', VIEW_W / 2, 400, 20, '#fff', 'center');
  ctx.globalAlpha = 1;
  text(ctx, 'Move: WASD / arrows  ·  Interact: E or Space (hold E to chop)  ·  Pantry: keys 1-7  ·  M: mute  ·  P: pause', VIEW_W / 2, 452, 14, C.cream, 'center');
  text(ctx, 'Recipes unlock as you earn: Soup & Salad, then Skewer, Fish and Berry Tart.', VIEW_W / 2, 482, 14, C.cream, 'center');
  text(ctx, 'Click a station to walk over and use it — mouse players welcome.', VIEW_W / 2, 512, 14, C.cream, 'center');
}

function drawGameOver(ctx, w) {
  ctx.fillStyle = 'rgba(24,10,4,0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text(ctx, 'SHIFT COMPLETE!', VIEW_W / 2, 240, 52, C.gold, 'center');
  text(ctx, `You earned $${w.coins} across ${w.served} served dishes — best streak ${w.bestStreak}.`, VIEW_W / 2, 292, 19, C.cream, 'center');
  const stars = starsEarned(w);
  for (let i = 0; i < 3; i++) {
    const x = VIEW_W / 2 - 90 + i * 90;
    const y = 380;
    ctx.fillStyle = i < stars ? C.gold : 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    for (let p = 0; p < 10; p++) {
      const r = p % 2 === 0 ? 34 : 15;
      const a = -Math.PI / 2 + (p * Math.PI) / 5;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (p === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  text(ctx, stars === 3 ? 'Three stars — the town is talking about your kitchen!' : stars === 2 ? 'Two stars — a very respectable shift.' : stars === 1 ? 'One star — the regulars will be back.' : 'No stars yet — the stove is still warm. Try again!', VIEW_W / 2, 452, 17, C.cream, 'center');
  text(ctx, 'Press ENTER to run another shift', VIEW_W / 2, 500, 18, '#fff', 'center');
  text(ctx, `Recipes served: ${RECIPES.filter((r) => r.level <= w.level).map((r) => r.name).join('  ·  ')}`, VIEW_W / 2, 548, 13, '#ffd9a8', 'center');
}

// ---------------------------------------------------------------- frame

export function render(ctx, w, t) {
  // Floor: warm checker tiles.
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 16; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? C.floorA : C.floorB;
      ctx.fillRect(x * 80, 108 + y * 70, 80, 70);
    }
  }
  // Wall band behind the top counters.
  ctx.fillStyle = C.wall;
  ctx.fillRect(0, 108, VIEW_W, 26);
  ctx.fillStyle = C.wallTop;
  ctx.fillRect(0, 108, VIEW_W, 8);

  drawOrders(ctx, w);
  drawPantry(ctx, STATIONS.pantry, w, t);
  drawBoard(ctx, STATIONS.board, w, t);
  drawCooker(ctx, STATIONS.stove, w.stove, 'STOVE', w, t, 'stove');
  drawCooker(ctx, STATIONS.grill, w.grill, 'GRILL', w, t, 'grill');
  drawWindow(ctx, STATIONS.window, w);
  drawPlates(ctx, STATIONS.plates, w);
  drawBin(ctx, STATIONS.bin);

  // Recipe hints along the bottom edge.
  const unlocked = RECIPES.filter((r) => r.level <= w.level);
  text(ctx, 'MENU  ·  ' + unlocked.map((r) => `${r.name} $${r.price}`).join('    '), 30, VIEW_H - 66, 12, 'rgba(255,246,230,0.85)');

  drawChef(ctx, w, t);
  drawHud(ctx, w);
  if (w.phase === 'title') drawTitle(ctx, w, t);
  if (w.phase === 'over') drawGameOver(ctx, w);
  if (w.paused) {
    ctx.fillStyle = 'rgba(24,10,4,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    text(ctx, 'PAUSED — press P to keep cooking', VIEW_W / 2, VIEW_H / 2, 28, '#fff', 'center');
  }
}
