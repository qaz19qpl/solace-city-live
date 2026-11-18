// input.js — keyboard and mouse state for the game. The main loop reads
// `keys` for held controls and consumes `pressed` for one-shot actions
// (enter car, talk, pause), so a single key tap never fires twice.

export const keys = new Set();
export const pressed = new Set();
export const mouse = { x: 0, y: 0, down: false, clicked: false };

let attached = false;

export function attachInput(canvas) {
  if (attached) return;
  attached = true;

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) pressed.add(event.code);
    keys.add(event.code);
  });

  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });

  window.addEventListener('blur', () => {
    keys.clear();
    mouse.down = false;
  });

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  });

  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  });

  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
}

export function wasPressed(code) {
  return pressed.has(code);
}

// Called at the very end of each frame by the main loop.
export function endFrameInput() {
  pressed.clear();
  mouse.clicked = false;
}

export function moveAxis() {
  let x = 0;
  let y = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) {
    const inv = Math.SQRT1_2;
    x *= inv;
    y *= inv;
  }
  return { x, y };
}
