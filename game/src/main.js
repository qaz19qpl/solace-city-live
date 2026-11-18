// main.js — boots Solace City and runs it: the game loop, the camera, the
// crime-and-witness bookkeeping, busted/wasted respawns, saving, the
// title/pause flow, and the staged scenes the screenshots are taken from
// (?scene=chase | downtown | contact | beach).

import { buildCity } from './city.js';
import { RNG, clamp, distance } from './random.js';
import { attachInput, endFrameInput, keys, mouse, wasPressed } from './input.js';
import { SoundEngine } from './audio.js';
import { Effects } from './effects.js';
import { makeCar, collideCars, POLICE_MODEL, SPORTS_MODEL } from './cars.js';
import { createTraffic } from './traffic.js';
import { createCrowd, updateCrowd, scareCrowd } from './people.js';
import { createPolice } from './police.js';
import { updateBullets, updatePickups, updateGuards, spawnPickup } from './combat.js';
import { createPlayer, updatePlayer, nearestCar } from './player.js';
import { createMissionEngine, CONTACTS, MISSION_DEFS } from './missions.js';
import { loadSave, storeSave, clearSave, defaultSave } from './save.js';
import { drawWorld } from './render.js';
import { drawHUD, drawMenus, makeMinimapBase } from './hud.js';

const VIEW_W = 1280;
const VIEW_H = 800;
const SPAWN = { x: 2236, y: 762 };
const CLINIC_FRONT = { x: 2020, y: 515 };
const HALL_FRONT = { x: 1820, y: 1160 };

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
attachInput(canvas);

const rng = new RNG(20261118);
const city = buildCity(20261118);

const S = {
  mode: 'title',
  time: 0,
  rng,
  city,
  player: createPlayer(SPAWN.x, SPAWN.y),
  playerView: null,
  cars: [],
  peds: [],
  cops: [],
  bullets: [],
  pickups: [],
  traffic: null,
  police: null,
  missions: null,
  effects: new Effects(),
  audio: new SoundEngine(),
  camera: { x: 1500, y: 800 },
  mouseWorld: { x: 0, y: 0 },
  wanted: { heat: 0, stars: 0, bust: 0, lastSeenAgo: 99 },
  cash: 60,
  stats: defaultSave().stats,
  nextMission: 0,
  storyDone: false,
  passenger: null,
  missionItem: null,
  dialogue: null,
  bannerTitle: '',
  bannerSub: '',
  bannerT: 0,
  prompt: null,
  activeDistrict: 'Marina Bay',
  districtT: 0,
  minimapBase: null,
  uiButtons: [],
  existingSave: loadSave(),
  scene: null,
};
S.playerView = {
  kind: 'player', x: S.player.x, y: S.player.y, angle: 0,
  shirt: '#f2ede2', skin: '#a0663a', pants: '#31404f',
  speed: 0, state: 'walk', walkPhase: 0, role: null, name: null,
};

// --- world population -----------------------------------------------------

for (const spot of city.parkedSpots) {
  if (rng.chance(0.78)) {
    const car = makeCar(rng.int(0, 5), spot.x, spot.y, spot.angle + rng.range(-0.04, 0.04), rng);
    car.driver = 'parked';
    S.cars.push(car);
  }
}
S.peds = createCrowd(city, rng, 42);
S.traffic = createTraffic(city, rng, S.cars);
S.police = createPolice();
S.missions = createMissionEngine(S);
S.minimapBase = makeMinimapBase(city);

const PICKUP_HOMES = [
  { x: 2020, y: 545, kind: 'health' },
  { x: 1560, y: 764, kind: 'health' },
  { x: 631, y: 1505, kind: 'armour' },
  { x: 2240, y: 905, kind: 'ammo', amount: 12 },
  { x: 470, y: 420, kind: 'ammo', amount: 12 },
];
for (const home of PICKUP_HOMES) {
  spawnPickup(S, home.x, home.y, home.kind, home.amount || 0);
  home.takenT = 0;
}

