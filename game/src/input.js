// Keyboard and mouse input for Velvet Vault.
//
// Held keys give a movement vector each frame; one-shot presses (confirm,
// pause, decoy, EMP, restart, mute) are queued as bit flags and taken once
// by the loop, so a press between two frames is never lost or doubled.
// The mouse offers a second way to move: hold the left button and the thief
// walks toward the pointer. A right click tosses a decoy coin at the
// pointer. Pointer positions are reported in raw client pixels; the loop
// converts them to field coordinates through the renderer.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DECOY = 4;
export const ACTION_EMP = 8;
export const ACTION_RESTART = 16;
export const ACTION_MUTE = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(target) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let sneak = false;
  let interact = false;
  let actions = 0;
  const pointer = { x: 0, y: 0, down: false, seen: false };

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') sneak = true;
    else if (event.code === 'KeyE') interact = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyQ') {
      if (!event.repeat) actions |= ACTION_DECOY;
    } else if (event.code === 'KeyF') {
      if (!event.repeat) actions |= ACTION_EMP;
    } else if (event.code === 'KeyR') {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (event.code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });

  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') sneak = false;
    else if (event.code === 'KeyE') interact = false;
  });

  // A key released while the tab is hidden never sends keyup: let go of
  // everything on blur so the thief does not walk on alone.
  window.addEventListener('blur', () => {
    up = down = left = right = sneak = interact = false;
    pointer.down = false;
  });

  target.addEventListener('pointermove', (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.seen = true;
  });
  target.addEventListener('pointerdown', (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.seen = true;
    if (event.button === 2) actions |= ACTION_DECOY;
    else {
      pointer.down = true;
      actions |= ACTION_CONFIRM;
    }
    event.preventDefault();
  });
  target.addEventListener('pointerup', (event) => {
    if (event.button === 0) pointer.down = false;
  });
  target.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    pointer,
    /** Movement vector from held keys, each axis -1, 0 or 1. */
    vector() {
      return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
    },
    sneakHeld() {
      return sneak;
    },
    interactHeld() {
      return interact || pointer.down;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
