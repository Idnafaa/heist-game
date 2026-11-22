// The three rooms of the Velvet Vault job. Each level is one screen: solids
// (walls, glass cases, pillars) that block both feet and eyesight, patrol
// routes for the guards, sweeping cameras, loot worth lifting, a start
// corner and a getaway door. Every room offers at least two routes past each
// guard, so reading the cones — not memorising one path — wins the night.
//
// Coordinates are in the 1280x720 field. Angles follow canvas convention:
// 0 points east, Math.PI / 2 points south.

export const LEVELS = [
  {
    name: 'Lobby of Lamps',
    subtitle: 'Two guards, one camera, easy money. Warm up quiet.',
    need: 2,
    par: 75,
    start: { x: 95, y: 622 },
    exit: { x: 1176, y: 594, width: 60, height: 78 },
    carpets: [
      { x: 420, y: 300, width: 440, height: 150 },
      { x: 120, y: 120, width: 200, height: 120 },
    ],
    solids: [
      { x: 330, y: 248, width: 260, height: 34, kind: 'case' },
      { x: 690, y: 248, width: 260, height: 34, kind: 'case' },
      { x: 610, y: 402, width: 34, height: 120, kind: 'case' },
      { x: 120, y: 342, width: 180, height: 22, kind: 'wall' },
      { x: 980, y: 342, width: 180, height: 22, kind: 'wall' },
      { x: 298, y: 448, width: 46, height: 46, kind: 'pillar' },
      { x: 936, y: 448, width: 46, height: 46, kind: 'pillar' },
      { x: 700, y: 120, width: 46, height: 46, kind: 'pillar' },
    ],
    guards: [
      { waypoints: [[210, 182], [1070, 182]] },
      { waypoints: [[1070, 548], [250, 548]] },
    ],
    cameras: [
      { x: 640, y: 98, baseAngle: Math.PI / 2, phase: 0 },
    ],
    loots: [
      { x: 460, y: 208, kind: 'gem', value: 600, label: 'Sapphire' },
      { x: 820, y: 208, kind: 'cash', value: 450, label: 'Cash bundle' },
      { x: 627, y: 618, kind: 'gold', value: 700, label: 'Gold bars' },
    ],
  },
  {
    name: 'Gem Hall',
    subtitle: 'Three guards, two cameras. The cases make good cover.',
    need: 3,
    par: 95,
    start: { x: 95, y: 158 },
    exit: { x: 44, y: 594, width: 60, height: 78 },
    carpets: [
      { x: 440, y: 290, width: 400, height: 140 },
      { x: 980, y: 120, width: 220, height: 140 },
    ],
    solids: [
      { x: 300, y: 182, width: 300, height: 34, kind: 'case' },
      { x: 680, y: 182, width: 300, height: 34, kind: 'case' },
      { x: 300, y: 468, width: 300, height: 34, kind: 'case' },
      { x: 680, y: 468, width: 300, height: 34, kind: 'case' },
      { x: 520, y: 342, width: 240, height: 22, kind: 'wall' },
      { x: 628, y: 150, width: 26, height: 50, kind: 'wall' },
      { x: 628, y: 530, width: 26, height: 50, kind: 'wall' },
      { x: 176, y: 380, width: 46, height: 46, kind: 'pillar' },
      { x: 1058, y: 380, width: 46, height: 46, kind: 'pillar' },
    ],
    guards: [
      { waypoints: [[180, 132], [1100, 132]] },
      { waypoints: [[150, 320], [1130, 320]] },
      { waypoints: [[1100, 606], [180, 606]] },
    ],
    cameras: [
      { x: 330, y: 98, baseAngle: Math.PI / 2, phase: 1.4 },
      { x: 950, y: 686, baseAngle: -Math.PI / 2, phase: 3.6 },
    ],
    loots: [
      { x: 450, y: 142, kind: 'gem', value: 650, label: 'Emerald' },
      { x: 830, y: 142, kind: 'gold', value: 750, label: 'Gold bars' },
      { x: 450, y: 548, kind: 'cash', value: 500, label: 'Cash bundle' },
      { x: 830, y: 548, kind: 'gem', value: 800, label: 'Ruby' },
    ],
  },
  {
    name: 'The Velvet Vault',
    subtitle: 'The big stone sleeps in the vault. Four guards say otherwise.',
    need: 4,
    par: 120,
    start: { x: 95, y: 622 },
    exit: { x: 1176, y: 594, width: 60, height: 78 },
    carpets: [
      { x: 1010, y: 120, width: 210, height: 110 },
      { x: 380, y: 330, width: 420, height: 150 },
    ],
    solids: [
      // Vault chamber, top right: one door gap on its west wall.
      { x: 980, y: 92, width: 22, height: 100, kind: 'wall' },
      { x: 980, y: 252, width: 270, height: 22, kind: 'wall' },
      { x: 1060, y: 150, width: 120, height: 30, kind: 'case' },
      // Gallery furniture.
      { x: 250, y: 220, width: 280, height: 34, kind: 'case' },
      { x: 600, y: 220, width: 220, height: 34, kind: 'case' },
      { x: 250, y: 470, width: 280, height: 34, kind: 'case' },
      { x: 640, y: 470, width: 34, height: 124, kind: 'case' },
      { x: 880, y: 420, width: 220, height: 22, kind: 'wall' },
      { x: 120, y: 360, width: 170, height: 22, kind: 'wall' },
      { x: 440, y: 96, width: 46, height: 36, kind: 'pillar' },
      { x: 440, y: 560, width: 46, height: 36, kind: 'pillar' },
      { x: 1090, y: 520, width: 46, height: 46, kind: 'pillar' },
    ],
    guards: [
      { waypoints: [[1052, 214], [1186, 214]] },
      { waypoints: [[180, 150], [860, 150]] },
      { waypoints: [[1130, 330], [240, 330]] },
      { waypoints: [[1080, 612], [220, 612]] },
    ],
    cameras: [
      { x: 640, y: 98, baseAngle: Math.PI / 2, phase: 0.8 },
      { x: 1244, y: 390, baseAngle: Math.PI, phase: 2.9 },
      { x: 36, y: 300, baseAngle: 0, phase: 5.1 },
    ],
    loots: [
      { x: 1120, y: 124, kind: 'gem', value: 1500, label: 'Velvet Star' },
      { x: 390, y: 180, kind: 'cash', value: 500, label: 'Cash bundle' },
      { x: 710, y: 180, kind: 'gold', value: 700, label: 'Gold bars' },
      { x: 390, y: 548, kind: 'cash', value: 550, label: 'Cash bundle' },
      { x: 800, y: 560, kind: 'gem', value: 850, label: 'Opal' },
    ],
  },
];
