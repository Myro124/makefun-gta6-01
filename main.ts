// Solmar Heat — entrypoint for the make.fun "Make GTA 6" bounty (gta6-01).
// Node 22, standard library only. The game itself is plain static files in
// game/ (game/index.html plus its ES modules, no library, no network request)
// and this program hands it in: it first checks the entry against the
// scorer's caps, then copies game/ and screenshots/ beside this file into
// /output (or MAKEFUN_OUTPUT_DIR outside the grader's container) and writes
// /output/dossier.json, the summary the judge reads, using the vendored
// make.fun library in vendor/makefun-game.ts.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game itself with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse.
const SOLMAR_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function fail(problem) {
  throw new Error(`Solmar Heat entry is not ready: ${problem}`);
}

// Walk a directory depth-first and return every file under it, as paths
// relative to the directory, so the caps can be counted exactly.
function walkFiles(dir, base = dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, base, found);
    else if (entry.isFile()) found.push(full.slice(base.length + 1));
  }
  return found;
}

function fileBytes(path) {
  return statSync(path).size;
}

// Check the entry before anything is copied, so a bad bundle fails here
// with the problem named instead of failing in the grader.
function validateEntry() {
  const gameDir = join(here, 'game');
  const shotsDir = join(here, 'screenshots');
  const indexPath = join(gameDir, 'index.html');
  if (!existsSync(indexPath)) fail('game/index.html is missing — the game has no entry page');
  if (!existsSync(gameDir)) fail('game/ is missing');
  const gameFiles = walkFiles(gameDir);
  if (gameFiles.length === 0) fail('game/ holds no files');
  if (gameFiles.length > SOLMAR_CAPS.game_max_files) {
    fail(`game/ holds ${gameFiles.length} files, over the cap of ${SOLMAR_CAPS.game_max_files}`);
  }
  let gameBytes = 0;
  for (const rel of gameFiles) {
    if (Buffer.byteLength(rel, 'utf8') > SOLMAR_CAPS.game_path_max_bytes) {
      fail(`game file path is too long: ${rel}`);
    }
    gameBytes += fileBytes(join(gameDir, rel));
  }
  if (gameBytes > SOLMAR_CAPS.game_max_bytes) {
    fail(`game/ is ${gameBytes} bytes, over the cap of ${SOLMAR_CAPS.game_max_bytes}`);
  }
  if (!existsSync(shotsDir)) fail('screenshots/ is missing — the entry needs 3 or 4 screenshots');
  const shots = readdirSync(shotsDir)
    .filter((name) => /\.(jpg|jpeg|png)$/i.test(name))
    .sort();
  if (shots.length < 1 || shots.length > SOLMAR_CAPS.screenshots.max) {
    fail(`screenshots/ holds ${shots.length} images, need 1 to ${SOLMAR_CAPS.screenshots.max}`);
  }
  const shotSizes = shots.map((name) => {
    const size = fileBytes(join(shotsDir, name));
    if (size > SOLMAR_CAPS.screenshots.max_bytes) {
      fail(`screenshot ${name} is ${size} bytes, over the cap of ${SOLMAR_CAPS.screenshots.max_bytes}`);
    }
    return { name, size };
  });
  // If shots.json lists the staged scenes, every shot it names must be one
  // of the screenshots on disk, so a renamed file cannot silently drop a scene.
  const shotsJson = join(here, 'shots.json');
  if (existsSync(shotsJson)) {
    const listed = JSON.parse(readFileSync(shotsJson, 'utf8'));
    for (const entry of listed) {
      if (!shots.includes(entry.name)) fail(`shots.json lists ${entry.name}, which is not in screenshots/`);
    }
    if (listed.length !== shots.length) fail(`shots.json lists ${listed.length} shots but screenshots/ holds ${shots.length}`);
  }
  return { gameFiles: gameFiles.length, gameBytes, shots: shotSizes };
}

const checked = validateEntry();

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

const dossierPath = join(out, 'dossier.json');
writeFileSync(
  dossierPath,
  buildDossier(out, {
    text_max_bytes: SOLMAR_CAPS.text_max_bytes,
    screenshots: SOLMAR_CAPS.screenshots,
    game_max_files: SOLMAR_CAPS.game_max_files,
    game_max_bytes: SOLMAR_CAPS.game_max_bytes,
    game_path_max_bytes: SOLMAR_CAPS.game_path_max_bytes,
  }),
);

// Short human-readable summary, so a local run shows what was handed in.
const dossierBytes = fileBytes(dossierPath);
console.log(`Solmar Heat — dossier written to ${dossierPath} (${dossierBytes} bytes)`);
console.log(`game/: ${checked.gameFiles} files, ${checked.gameBytes} bytes`);
for (const shot of checked.shots) console.log(`screenshot: ${shot.name} (${shot.size} bytes)`);
