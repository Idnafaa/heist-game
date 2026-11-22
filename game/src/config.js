// Velvet Vault tuning: every number and colour the game uses lives here.
// The playfield is a fixed 1280x720 logical room; the renderer scales it to
// the window, so no rule depends on the screen size. One room fits one
// screen on purpose: the whole heist — thief, guards, cameras, loot, alarm
// meter — is readable in a single frame.

export const FIELD = { width: 1280, height: 720 };

/** Fixed simulation step: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

/** The room the thief can walk in (inside the outer walls, below the HUD). */
export const ROOM = { x: 30, y: 92, width: 1220, height: 598 };

export const THIEF = {
  radius: 13,
  runSpeed: 208,
  sneakSpeed: 116,
  catchRadius: 27,
  noiseRadius: 96,
  lootRange: 46,
  lootSeconds: 1.15,
  exitSeconds: 0.8,
};

export const GUARD = {
  radius: 13,
  patrolSpeed: 84,
  chaseSpeed: 172,
  investigateSpeed: 128,
  viewRange: 198,
  viewHalfAngle: 0.62, // radians, about 71 degrees of cone in total
  waypointPause: 1.1,
  suspicionFill: 1.15, // per second at point-blank range, before falloff
  suspicionDecay: 0.34,
  alarmPerSecond: 40,
  investigateSeconds: 2.6,
  loseSeconds: 2.2,
};

export const CAMERA = {
  viewRange: 212,
  viewHalfAngle: 0.48,
  alarmPerSecond: 27,
  sweepAmplitude: 0.85,
  sweepSpeed: 0.55,
};

export const ALARM = {
  max: 100,
  decayPerSecond: 5.5,
  decayDelay: 1.2,
  sneakFactor: 0.45,
  stillFactor: 0.78,
};

export const TOOLS = {
  decoysPerLevel: 3,
  decoyCost: 150,
  decoyRange: 280,
  decoyHearRadius: 320,
  empsPerLevel: 2,
  empCost: 300,
  empSeconds: 6,
};

export const SCORE = {
  levelClear: 500,
  ghostBonus: 400,
  timeBonusPerSecond: 5,
};

export const PALETTE = {
  backdrop: '#0d0f16',
  floorA: '#232838',
  floorB: '#1d2231',
  carpet: '#3d2b4f',
  carpetTrim: '#c9a227',
  wall: '#39415c',
  wallTop: '#4c5878',
  wallEdge: '#141826',
  caseGlass: '#9fd8e8',
  caseFrame: '#6b4f2a',
  pillar: '#2e3550',
  thief: '#15151d',
  thiefTrim: '#e8e4d8',
  thiefSkin: '#d9a066',
  guard: '#2b4a8f',
  guardCap: '#1c2f5c',
  guardSkin: '#d9a066',
  coneGuard: 'rgba(242, 201, 76, 0.20)',
  coneGuardHot: 'rgba(229, 83, 75, 0.30)',
  coneCamera: 'rgba(120, 200, 255, 0.16)',
  coneCameraHot: 'rgba(229, 83, 75, 0.28)',
  coneOff: 'rgba(140, 150, 170, 0.07)',
  lootGem: '#3fe0c5',
  lootCash: '#7ed957',
  lootGold: '#f2c94c',
  exitClosed: '#5a6274',
  exitOpen: '#3fae6a',
  van: '#8b93a3',
  hudBar: '#12151f',
  panel: '#1a1f2e',
  panelEdge: '#c9a227',
  text: '#eef1f5',
  muted: '#9aa3b5',
  danger: '#e5534b',
  warn: '#f2c94c',
  good: '#3fae6a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best total score is kept between visits (this browser only). */
export const BEST_KEY = 'velvet-vault.best';
