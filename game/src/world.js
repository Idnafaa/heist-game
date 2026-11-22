// Velvet Vault rules and state: the thief, patrolling guards with vision
// cones, sweeping cameras, the alarm meter, loot, tools and the getaway
// door. No drawing and no browser here — step() advances one fixed tick
// from a control object and returns what happened as bit flags, so the
// caller can play sounds and switch screens without the world knowing.

import { ALARM, CAMERA, GUARD, ROOM, SCORE, THIEF, TOOLS } from './config.js';
import { LEVELS } from './levels.js';

export const EVENT_SEEN = 1;
export const EVENT_LOOT = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_CLEAR = 8;
export const EVENT_DECOY = 16;
export const EVENT_EMP = 32;
export const EVENT_LOCKDOWN = 64;

const GUARD_PATROL = 'patrol';
const GUARD_SUSPICIOUS = 'suspicious';
const GUARD_CHASE = 'chase';
const GUARD_INVESTIGATE = 'investigate';
const GUARD_RETURN = 'return';

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function distance(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Smallest signed turn from angle a to angle b, in (-PI, PI]. */
function angleDiff(a, b) {
  let diff = (b - a) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function turnToward(current, target, maxTurn) {
  const diff = angleDiff(current, target);
  if (Math.abs(diff) <= maxTurn) return target;
  return current + Math.sign(diff) * maxTurn;
}

function pointInRect(x, y, rect, pad) {
  return x > rect.x - pad && x < rect.x + rect.width + pad && y > rect.y - pad && y < rect.y + rect.height + pad;
}

export function createWorld(random) {
  const state = {
    levelIndex: 0,
    level: LEVELS[0],
    player: { x: 0, y: 0, angle: -Math.PI / 2, sneaking: false, moving: false, bag: 0 },
    guards: [],
    cameras: [],
    loots: [],
    alarm: 0,
    alarmHold: 0,
    lockdown: false,
    score: 0,
    lootGot: 0,
    lootNeed: 0,
    lootTotal: 0,
    time: 0,
    decoysLeft: 0,
    empsLeft: 0,
    empTimer: 0,
    channel: { index: -1, progress: 0 },
    exitProgress: 0,
    seenEver: false,
    caught: false,
    cleared: false,
    lastBonus: { level: 0, ghost: 0, time: 0 },
    message: { text: '', timer: 0 },
    decoyPings: [],
    lastSeen: { x: 0, y: 0 },
  };

  function say(text, seconds) {
    state.message.text = text;
    state.message.timer = seconds;
  }

  function loadLevel(index) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.level = level;
    state.player.x = level.start.x;
    state.player.y = level.start.y;
    state.player.angle = -Math.PI / 2;
    state.player.sneaking = false;
    state.player.moving = false;
    state.player.bag = 0;
    state.guards = level.guards.map((spec) => ({
      x: spec.waypoints[0][0],
      y: spec.waypoints[0][1],
      angle: Math.atan2(spec.waypoints[1][1] - spec.waypoints[0][1], spec.waypoints[1][0] - spec.waypoints[0][0]),
      waypoints: spec.waypoints,
      waypointIndex: 1 % spec.waypoints.length,
      pauseTimer: 0,
      state: GUARD_PATROL,
      suspicion: 0,
      sees: false,
      targetX: spec.waypoints[0][0],
      targetY: spec.waypoints[0][1],
      lookTimer: 0,
      loseTimer: 0,
    }));
    state.cameras = level.cameras.map((spec) => ({
      x: spec.x,
      y: spec.y,
      baseAngle: spec.baseAngle,
      phase: spec.phase,
      angle: spec.baseAngle,
      sees: false,
    }));
    state.loots = level.loots.map((spec) => ({
      x: spec.x,
      y: spec.y,
      kind: spec.kind,
      value: spec.value,
      label: spec.label,
      taken: false,
      sparkle: random() * Math.PI * 2,
    }));
    state.alarm = 0;
    state.alarmHold = 0;
    state.lockdown = false;
    state.lootGot = 0;
    state.lootNeed = level.need;
    state.lootTotal = level.loots.length;
    state.time = 0;
    state.decoysLeft = TOOLS.decoysPerLevel;
    state.empsLeft = TOOLS.empsPerLevel;
    state.empTimer = 0;
    state.channel.index = -1;
    state.channel.progress = 0;
    state.exitProgress = 0;
    state.seenEver = false;
    state.caught = false;
    state.cleared = false;
    state.lastBonus = { level: 0, ghost: 0, time: 0 };
    state.decoyPings = [];
    state.lastSeen.x = level.start.x;
    state.lastSeen.y = level.start.y;
    say(`${level.name}: lift ${level.need} loot, then reach the door.`, 4);
  }

  function resetRun() {
    state.score = 0;
    loadLevel(0);
  }

  /** True when a solid blocks the straight line between two points. */
  function lineBlocked(x1, y1, x2, y2) {
    const dist = distance(x1, y1, x2, y2);
    const steps = Math.max(1, Math.floor(dist / 7));
    for (let i = 2; i < steps; i += 1) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      for (const solid of state.level.solids) {
        if (pointInRect(x, y, solid, 1)) return true;
      }
    }
    return false;
  }

  /** Cone + range + eyesight test shared by guards and cameras. */
  function inCone(ox, oy, angle, range, halfAngle, tx, ty) {
    const dist = distance(ox, oy, tx, ty);
    if (dist > range) return 0;
    const bearing = Math.atan2(ty - oy, tx - ox);
    if (Math.abs(angleDiff(angle, bearing)) > halfAngle) return 0;
    if (lineBlocked(ox, oy, tx, ty)) return 0;
    return 1 - dist / range; // 1 at point blank, 0 at the cone's rim
  }

  function circleHitsSolid(x, y, radius) {
    if (x < ROOM.x + radius || x > ROOM.x + ROOM.width - radius) return true;
    if (y < ROOM.y + radius || y > ROOM.y + ROOM.height - radius) return true;
    for (const solid of state.level.solids) {
      const nearX = clamp(x, solid.x, solid.x + solid.width);
      const nearY = clamp(y, solid.y, solid.y + solid.height);
      if (distance(x, y, nearX, nearY) < radius) return true;
    }
    return false;
  }

  /** Move a circle by (dx, dy), sliding along solids one axis at a time. */
  function moveCircle(body, radius, dx, dy) {
    if (dx !== 0 && !circleHitsSolid(body.x + dx, body.y, radius)) body.x += dx;
    if (dy !== 0 && !circleHitsSolid(body.x, body.y + dy, radius)) body.y += dy;
  }

  function moveToward(body, radius, tx, ty, speed, dt) {
    const dist = distance(body.x, body.y, tx, ty);
    if (dist < 2) return true;
    const step = Math.min(dist, speed * dt);
    moveCircle(body, radius, ((tx - body.x) / dist) * step, ((ty - body.y) / dist) * step);
    return distance(body.x, body.y, tx, ty) < 4;
  }

  function nearestWaypointIndex(guard) {
    let best = 0;
    let bestDist = Infinity;
    guard.waypoints.forEach((point, index) => {
      const dist = distance(guard.x, guard.y, point[0], point[1]);
      if (dist < bestDist) {
        bestDist = dist;
        best = index;
      }
    });
    return best;
  }

  function stepGuard(guard, dt, harmless, detection) {
    const player = state.player;
    guard.sees = false;
    let closeness = 0;
    if (!harmless) {
      closeness = inCone(guard.x, guard.y, guard.angle, GUARD.viewRange, GUARD.viewHalfAngle, player.x, player.y);
      guard.sees = closeness > 0;
    }
    const distToPlayer = distance(guard.x, guard.y, player.x, player.y);
    const hears = !harmless && player.moving && !player.sneaking && distToPlayer < THIEF.noiseRadius;

    if (guard.sees) {
      const fill = GUARD.suspicionFill * (0.45 + 0.55 * closeness)
        * (player.sneaking ? ALARM.sneakFactor : 1)
        * (player.moving ? 1 : ALARM.stillFactor);
      guard.suspicion = clamp(guard.suspicion + fill * dt, 0, 1);
      detection.alarmRate += GUARD.alarmPerSecond * (0.4 + 0.6 * closeness)
        * (player.sneaking ? ALARM.sneakFactor : 1);
      detection.anySeen = true;
      state.lastSeen.x = player.x;
      state.lastSeen.y = player.y;
      guard.loseTimer = GUARD.loseSeconds;
    } else if (hears) {
      guard.suspicion = clamp(guard.suspicion + 0.55 * dt, 0, 1);
    } else {
      guard.suspicion = clamp(guard.suspicion - GUARD.suspicionDecay * dt, 0, 1);
    }

    if (!harmless && (guard.suspicion >= 1 || state.lockdown)) {
      if (guard.state !== GUARD_CHASE) guard.state = GUARD_CHASE;
    } else if (guard.state === GUARD_CHASE && guard.loseTimer <= 0 && guard.suspicion < 0.4) {
      guard.state = GUARD_INVESTIGATE;
      guard.targetX = state.lastSeen.x;
      guard.targetY = state.lastSeen.y;
      guard.lookTimer = GUARD.investigateSeconds;
    } else if (guard.state !== GUARD_CHASE && guard.state !== GUARD_INVESTIGATE && guard.state !== GUARD_RETURN) {
      guard.state = guard.suspicion > 0.22 ? GUARD_SUSPICIOUS : GUARD_PATROL;
    }

    if (guard.state === GUARD_CHASE) {
      const tx = guard.sees ? player.x : state.lastSeen.x;
      const ty = guard.sees ? player.y : state.lastSeen.y;
      guard.angle = turnToward(guard.angle, Math.atan2(ty - guard.y, tx - guard.x), 5.2 * dt);
      const speed = GUARD.chaseSpeed * (state.lockdown ? 1.08 : 1);
      moveToward(guard, GUARD.radius, tx, ty, speed, dt);
      if (!guard.sees) guard.loseTimer -= dt;
      if (!harmless && distToPlayer < THIEF.catchRadius) detection.caught = true;
    } else if (guard.state === GUARD_SUSPICIOUS) {
      guard.angle = turnToward(guard.angle, Math.atan2(player.y - guard.y, player.x - guard.x), 3.4 * dt);
    } else if (guard.state === GUARD_INVESTIGATE) {
      const arrived = moveToward(guard, GUARD.radius, guard.targetX, guard.targetY, GUARD.investigateSpeed, dt);
      if (arrived) {
        guard.lookTimer -= dt;
        guard.angle += Math.sin(state.time * 1.7 + guard.x) * 1.6 * dt;
        if (guard.lookTimer <= 0) {
          guard.state = GUARD_RETURN;
          guard.waypointIndex = nearestWaypointIndex(guard);
        }
      } else {
        guard.angle = turnToward(guard.angle, Math.atan2(guard.targetY - guard.y, guard.targetX - guard.x), 4 * dt);
      }
    } else if (guard.state === GUARD_RETURN) {
      const point = guard.waypoints[guard.waypointIndex];
      const arrived = moveToward(guard, GUARD.radius, point[0], point[1], GUARD.investigateSpeed, dt);
      guard.angle = turnToward(guard.angle, Math.atan2(point[1] - guard.y, point[0] - guard.x), 4 * dt);
      if (arrived) {
        guard.state = GUARD_PATROL;
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        guard.pauseTimer = 0;
      }
    } else {
      // Patrol: walk the route, pause at each end, look where you walk.
      if (guard.pauseTimer > 0) {
        guard.pauseTimer -= dt;
      } else {
        const point = guard.waypoints[guard.waypointIndex];
        const arrived = moveToward(guard, GUARD.radius, point[0], point[1], GUARD.patrolSpeed, dt);
        guard.angle = turnToward(guard.angle, Math.atan2(point[1] - guard.y, point[0] - guard.x), 3.2 * dt);
        if (arrived) {
          guard.pauseTimer = GUARD.waypointPause * (0.7 + random() * 0.6);
          guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        }
      }
    }
  }

  function stepCamera(camera, dt, harmless, detection) {
    camera.angle = camera.baseAngle + Math.sin(state.time * CAMERA.sweepSpeed + camera.phase) * CAMERA.sweepAmplitude;
    camera.sees = false;
    if (harmless || state.empTimer > 0) return;
    const player = state.player;
    const closeness = inCone(camera.x, camera.y, camera.angle, CAMERA.viewRange, CAMERA.viewHalfAngle, player.x, player.y);
    if (closeness > 0) {
      camera.sees = true;
      detection.alarmRate += CAMERA.alarmPerSecond * (0.4 + 0.6 * closeness)
        * (player.sneaking ? ALARM.sneakFactor : 1);
      detection.anySeen = true;
      state.lastSeen.x = player.x;
      state.lastSeen.y = player.y;
    }
  }

  /**
   * One fixed tick. `control` is { mx, my, sneak, interact, decoyAt, emp }:
   * a movement wish, held-key flags, a decoy landing point (or null) and a
   * one-shot EMP request. With `harmless` set (title backdrop) guards patrol
   * and cameras sweep but nothing detects, scores or catches.
   */
  function step(dt, control, harmless) {
    let events = 0;
    if (state.caught || state.cleared) return events;
    state.time += dt;
    if (state.message.timer > 0) state.message.timer -= dt;
    if (state.empTimer > 0) state.empTimer = Math.max(0, state.empTimer - dt);
    for (const ping of state.decoyPings) ping.timer -= dt;
    state.decoyPings = state.decoyPings.filter((ping) => ping.timer > 0);

    const player = state.player;
    player.sneaking = Boolean(control.sneak);
    let mx = control.mx || 0;
    let my = control.my || 0;
    const length = Math.sqrt(mx * mx + my * my);
    if (length > 1) {
      mx /= length;
      my /= length;
    }
    player.moving = length > 0.05;
    if (!harmless && player.moving) {
      const speed = player.sneaking ? THIEF.sneakSpeed : THIEF.runSpeed;
      moveCircle(player, THIEF.radius, mx * speed * dt, my * speed * dt);
      player.angle = Math.atan2(my, mx);
    }

    // Tools at a cost: charges per room, and every use docks the score.
    if (!harmless && control.decoyAt && state.decoysLeft > 0) {
      let tx = control.decoyAt.x;
      let ty = control.decoyAt.y;
      const dist = distance(player.x, player.y, tx, ty);
      if (dist > TOOLS.decoyRange) {
        tx = player.x + ((tx - player.x) / dist) * TOOLS.decoyRange;
        ty = player.y + ((ty - player.y) / dist) * TOOLS.decoyRange;
      }
      tx = clamp(tx, ROOM.x + 14, ROOM.x + ROOM.width - 14);
      ty = clamp(ty, ROOM.y + 14, ROOM.y + ROOM.height - 14);
      state.decoysLeft -= 1;
      state.score = Math.max(0, state.score - TOOLS.decoyCost);
      state.decoyPings.push({ x: tx, y: ty, timer: 1.2 });
      for (const guard of state.guards) {
        if (guard.state !== GUARD_CHASE && distance(guard.x, guard.y, tx, ty) < TOOLS.decoyHearRadius) {
          guard.state = GUARD_INVESTIGATE;
          guard.targetX = tx;
          guard.targetY = ty;
          guard.lookTimer = GUARD.investigateSeconds;
        }
      }
      say('Decoy coin tossed. Guards turn to the clink.', 2.2);
      events |= EVENT_DECOY;
    }
    if (!harmless && control.emp && state.empsLeft > 0 && state.empTimer <= 0) {
      state.empsLeft -= 1;
      state.empTimer = TOOLS.empSeconds;
      state.score = Math.max(0, state.score - TOOLS.empCost);
      say('EMP pulse: cameras are blind for a few seconds.', 2.6);
      events |= EVENT_EMP;
    }

    const detection = { anySeen: false, alarmRate: 0, caught: false };
    for (const guard of state.guards) stepGuard(guard, dt, harmless, detection);
    for (const camera of state.cameras) stepCamera(camera, dt, harmless, detection);

    if (!harmless) {
      if (detection.anySeen) {
        if (!state.seenEver) events |= EVENT_SEEN;
        state.seenEver = true;
        state.alarmHold = 0;
        state.alarm = clamp(state.alarm + detection.alarmRate * dt, 0, ALARM.max);
      } else {
        state.alarmHold += dt;
        if (state.alarmHold > ALARM.decayDelay) {
          state.alarm = clamp(state.alarm - ALARM.decayPerSecond * dt, 0, ALARM.max);
        }
      }
      if (state.alarm >= ALARM.max && !state.lockdown) {
        state.lockdown = true;
        say('LOCKDOWN! Every guard is coming. Break their line of sight!', 3.5);
        events |= EVENT_LOCKDOWN;
      }
      if (state.lockdown && state.alarm < 55) {
        state.lockdown = false;
        say('The alarm cools. Stay out of the cones.', 2.5);
      }
      if (detection.caught) {
        state.caught = true;
        events |= EVENT_CAUGHT;
        return events;
      }
    }

    // Loot: stand close and hold interact to lift a piece, piece by piece.
    if (!harmless) {
      let nearest = -1;
      let nearestDist = Infinity;
      state.loots.forEach((loot, index) => {
        if (loot.taken) return;
        const dist = distance(player.x, player.y, loot.x, loot.y);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = index;
        }
      });
      if (nearest >= 0 && nearestDist <= THIEF.lootRange && control.interact) {
        if (state.channel.index !== nearest) {
          state.channel.index = nearest;
          state.channel.progress = 0;
        }
        state.channel.progress += dt / THIEF.lootSeconds;
        if (state.channel.progress >= 1) {
          const loot = state.loots[nearest];
          loot.taken = true;
          state.lootGot += 1;
          player.bag += 1;
          state.score += loot.value;
          state.channel.index = -1;
          state.channel.progress = 0;
          say(`${loot.label} lifted: +$${loot.value}. ${state.lootGot}/${state.lootNeed} needed.`, 2.6);
          events |= EVENT_LOOT;
        }
      } else {
        state.channel.index = -1;
        state.channel.progress = Math.max(0, state.channel.progress - dt * 2);
      }

      // Getaway: with enough loot, stand in the door to slip out.
      const exit = state.level.exit;
      const inExit = player.x > exit.x && player.x < exit.x + exit.width
        && player.y > exit.y && player.y < exit.y + exit.height;
      if (state.lootGot >= state.lootNeed && inExit) {
        state.exitProgress += dt / THIEF.exitSeconds;
        if (state.exitProgress >= 1) {
          state.cleared = true;
          const timeBonus = Math.max(0, Math.round(state.level.par - state.time)) * SCORE.timeBonusPerSecond;
          state.lastBonus = {
            level: SCORE.levelClear,
            ghost: state.seenEver ? 0 : SCORE.ghostBonus,
            time: timeBonus,
          };
          state.score += state.lastBonus.level + state.lastBonus.ghost + state.lastBonus.time;
          events |= EVENT_CLEAR;
        }
      } else {
        state.exitProgress = Math.max(0, state.exitProgress - dt * 2);
      }
    }

    return events;
  }

  resetRun();
  return { state, resetRun, loadLevel, step, say };
}
