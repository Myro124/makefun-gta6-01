// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 view follows the player through the 2560x1920 city, scaled
// to fit the window. Flat shapes and canvas text for the HUD and panels.
import { CITY, FONT, MINIMAP, MISSIONS, PALETTE, ROAD_W, ROADS_X, ROADS_Y, TITLE_PANEL, VIEW } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function drawCar(ctx, x, y, angle, color, police, wreck) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  if (wreck) { ctx.fillStyle = '#222'; ctx.fillRect(-26, -13, 52, 26); ctx.restore(); return; }
  ctx.fillStyle = '#111'; ctx.fillRect(-28, -14, 56, 28);
  ctx.fillStyle = color; ctx.fillRect(-26, -13, 52, 26);
  ctx.fillStyle = 'rgba(180,220,255,0.85)'; ctx.fillRect(6, -11, 10, 22);
  ctx.fillStyle = 'rgba(20,20,30,0.9)'; ctx.fillRect(-8, -11, 8, 22);
  ctx.fillStyle = '#ffe9a8'; ctx.fillRect(24, -11, 3, 6); ctx.fillRect(24, 5, 3, 6);
  ctx.fillStyle = '#ff3b30'; ctx.fillRect(-27, -11, 3, 6); ctx.fillRect(-27, 5, 3, 6);
  if (police) { ctx.fillStyle = '#fff'; ctx.fillRect(-2, -13, 8, 26); ctx.fillStyle = '#ff3b30'; ctx.fillRect(0, -13, 4, 6); ctx.fillStyle = '#3a6fd8'; ctx.fillRect(0, 7, 4, 6); }
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    view.x = (canvas.width - VIEW.width * view.scale) / 2;
    view.y = (canvas.height - VIEW.height * view.scale) / 2;
  }
  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    ctx.font = fonts.get(size); ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }
  function panel(x, y, w, h) { ctx.fillStyle = PALETTE.panel; ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgba(242,201,76,0.5)'; ctx.strokeRect(x, y, w, h); }

  function drawCity(state, camX, camY, shakeX, shakeY) {
    const ox = -camX + shakeX, oy = -camY + shakeY;
    ctx.save(); ctx.translate(ox, oy);
    ctx.fillStyle = PALETTE.grass; ctx.fillRect(0, 0, CITY.width, CITY.height);
    for (const w of state.water) { ctx.fillStyle = PALETTE.water; ctx.fillRect(w.x, w.y, w.w, w.h); ctx.fillStyle = PALETTE.sand; ctx.fillRect(w.x, w.y, w.w, 10); }
    for (const p of state.parks) {
      ctx.fillStyle = PALETTE.park; ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = '#3f9a55';
      for (let i = 0; i < 8; i += 1) { const tx = p.x + 30 + ((i * 53) % Math.max(40, p.w - 60)); const ty = p.y + 30 + ((i * 71) % Math.max(40, p.h - 60)); ctx.beginPath(); ctx.arc(tx, ty, 14, 0, Math.PI * 2); ctx.fill(); }
    }
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const x of ROADS_X) ctx.fillRect(x - ROAD_W / 2, 0, ROAD_W, CITY.height);
    for (const y of ROADS_Y) ctx.fillRect(0, y - ROAD_W / 2, CITY.width, ROAD_W);
    ctx.fillStyle = PALETTE.sidewalk;
    for (const x of ROADS_X) { ctx.fillRect(x - ROAD_W / 2 - 10, 0, 10, CITY.height); ctx.fillRect(x + ROAD_W / 2, 0, 10, CITY.height); }
    for (const y of ROADS_Y) { ctx.fillRect(0, y - ROAD_W / 2 - 10, CITY.width, 10); ctx.fillRect(0, y + ROAD_W / 2, CITY.width, 10); }
    ctx.fillStyle = PALETTE.roadLine;
    for (const x of ROADS_X) for (let y = 0; y < CITY.height; y += 64) ctx.fillRect(x - 2, y, 4, 32);
    for (const y of ROADS_Y) for (let x = 0; x < CITY.width; x += 64) ctx.fillRect(x, y - 2, 32, 4);
    // Marina lot.
    ctx.fillStyle = '#3c4048'; ctx.fillRect(state.marinaLot.x, state.marinaLot.y, state.marinaLot.w, state.marinaLot.h);
    ctx.fillStyle = PALETTE.roadLine; ctx.strokeStyle = PALETTE.roadLine; ctx.strokeRect(state.marinaLot.x + 4, state.marinaLot.y + 4, state.marinaLot.w - 8, state.marinaLot.h - 8);
    // Buildings with roof detail.
    for (const b of state.buildings) {
      ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = PALETTE.roof; ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      ctx.fillStyle = 'rgba(255,240,180,0.35)';
      for (let wx = b.x + 18; wx < b.x + b.w - 14; wx += 26) for (let wy = b.y + 18; wy < b.y + b.h - 14; wy += 26) ctx.fillRect(wx, wy, 8, 8);
    }
    // Mission marker: pulsing ring + diamond.
    const m = state.missionIndex < MISSIONS.length ? MISSIONS[state.missionIndex] : null;
    // target is computed by caller via state; marker drawn from world.targetPos in draw()
    ctx.restore();
    return { ox, oy };
  }

  function drawEntities(state, ox, oy) {
    ctx.save(); ctx.translate(ox, oy);
    for (const p of state.peds) {
      if (!p.alive) continue;
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4, 3, 0, Math.PI * 2); ctx.fill();
    }
    for (const c of state.cars) drawCar(ctx, c.x, c.y, c.angle, c.color, c.police, c.wreck);
    for (const g of state.guards) {
      if (!g.alive) continue;
      ctx.fillStyle = g.cop ? '#2f5fd0' : '#c0392b'; ctx.beginPath(); ctx.arc(g.x, g.y, 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(g.x + Math.cos(g.angle) * 18, g.y + Math.sin(g.angle) * 18); ctx.stroke();
    }
    if (state.loot) {
      ctx.fillStyle = PALETTE.gold; ctx.save(); ctx.translate(state.loot.x, state.loot.y); ctx.rotate(Math.PI / 4); ctx.fillRect(-9, -9, 18, 18); ctx.restore();
    }
    for (const b of state.bullets) { ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill(); }
    for (const p of state.particles) { ctx.globalAlpha = Math.max(0, p.life / p.maxLife); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    // Player.
    const pl = state.player;
    if (!pl.inCar) {
      ctx.fillStyle = PALETTE.player; ctx.beginPath(); ctx.arc(pl.x, pl.y, 13, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(pl.x, pl.y); ctx.lineTo(pl.x + Math.cos(pl.angle) * 20, pl.y + Math.sin(pl.angle) * 20); ctx.stroke();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(pl.x, pl.y, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawMarker(state, ox, oy, target) {
    if (!target) return;
    const pulse = 1 + 0.15 * Math.sin(state.elapsed * 5);
    ctx.save(); ctx.translate(ox, oy);
    ctx.strokeStyle = PALETTE.gold; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(target.x, target.y, 30 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = PALETTE.gold; ctx.beginPath(); ctx.moveTo(target.x, target.y - 42); ctx.lineTo(target.x + 10, target.y - 24); ctx.lineTo(target.x - 10, target.y - 24); ctx.closePath(); ctx.fill();
    ctx.restore();
    // Edge arrow when the target is off-screen.
    const sx = target.x - state.camera.x, sy = target.y - state.camera.y;
    if (sx < 60 || sx > VIEW.width - 60 || sy < 60 || sy > VIEW.height - 60) {
      const cx = Math.max(60, Math.min(VIEW.width - 60, sx)), cy = Math.max(60, Math.min(VIEW.height - 60, sy));
      const a = Math.atan2(sy - 360, sx - 640);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); ctx.fillStyle = PALETTE.gold;
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -10); ctx.lineTo(-10, 10); ctx.closePath(); ctx.fill(); ctx.restore();
      const d = Math.round(Math.hypot(target.x - state.player.x, target.y - state.player.y));
      text(`${d}m`, cx, cy + 30, 16, PALETTE.gold, 'center');
    }
  }

  // Wrap a line of text to fit inside the panel, breaking on word
  // boundaries, so a long subtitle never runs into (or past) the panel edge.
  function wrapLine(value, maxWidth, size) {
    ctx.font = `bold ${size}px ${FONT}`;
    const words = value.split(' ');
    const lines = [''];
    for (const word of words) {
      const trial = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
      if (ctx.measureText(trial).width <= maxWidth) lines[lines.length - 1] = trial;
      else lines.push(word);
    }
    return lines;
  }

  function drawMinimap(state) {
    const mw = 230, mh = 172, sx = mw / CITY.width, sy = mh / CITY.height;
    const x0 = VIEW.width - mw - 16, y0 = VIEW.height - mh - 16;
    panel(x0 - 6, y0 - 6, mw + 12, mh + 12);
    ctx.fillStyle = MINIMAP.background; ctx.fillRect(x0, y0, mw, mh);
    ctx.fillStyle = MINIMAP.water; for (const w of state.water) ctx.fillRect(x0 + w.x * sx, y0 + w.y * sy, Math.max(2, w.w * sx), Math.max(2, w.h * sy));
    ctx.fillStyle = MINIMAP.park; for (const p of state.parks) ctx.fillRect(x0 + p.x * sx, y0 + p.y * sy, Math.max(2, p.w * sx), Math.max(2, p.h * sy));
    ctx.fillStyle = MINIMAP.road; for (const x of ROADS_X) ctx.fillRect(x0 + x * sx - 2, y0, 4, mh); for (const y of ROADS_Y) ctx.fillRect(x0, y0 + y * sy - 2, mw, 4);
    ctx.fillStyle = MINIMAP.building; for (const b of state.buildings) ctx.fillRect(x0 + b.x * sx, y0 + b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
    const t = state._target;
    if (t) { ctx.fillStyle = PALETTE.gold; ctx.beginPath(); ctx.arc(x0 + t.x * sx, y0 + t.y * sy, 5, 0, Math.PI * 2); ctx.fill(); }
    for (const c of state.cars) if (c.police && !c.wreck) { ctx.fillStyle = '#5b8cff'; ctx.fillRect(x0 + c.x * sx - 2, y0 + c.y * sy - 2, 4, 4); }
    ctx.fillStyle = PALETTE.player; ctx.beginPath(); ctx.arc(x0 + state.player.x * sx, y0 + state.player.y * sy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x0 + state.player.x * sx, y0 + state.player.y * sy, 5, 0, Math.PI * 2); ctx.stroke();
  }

  function drawHud(state) {
    panel(12, 12, 300, 96);
    text(`$${state.cash}`, 24, 42, 26, PALETTE.gold, 'left');
    const m = state.missionIndex < MISSIONS.length ? MISSIONS[state.missionIndex] : null;
    text(m ? `Job ${state.missionIndex + 1}/3: ${m.name}` : 'Free roam — story done', 24, 68, 17, PALETTE.text, 'left');
    text(`Missions ${state.missionsDone}/3`, 24, 92, 16, PALETTE.muted, 'left');
    // Health bar.
    panel(12, 116, 200, 26);
    ctx.fillStyle = '#333'; ctx.fillRect(18, 122, 150, 14);
    ctx.fillStyle = state.player.health > 40 ? PALETTE.green : PALETTE.red; ctx.fillRect(18, 122, 150 * Math.max(0, state.player.health) / 100, 14);
    text('HP', 174, 136, 14, PALETTE.text, 'left');
    // Wanted stars: earned stars solid red, the rest muted outlines.
    for (let i = 0; i < 5; i += 1) text(i < state.wanted ? '★' : '☆', 24 + i * 28, 168, 26, i < state.wanted ? PALETTE.red : PALETTE.muted, 'left');
    // Ammo / speed.
    const pc = state.cars.find((c) => c.id === state.player.carId);
    text(state.player.reloading ? 'RELOADING…' : `Ammo ${state.player.ammo}/${12}`, 24, 196, 18, PALETTE.text, 'left');
    text(pc ? `Speed ${Math.round(Math.abs(pc.speed) * 0.18)} km/h` : 'On foot', 24, 220, 18, PALETTE.text, 'left');
    if (state.messageT > 0 && state.message) {
      panel(320, 12, 640, 44); text(state.message, 640, 42, 17, PALETTE.text, 'center');
    }
    drawMinimap(state);
    // Crosshair.
    if (state._aim) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(state._aim.x, state._aim.y, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(state._aim.x - 14, state._aim.y); ctx.lineTo(state._aim.x - 6, state._aim.y); ctx.moveTo(state._aim.x + 6, state._aim.y); ctx.lineTo(state._aim.x + 14, state._aim.y); ctx.moveTo(state._aim.x, state._aim.y - 14); ctx.lineTo(state._aim.x, state._aim.y - 6); ctx.moveTo(state._aim.x, state._aim.y + 6); ctx.lineTo(state._aim.x, state._aim.y + 14); ctx.stroke();
    }
  }

  function drawPanel(title, lines, prompt) {
    const w = TITLE_PANEL.width;
    const maxText = w - TITLE_PANEL.sideMargin * 2;
    const wrapped = lines.flatMap((line) => wrapLine(line, maxText, 19));
    const h = 130 + wrapped.length * TITLE_PANEL.lineHeight;
    const x = (VIEW.width - w) / 2, y = (VIEW.height - h) / 2;
    panel(x, y, w, h);
    text(title, VIEW.width / 2, y + 62, 44, PALETTE.text, 'center');
    wrapped.forEach((line, i) => text(line, VIEW.width / 2, y + 108 + i * TITLE_PANEL.lineHeight, 19, PALETTE.muted, 'center'));
    text(prompt, VIEW.width / 2, y + h - 28, 20, PALETTE.gold, 'center');
  }

  function draw(state, screen, target, aim) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#11141b'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    state._target = target; state._aim = aim;
    const shakeX = state.camera.shake ? (Math.random() - 0.5) * state.camera.shake : 0;
    const shakeY = state.camera.shake ? (Math.random() - 0.5) * state.camera.shake : 0;
    const { ox, oy } = drawCity(state, state.camera.x, state.camera.y, shakeX, shakeY);
    drawMarker(state, ox, oy, target);
    drawEntities(state, ox, oy);
    if (screen === SCREEN_TITLE) {
      drawPanel('SOLMAR HEAT', ['A top-down open-world crime game. Milo Reyes takes jobs from Ana Solis.', 'WASD drive / walk • E enter or steal a car • Mouse aim, click to shoot', 'R reload • P pause • M mute • L load save • 3 jobs, then free roam'], 'Press Space or click to start');
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) drawPanel('Paused', ['Your game auto-saved. The streets of Solmar will wait.'], 'Press P to resume');
    else if (screen === SCREEN_OVER) {
      const busted = state.busted;
      drawPanel(busted ? 'BUSTED' : 'WASTED', [busted ? 'The Solmar police took you in.' : 'Milo went down on the streets of Solmar.', `Cash kept: $${state.cash} • Jobs done: ${state.missionsDone}/3`], 'Press Space or click to start over');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