// --- shared services the other modules call -------------------------------

S.banner = (title, sub) => {
  S.bannerTitle = title;
  S.bannerSub = sub;
  S.bannerT = 3.4;
};

S.persist = () => {
  storeSave({
    cash: S.cash,
    nextMission: S.nextMission,
    storyDone: S.storyDone,
    ammo: S.player.ammo,
    hasPistol: S.player.hasPistol,
    stats: S.stats,
  });
  S.existingSave = loadSave();
};

S.addCash = (amount, x, y) => {
  S.cash += amount;
  S.effects.floatText(x, y - 24, `+$${amount}`, '#8be26a');
  S.persist();
};

const CRIME_HEAT = {
  theft: 60, theftCop: 115, shot: 45, assault: 35, assaultCop: 95,
  crash: 22, runover: 120, copCar: 135, hitCopCar: 85,
};

function witnessed(x, y, radius) {
  for (const ped of S.peds) {
    if (ped.state === 'down' || ped.state === 'dead' || ped.role === 'guard') continue;
    if (distance(x, y, ped.x, ped.y) < radius && city.losClear(x, y, ped.x, ped.y)) return true;
  }
  for (const cop of S.cops) {
    if (cop.state === 'chase' && distance(x, y, cop.x, cop.y) < radius + 60) return true;
  }
  for (const car of S.police.cars) {
    if (!car.wrecked && distance(x, y, car.x, car.y) < radius + 130 && city.losClear(x, y, car.x, car.y)) return true;
  }
  return false;
}

S.reportCrime = (kind, x, y) => {
  const base = CRIME_HEAT[kind] || 30;
  const seen = witnessed(x, y, 250);
  S.wanted.heat = Math.min(500, S.wanted.heat + (seen ? base : base * 0.25));
  if (kind === 'shot' || kind === 'runover' || kind === 'copCar') scareCrowd(S, x, y, 230);
};

S.onPedRunOver = (ped) => {
  S.stats.runovers += 1;
  S.reportCrime(ped.kind === 'cop' ? 'copCar' : 'runover', ped.x, ped.y);
  if (S.rng.chance(0.35)) spawnPickup(S, ped.x, ped.y, 'cash', S.rng.int(8, 34));
};

S.onPedAttacked = (ped, cause) => {
  if (ped.role === 'guard') {
    for (const other of S.peds) {
      if (other.role === 'guard' && distance(other.x, other.y, ped.x, ped.y) < 300) other.alert = 1;
    }
  }
  if (cause === 'shot' || cause === 'fist') S.reportCrime('assault', ped.x, ped.y);
};

S.damagePlayer = (amount, cause) => {
  const p = S.player;
  if (S.mode !== 'play' || amount <= 0) return;
  let remaining = amount;
  if (p.armour > 0) {
    const absorbed = Math.min(p.armour, amount * 0.65);
    p.armour -= absorbed;
    remaining = amount - absorbed;
  }
  p.hp -= remaining;
  p.hurtT = 0.55;
  if (cause === 'shot') S.effects.shake(2.5);
  if (p.hp <= 0) {
    p.hp = 0;
    S.mode = 'wasted';
    S.stats.wasted += 1;
    S.missions.interrupted('wasted');
    S.audio.setEngine(null);
    S.audio.setSiren(false);
    S.audio.failSting();
    S.persist();
  }
};

S.onBusted = () => {
  if (S.mode !== 'play') return;
  S.mode = 'busted';
  S.stats.busted += 1;
  S.missions.interrupted('busted');
  S.audio.setEngine(null);
  S.audio.setSiren(false);
  S.audio.failSting();
  S.persist();
};

S.onMissionCarStolen = (car) => {
  S.missions.handleCarStolen(car);
};

S.tryTalk = () => S.missions.talk();

