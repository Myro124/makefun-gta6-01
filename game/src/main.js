// Solmar Heat — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// Screens: title, play, paused, game over.
// ?seed=N fixes the city. ?shot=start|drive|mission|wanted (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { PLAYER, SAVE_KEY, STEP, VIEW } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CRASH, EVENT_EXPLODE, EVENT_HIT, EVENT_JINGLE, EVENT_MISSION, EVENT_OVER, EVENT_PICKUP, EVENT_SHOT } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_LOAD, ACTION_MUTE, ACTION_PAUSE, ACTION_RELOAD, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const PLAYER_MAG_SIZE = PLAYER.magSize; // reload click only plays when the magazine is not already full
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    const target = world.targetPos();
    renderer.draw(world.state, scene.screen, target, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let muted = false;
  let pendingEnter = false;
  let pendingReload = false;
  function announce(message) { status.textContent = message; }
  function saveGame() { try { window.localStorage.setItem(SAVE_KEY, world.save()); } catch { /* storage off */ } }
  function loadGame() {
    try {
      const data = window.localStorage.getItem(SAVE_KEY);
      if (data && world.load(data)) { screen = SCREEN_PLAY; announce('Save loaded.'); return true; }
    } catch { /* ignore */ }
    announce('No save found.');
    return false;
  }
  function startGame() { world.reset(); accumulator = 0; screen = SCREEN_PLAY; announce('Playing. Ana Solis has a job for you.'); }
  function endGame() { screen = SCREEN_OVER; saveGame(); announce(world.state.busted ? 'Busted.' : 'Wasted.'); }
  function handleActions() {
    const actions = input.takeActions();
    pendingEnter = pendingEnter || !!(actions & ACTION_ENTER);
    pendingReload = pendingReload || !!(actions & ACTION_RELOAD);
    if (actions & ACTION_MUTE) { muted = audio.toggleMute(); announce(muted ? 'Muted.' : 'Sound on.'); }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_LOAD) loadGame();
      else if (actions & ACTION_CONFIRM) { audio.unlock(); startGame(); }
      return;
    }
    if (screen === SCREEN_OVER) { if (actions & ACTION_CONFIRM) startGame(); return; }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; saveGame(); announce('Paused. Auto-saved.'); }
    else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
  }
  function playEvents(events) {
    if (events & EVENT_SHOT) audio.shoot();
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_EXPLODE) audio.explode();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & (EVENT_MISSION | EVENT_JINGLE)) audio.jingle();
  }
  function viewMouse() {
    const mouse = input.mouse();
    const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
    const offX = (window.innerWidth - VIEW.width * scale) / 2, offY = (window.innerHeight - VIEW.height * scale) / 2;
    return { x: (mouse.x - offX) / scale, y: (mouse.y - offY) / scale, down: mouse.down, scale, offX, offY };
  }
  function step() {
    if (screen === SCREEN_TITLE) {
      const ev = world.step(STEP, { move: { x: 0, y: 0, sprint: false }, shoot: false, reload: false, enter: false, aimAngle: -Math.PI / 2 });
      playEvents(ev);
      return;
    }
    const vm = viewMouse();
    const worldMouseX = world.state.camera.x + vm.x;
    const worldMouseY = world.state.camera.y + vm.y;
    const aimAngle = Math.atan2(worldMouseY - world.state.player.y, worldMouseX - world.state.player.x);
    const ctrl = {
      move: input.move(),
      shoot: vm.down && !world.state.player.inCar,
      reload: pendingReload,
      enter: pendingEnter,
      aimAngle,
    };
    if (pendingReload && world.state.player.ammo < PLAYER_MAG_SIZE) audio.reload();
    pendingEnter = false; pendingReload = false;
    const events = world.step(STEP, ctrl);
    playEvents(events);
    const pc = world.state.cars.find((c) => c.id === world.state.player.carId);
    audio.update(STEP, pc ? Math.abs(pc.speed) : 0, world.state.wanted);
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_MISSION) announce(world.state.message);
  }
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) { step(); accumulator -= STEP; }
    } else accumulator = 0;
    const target = world.targetPos();
    const vm = viewMouse();
    renderer.draw(world.state, screen, target, screen === SCREEN_PLAY && !world.state.player.inCar ? { x: vm.x, y: vm.y } : null);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; saveGame(); announce('Paused.'); }
  });
  announce('Solmar Heat. Press Space or click to start. L loads a save.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
