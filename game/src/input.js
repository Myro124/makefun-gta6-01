// Keyboard + mouse input. Held keys are read every frame; one-shot presses
// (confirm, pause, enter car, reload, mute, load save) are queued as bit flags
// and taken once by the loop, so a press between frames is never lost.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_RELOAD = 8;
export const ACTION_MUTE = 16;
export const ACTION_LOAD = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 640; let mouseY = 360; let mouseDown = false;
  function queue(code) {
    if (code === 'KeyE') actions |= ACTION_ENTER;
    else if (code === 'KeyR') actions |= ACTION_RELOAD;
    else if (code === 'KeyM') actions |= ACTION_MUTE;
    else if (code === 'KeyL') actions |= ACTION_LOAD;
  }
  window.addEventListener('keydown', (event) => {
    if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (!event.repeat) queue(event.code); // one-shot keys (E/R/M/L) fire once per press, not while held
    keys.add(event.code);
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || event.code === 'Space') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => { keys.clear(); mouseDown = false; });
  canvas.addEventListener('pointermove', (event) => {
    const r = canvas.getBoundingClientRect();
    mouseX = event.clientX - r.left; mouseY = event.clientY - r.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const r = canvas.getBoundingClientRect();
    mouseX = event.clientX - r.left; mouseY = event.clientY - r.top;
    mouseDown = true; actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => { mouseDown = false; });
  const held = (set) => { for (const c of set) if (keys.has(c)) return true; return false; };
  return {
    move() {
      const x = (held(RIGHT) ? 1 : 0) - (held(LEFT) ? 1 : 0);
      const y = (held(DOWN) ? 1 : 0) - (held(UP) ? 1 : 0);
      return { x, y, sprint: keys.has('ShiftLeft') || keys.has('ShiftRight') };
    },
    mouse() { return { x: mouseX, y: mouseY, down: mouseDown }; },
    takeActions() { const t = actions; actions = 0; return t; },
  };
}
