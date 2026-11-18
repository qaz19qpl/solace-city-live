# Solace City

An original open-world crime game that runs in the browser from static
files — no build step, no network, no libraries. You are **Dario Venn**, a
dockside courier who owes the wrong people money, working his way out of
debt in a sun-soaked coastal city of pastel rooftops, palm avenues and one
long beach.

## The city

Solace City is a 6×5 grid of avenues across seven districts — Old Port,
Coral Heights, Marina Bay, Downtown Solace, South Yards, the Palm District
and La Brisa Beach — with 79 buildings (49 of them signed businesses, from
the Hotel Marisol to the Churros La Ola kiosk on the sand), parks, parking
lots full of stealable cars, a marina pier, and an animated sea.

## What you can do

- **Explore on foot and by car.** Walk up to any of six car models (plus
  the SCPD Interceptor, if you are feeling brave) and press E to get in —
  or drag its driver out. Arcade driving with handbrake drifts, tyre smoke
  and skid marks.
- **Live traffic and crowds.** Fourteen drivers run routes on the avenue
  grid, brake for jaywalkers and honk at you; forty-odd pedestrians stroll
  the sidewalks and flee from gunfire and bad driving.
- **A 1–5 star wanted system.** Witnessed crimes build heat; heat brings
  interceptors that work the road grid to find you, then chase, ram and
  box you in. At three stars, officers come on foot. Get held at a
  standstill and the bust meter fills. Break line of sight and the heat
  bleeds away.
- **Combat.** Fists, and a pistol once Sal trusts you with one. Armed
  guards hold Pier 9. Health, armour, ammo and cash pickups are scattered
  where you would expect them — the clinic, the docks, the wrong pockets.
- **A five-mission story.** A courier run for marina boss Lena Marsh, a
  fleeing debtor for loan shark Big Sal Okafor, a stolen Vantara Sunfire
  delivered against the clock for fixer Priya Anand, a full police getaway,
  and a five-guard clear-out at Pier 9. Busted, wasted and out-of-time all
  fail the job, never the story.
- **A full HUD.** Live minimap with police blips and the objective marker,
  wanted stars, health and armour, cash, speedometer, mission banners,
  timers and a dialogue system. Progress, cash and story state save to
  `localStorage`; Continue picks the story up where it stopped.
- **Synthesized everything.** Engine hum, sirens, gunshots, honks, crashes
  and a lazy Am7 coastal music loop are all WebAudio — there are no audio
  files.

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

## Layout

- `main.ts` — the handover program: copies `game/` and `screenshots/` to
  the output folder and writes `dossier.json` via `vendor/makefun-game.ts`
  (the kit's library, byte-identical).
- `game/src/` — one file per job: `city.js` builds the world, `render.js`
  draws it, `cars.js` and `traffic.js` move vehicles, `police.js` runs the
  wanted system, `people.js` the crowds, `player.js` and `combat.js` the
  action, `missions.js` the story, `hud.js` the interface, `audio.js` the
  sound, `effects.js` the particles, `input.js`, `random.js` and `save.js`
  the plumbing.
- `screenshots/` — four real renders of the game: a mid-getaway police
  chase, downtown on foot, meeting Lena at the marina, and a beachfront
  drive.

Built for make.fun's gta6-01 bounty. MIT licensed.
