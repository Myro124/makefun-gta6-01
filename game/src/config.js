// Solmar Heat — tuning, city layout, missions and palette, all in one place.
// Top-down open-world crime game. The city is 2560x1920 world units; the
// renderer shows a 1280x720 window that follows the player.
export const CITY = { width: 2560, height: 1920 };
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const ROAD_W = 96;
export const ROADS_X = [200, 700, 1200, 1700, 2200];
export const ROADS_Y = [200, 650, 1100, 1550, 1750];
export const SAVE_KEY = 'solmar-heat.save.v1';
// Title panel: the subtitle lines must wrap inside the panel, so the panel
// is wider than the longest line and the text gets a side margin.
export const TITLE_PANEL = { width: 760, sideMargin: 44, lineHeight: 32 };
// Minimap: brighter roads and buildings than the old dark-on-dark scheme,
// so the map reads at a glance in the corner of the HUD.
export const MINIMAP = { background: '#16241a', road: '#6a707c', building: '#c2a878', park: '#3f9a55', water: '#2a6a8a' };
// Wanted decay: how long after the last crime the heat starts to cool,
// and how long each star then takes to drop.
export const WANTED = { coolDown: 25, decayPerStar: 25 };
export const PLAYER = {
  radius: 13, walkSpeed: 170, sprintSpeed: 260, health: 100,
  magSize: 12, reloadTime: 1.1, fireInterval: 0.16, bulletSpeed: 780, bulletDamage: 34,
};
export const CAR = {
  length: 52, width: 26, accel: 420, brake: 620, maxSpeed: 520, reverseMax: 180,
  turnRate: 2.6, health: 100, drag: 0.6,
};
export const MISSIONS = [
  { id: 1, name: 'The Pickup', reward: 500, giver: 'Ana Solis',
    brief: 'Pick up the package at the dock warehouse and take it to Neon Palms.',
    pickup: { x: 2180, y: 1620, label: 'Dock warehouse' },
    dropoff: { x: 700, y: 650, label: 'Neon Palms' } },
  { id: 2, name: 'Wheelman', reward: 800, giver: 'Ana Solis',
    brief: 'Steal the red coupe from the marina lot and bring it to the hideout garage.',
    pickup: { x: 2120, y: 1380, label: 'Marina lot — red coupe' },
    dropoff: { x: 420, y: 1100, label: 'Hideout garage' } },
  { id: 3, name: 'Harbor Lights', reward: 1500, giver: 'Ana Solis',
    brief: 'Take down the 4 warehouse guards, grab the loot, and get out.',
    pickup: { x: 2180, y: 1620, label: 'Warehouse guards' },
    dropoff: { x: 420, y: 1100, label: 'Hideout garage' } },
];
export const PALETTE = {
  grass: '#2e5d3a', ground: '#3a3f4a', road: '#23262e', roadLine: '#d8c95a',
  sidewalk: '#6b6f78', building: '#8a7f6d', building2: '#7d6a8a', building3: '#5d7a8a',
  park: '#2f7a44', water: '#1e4d6b', sand: '#b8a06a', roof: '#4a3f35',
  player: '#f2c94c', playerCar: '#e5534b', police: '#3a6fd8',
  ped: '#e8e0d0', guard: '#c0392b', traffic: '#9aa3ad', text: '#f2f4f7', muted: '#aab2bd',
  panel: 'rgba(12,14,20,0.78)', gold: '#f2c94c', red: '#ff4d4d', green: '#4ade80',
};
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
