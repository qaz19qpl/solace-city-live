# Solace City

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/qaz19qpl/solace-city-live/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/qaz19qpl/solace-city-live/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A browser open-world crime game made of static files only — no build
step, no network, no libraries, no assets. You are **Dario Venn**, a
dockside courier who owes the wrong people money, working his way out
across a sun-soaked coastal city of pastel rooftops, palm avenues and one
long beach.

## The place

Solace City is a 6×5 avenue grid across seven districts — Old Port,
Coral Heights, Marina Bay, Downtown Solace, South Yards, the Palm
District and La Brisa Beach. Seventy-nine buildings stand on it, 49 of
them named businesses — the Hotel Marisol, the Sol&Co Bank, the Churros
La Ola kiosk on the sand — plus parks, parking lots full of cars waiting
to be borrowed, a marina pier, and a sea that never stops moving.

## Playing it

- **On foot and by car.** Walk up to any of six car models and press E
  to get in — or drag its driver out first. The SCPD Interceptor is
  there too, if you are feeling brave. Arcade driving with a handbrake,
  drifts, tyre smoke and skid marks.
- **A city that notices.** Fourteen drivers run routes on the avenue
  grid, brake for jaywalkers and honk at you; forty-odd pedestrians
  stroll the sidewalks and run from gunfire and bad driving. A witness
  is how most crimes get reported.
- **Wanted, one to five stars.** Witnessed crimes build heat; heat
  brings interceptors that work the road grid to find you, then chase,
  ram and box you in. At three stars, officers come on foot. Get held
  still and the bust meter fills. Break line of sight and the heat
  bleeds away.
- **Fists and a pistol.** Sal trusts you with one eventually. Armed
  guards hold Pier 9. Health, armour, ammo and cash pickups sit where
  you would expect them — the clinic, the docks, the wrong pockets.
- **Five jobs, one story.** A courier run for marina boss Lena Marsh, a
  fleeing debtor for loan shark Big Sal Okafor, a stolen Vantara Sunfire
  delivered against the clock for fixer Priya Anand, a full police
  getaway, and a five-guard clear-out at Pier 9. Busted, wasted and
  out-of-time all fail the job, never the story.
- **The whole HUD.** Live minimap with police blips and the objective
  marker, wanted stars, health and armour, cash, speedometer, mission
  banners, timers and dialogue. Progress, cash and story state save to
  `localStorage`; Continue picks the story up where it stopped.
- **Synthesized sound.** Engine hum, sirens, gunshots, honks, crashes
  and a lazy Am7 coastal music loop are all WebAudio — there are no
  audio files anywhere in the folder.

## Controls

| Keys | Action |
| --- | --- |
| WASD / arrows | Move, drive, steer |
| Mouse | Aim |
| Click | Shoot (with pistol) / punch |
| E | Enter & exit cars, talk, advance dialogue |
| Space | Handbrake |
| Shift | Run |
| P / Esc | Pause |
| M | Mute |

## Run it

Serve `game/` with any static file server (the kit's `node serve.ts`
works) and open `index.html` in desktop Chrome. Or just open the page —
everything it needs is in the folder.

## Inside the folder

- `main.ts` — the handover program: copies `game/` and `screenshots/`
  to the output folder and writes `dossier.json` through
  `vendor/makefun-game.ts` (the kit's library, byte-identical).
- `game/src/` — one file per job. `city.js` builds the world, `render.js`
  draws it, `cars.js` and `traffic.js` move vehicles, `police.js` runs
  the wanted system, `people.js` the crowds, `player.js` and `combat.js`
  the action, `missions.js` the story, `hud.js` the interface, `audio.js`
  the sound, `effects.js` the particles, and `input.js`, `random.js` and
  `save.js` the plumbing.
- `screenshots/` — four real renders of the game: a mid-getaway police
  chase, downtown on foot, meeting Lena at the marina, and a beachfront
  drive.

Built for make.fun's gta6-01 bounty. MIT licensed.

---

<sub>Entered on [make.fun](https://make.fun/?ref=mq95vk6b&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
