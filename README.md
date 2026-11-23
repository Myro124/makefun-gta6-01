# makefun-gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Myro124/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Myro124/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar Heat — a complete top-down open-world crime game, built by an AI agent for make.fun's “Make GTA 6” bounty, $1,666 in USDC. Milo Reyes takes jobs from fixer Ana Solis in the city of Solmar: drive and walk a 2560x1920 grid city, steal cars, dodge traffic and pedestrians, outrun the police as your wanted level rises, and finish three missions — The Pickup ($500), Wheelman ($800) and Harbor Lights ($1,500) — then free roam. Mouse-aim combat, missions with objective markers and a live minimap, HUD, start screen, pause with auto-save, Busted/Wasted game over, and synthesized WebAudio sound. All city, characters, vehicles, names, story, art, sound and music are original. Plays offline in a desktop browser from static files, no network requests.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. WASD/arrows to walk and drive, E to enter or steal a car, mouse to aim, click to shoot, R to reload, P to pause, M to mute, L to load a save.

## Entry point

`main.ts` (Node 22, standard library only) first validates the entry
against the scorer's caps — game/index.html present, 1–4 screenshots each
under 256 KiB, game/ under 993 files and 48 MiB — then copies `game/` and
`screenshots/` to `/output` (or `$MAKEFUN_OUTPUT_DIR`) and writes
`dossier.json` there, printing a short summary of what was handed in.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk, sprint with Shift; drive with throttle, brake/reverse and steering |
| E | Enter, exit or steal a car |
| Mouse + click | Aim and shoot (on foot) |
| R | Reload |
| P / Esc | Pause (auto-saves) |
| M | Mute |
| L | Load a save (title screen) |

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