function respawn(kind) {
  const p = S.player;
  const penalty = Math.floor(S.cash * 0.1);
  S.cash -= penalty;
  if (p.car) {
    if (kind === 'busted') {
      const idx = S.cars.indexOf(p.car);
      if (idx >= 0) S.cars.splice(idx, 1); // impounded
    } else {
      p.car.driver = 'parked';
    }
    p.car = null;
  }
  S.police.clearAll(S);
  p.hp = p.maxHp;
  p.armour = 0;
  const spot = kind === 'busted' ? HALL_FRONT : CLINIC_FRONT;
  p.x = spot.x;
  p.y = spot.y;
  S.camera.x = spot.x;
  S.camera.y = spot.y;
  S.mode = 'play';
  S.banner(kind === 'busted' ? 'RELEASED' : 'DISCHARGED', penalty > 0 ? `The city took $${penalty} for its trouble` : 'The city lets you go, this once');
  S.persist();
}

// --- game flow --------------------------------------------------------------

function resetRun(save) {
  const p = S.player;
  if (p.car) {
    p.car.driver = 'parked';
    p.car = null;
  }
  S.police.clearAll(S);
  if (S.missions.active) S.missions.interrupted('reset');
  S.passenger = null;
  S.dialogue = null;
  S.cash = save.cash;
  S.nextMission = save.nextMission;
  S.storyDone = save.storyDone;
  S.stats = { ...save.stats };
  p.hp = p.maxHp;
  p.armour = 0;
  p.hasPistol = save.hasPistol;
  p.ammo = save.ammo;
  p.x = SPAWN.x;
  p.y = SPAWN.y;
  S.camera.x = SPAWN.x;
  S.camera.y = SPAWN.y;
  S.missions.refreshContact();
  S.mode = 'play';
}

function startNewGame() {
  clearSave();
  S.existingSave = null;
  resetRun(defaultSave());
  S.banner('SOLACE CITY', 'Meet Lena Marsh at the marina — follow the gold marker');
  S.persist();
}

function continueGame() {
  const save = loadSave();
  if (!save) return startNewGame();
  resetRun(save);
  S.banner('WELCOME BACK', S.storyDone ? 'Solace City is yours' : `Next job: “${MISSION_DEFS[S.nextMission].title}”`);
}

function handleButtons() {
  if (!mouse.clicked) return;
  for (const b of S.uiButtons) {
    if (mouse.x >= b.x && mouse.x <= b.x + b.w && mouse.y >= b.y && mouse.y <= b.y + b.h) {
      S.audio.init();
      S.audio.click();
      if (b.id === 'new') startNewGame();
      else if (b.id === 'continue') continueGame();
      else if (b.id === 'resume') S.mode = 'play';
      else if (b.id === 'restart') { S.mode = 'title'; S.existingSave = loadSave(); }
      else if (b.id === 'mute') S.audio.setMuted(!S.audio.muted);
      return;
    }
  }
}

// --- staged scenes for the screenshots -------------------------------------

function stageScene(name) {
  resetRun(defaultSave());
  const p = S.player;
  if (name === 'downtown') {
    p.x = 1150;
    p.y = 1085;
    S.camera.x = p.x;
    S.camera.y = p.y;
  } else if (name === 'contact') {
    p.x = 2196;
    p.y = 662;
    p.angle = 0.4;
    S.camera.x = p.x;
    S.camera.y = p.y;
  } else if (name === 'beach') {
    // Southbound in the correct lane, mid-block, with a clear run down the
    // beachfront avenue. The screenshot driver holds W like a player.
    const car = makeCar(SPORTS_MODEL, 2122, 1000, Math.PI / 2, rng, '#19b3a6');
    car.driver = 'player';
    car.vy = 120;
    S.cars.push(car);
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    S.camera.x = car.x;
    S.camera.y = car.y + 60;
  } else if (name === 'chase') {
    S.nextMission = 3;
    S.missions.refreshContact();
    S.missions.activate(3);
    const M = S.missions.active;
    const car = makeCar(SPORTS_MODEL, 1150, 962, 0, rng, '#e33f4e');
    car.driver = 'player';
    car.vx = 265;
    S.cars.push(car);
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    if (M) {
      M.stage = 2;
      M.objective = 'Get Lena to the Old Port hideout — do not stop';
      M.target = { x: 470, y: 1560 };
    }
    S.passenger = 'Lena Marsh';
    S.wanted.heat = 340;
    S.cash = 385;
    const spots = [[905, 962, 0], [812, 962, 0], [985, 1075, -Math.PI / 2]];
    for (const [x, y, a] of spots) {
      const cop = makeCar(POLICE_MODEL, x, y, a, rng);
      cop.driver = 'police';
      cop.vx = Math.cos(a) * 250;
      cop.vy = Math.sin(a) * 250;
      S.cars.push(cop);
      S.police.cars.push(cop);
    }
    S.camera.x = p.x;
    S.camera.y = p.y;
  }
  S.mode = 'play';
}

