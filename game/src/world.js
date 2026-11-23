// Solmar Heat — the simulation, no drawing and no browser in it.
// Player on foot / in a car, traffic and pedestrians, police and wanted level,
// three missions, combat, explosions and particles. step() advances one fixed
// step and returns what happened as bit flags, so the caller can play sounds.
import { CAR, CITY, MISSIONS, PLAYER, ROADS_X, ROADS_Y, ROAD_W, WANTED } from './config.js';
import { randomRange } from './random.js';

export const EVENT_SHOT = 1;
export const EVENT_HIT = 2;
export const EVENT_EXPLODE = 4;
export const EVENT_MISSION = 8;
export const EVENT_WANTED = 16;
export const EVENT_OVER = 32;
export const EVENT_CRASH = 64;
export const EVENT_PICKUP = 128;
export const EVENT_JINGLE = 256;

const TAU = Math.PI * 2;
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
function circleRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w), ny = clamp(cy, rect.y, rect.y + rect.h);
  return dist2(cx, cy, nx, ny) < r * r;
}
function pointInRect(x, y, rect) { return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h; }
const CAR_COLORS = ['#c0392b', '#2e86c1', '#f1c40f', '#7d3c98', '#16a085', '#e67e22', '#95a5a6', '#ecf0f1'];
const PED_COLORS = ['#e8e0d0', '#a8d8a8', '#d8a8a8', '#a8c8d8', '#d8c8a8'];

