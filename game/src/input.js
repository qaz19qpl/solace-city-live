// input.js — keyboard and mouse, read once per frame.
//
// The main loop looks at `keys` for things held down (drive, run, aim)
// and at `pressed` for things tapped once (get in a car, talk, pause).
// `endFrameInput` clears the one-shot state at the end of every frame, so
// a single tap can never fire twice. Mouse coordinates are stored in
// canvas pixels (the canvas is 1280x800), whatever the page size is.
//
// One listener per event, each a named handler; `attachInput` wires them
// once and then gets out of the way.

export const keys = new Set();
export const pressed = new Set();
export const mouse = { x: 0, y: 0, down: false, clicked: false };

let wired = false;

// Keys the page must not scroll or activate while the game is running.
const SCROLL_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

function onKeyDown(event) {
  if (SCROLL_KEYS.includes(event.code)) event.preventDefault();
  if (!event.repeat) pressed.add(event.code);
  keys.add(event.code);
}

function onKeyUp(event) {
  keys.delete(event.code);
}

// Alt-tabbing away must not leave the car driving itself.
function onBlur() {
  keys.clear();
  mouse.down = false;
}

function onMouseMove(canvas) {
  return (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  };
}

function onMouseDown(event) {
  if (event.button === 0) {
    mouse.down = true;
    mouse.clicked = true;
  }
}

function onMouseUp(event) {
  if (event.button === 0) mouse.down = false;
}

export function attachInput(canvas) {
  if (wired) return;
  wired = true;
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove(canvas));
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
}

// True only on the frame the key went down.
export function wasPressed(code) {
  return pressed.has(code);
}

// Called at the very end of each frame by the main loop.
export function endFrameInput() {
  pressed.clear();
  mouse.clicked = false;
}

// WASD / arrows as a normalised 2D direction, for walking on foot.
export function moveAxis() {
  let x = 0;
  let y = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) {
    x *= Math.SQRT1_2;
    y *= Math.SQRT1_2;
  }
  return { x, y };
}
