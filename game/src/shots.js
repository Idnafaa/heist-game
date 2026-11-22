// Screenshot scenes behind ?shot=start|play|vault|end. Each scene stages
// the real world — same rules, same renderer — at a hand-picked moment of
// the heist, then steps it a few ticks so patrols and cones sit naturally.
// The play scene is the cover: thief mid-room with a bag of loot, a guard's
// cone hot on him, a camera sweeping, loot still on its pedestal and the
// alarm meter a third full, all in one frame.

import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const IDLE = { mx: 0, my: 0, sneak: false, interact: false, decoyAt: null, emp: false };

function settle(world, ticks) {
  for (let i = 0; i < ticks; i += 1) world.step(STEP, IDLE, false);
}

/** Set `world` to the named scene and return the screen and best to draw. */
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'play') {
    world.resetRun();
    // Mid-heist in the Lobby: one piece lifted, crossing the carpet.
    state.player.x = 580;
    state.player.y = 430;
    state.player.angle = 0.25;
    state.player.bag = 1;
    state.loots[0].taken = true;
    state.lootGot = 1;
    state.score = 850;
    state.alarm = 38;
    state.seenEver = true;
    state.guards[0].x = 498;
    state.guards[0].y = 320;
    state.guards[0].angle = 0.55;
    state.guards[0].suspicion = 0.42;
    state.guards[1].x = 982;
    state.guards[1].y = 548;
    state.guards[1].angle = Math.PI;
    state.time = 23.2;
    state.decoyPings.push({ x: 762, y: 382, timer: 0.9 });
    world.say('Sapphire lifted: +$600. 1/2 needed — one more, then the door.', 4);
    settle(world, 10);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'vault') {
    world.loadLevel(2);
    state.score = 2600;
    state.player.x = 700;
    state.player.y = 382;
    state.player.angle = -0.4;
    state.player.bag = 2;
    state.loots[1].taken = true;
    state.loots[3].taken = true;
    state.lootGot = 2;
    state.alarm = 55;
    state.seenEver = true;
    state.guards[2].x = 560;
    state.guards[2].y = 330;
    state.guards[2].angle = 0.35;
    state.guards[2].suspicion = 0.68;
    state.time = 47.5;
    world.say('Two pieces in the bag. The Velvet Star still sleeps in the vault.', 4);
    settle(world, 10);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'end') {
    world.loadLevel(2);
    state.score = 4200;
    state.player.x = 1202;
    state.player.y = 632;
    state.player.angle = 0;
    state.player.bag = 4;
    state.loots.forEach((loot, index) => {
      if (index !== 4) loot.taken = true;
    });
    state.lootGot = 4;
    state.alarm = 22;
    state.time = 96;
    settle(world, 6);
    return { screen: SCREEN_WIN, best: state.score };
  }
  // start (and anything unknown): the title over a patrolling Lobby.
  world.resetRun();
  for (let i = 0; i < 120; i += 1) world.step(STEP, IDLE, true);
  return { screen: SCREEN_TITLE, best: 0 };
}
