// Hearth & Ladle — boot and game loop: fixed-step updates, rendering,
// pause/mute/restart keys, and the title -> playing -> over flow.

import { VIEW_H, VIEW_W } from './config.js';
import { createInput } from './input.js';
import { render } from './render.js';
import { stageShot } from './shots.js';
import { createWorld, startShift, updateWorld } from './world.js';
import { sfx } from './audio.js';

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? 1) || 1;
const shot = params.get('shot');
const input = createInput(canvas);

let world;
if (shot) {
  world = stageShot(shot, seed);
} else {
  world = createWorld(seed);
}
world.paused = false;

// A small read-only handle for play-testing (the page's own console can read
// the live state; the game never uses it).
Object.defineProperty(window, '__hearth', {
  value: { get world() { return world; } },
});

let last = performance.now();
let acc = 0;
const STEP = 1 / 60;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (input.consume('m')) {
    const muted = sfx.toggleMute();
    document.getElementById('mute').textContent = muted ? 'Unmute (M)' : 'Mute (M)';
  }
  if (input.consume('p') && world.phase === 'playing') world.paused = !world.paused;
  if (input.consume('enter')) {
    if (world.phase === 'title') {
      startShift(world);
    } else if (world.phase === 'over') {
      const keepSeed = world.seed;
      world = createWorld(keepSeed);
      world.paused = false;
      startShift(world);
    }
  }
  if (input.takeClick() && world.phase === 'title') startShift(world);

  if (world.phase === 'playing' && !world.paused) {
    acc += dt;
    while (acc >= STEP) {
      updateWorld(world, input, STEP);
      acc -= STEP;
    }
  } else {
    // Drain stale input on the title / end screens so a held key does not leak in.
    input.takeClick();
  }

  render(ctx, world, now / 1000);
  requestAnimationFrame(frame);
}

document.getElementById('mute').addEventListener('click', () => {
  const muted = sfx.toggleMute();
  document.getElementById('mute').textContent = muted ? 'Unmute (M)' : 'Mute (M)';
});
document.getElementById('restart').addEventListener('click', () => {
  const keepSeed = world.seed;
  world = createWorld(keepSeed);
  world.paused = false;
  startShift(world);
});

requestAnimationFrame(frame);
