// Velvet Vault drawing: state in, pixels out. The whole room fits the
// 1280x720 field, so one frame shows the thief crossing the room, guards
// with vision cones, sweeping cameras, the loot and the alarm meter.
// Vision cones are ray-cast fans that stop at walls and cases, so cover
// reads at a glance: amber cones are danger, glass cases are safety,
// glowing loot is the prize, and the meter up top is the clock.

import { CAMERA, FIELD, FONT, GUARD, PALETTE, ROOM, THIEF } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_WIN = 'win';

const HUD_HEIGHT = 84;
const TILE = 61;

function formatTime(seconds) {
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${rest < 10 ? '0' : ''}${rest}`;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, weight) {
    const key = `${weight || ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ? `${weight} ` : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.fillText(value, x, y);
  }

  function pointInSolid(x, y, solids) {
    for (const solid of solids) {
      if (x > solid.x && x < solid.x + solid.width && y > solid.y && y < solid.y + solid.height) return true;
    }
    return false;
  }

  /** One ray-cast vision cone: a fan of rays that stop at cover. */
  function drawCone(ox, oy, angle, range, halfAngle, fill, solids) {
    const rays = 26;
    context.fillStyle = fill;
    context.beginPath();
    context.moveTo(ox, oy);
    for (let i = 0; i <= rays; i += 1) {
      const rayAngle = angle - halfAngle + (2 * halfAngle * i) / rays;
      const dx = Math.cos(rayAngle);
      const dy = Math.sin(rayAngle);
      let dist = range;
      for (let d = 10; d < range; d += 8) {
        const x = ox + dx * d;
        const y = oy + dy * d;
        if (x < ROOM.x || x > ROOM.x + ROOM.width || y < ROOM.y || y > ROOM.y + ROOM.height || pointInSolid(x, y, solids)) {
          dist = d;
          break;
        }
      }
      context.lineTo(ox + dx * dist, oy + dy * dist);
    }
    context.closePath();
    context.fill();
  }

  function drawFloor(state) {
    context.fillStyle = PALETTE.floorA;
    context.fillRect(ROOM.x, ROOM.y, ROOM.width, ROOM.height);
    context.fillStyle = PALETTE.floorB;
    for (let ty = 0; ty < ROOM.height / TILE; ty += 1) {
      for (let tx = 0; tx < ROOM.width / TILE; tx += 1) {
        if ((tx + ty) % 2 === 0) context.fillRect(ROOM.x + tx * TILE, ROOM.y + ty * TILE, TILE, TILE);
      }
    }
    for (const carpet of state.level.carpets) {
      context.fillStyle = PALETTE.carpet;
      context.fillRect(carpet.x, carpet.y, carpet.width, carpet.height);
      context.strokeStyle = PALETTE.carpetTrim;
      context.lineWidth = 3;
      context.strokeRect(carpet.x + 6, carpet.y + 6, carpet.width - 12, carpet.height - 12);
    }
    // Outer walls.
    context.fillStyle = PALETTE.wall;
    context.fillRect(ROOM.x - 14, ROOM.y - 14, ROOM.width + 28, 14);
    context.fillRect(ROOM.x - 14, ROOM.y + ROOM.height, ROOM.width + 28, 14);
    context.fillRect(ROOM.x - 14, ROOM.y - 14, 14, ROOM.height + 28);
    context.fillRect(ROOM.x + ROOM.width, ROOM.y - 14, 14, ROOM.height + 28);
    context.fillStyle = PALETTE.wallTop;
    context.fillRect(ROOM.x - 14, ROOM.y - 14, ROOM.width + 28, 4);
  }

  function drawExit(state) {
    const exit = state.level.exit;
    const open = state.lootGot >= state.lootNeed;
    context.fillStyle = open ? PALETTE.exitOpen : PALETTE.exitClosed;
    context.fillRect(exit.x, exit.y, exit.width, exit.height);
    context.fillStyle = PALETTE.van;
    context.fillRect(exit.x + 8, exit.y + 10, exit.width - 16, exit.height - 20);
    context.fillStyle = PALETTE.hudBar;
    context.fillRect(exit.x + 14, exit.y + 18, exit.width - 28, 16);
    text('GETAWAY', exit.x + exit.width / 2, exit.y - 8, 15, open ? PALETTE.good : PALETTE.muted, 'center', 'bold');
    if (!open) text(`needs ${state.lootNeed} loot`, exit.x + exit.width / 2, exit.y + exit.height + 20, 13, PALETTE.muted, 'center');
    if (open && state.exitProgress > 0) {
      context.fillStyle = PALETTE.good;
      context.fillRect(exit.x, exit.y + exit.height + 6, exit.width * state.exitProgress, 6);
    }
  }

  function drawLoot(state) {
    for (let index = 0; index < state.loots.length; index += 1) {
      const loot = state.loots[index];
      if (loot.taken) continue;
      const pulse = 0.55 + 0.25 * Math.sin(state.time * 3 + loot.sparkle);
      context.fillStyle = `rgba(242, 201, 76, ${0.14 * pulse + 0.08})`;
      context.beginPath();
      context.arc(loot.x, loot.y, 30, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.caseFrame;
      context.fillRect(loot.x - 17, loot.y - 14, 34, 28);
      context.fillStyle = PALETTE.caseGlass;
      context.globalAlpha = 0.35;
      context.fillRect(loot.x - 14, loot.y - 11, 28, 22);
      context.globalAlpha = 1;
      if (loot.kind === 'gem') {
        context.fillStyle = PALETTE.lootGem;
        context.beginPath();
        context.moveTo(loot.x, loot.y - 10);
        context.lineTo(loot.x + 8, loot.y);
        context.lineTo(loot.x, loot.y + 10);
        context.lineTo(loot.x - 8, loot.y);
        context.closePath();
        context.fill();
      } else if (loot.kind === 'cash') {
        context.fillStyle = PALETTE.lootCash;
        context.fillRect(loot.x - 10, loot.y - 6, 20, 12);
        context.fillStyle = PALETTE.hudBar;
        context.fillRect(loot.x - 2, loot.y - 6, 4, 12);
      } else {
        context.fillStyle = PALETTE.lootGold;
        context.fillRect(loot.x - 11, loot.y + 2, 22, 6);
        context.fillRect(loot.x - 7, loot.y - 5, 14, 6);
      }
      text(`$${loot.value}`, loot.x, loot.y + 32, 14, PALETTE.lootGold, 'center', 'bold');
      if (state.channel.index === index && state.channel.progress > 0) {
        context.strokeStyle = PALETTE.text;
        context.lineWidth = 4;
        context.beginPath();
        context.arc(loot.x, loot.y, 24, -Math.PI / 2, -Math.PI / 2 + state.channel.progress * Math.PI * 2);
        context.stroke();
      }
    }
  }

  /** Loot price tags, painted over the furniture so they never hide. */
  function drawLootLabels(state) {
    for (const loot of state.loots) {
      if (loot.taken) continue;
      text(`$${loot.value}`, loot.x, loot.y + 32, 14, PALETTE.lootGold, 'center', 'bold');
    }
  }

  function drawSolids(state) {
    for (const solid of state.level.solids) {
      if (solid.kind === 'case') {
        context.fillStyle = PALETTE.caseFrame;
        context.fillRect(solid.x, solid.y, solid.width, solid.height);
        context.fillStyle = PALETTE.caseGlass;
        context.globalAlpha = 0.4;
        context.fillRect(solid.x + 4, solid.y + 4, solid.width - 8, solid.height - 8);
        context.globalAlpha = 1;
        context.strokeStyle = PALETTE.wallEdge;
        context.lineWidth = 2;
        context.strokeRect(solid.x + 1, solid.y + 1, solid.width - 2, solid.height - 2);
      } else if (solid.kind === 'pillar') {
        context.fillStyle = PALETTE.pillar;
        context.fillRect(solid.x, solid.y, solid.width, solid.height);
        context.fillStyle = PALETTE.wallTop;
        context.fillRect(solid.x + 5, solid.y + 5, solid.width - 10, solid.height - 10);
      } else {
        context.fillStyle = PALETTE.wall;
        context.fillRect(solid.x, solid.y, solid.width, solid.height);
        context.fillStyle = PALETTE.wallTop;
        context.fillRect(solid.x, solid.y, solid.width, 5);
        context.strokeStyle = PALETTE.wallEdge;
        context.lineWidth = 2;
        context.strokeRect(solid.x + 1, solid.y + 1, solid.width - 2, solid.height - 2);
      }
    }
  }

  function drawPerson(x, y, angle, bodyColor, trimColor, skinColor, ringColor) {
    if (ringColor) {
      context.strokeStyle = ringColor;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(x, y, THIEF.radius + 5, 0, Math.PI * 2);
      context.stroke();
    }
    context.fillStyle = bodyColor;
    context.beginPath();
    context.arc(x, y, THIEF.radius, 0, Math.PI * 2);
    context.fill();
    const fx = x + Math.cos(angle) * 6;
    const fy = y + Math.sin(angle) * 6;
    context.fillStyle = skinColor;
    context.beginPath();
    context.arc(fx, fy, 6, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = trimColor;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(fx - Math.cos(angle + Math.PI / 2) * 6, fy - Math.sin(angle + Math.PI / 2) * 6);
    context.lineTo(fx + Math.cos(angle + Math.PI / 2) * 6, fy + Math.sin(angle + Math.PI / 2) * 6);
    context.stroke();
  }

  function drawActors(state) {
    for (const guard of state.guards) {
      drawPerson(guard.x, guard.y, guard.angle, PALETTE.guard, PALETTE.guardCap, PALETTE.guardSkin, null);
      if (guard.suspicion > 0.03) {
        context.fillStyle = PALETTE.hudBar;
        context.fillRect(guard.x - 16, guard.y - 34, 32, 6);
        context.fillStyle = guard.state === 'chase' ? PALETTE.danger : PALETTE.warn;
        context.fillRect(guard.x - 16, guard.y - 34, 32 * guard.suspicion, 6);
      }
      if (guard.state === 'chase') text('!', guard.x, guard.y - 40, 26, PALETTE.danger, 'center', 'bold');
      else if (guard.state === 'suspicious' || guard.state === 'investigate') text('?', guard.x, guard.y - 40, 22, PALETTE.warn, 'center', 'bold');
    }
    for (const camera of state.cameras) {
      const off = state.empTimer > 0;
      context.fillStyle = off ? PALETTE.exitClosed : PALETTE.hudBar;
      context.fillRect(camera.x - 11, camera.y - 9, 22, 18);
      context.strokeStyle = PALETTE.muted;
      context.lineWidth = 2;
      context.strokeRect(camera.x - 11, camera.y - 9, 22, 18);
      const lx = camera.x + Math.cos(camera.angle) * 10;
      const ly = camera.y + Math.sin(camera.angle) * 10;
      context.fillStyle = off ? PALETTE.muted : (camera.sees ? PALETTE.danger : '#7ec8ff');
      context.beginPath();
      context.arc(lx, ly, 5, 0, Math.PI * 2);
      context.fill();
      if (!off && Math.floor(state.time * 2) % 2 === 0) {
        context.fillStyle = PALETTE.danger;
        context.beginPath();
        context.arc(camera.x + 7, camera.y - 6, 3, 0, Math.PI * 2);
        context.fill();
      }
      text(off ? 'CAM OFF' : 'CAM', camera.x, camera.y + 26, 11, off ? PALETTE.muted : '#7ec8ff', 'center', 'bold');
    }
    const player = state.player;
    if (player.bag > 0) {
      const bx = player.x - Math.cos(player.angle) * 16;
      const by = player.y - Math.sin(player.angle) * 16;
      context.fillStyle = PALETTE.lootGold;
      context.beginPath();
      context.arc(bx, by, 7 + player.bag, 0, Math.PI * 2);
      context.fill();
    }
    drawPerson(player.x, player.y, player.angle, PALETTE.thief, PALETTE.thiefTrim, PALETTE.thiefSkin, PALETTE.text);
    text('THIEF', player.x, player.y - 26, 12, PALETTE.text, 'center', 'bold');
    for (const ping of state.decoyPings) {
      const grow = (1.2 - ping.timer) * 34;
      context.strokeStyle = PALETTE.lootGold;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(ping.x, ping.y, 8 + grow, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = PALETTE.lootGold;
      context.beginPath();
      context.arc(ping.x, ping.y, 5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawHud(state, best, muted) {
    context.fillStyle = PALETTE.hudBar;
    context.fillRect(0, 0, FIELD.width, HUD_HEIGHT);
    context.fillStyle = PALETTE.panelEdge;
    context.fillRect(0, HUD_HEIGHT - 3, FIELD.width, 3);

    text('VELVET VAULT', 20, 30, 20, PALETTE.panelEdge, 'left', 'bold');
    text(state.level.name, 20, 56, 16, PALETTE.text, 'left');
    text(`Best $${best}`, 20, 76, 13, PALETTE.muted, 'left');

    // The alarm meter: the loudest thing on screen, by design.
    const meterX = 330;
    const meterW = 380;
    text('ALARM', meterX, 30, 20, state.lockdown ? PALETTE.danger : PALETTE.text, 'left', 'bold');
    const pct = Math.round(state.alarm);
    text(`${pct}%`, meterX + meterW, 30, 20, state.alarm > 70 ? PALETTE.danger : PALETTE.text, 'right', 'bold');
    context.fillStyle = '#2a2f42';
    context.fillRect(meterX, 38, meterW, 20);
    const fillColor = state.alarm > 70 ? PALETTE.danger : state.alarm > 35 ? PALETTE.warn : PALETTE.good;
    context.fillStyle = fillColor;
    context.fillRect(meterX, 38, (meterW * state.alarm) / 100, 20);
    if (state.lockdown && Math.floor(state.time * 4) % 2 === 0) {
      context.strokeStyle = PALETTE.danger;
      context.lineWidth = 3;
      context.strokeRect(meterX - 2, 36, meterW + 4, 24);
    }
    context.fillStyle = PALETTE.hudBar;
    for (let tick = 1; tick < 10; tick += 1) context.fillRect(meterX + (meterW * tick) / 10, 38, 2, 20);
    text(state.lockdown ? 'LOCKDOWN — break line of sight!' : 'Stay out of the cones', meterX, 76, 13, state.lockdown ? PALETTE.danger : PALETTE.muted, 'left');

    text(`Score $${state.score}`, 760, 30, 20, PALETTE.lootGold, 'left', 'bold');
    text(`Loot ${state.lootGot}/${state.lootNeed} needed · ${state.lootTotal} in room`, 760, 56, 15, PALETTE.text, 'left');
    text(`Time ${formatTime(state.time)}`, 760, 76, 13, PALETTE.muted, 'left');

    text(`Decoys Q: ${'●'.repeat(state.decoysLeft)}${'○'.repeat(Math.max(0, 3 - state.decoysLeft))}`, 1030, 30, 15, PALETTE.text, 'left');
    text(`EMP F: ${'●'.repeat(state.empsLeft)}${'○'.repeat(Math.max(0, 2 - state.empsLeft))}${state.empTimer > 0 ? ` (${Math.ceil(state.empTimer)}s)` : ''}`, 1030, 56, 15, PALETTE.text, 'left');
    text(muted ? 'Sound off (M)' : 'Sneak Shift · Lift hold E', 1030, 76, 13, PALETTE.muted, 'left');

    if (state.message.timer > 0) {
      context.fillStyle = 'rgba(10, 12, 20, 0.82)';
      context.fillRect(240, FIELD.height - 44, 800, 32);
      text(state.message.text, FIELD.width / 2, FIELD.height - 22, 17, PALETTE.text, 'center');
    }
    if (state.lockdown) {
      context.fillStyle = `rgba(229, 83, 75, ${0.05 + 0.04 * Math.sin(state.time * 6)})`;
      context.fillRect(ROOM.x, ROOM.y, ROOM.width, ROOM.height);
    }
  }

  function drawPanel(title, lines, prompt, titleColor) {
    const width = 680;
    const lineHeight = 30;
    const height = 110 + lines.length * lineHeight + 64;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(8, 10, 16, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 3;
    context.strokeRect(x, y, width, height);
    text(title, FIELD.width / 2, y + 62, 44, titleColor || PALETTE.text, 'center', 'bold');
    lines.forEach((line, index) => {
      text(line, FIELD.width / 2, y + 110 + index * lineHeight, 19, PALETTE.muted, 'center');
    });
    text(prompt, FIELD.width / 2, y + height - 30, 21, PALETTE.lootGold, 'center', 'bold');
  }

  /** Paint one frame: room, cones, cover, actors, HUD, then any panel. */
  function draw(state, screen, best, muted) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);

    drawFloor(state);
    drawExit(state);
    for (const guard of state.guards) {
      drawCone(guard.x, guard.y, guard.angle, GUARD.viewRange, GUARD.viewHalfAngle,
        guard.sees || guard.state === 'chase' ? PALETTE.coneGuardHot : PALETTE.coneGuard, state.level.solids);
    }
    for (const camera of state.cameras) {
      drawCone(camera.x, camera.y, camera.angle, CAMERA.viewRange, CAMERA.viewHalfAngle,
        state.empTimer > 0 ? PALETTE.coneOff : camera.sees ? PALETTE.coneCameraHot : PALETTE.coneCamera, state.level.solids);
    }
    drawLoot(state);
    drawSolids(state);
    drawLootLabels(state);
    drawActors(state);
    drawHud(state, best, muted);

    if (screen === SCREEN_TITLE) {
      drawPanel('VELVET VAULT', [
        'A quiet night\u2019s work: lift the loot, dodge the cones, slip out.',
        'Move: WASD / arrows, or hold the mouse. Sneak: Shift (quieter, slower).',
        'Lift loot: stand close, hold E. Decoy coin: Q or right-click (costs $150).',
        'EMP: F blinds cameras for 6s (costs $300). Pause: P. Sound: M.',
        'If the ALARM fills, every guard hunts you. A guard\u2019s touch ends the night.',
        `Best haul so far: $${best}`,
      ], 'Press Space or click to start the heist', PALETTE.panelEdge);
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The guards hold their breath. So do you.'], 'Press P or Space to keep sneaking');
    } else if (screen === SCREEN_CLEAR) {
      const bonus = state.lastBonus;
      drawPanel(`${state.level.name} — CLEARED`, [
        `Room bonus +$${bonus.level}`,
        bonus.ghost > 0 ? `Ghost bonus (never seen) +$${bonus.ghost}` : 'No ghost bonus — they saw something.',
        `Speed bonus +$${bonus.time}`,
        `Haul so far: $${state.score}`,
      ], 'Press Space for the next room', PALETTE.good);
    } else if (screen === SCREEN_CAUGHT) {
      drawPanel('CAUGHT!', [
        `A guard got a hand on you in ${state.level.name}.`,
        `Loot lifted: ${state.lootGot}. Score banked: $${state.score}.`,
        'Tip: sneak (Shift) halves how fast cones fill the alarm.',
      ], 'Press Space to try the night again', PALETTE.danger);
    } else if (screen === SCREEN_WIN) {
      drawPanel('CLEAN GETAWAY', [
        'Three rooms, one van, zero fingerprints. Beautiful work.',
        `Final haul: $${state.score}`,
        `Best haul: $${Math.max(best, state.score)}`,
      ], 'Press Space to run it again', PALETTE.good);
    }
  }

  function toField(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * (canvas.width / rect.width);
    const py = (clientY - rect.top) * (canvas.height / rect.height);
    return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField };
}
