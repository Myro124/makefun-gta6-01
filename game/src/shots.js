// Screenshot scenes behind ?shot=start|drive|mission|wanted (with &seed=N).
// Each one sets up the real world in a staged state and steps the simulation
// forward briefly, so the frame is what real gameplay looks like and the same
// seed always gives the same frame. Staging is kept short and the player's
// health is restored afterwards, so a shot never shows a dying player.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function stepWorld(world, seconds, ctrl) {
  const s = world.state;
  for (let i = 0; i < seconds / STEP; i += 1) {
    world.step(STEP, ctrl);
    if (s.over) break;
  }
}
function putInCar(world, car, x, y, angle) {
  const s = world.state;
  car.x = x; car.y = y; car.angle = angle; car.speed = 0; car.health = 100; car.wreck = false;
  s.player.x = x; s.player.y = y; s.player.angle = angle;
  s.player.inCar = true; s.player.carId = car.id; car.occupied = true; car.driver = 'player';
}

export function stageShot(name, world) {
  world.reset();
  const s = world.state;
  if (name === 'start') {
    s.player.x = 1200; s.player.y = 1100;
    stepWorld(world, 3, { move: { x: 0, y: 0, sprint: false }, shoot: false, reload: false, enter: false, aimAngle: -Math.PI / 2 });
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'drive') {
    const car = s.cars.find((c) => c.kind === 'parked');
    if (car) putInCar(world, car, 700, 1100, 0);
    stepWorld(world, 2.2, { move: { x: 0, y: -1, sprint: false }, shoot: false, reload: false, enter: false, aimAngle: 0 });
    s.player.health = 100;
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'mission') {
    s.missionIndex = 2; s.missionStage = 'guards'; s.guardsLeft = 4;
    s.player.x = 1950; s.player.y = 1450;
    s.player.angle = Math.atan2(1620 - 1450, 2180 - 1950);
    s.guards.length = 0;
    const spots = [[-70, -40], [60, -60], [-40, 70], [80, 40]];
    for (const [dx, dy] of spots) s.guards.push({ x: 2180 + dx, y: 1620 + dy, angle: 0, health: 60, alive: true, fireT: 3, cop: false, arrestT: 0 });
    s.message = 'Harbor Lights: take down the 4 warehouse guards.'; s.messageT = 6;
    stepWorld(world, 0.8, { move: { x: 0, y: 0, sprint: false }, shoot: true, reload: false, enter: false, aimAngle: s.player.angle });
    s.player.health = 100; s.wanted = 1;
    return { screen: SCREEN_PLAY, best: 0 };
  }
  // wanted
  const car = s.cars.find((c) => c.kind === 'parked');
  if (car) putInCar(world, car, 700, 650, 0);
  s.wanted = 3; s.crimeT = 0;
  s.message = 'Wanted — 3 stars. Lose the police.'; s.messageT = 6;
  stepWorld(world, 2.2, { move: { x: 0, y: -1, sprint: false }, shoot: false, reload: false, enter: false, aimAngle: 0 });
  // Two police cars closing in, staged close to the player.
  const px = s.player.x, py = s.player.y;
  s.cars.push({ id: 900, x: px - 260, y: py - 120, angle: 0, speed: 300, health: 100, color: '#3a6fd8', kind: 'police', occupied: true, driver: 'ai', dirX: 1, dirY: 0, road: 'y', police: true, wreck: false });
  s.cars.push({ id: 901, x: px + 180, y: py + 200, angle: -Math.PI / 2, speed: 260, health: 100, color: '#3a6fd8', kind: 'police', occupied: true, driver: 'ai', dirX: 0, dirY: -1, road: 'x', police: true, wreck: false });
  stepWorld(world, 0.6, { move: { x: 0, y: -1, sprint: false }, shoot: false, reload: false, enter: false, aimAngle: 0 });
  s.player.health = 100;
  const pc = s.cars.find((c) => c.id === s.player.carId);
  if (pc) pc.health = 100;
  s.wanted = 3;
  return { screen: SCREEN_PLAY, best: 0 };
}