const params = new URLSearchParams(window.location.search);
if (params.get('scene')) {
  S.scene = params.get('scene');
  stageScene(S.scene);
}

// --- per-frame update ---------------------------------------------------------

function computePrompt() {
  const p = S.player;
  if (S.mode !== 'play' || S.dialogue) {
    S.prompt = null;
    return;
  }
  if (p.car) {
    S.prompt = 'E — Get out';
    return;
  }
  const contact = S.missions.contactPed;
  if (contact && distance(p.x, p.y, contact.x, contact.y) < 52) {
    S.prompt = `E — Talk to ${contact.name}`;
    return;
  }
  if (S.missionItem && distance(p.x, p.y, S.missionItem.x, S.missionItem.y) < 40) {
    S.prompt = 'Grab the package';
    return;
  }
  const car = nearestCar(S, p.x, p.y, 54);
  if (car) {
    S.prompt = car.wrecked ? 'This one is wrecked' : car.driver === 'traffic' ? 'E — Steal the car' : 'E — Get in';
    return;
  }
  S.prompt = null;
}

function updatePlay(dt) {
  if (S.dialogue) {
    if (wasPressed('KeyE') || mouse.clicked) {
      S.audio.init();
      S.dialogue.idx += 1;
      S.audio.click();
      if (S.dialogue.idx >= S.dialogue.lines.length) {
        const done = S.dialogue.onDone;
        S.dialogue = null;
        if (done) done();
      }
    }
    S.effects.update(dt);
    return;
  }

  updatePlayer(dt, S);
  S.traffic.update(dt, S);
  S.police.update(dt, S);
  updateCrowd(dt, S);
  updateGuards(dt, S);

  const impacts = collideCars(S.cars, S.effects);
  for (const hit of impacts) {
    const involvesPlayer = hit.a === S.player.car || hit.b === S.player.car;
    const other = hit.a === S.player.car ? hit.b : hit.a;
    if (involvesPlayer) {
      S.audio.crash(clamp(hit.force / 260, 0.2, 1));
      S.effects.shake(Math.min(6, hit.force * 0.02));
      if (other.driver === 'police') S.reportCrime('hitCopCar', S.player.x, S.player.y);
      else if (hit.force > 170) S.reportCrime('crash', S.player.x, S.player.y);
    } else if (hit.force > 120 && distance(hit.x, hit.y, S.player.x, S.player.y) < 620) {
      S.audio.crash(0.35);
    }
  }

  updateBullets(dt, S);
  updatePickups(dt, S);
  S.missions.update(dt);

  for (const home of PICKUP_HOMES) {
    const present = S.pickups.some((pk) => Math.abs(pk.x - home.x) < 4 && Math.abs(pk.y - home.y) < 4);
    if (!present) {
      home.takenT += dt;
      if (home.takenT > 45) {
        spawnPickup(S, home.x, home.y, home.kind, home.amount || 0);
        home.takenT = 0;
      }
    } else {
      home.takenT = 0;
    }
  }

  computePrompt();

  const district = city.districtAt(S.player.x, S.player.y);
  if (district !== S.activeDistrict) {
    S.activeDistrict = district;
    S.districtT = 2.2;
  }
}

