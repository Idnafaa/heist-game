// Velvet Vault boot and loop: input is read every frame, the world advances
// in fixed 1/60 s steps, and the renderer paints what is there. Screens:
// title, play, paused, room cleared, caught, and the clean getaway.
// Sounds come from audio.js; every event the world reports gets its noise.
//
// ?seed=N fixes the patrol jitter. ?shot=start|play|vault|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady so a screenshot tool knows the frame is final.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, EVENT_CAUGHT, EVENT_CLEAR, EVENT_DECOY, EVENT_EMP,
  EVENT_LOCKDOWN, EVENT_LOOT,
} from './world.js';
import {
  ACTION_CONFIRM, ACTION_DECOY, ACTION_EMP, ACTION_MUTE, ACTION_PAUSE,
  ACTION_RESTART, createInput,
} from './input.js';
import {
  createRenderer, SCREEN_CAUGHT, SCREEN_CLEAR, SCREEN_PAUSED, SCREEN_PLAY,
  SCREEN_TITLE, SCREEN_WIN,
} from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { LEVELS } from './levels.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best haul lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let pendingDecoy = null;
  let pendingEmp = false;

  function announce(message) {
    status.textContent = message;
  }

  window.addEventListener('keydown', () => audio.unlock());
  canvas.addEventListener('pointerdown', () => audio.unlock());

  function bankBest() {
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
  }

  function startRun() {
    world.resetRun();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.click();
    announce(`${world.state.level.name}. Lift ${world.state.lootNeed} loot, then reach the getaway door.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (actions & ACTION_RESTART) startRun();
      if (actions & ACTION_DECOY) {
        const point = input.pointer.seen
          ? renderer.toField(input.pointer.x, input.pointer.y)
          : {
            x: world.state.player.x + Math.cos(world.state.player.angle) * 180,
            y: world.state.player.y + Math.sin(world.state.player.angle) * 180,
          };
        pendingDecoy = point;
      }
      if (actions & ACTION_EMP) pendingEmp = true;
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_TITLE || screen === SCREEN_CAUGHT || screen === SCREEN_WIN) {
      if (actions & (ACTION_CONFIRM | ACTION_RESTART)) startRun();
    } else if (screen === SCREEN_CLEAR) {
      if (actions & ACTION_CONFIRM) {
        world.loadLevel(world.state.levelIndex + 1);
        screen = SCREEN_PLAY;
        audio.click();
        announce(`${world.state.level.name}. Lift ${world.state.lootNeed} loot.`);
      }
    }
  }

  function buildControl() {
    const vector = input.vector();
    let mx = vector.x;
    let my = vector.y;
    if (mx === 0 && my === 0 && input.pointer.down) {
      const target = renderer.toField(input.pointer.x, input.pointer.y);
      const dx = target.x - world.state.player.x;
      const dy = target.y - world.state.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 10) {
        mx = dx / dist;
        my = dy / dist;
      }
    }
    const control = {
      mx,
      my,
      sneak: input.sneakHeld(),
      interact: input.interactHeld(),
      decoyAt: pendingDecoy,
      emp: pendingEmp,
    };
    pendingDecoy = null;
    pendingEmp = false;
    return control;
  }

  function react(events) {
    if (events & EVENT_LOOT) {
      audio.loot();
      announce(world.state.message.text);
    }
    if (events & EVENT_DECOY) audio.decoy();
    if (events & EVENT_EMP) audio.emp();
    if (events & EVENT_LOCKDOWN) {
      audio.lockdown();
      announce('Lockdown! Every guard is hunting you.');
    }
    if (events & EVENT_CAUGHT) {
      screen = SCREEN_CAUGHT;
      bankBest();
      audio.caught();
      announce(`Caught in ${world.state.level.name}. Score ${world.state.score}.`);
    } else if (events & EVENT_CLEAR) {
      bankBest();
      if (world.state.levelIndex >= LEVELS.length - 1) {
        screen = SCREEN_WIN;
        audio.win();
        announce(`Clean getaway! Final haul ${world.state.score} dollars.`);
      } else {
        screen = SCREEN_CLEAR;
        audio.clear();
        announce(`${world.state.level.name} cleared. Haul ${world.state.score} dollars.`);
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        world.step(STEP, { mx: 0, my: 0, sneak: false, interact: false, decoyAt: null, emp: false }, true);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        react(world.step(STEP, buildControl(), false));
        accumulator -= STEP;
      }
      const seen = world.state.guards.some((guard) => guard.sees)
        || world.state.cameras.some((camera) => camera.sees);
      if (seen) audio.seenTick(world.state.alarm / 100);
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, audio.isMuted());
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Velvet Vault. Press Space or click to start the heist.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