export function createWorld(random) {
  // ---- city, built once from the seed ----
  const buildings = [];
  const parks = [];
  const water = [];
  for (let i = 0; i < ROADS_X.length - 1; i += 1) {
    for (let j = 0; j < ROADS_Y.length - 1; j += 1) {
      const x0 = ROADS_X[i] + ROAD_W / 2 + 14, x1 = ROADS_X[i + 1] - ROAD_W / 2 - 14;
      const y0 = ROADS_Y[j] + ROAD_W / 2 + 14, y1 = ROADS_Y[j + 1] - ROAD_W / 2 - 14;
      const block = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      if (i === 3 && j === 3) { water.push(block); continue; } // harbour
      if ((i === 1 && j === 2) || (i === 3 && j === 0)) { parks.push(block); continue; }
      const n = 2 + Math.floor(random() * 3);
      for (let k = 0; k < n; k += 1) {
        const bw = 90 + random() * 130, bh = 70 + random() * 110;
        const bx = x0 + 10 + random() * Math.max(1, block.w - bw - 20);
        const by = y0 + 10 + random() * Math.max(1, block.h - bh - 20);
        buildings.push({ x: bx, y: by, w: bw, h: bh, color: ['#8a7f6d', '#7d6a8a', '#5d7a8a', '#6d7a5d'][Math.floor(random() * 4)] });
      }
    }
  }
  // Marina parking lot (mission 2 car) and a couple of roadside parks are
  // inside the blocks above; the lot itself is an open rectangle.
  const marinaLot = { x: 1980, y: 1280, w: 320, h: 180 };

  const player = { x: 1200, y: 1100, angle: -Math.PI / 2, health: PLAYER.health, inCar: false, carId: -1, ammo: PLAYER.magSize, reloading: false, reloadT: 0, fireT: 0 };
  const state = {
    player, buildings, parks, water, marinaLot,
    cars: [], peds: [], guards: [], bullets: [], particles: [],
    cash: 0, wanted: 0, missionsDone: 0, elapsed: 0,
    missionIndex: 0, missionStage: 'toPickup', hasPackage: false, guardsLeft: 0, loot: null,
    message: 'Ana Solis: pick up the package at the dock warehouse.', messageT: 0,
    camera: { x: 1200, y: 1100, shake: 0 }, over: false, overReason: '', busted: false,
    crimeT: 0, decayT: 0, policeTimer: 0, trafficTimer: 0, pedTimer: 0, siren: false,
  };
  let carSeq = 0;

  function missionDef() { return MISSIONS[state.missionIndex] || null; }
  function targetPos() {
    const m = missionDef();
    if (!m) return null;
    if (state.missionIndex === 2 && state.missionStage === 'guards') return m.pickup;
    if (state.missionIndex === 2 && state.missionStage === 'loot') return state.loot || m.pickup;
    return state.missionStage === 'toPickup' ? m.pickup : m.dropoff;
  }
  function setMessage(text, t) { state.message = text; state.messageT = t || 5; }

  function addCar(x, y, angle, opts) {
    const c = { id: carSeq++, x, y, angle, speed: 0, health: CAR.health, color: opts.color || CAR_COLORS[Math.floor(random() * CAR_COLORS.length)], kind: opts.kind || 'traffic', occupied: !!opts.occupied, driver: opts.driver || 'ai', dirX: opts.dirX || 0, dirY: opts.dirY || 1, road: opts.road || 'y', police: !!opts.police, wreck: false };
    state.cars.push(c); return c;
  }
  function addPed(x, y) {
    state.peds.push({ x, y, angle: random() * TAU, speed: 40 + random() * 40, flee: 0, alive: true, color: PED_COLORS[Math.floor(random() * PED_COLORS.length)] });
  }
  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i += 1) {
      const a = random() * TAU, s = speed * (0.3 + random() * 0.7);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + random() * 0.5, maxLife: 1, color, size: 2 + random() * 4 });
    }
  }
  function explode(x, y) {
    burst(x, y, '#ff7b00', 26, 260); burst(x, y, '#ffd23f', 16, 180); burst(x, y, '#666', 12, 90);
    state.camera.shake = 14;
  }
  function raiseWanted(n, events) {
    const before = state.wanted;
    state.wanted = clamp(state.wanted + n, 0, 5);
    state.crimeT = 0; state.decayT = 0;
    if (state.wanted > before) return events | EVENT_WANTED;
    return events;
  }
  function nearestRoadX(x) { let best = ROADS_X[0]; for (const r of ROADS_X) if (Math.abs(r - x) < Math.abs(best - x)) best = r; return best; }
  function nearestRoadY(y) { let best = ROADS_Y[0]; for (const r of ROADS_Y) if (Math.abs(r - y) < Math.abs(best - y)) best = r; return best; }
  function onRoad(x, y) {
    for (const r of ROADS_X) if (Math.abs(x - r) < ROAD_W / 2) return true;
    for (const r of ROADS_Y) if (Math.abs(y - r) < ROAD_W / 2) return true;
    return false;
  }
  function inWater(x, y) { return state.water.some((w) => pointInRect(x, y, w)); }
  function collideBuildings(x, y, r) {
    for (const b of state.buildings) if (circleRect(x, y, r, b)) return b;
    return null;
  }
  function spawnTraffic() {
    const vertical = random() < 0.5;
    let x, y, dirX = 0, dirY = 0, road = 'y';
    if (vertical) { x = ROADS_X[Math.floor(random() * ROADS_X.length)]; y = 60 + random() * (CITY.height - 120); dirY = random() < 0.5 ? 1 : -1; road = 'x'; }
    else { y = ROADS_Y[Math.floor(random() * ROADS_Y.length)]; x = 60 + random() * (CITY.width - 120); dirX = random() < 0.5 ? 1 : -1; road = 'y'; }
    if (dist2(x, y, player.x, player.y) < 300 * 300) return;
    const c = addCar(x, y, Math.atan2(dirY, dirX), { kind: 'traffic', occupied: true, dirX, dirY, road });
    c.speed = randomRange(random, 130, 200);
  }
  function spawnPed() {
    for (let tries = 0; tries < 12; tries += 1) {
      const x = 80 + random() * (CITY.width - 160), y = 80 + random() * (CITY.height - 160);
      if (onRoad(x, y) || inWater(x, y) || collideBuildings(x, y, 14)) continue;
      if (dist2(x, y, player.x, player.y) < 250 * 250) continue;
      addPed(x, y);
      return;
    }
  }
  function spawnPoliceCar() {
    const a = random() * TAU;
    const x = clamp(player.x + Math.cos(a) * 620, 120, CITY.width - 120);
    const y = clamp(player.y + Math.sin(a) * 620, 120, CITY.height - 120);
    const rx = nearestRoadX(x), ry = nearestRoadY(y);
    const px = Math.abs(x - rx) < Math.abs(y - ry) ? rx : x;
    const py = Math.abs(x - rx) < Math.abs(y - ry) ? y : ry;
    const c = addCar(px, py, Math.atan2(player.y - py, player.x - px), { kind: 'police', color: '#3a6fd8', occupied: true, police: true });
    c.speed = 200;
  }
  function spawnFootCop() {
    const a = random() * TAU;
    const x = clamp(player.x + Math.cos(a) * 320, 40, CITY.width - 40);
    const y = clamp(player.y + Math.sin(a) * 320, 40, CITY.height - 40);
    if (collideBuildings(x, y, 14) || inWater(x, y)) return;
    state.guards.push({ x, y, angle: 0, health: 50, alive: true, fireT: 1 + random(), cop: true, arrestT: 0 });
  }
  function spawnGuards() {
    state.missionStage = 'guards';
    const base = MISSIONS[2].pickup;
    const spots = [[-70, -40], [60, -60], [-40, 70], [80, 40]];
    for (const [dx, dy] of spots) state.guards.push({ x: base.x + dx, y: base.y + dy, angle: 0, health: 60, alive: true, fireT: 1 + random() * 1.5, cop: false, arrestT: 0 });
    state.guardsLeft = 4;
  }

  function reset() {
    player.x = 1200; player.y = 1100; player.angle = -Math.PI / 2; player.health = PLAYER.health;
    player.inCar = false; player.carId = -1; player.ammo = PLAYER.magSize; player.reloading = false; player.reloadT = 0; player.fireT = 0;
    state.cars.length = 0; state.peds.length = 0; state.guards.length = 0; state.bullets.length = 0; state.particles.length = 0;
    state.cash = 0; state.wanted = 0; state.missionsDone = 0; state.elapsed = 0;
    state.missionIndex = 0; state.missionStage = 'toPickup'; state.hasPackage = false; state.guardsLeft = 0; state.loot = null;
    state.over = false; state.overReason = ''; state.busted = false; state.crimeT = 0; state.decayT = 0; state.policeTimer = 0;
    state.camera.x = player.x; state.camera.y = player.y; state.camera.shake = 0;
    setMessage('Ana Solis: pick up the package at the dock warehouse.', 6);
    // Parked cars to steal, plus the red coupe for mission 2.
    addCar(2120, 1380, 0, { kind: 'mission', color: '#d21f2b', occupied: false });
    addCar(700, 760, Math.PI / 2, { kind: 'parked', occupied: false });
    addCar(1250, 300, 0, { kind: 'parked', occupied: false });
    addCar(1750, 1200, Math.PI, { kind: 'parked', occupied: false });
    addCar(450, 1650, Math.PI / 2, { kind: 'parked', occupied: false });
    for (let i = 0; i < 12; i += 1) spawnTraffic();
    for (let i = 0; i < 20; i += 1) spawnPed();
  }

  function playerCar() { return state.cars.find((c) => c.id === player.carId) || null; }
  function enterCar(events) {
    let best = null, bestD = 90 * 90;
    for (const c of state.cars) {
      if (c.wreck || c.kind === 'police') continue;
      const d = dist2(player.x, player.y, c.x, c.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (!best) return events;
    if (best.occupied && best.driver === 'ai') {
      events = raiseWanted(1, events);
      setMessage('You stole an occupied car! Wanted level up.', 4);
      burst(best.x, best.y, '#fff', 8, 120);
    }
    if (best.kind === 'mission' && state.missionIndex === 1 && state.missionStage === 'toPickup') {
      state.missionStage = 'toDropoff'; setMessage('Got the coupe. Take it to the hideout garage.', 5); events |= EVENT_MISSION;
    }
    best.occupied = true; best.driver = 'player'; best.kind = best.kind === 'mission' ? 'player' : best.kind;
    player.inCar = true; player.carId = best.id; player.x = best.x; player.y = best.y; player.angle = best.angle;
    return events;
  }
  function exitCar() {
    const c = playerCar();
    if (!c) return;
    c.driver = null; c.occupied = false; c.speed = 0;
    player.inCar = false; player.carId = -1;
    player.x = c.x + Math.cos(c.angle + Math.PI / 2) * 40; player.y = c.y + Math.sin(c.angle + Math.PI / 2) * 40;
    player.x = clamp(player.x, 20, CITY.width - 20); player.y = clamp(player.y, 20, CITY.height - 20);
  }

  function shoot(events, aimAngle) {
    if (player.fireT > 0 || player.reloading) return events;
    if (player.ammo <= 0) { player.reloading = true; player.reloadT = PLAYER.reloadTime; return events; }
    player.ammo -= 1; player.fireT = PLAYER.fireInterval;
    const ox = player.x + Math.cos(aimAngle) * 22, oy = player.y + Math.sin(aimAngle) * 22;
    state.bullets.push({ x: ox, y: oy, vx: Math.cos(aimAngle) * PLAYER.bulletSpeed, vy: Math.sin(aimAngle) * PLAYER.bulletSpeed, life: 0.9, from: 'player', damage: PLAYER.bulletDamage });
    state.camera.shake = Math.max(state.camera.shake, 2);
    if (state.wanted === 0) events = raiseWanted(1, events);
    return events | EVENT_SHOT;
  }

  function damagePlayer(amount, events, reason) {
    if (state.over) return events;
    if (player.inCar) {
      const c = playerCar();
      if (c) { c.health -= amount; if (c.health <= 0) { explode(c.x, c.y); c.wreck = true; player.health -= 25; exitCar(); events |= EVENT_EXPLODE; } }
    } else player.health -= amount;
    events |= EVENT_HIT;
    if (player.health <= 0) {
      state.over = true; state.overReason = reason || 'wasted'; state.busted = false;
      return events | EVENT_OVER;
    }
    return events;
  }

  function stepTraffic(dt) {
    for (const c of state.cars) {
      if (c.wreck || c.driver === 'player') continue;
      if (c.kind === 'parked' || c.kind === 'mission') continue;
      if (c.police) {
        // Chase the player: steer toward them, faster with more stars.
        const want = Math.atan2(player.y - c.y, player.x - c.x);
        c.angle += clamp(angDiff(want, c.angle), -2.2 * dt, 2.2 * dt);
        c.speed = Math.min(c.speed + 300 * dt, 360 + state.wanted * 30);
      } else {
        // Road-following AI: at an intersection, sometimes turn.
        const atX = ROADS_X.some((r) => Math.abs(c.x - r) < 30);
        const atY = ROADS_Y.some((r) => Math.abs(c.y - r) < 30);
        if (atX && atY && random() < 0.012) {
          if (c.road === 'x') { c.road = 'y'; c.dirX = 0; c.dirY = random() < 0.5 ? 1 : -1; }
          else { c.road = 'x'; c.dirY = 0; c.dirX = random() < 0.5 ? 1 : -1; }
        }
        const want = Math.atan2(c.dirY, c.dirX);
        c.angle += clamp(angDiff(want, c.angle), -3 * dt, 3 * dt);
        // Slow for a car ahead.
        let ahead = false;
        for (const o of state.cars) {
          if (o === c || o.wreck) continue;
          const dx = o.x - c.x, dy = o.y - c.y;
          const fwd = dx * Math.cos(c.angle) + dy * Math.sin(c.angle);
          if (fwd > 0 && fwd < 70 && Math.abs(-dx * Math.sin(c.angle) + dy * Math.cos(c.angle)) < 30) ahead = true;
        }
        c.speed = ahead ? Math.max(0, c.speed - 300 * dt) : Math.min(c.speed + 120 * dt, 150 + (c.police ? 150 : 0));
      }
      const nx = c.x + Math.cos(c.angle) * c.speed * dt, ny = c.y + Math.sin(c.angle) * c.speed * dt;
      if (collideBuildings(nx, ny, 20)) { c.speed *= -0.25; burst(c.x, c.y, '#ccc', 6, 100); }
      else { c.x = clamp(nx, 30, CITY.width - 30); c.y = clamp(ny, 30, CITY.height - 30); }
      if (c.police) {
        // Ram the player.
        const pc = playerCar();
        const tx = pc ? pc.x : player.x, ty = pc ? pc.y : player.y;
        if (dist2(c.x, c.y, tx, ty) < 46 * 46) {
          c.speed *= 0.4; state.camera.shake = Math.max(state.camera.shake, 5);
          if (pc) pc.health -= 6; else player.health -= 6;
          burst(tx, ty, '#fff', 6, 120);
        }
      }
    }
  }

  function stepPeds(dt, events) {
    for (const p of state.peds) {
      if (!p.alive) continue;
      if (p.flee > 0) { p.flee -= dt; p.speed = 150; } else p.speed = 50;
      const nx = p.x + Math.cos(p.angle) * p.speed * dt, ny = p.y + Math.sin(p.angle) * p.speed * dt;
      if (collideBuildings(nx, ny, 10) || inWater(nx, ny) || onRoad(nx, ny) && p.flee <= 0) { p.angle += (random() - 0.5) * 2.4; continue; }
      p.x = clamp(nx, 20, CITY.width - 20); p.y = clamp(ny, 20, CITY.height - 20);
      if (random() < 0.004) p.angle = random() * TAU;
      // Run over by a car.
      for (const c of state.cars) {
        if (c.wreck || Math.abs(c.speed) < 80) continue;
        if (dist2(p.x, p.y, c.x, c.y) < 30 * 30) {
          p.alive = false; burst(p.x, p.y, '#c0392b', 14, 160);
          if (c.driver === 'player') events = raiseWanted(2, events);
        }
      }
    }
    return events;
  }

  function stepGuards(dt, events) {
    for (const g of state.guards) {
      if (!g.alive) continue;
      const d = Math.sqrt(dist2(g.x, g.y, player.x, player.y));
      g.angle = Math.atan2(player.y - g.y, player.x - g.x);
      if (g.cop) {
        // Foot police chase; arrest on foot at close range, shoot at wanted >= 2.
        if (d > 34) { g.x += Math.cos(g.angle) * 150 * dt; g.y += Math.sin(g.angle) * 150 * dt; g.arrestT = 0; }
        else if (!player.inCar) {
          g.arrestT += dt;
          if (g.arrestT > 1.4) { state.over = true; state.overReason = 'busted'; state.busted = true; return events | EVENT_OVER; }
        }
        if (state.wanted >= 2 && d < 380 && d > 40) {
          g.fireT -= dt;
          if (g.fireT <= 0) {
            g.fireT = 0.9 + random() * 0.7;
            const a = g.angle + (random() - 0.5) * 0.25;
            state.bullets.push({ x: g.x + Math.cos(a) * 20, y: g.y + Math.sin(a) * 20, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, life: 0.9, from: 'enemy', damage: 7 });
            events |= EVENT_SHOT;
          }
        }
      } else if (d < 460) {
        g.fireT -= dt;
        if (g.fireT <= 0) {
          g.fireT = 1.0 + random() * 0.8;
          const a = g.angle + (random() - 0.5) * 0.3;
          state.bullets.push({ x: g.x + Math.cos(a) * 20, y: g.y + Math.sin(a) * 20, vx: Math.cos(a) * 600, vy: Math.sin(a) * 600, life: 0.9, from: 'enemy', damage: 8 });
          events |= EVENT_SHOT;
        }
      }
    }
    return events;
  }

  function stepBullets(dt, events) {
    for (const b of state.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.x > CITY.width || b.y < 0 || b.y > CITY.height) { b.life = 0; continue; }
      if (collideBuildings(b.x, b.y, 2)) { b.life = 0; burst(b.x, b.y, '#ccc', 4, 80); continue; }
      if (b.from === 'player') {
        for (const g of state.guards) {
          if (!g.alive || dist2(b.x, b.y, g.x, g.y) > 16 * 16) continue;
          g.health -= b.damage; b.life = 0; burst(b.x, b.y, '#c0392b', 8, 120);
          if (g.health <= 0) {
            g.alive = false; burst(g.x, g.y, '#c0392b', 18, 180);
            if (!g.cop) {
              state.guardsLeft -= 1; setMessage(`Guard down — ${state.guardsLeft} left.`, 3);
              if (state.guardsLeft === 0 && state.missionIndex === 2 && state.missionStage === 'guards') {
                state.missionStage = 'loot'; state.loot = { x: MISSIONS[2].pickup.x + 40, y: MISSIONS[2].pickup.y + 20 };
                setMessage('All guards down. Grab the loot!', 5); events |= EVENT_MISSION;
              }
            }
          }
          break;
        }
        if (b.life === 0) continue;
        for (const p of state.peds) {
          if (!p.alive || dist2(b.x, b.y, p.x, p.y) > 14 * 14) continue;
          p.alive = false; b.life = 0; burst(p.x, p.y, '#c0392b', 12, 150);
          events = raiseWanted(2, events);
          for (const q of state.peds) if (q.alive && dist2(q.x, q.y, p.x, p.y) < 300 * 300) { q.flee = 3; q.angle = Math.atan2(q.y - p.y, q.x - p.x); }
          break;
        }
        if (b.life === 0) continue;
        for (const c of state.cars) {
          if (c.wreck || c.driver === 'player' || dist2(b.x, b.y, c.x, c.y) > 28 * 28) continue;
          c.health -= b.damage; b.life = 0; burst(b.x, b.y, '#ffb347', 6, 120);
          if (c.health <= 0) { c.wreck = true; explode(c.x, c.y); events |= EVENT_EXPLODE; if (c.police) events = raiseWanted(1, events); }
          break;
        }
      } else {
        const pc = playerCar();
        if (pc && dist2(b.x, b.y, pc.x, pc.y) < 28 * 28) { b.life = 0; events = damagePlayer(b.damage, events, 'wasted'); continue; }
        if (!player.inCar && dist2(b.x, b.y, player.x, player.y) < 15 * 15) { b.life = 0; events = damagePlayer(b.damage, events, 'wasted'); }
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0);
    return events;
  }

  function stepMission(dt, events) {
    const m = missionDef();
    if (!m || state.over) return events;
    const t = targetPos();
    if (!t) return events;
    const d = Math.sqrt(dist2(player.x, player.y, t.x, t.y));
    if (state.missionStage === 'toPickup' && state.missionIndex !== 1 && state.missionIndex !== 2) {
      if (d < 75) { state.hasPackage = true; state.missionStage = 'toDropoff'; setMessage('Package secured. Take it to Neon Palms.', 5); events |= EVENT_PICKUP | EVENT_JINGLE; }
    } else if (state.missionStage === 'loot' && state.loot) {
      if (d < 60) { state.loot = null; state.hasPackage = true; state.missionStage = 'toDropoff'; setMessage('Loot grabbed. Get to the hideout garage.', 5); events |= EVENT_PICKUP | EVENT_JINGLE; }
    } else if (state.missionStage === 'toDropoff') {
      if (d < 85) {
        state.cash += m.reward; state.missionsDone += 1; events |= EVENT_MISSION | EVENT_JINGLE;
        if (state.missionIndex < MISSIONS.length - 1) {
          state.missionIndex += 1; state.missionStage = 'toPickup'; state.hasPackage = false;
          const nm = MISSIONS[state.missionIndex];
          setMessage(`$${m.reward} earned. New job from Ana Solis: ${nm.name} — ${nm.brief}`, 7);
          if (state.missionIndex === 2) spawnGuards();
        } else {
          state.missionIndex = 3; setMessage(`$${m.reward} earned. Story complete — Solmar is yours. Free roam!`, 8);
        }
      }
    }
    return events;
  }

  function step(dt, ctrl) {
    let events = 0;
    if (state.over) return events;
    state.elapsed += dt;
    state.crimeT += dt;
    if (state.messageT > 0) state.messageT -= dt;
    // Wanted decay when laying low: nothing for a while after the last
    // crime, then one star drops per decay interval.
    if (state.wanted > 0 && state.crimeT > WANTED.coolDown) { state.decayT += dt; if (state.decayT > WANTED.decayPerStar) { state.wanted -= 1; state.decayT = 0; state.crimeT = 0; } }
    if (player.fireT > 0) player.fireT -= dt;
    if (player.reloading) { player.reloadT -= dt; if (player.reloadT <= 0) { player.reloading = false; player.ammo = PLAYER.magSize; } }
    if (ctrl.reload && !player.reloading && player.ammo < PLAYER.magSize) { player.reloading = true; player.reloadT = PLAYER.reloadTime; }
    if (ctrl.enter) events = player.inCar ? (exitCar(), events) : enterCar(events);
    if (ctrl.shoot) events = shoot(events, ctrl.aimAngle ?? player.angle);

    // ---- player movement ----
    const mv = ctrl.move || { x: 0, y: 0, sprint: false };
    if (player.inCar) {
      const c = playerCar();
      if (c) {
        const fwd = mv.y < 0 ? 1 : mv.y > 0 ? -0.6 : 0;
        if (fwd > 0) c.speed = Math.min(c.speed + CAR.accel * dt, CAR.maxSpeed);
        else if (fwd < 0) c.speed = Math.max(c.speed - CAR.brake * dt, -CAR.reverseMax);
        else c.speed *= Math.max(0, 1 - CAR.drag * dt * 2);
        if (Math.abs(c.speed) > 5) c.angle += mv.x * CAR.turnRate * dt * Math.sign(c.speed) * Math.min(1, Math.abs(c.speed) / 160);
        const nx = c.x + Math.cos(c.angle) * c.speed * dt, ny = c.y + Math.sin(c.angle) * c.speed * dt;
        if (collideBuildings(nx, ny, 22) || inWater(nx, ny)) {
          if (Math.abs(c.speed) > 200) { events |= EVENT_CRASH; burst(c.x, c.y, '#ccc', 10, 140); state.camera.shake = Math.max(state.camera.shake, 6); c.health -= 4; }
          c.speed *= -0.3;
        } else { c.x = clamp(nx, 30, CITY.width - 30); c.y = clamp(ny, 30, CITY.height - 30); }
        if (c.health <= 0 && !c.wreck) { c.wreck = true; explode(c.x, c.y); events |= EVENT_EXPLODE; exitCar(); player.health -= 20; }
        player.x = c.x; player.y = c.y; player.angle = c.angle;
        // Running over pedestrians is handled in stepPeds.
      }
    } else {
      const len = Math.hypot(mv.x, mv.y) || 1;
      const sp = (mv.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed);
      const nx = player.x + (mv.x / len) * sp * dt * (mv.x || mv.y ? 1 : 0);
      const ny = player.y + (mv.y / len) * sp * dt * (mv.x || mv.y ? 1 : 0);
      if (mv.x || mv.y) player.angle = Math.atan2(mv.y, mv.x);
      if (!collideBuildings(nx, player.y, PLAYER.radius) && !inWater(nx, player.y)) player.x = clamp(nx, 20, CITY.width - 20);
      if (!collideBuildings(player.x, ny, PLAYER.radius) && !inWater(player.x, ny)) player.y = clamp(ny, 20, CITY.height - 20);
    }
    // Car-car collisions.
    for (let i = 0; i < state.cars.length; i += 1) {
      for (let j = i + 1; j < state.cars.length; j += 1) {
        const a = state.cars[i], b = state.cars[j];
        if (a.wreck || b.wreck) continue;
        const d2 = dist2(a.x, a.y, b.x, b.y);
        if (d2 < 44 * 44 && d2 > 0.01) {
          const d = Math.sqrt(d2), push = (44 - d) / 2 + 2, ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
          a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push;
          if (Math.abs(a.speed) > 150 || Math.abs(b.speed) > 150) { events |= EVENT_CRASH; a.health -= 1; b.health -= 1; }
          a.speed *= 0.92; b.speed *= 0.92;
        }
      }
    }
    stepTraffic(dt);
    events = stepPeds(dt, events);
    events = stepGuards(dt, events);
    events = stepBullets(dt, events);
    events = stepMission(dt, events);
    // Spawning to keep the city alive.
    state.trafficTimer -= dt;
    if (state.trafficTimer <= 0) { state.trafficTimer = 2.5; if (state.cars.filter((c) => c.kind === 'traffic').length < 14) spawnTraffic(); }
    state.pedTimer -= dt;
    if (state.pedTimer <= 0) { state.pedTimer = 2; if (state.peds.filter((p) => p.alive).length < 22) spawnPed(); }
    // Police response.
    state.policeTimer -= dt;
    if (state.wanted > 0 && state.policeTimer <= 0) {
      state.policeTimer = Math.max(3, 9 - state.wanted);
      const policeCars = state.cars.filter((c) => c.police && !c.wreck).length;
      const cops = state.guards.filter((g) => g.cop && g.alive).length;
      if (policeCars < state.wanted) spawnPoliceCar();
      else if (cops < Math.min(3, state.wanted)) spawnFootCop();
    }
    state.siren = state.wanted > 0;
    // Particles.
    for (const p of state.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.life -= dt; }
    state.particles = state.particles.filter((p) => p.life > 0);
    // Camera follows the player, with shake.
    state.camera.x = clamp(player.x - 640, 0, CITY.width - 1280);
    state.camera.y = clamp(player.y - 360, 0, CITY.height - 720);
    if (state.camera.shake > 0) state.camera.shake = Math.max(0, state.camera.shake - 30 * dt);
    if (player.health <= 0 && !state.over) { state.over = true; state.overReason = 'wasted'; events |= EVENT_OVER; }
    return events;
  }

  function save() {
    return JSON.stringify({ x: player.x, y: player.y, health: player.health, cash: state.cash, wanted: state.wanted, missionIndex: Math.min(state.missionIndex, 2), missionsDone: state.missionsDone, ammo: player.ammo });
  }
  function load(data) {
    try {
      const s = JSON.parse(data);
      reset();
      player.x = clamp(s.x ?? 1200, 20, CITY.width - 20); player.y = clamp(s.y ?? 1100, 20, CITY.height - 20);
      player.health = s.health ?? PLAYER.health; state.cash = s.cash ?? 0; state.wanted = s.wanted ?? 0;
      state.missionsDone = s.missionsDone ?? 0; state.missionIndex = state.missionsDone >= 3 ? 3 : (s.missionIndex ?? 0); player.ammo = s.ammo ?? PLAYER.magSize;
      state.missionStage = 'toPickup'; state.hasPackage = false;
      if (state.missionIndex === 2) spawnGuards();
      setMessage('Save loaded. Back on the streets of Solmar.', 4);
      return true;
    } catch { return false; }
  }

  reset();
  return { state, reset, step, targetPos, missionDef, save, load, enterCar };
}