function updateCamera(dt) {
  const p = S.player;
  let tx;
  let ty;
  if (S.mode === 'title') {
    tx = 1500 + Math.sin(S.time * 0.05) * 220;
    ty = 820 + Math.cos(S.time * 0.04) * 120;
  } else {
    tx = p.x + clamp(p.vx * 0.38, -130, 130);
    ty = p.y + clamp(p.vy * 0.38, -130, 130);
  }
  const k = S.mode === 'title' ? 1.2 : 5.2;
  S.camera.x += (tx - S.camera.x) * Math.min(1, k * dt);
  S.camera.y += (ty - S.camera.y) * Math.min(1, k * dt);
  S.camera.x = clamp(S.camera.x, VIEW_W / 2 - 60, city.W - VIEW_W / 2 + 60);
  S.camera.y = clamp(S.camera.y, VIEW_H / 2 - 60, city.H - VIEW_H / 2 + 60);
  S.mouseWorld.x = mouse.x + S.camera.x - VIEW_W / 2;
  S.mouseWorld.y = mouse.y + S.camera.y - VIEW_H / 2;
}

function render() {
  ctx.fillStyle = '#79a84f';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const shake = S.effects.shakeOffset();
  const view = {
    x: S.camera.x - VIEW_W / 2,
    y: S.camera.y - VIEW_H / 2,
    w: VIEW_W,
    h: VIEW_H,
  };
  ctx.save();
  ctx.translate(-view.x + shake.x, -view.y + shake.y);

  const pv = S.playerView;
  pv.x = S.player.x;
  pv.y = S.player.y;
  pv.angle = S.player.angle;
  pv.speed = S.player.car ? 0 : S.player.speedMag;
  pv.walkPhase = S.player.walkFrame;
  pv.state = S.player.hp <= 0 ? 'down' : 'walk';

  drawWorld(ctx, S, view);
  ctx.restore();

  // Warm sunlight wash and a soft vignette over everything.
  const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 320, VIEW_W / 2, VIEW_H / 2, 780);
  grad.addColorStop(0, 'rgba(255,214,120,0.05)');
  grad.addColorStop(1, 'rgba(60,30,0,0.16)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  if (S.mode === 'play' || S.mode === 'pause') drawHUD(ctx, S);
  drawMenus(ctx, S);
}

let lastTs = 0;
function frame(ts) {
  const dt = Math.min(0.033, lastTs ? (ts - lastTs) / 1000 : 0.016);
  lastTs = ts;
  S.time += dt;
  S.bannerT = Math.max(0, S.bannerT - dt);
  S.districtT = Math.max(0, S.districtT - dt);

  if (mouse.clicked || wasPressed('KeyW')) S.audio.init();

  if (S.mode === 'play') {
    if (wasPressed('KeyP') || wasPressed('Escape')) {
      S.mode = 'pause';
      S.audio.setEngine(null);
    } else {
      updatePlay(dt);
    }
  } else if (S.mode === 'title') {
    S.traffic.update(dt, S);
    updateCrowd(dt, S);
    S.effects.update(dt);
  } else if (S.mode === 'pause') {
    if (wasPressed('KeyP') || wasPressed('Escape')) S.mode = 'play';
  } else if (S.mode === 'busted' || S.mode === 'wasted') {
    if (wasPressed('Enter')) respawn(S.mode);
    S.effects.update(dt);
  }

  if (S.mode === 'play') S.effects.update(dt);
  if (wasPressed('KeyM')) S.audio.setMuted(!S.audio.muted);
  if (S.mode === 'title' && wasPressed('Enter')) {
    if (S.existingSave) continueGame();
    else startNewGame();
  }

  handleButtons();
  updateCamera(dt);
  render();
  endFrameInput();
  window.requestAnimationFrame(frame);
}

window.__game = S;
window.__gameActions = { startNewGame, continueGame, respawn };
window.requestAnimationFrame(frame);
