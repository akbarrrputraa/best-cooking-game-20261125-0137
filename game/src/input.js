// Hearth & Ladle — keyboard and mouse input.
// Movement: WASD or arrow keys. Interact: E or Space. Mute: M. Pause: P.
// Mouse: click the floor to walk there, click a station to walk to it and use it.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let click = null;

  function keyName(e) {
    const k = e.key.toLowerCase();
    if (k === ' ') return 'space';
    return k;
  }

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (!e.repeat) pressed.add(k);
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(keyName(e)));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    click = {
      x: ((e.clientX - r.left) / r.width) * canvas.width,
      y: ((e.clientY - r.top) / r.height) * canvas.height,
    };
  });

  return {
    // -1/0/1 movement axes from the keys currently held.
    axes() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      return { x, y };
    },
    // True once for each fresh key press; consumed by the caller each frame.
    consume(key) {
      if (pressed.has(key)) {
        pressed.delete(key);
        return true;
      }
      return false;
    },
    interactHeld() {
      return keys.has('e') || keys.has('space');
    },
    interactPressed() {
      return this.consume('e') || this.consume('space');
    },
    // The latest pointer click in canvas coordinates, or null.
    takeClick() {
      const c = click;
      click = null;
      return c;
    },
  };
}
