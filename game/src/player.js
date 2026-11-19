// player.js — Dario Venn himself: walking, running, aiming, stealing
// cars and driving them.
//
// On foot he is a twin-stick fighter (WASD moves, the mouse aims, click
// shoots or punches); in a car the same keys become pedals and steering.
// Getting into a traffic car drags its driver out — and the whole city
// notices. E is the universal hand: talk to a contact, get in, get out.

import { stepCar, carSpeed, speedOf } from './cars.js';
import { hurtPed, makePed } from './people.js';
import { playerShoot, playerPunch } from './combat.js';
import { keys, mouse, moveAxis, wasPressed } from './input.js';
import { angleTo, clamp, distance } from './random.js';

export function createPlayer(x, y) {
  return {
    kind: 'player',
    x, y,
    vx: 0, vy: 0,
    angle: -Math.PI / 2,
    aimAngle: -Math.PI / 2,
    hp: 100,
    maxHp: 100,
    armour: 0,
    car: null,
    hasPistol: false,
    ammo: 0,
    fireCd: 0,
    punchCd: 0,
    speedMag: 0,
    walkFrame: 0,
    hurtT: 0,
  };
}

// The nearest car to a point, within maxDist, favouring close ones by
// measuring to the car's edge rather than its centre.
export function nearestCar(S, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of S.cars) {
    const d = distance(x, y, car.x, car.y) - car.len * 0.3;
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

// Step out on whichever side is not a wall (driver side first).
function stepOutOfCar(S, car) {
  const rx = -Math.sin(car.angle);
  const ry = Math.cos(car.angle);
  let spot = { x: car.x + rx * (car.wid + 12), y: car.y + ry * (car.wid + 12) };
  for (const side of [1, -1]) {
    const pos = { x: car.x + rx * side * (car.wid + 12), y: car.y + ry * side * (car.wid + 12) };
    const before = { ...pos };
    S.city.collideCircle(pos, 9);
    spot = pos;
    if (Math.abs(pos.x - before.x) < 0.01 && Math.abs(pos.y - before.y) < 0.01) break;
  }
  return spot;
}

function exitCar(S) {
  const p = S.player;
  const car = p.car;
  car.driver = 'parked';
  const spot = stepOutOfCar(S, car);
  p.x = spot.x;
  p.y = spot.y;
  p.car = null;
  S.audio.setEngine(null);
  S.audio.click();
}

function enterCar(S, car) {
  const p = S.player;
  if (car.driver === 'traffic') {
    // Drag the driver out. They will have opinions about this.
    const driver = makePed(S.rng, car.x + 14, car.y + 16);
    driver.state = 'flee';
    driver.fleeX = p.x;
    driver.fleeY = p.y;
    driver.fleeT = 3;
    S.peds.push(driver);
    S.stats.thefts += 1;
    S.reportCrime('theft', p.x, p.y);
    S.effects.floatText(p.x, p.y - 24, 'STOLEN!', '#ffb3b3');
  } else if (car.driver === 'police') {
    S.stats.thefts += 1;
    S.reportCrime('theftCop', p.x, p.y);
  } else if (car.owner === 'mission-target') {
    S.onMissionCarStolen(car);
  }
  car.driver = 'player';
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  S.audio.click();
}

// E on foot: get in the nearest car (or drag its driver out first).
// E in a car: step out on whichever side is not a wall.
export function tryEnterExitCar(S) {
  const p = S.player;
  if (p.car) {
    exitCar(S);
    return;
  }
  const car = nearestCar(S, p.x, p.y, 54);
  if (!car || car.wrecked) return;
  enterCar(S, car);
}

// At speed, the front, middle and rear of the car all run people over.
function runOverAt(S, car, person, radius, onHit) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  for (const s of [0.32, -0.32, 0]) {
    const cx = car.x + fx * car.len * s;
    const cy = car.y + fy * car.len * s;
    if (distance(cx, cy, person.x, person.y) < car.wid * 0.55 + radius) {
      onHit();
      return;
    }
  }
}

function checkRunOvers(S, car) {
  if (speedOf(car) < 65) return;
  for (const ped of S.peds) {
    if (ped.state === 'down' || ped.state === 'dead') continue;
    runOverAt(S, car, ped, 8, () => hurtPed(S, ped, 34, 'car'));
  }
  for (const cop of S.cops) {
    if (cop.state !== 'chase') continue;
    runOverAt(S, car, cop, 8, () => {
      cop.hp -= 55;
      S.reportCrime('copCar', car.x, car.y);
      if (cop.hp <= 0) {
        cop.state = 'down';
        cop.downT = 5;
        S.effects.bloodlessPuff(cop.x, cop.y);
      }
    });
  }
}

function updateDriving(dt, S) {
  const p = S.player;
  const car = p.car;
  const throttle = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) + (keys.has('KeyS') || keys.has('ArrowDown') ? -1 : 0);
  const steer = (keys.has('KeyA') || keys.has('ArrowLeft') ? -1 : 0) + (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
  const impact = stepCar(car, { throttle, steer, handbrake: keys.has('Space') }, dt, S.city, S.effects);
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  if (impact > 95) {
    S.audio.crash(Math.min(1, impact / 220));
    S.damagePlayer((impact - 80) * 0.06, 'crash');
    if (impact > 150) S.reportCrime('crash', p.x, p.y);
  }
  checkRunOvers(S, car);
  S.audio.setEngine(clamp(Math.abs(carSpeed(car)) / 440, 0, 1));
  if (wasPressed('KeyE')) tryEnterExitCar(S);
}

function updateOnFoot(dt, S) {
  const p = S.player;
  const axis = moveAxis();
  const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const speed = sprint ? 240 : 168;
  p.x += axis.x * speed * dt;
  p.y += axis.y * speed * dt;
  const pos = { x: p.x, y: p.y };
  S.city.collideCircle(pos, 9);
  p.x = pos.x;
  p.y = pos.y;
  p.speedMag = Math.sqrt(axis.x * axis.x + axis.y * axis.y) * (axis.x || axis.y ? speed : 0);
  if (axis.x || axis.y) p.walkFrame += dt * (sprint ? 11 : 8);

  // Aim from the mouse's world position, computed by main into S.mouseWorld.
  p.aimAngle = angleTo(p.x, p.y, S.mouseWorld.x, S.mouseWorld.y);
  p.angle = p.aimAngle;

  if (mouse.down) {
    if (p.hasPistol && p.ammo > 0) playerShoot(S);
    else if (p.punchCd <= 0) playerPunch(S);
  }
  if (wasPressed('KeyF')) playerPunch(S);
  if (wasPressed('KeyE')) {
    if (!S.tryTalk()) tryEnterExitCar(S);
  }
  S.audio.setEngine(null);
}

export function updatePlayer(dt, S) {
  const p = S.player;
  const prevX = p.x;
  const prevY = p.y;
  p.fireCd = Math.max(0, p.fireCd - dt);
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.hurtT = Math.max(0, p.hurtT - dt);

  if (p.car) updateDriving(dt, S);
  else updateOnFoot(dt, S);

  p.vx = dt > 0 ? (p.x - prevX) / dt : 0;
  p.vy = dt > 0 ? (p.y - prevY) / dt : 0;
  if (p.car) {
    p.vx = p.car.vx;
    p.vy = p.car.vy;
    p.speedMag = Math.abs(carSpeed(p.car));
  }
}
