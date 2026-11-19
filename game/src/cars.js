// cars.js — Solace City's street cars, plus the police interceptor.
//
// Six civilian models and one SCPD Interceptor: their shapes, paint,
// top speeds and the arcade physics every driver shares — the player,
// traffic and the police all steer through `stepCar`. Cars collide as
// two circles, one per axle, which keeps them honest against building
// corners and each other.
//
// The physics step runs in phases on a small state bundle: engine and
// drag, grip, steering, integration, tyre marks, then the two axle
// circles against the world. Nothing here is random; the same inputs
// always give the same car.

import { clamp } from './random.js';

export const CAR_MODELS = [
  { name: 'Brisa Compact', len: 40, wid: 21, topSpeed: 305, accel: 245, grip: 8.5, colors: ['#d95f4b', '#5b8dd9', '#e8e3d8', '#7ab648', '#8d6fc0'] },
  { name: 'Coral Sedan', len: 46, wid: 22, topSpeed: 345, accel: 262, grip: 8.0, colors: ['#3f6fb5', '#c0c6cc', '#37414a', '#8c2f39', '#e0b64f'] },
  { name: 'Dunas Pickup', len: 49, wid: 24, topSpeed: 322, accel: 252, grip: 7.4, colors: ['#b5672c', '#5d7261', '#7a4a2b', '#48525c'] },
  { name: 'Vantara Sunfire', len: 46, wid: 23, topSpeed: 438, accel: 368, grip: 9.2, colors: ['#e33f4e', '#ffb400', '#19b3a6', '#f2f2f2'] },
  { name: 'Alamar Wagon', len: 47, wid: 23, topSpeed: 328, accel: 248, grip: 7.8, colors: ['#6b7f59', '#946b54', '#54687a', '#c9a86a'] },
  { name: 'Faro Taxi', len: 46, wid: 22, topSpeed: 338, accel: 258, grip: 8.0, colors: ['#f7b731', '#f7b731', '#f7b731'] },
  { name: 'SCPD Interceptor', len: 47, wid: 23, topSpeed: 452, accel: 378, grip: 9.4, colors: ['#20242a'], police: true },
];

export const POLICE_MODEL = 6;
export const SPORTS_MODEL = 3;

export function makeCar(modelIdx, x, y, angle, rng, colorOverride = null) {
  const model = CAR_MODELS[modelIdx];
  return {
    kind: 'car',
    model: modelIdx,
    x, y, angle,
    vx: 0, vy: 0,
    color: colorOverride || model.colors[rng.int(0, model.colors.length - 1)],
    len: model.len,
    wid: model.wid,
    driver: 'parked', // 'parked' | 'traffic' | 'police' | 'player'
    hp: 100,
    maxHp: 100,
    wrecked: false,
    honkCd: 0,
    skidL: null,
    skidR: null,
    smokeCd: 0,
    flashT: 0, // police light phase
  };
}

// Forward speed along the car's nose (negative when reversing).
export function carSpeed(car) {
  return car.vx * Math.cos(car.angle) + car.vy * Math.sin(car.angle);
}

// Speed over the ground, whatever the direction.
export function speedOf(car) {
  return Math.sqrt(car.vx * car.vx + car.vy * car.vy);
}

// --- stepCar phases --------------------------------------------------------

// Engine and drag on the forward speed.
function applyEngine(st) {
  const { model, control, dt } = st;
  const throttle = clamp(control.throttle, -1, 1);
  if (throttle > 0) {
    st.vf += model.accel * throttle * dt;
  } else if (throttle < 0) {
    // Brake first, then reverse.
    if (st.vf > 12) st.vf -= 420 * dt;
    else st.vf += model.accel * 0.55 * throttle * dt;
  }
  const dragK = control.handbrake ? 0.25 : 0.55;
  st.vf -= st.vf * dragK * dt;
  if (!control.handbrake && throttle === 0) st.vf -= st.vf * 0.8 * dt;
  st.vf = clamp(st.vf, -model.topSpeed * 0.38, model.topSpeed);
}

// Grip kills sideways slide; the handbrake lets the tail hang out.
function applyGrip(st) {
  const grip = st.control.handbrake ? 1.7 : st.model.grip;
  st.vr *= Math.exp(-grip * st.dt);
}

// Steering bites harder the faster you go, up to a point.
function applySteering(st) {
  const steerAuthority = clamp(st.vf / 130, -1, 1);
  const steerBoost = st.control.handbrake ? 1.3 : 1;
  st.car.angle += clamp(st.control.steer, -1, 1) * 2.55 * steerAuthority * steerBoost * st.dt;
}

// Tyre smoke and skid marks while sliding.
function leaveTyreMarks(st) {
  const { car, effects, dt } = st;
  const sliding = Math.abs(st.vr) > 52 || (st.control.handbrake && Math.abs(st.vf) > 85);
  const rearX = car.x - st.fx * car.len * 0.32;
  const rearY = car.y - st.fy * car.len * 0.32;
  const wheelL = { x: rearX + st.rx * car.wid * 0.42, y: rearY + st.ry * car.wid * 0.42 };
  const wheelR = { x: rearX - st.rx * car.wid * 0.42, y: rearY - st.ry * car.wid * 0.42 };
  if (sliding && effects) {
    if (car.skidL) {
      effects.addSkid(car.skidL.x, car.skidL.y, wheelL.x, wheelL.y);
      effects.addSkid(car.skidR.x, car.skidR.y, wheelR.x, wheelR.y);
    }
    car.smokeCd -= dt;
    if (car.smokeCd <= 0) {
      effects.smoke(rearX, rearY);
      car.smokeCd = 0.05;
    }
  }
  car.skidL = wheelL;
  car.skidR = wheelR;
}

// Building and world collision on the two axle circles. Returns the
// hardest impact speed, and pushes the car back out of the wall.
function collideAxles(st) {
  const { car, city } = st;
  let impact = 0;
  const axleR = car.wid * 0.54;
  for (const s of [0.32, -0.32]) {
    const probe = { x: car.x + st.fx * car.len * s, y: car.y + st.fy * car.len * s };
    const beforeX = probe.x;
    const beforeY = probe.y;
    if (!city.collideCircle(probe, axleR)) continue;
    const pushX = probe.x - beforeX;
    const pushY = probe.y - beforeY;
    car.x += pushX;
    car.y += pushY;
    const into = -(car.vx * pushX + car.vy * pushY);
    if (into <= 0) continue;
    const pushLen = Math.sqrt(pushX * pushX + pushY * pushY) || 1;
    const nx = pushX / pushLen;
    const ny = pushY / pushLen;
    const vn = car.vx * nx + car.vy * ny;
    car.vx -= nx * vn * 1.25;
    car.vy -= ny * vn * 1.25;
    impact = Math.max(impact, Math.abs(vn));
  }
  return impact;
}

// One physics step. control = { throttle: -1..1, steer: -1..1, handbrake }.
// Returns the hardest impact speed this step, for damage and sound.
export function stepCar(car, control, dt, city, effects) {
  if (car.wrecked) {
    car.vx *= Math.max(0, 1 - 3 * dt);
    car.vy *= Math.max(0, 1 - 3 * dt);
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    return 0;
  }
  const model = CAR_MODELS[car.model];
  const st = {
    car, model, control, dt, city, effects,
    fx: Math.cos(car.angle), fy: Math.sin(car.angle),
    rx: 0, ry: 0,
    vf: 0, vr: 0,
  };
  st.rx = -st.fy;
  st.ry = st.fx;
  st.vf = car.vx * st.fx + car.vy * st.fy;
  st.vr = car.vx * st.rx + car.vy * st.ry;

  applyEngine(st);
  applyGrip(st);
  applySteering(st);

  st.fx = Math.cos(car.angle);
  st.fy = Math.sin(car.angle);
  st.rx = -st.fy;
  st.ry = st.fx;
  car.vx = st.fx * st.vf + st.rx * st.vr;
  car.vy = st.fy * st.vf + st.ry * st.vr;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  leaveTyreMarks(st);
  const impact = collideAxles(st);

  if (impact > 40 && effects) {
    effects.sparks(car.x + st.fx * car.len * 0.4, car.y + st.fy * car.len * 0.4, car.angle);
    effects.dust(car.x, car.y);
  }
  if (impact > 70) {
    // Only a real hit bends metal; nudging a wall just scrapes the paint.
    car.hp -= (impact - 55) * 0.12;
    if (effects) effects.shake(Math.min(7, impact * 0.03));
    if (car.hp <= 0) {
      car.hp = 0;
      car.wrecked = true;
    }
  }
  car.honkCd = Math.max(0, car.honkCd - dt);
  car.flashT += dt;
  return impact;
}

// One pair of cars, resolved as circles. Returns the impact record when
// the hit was hard enough to matter, else null.
function resolveCarPair(a, b, effects) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const minD = (a.len + b.len) * 0.36;
  const d2 = dx * dx + dy * dy;
  if (d2 >= minD * minD || d2 === 0) return null;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  const overlap = (minD - d) / 2;
  // A parked car barely gives way; a moving one gives way fully.
  const aGive = a.driver === 'parked' && !a.wrecked ? 0.25 : 1;
  const bGive = b.driver === 'parked' && !b.wrecked ? 0.25 : 1;
  a.x -= nx * overlap * aGive;
  a.y -= ny * overlap * aGive;
  b.x += nx * overlap * bGive;
  b.y += ny * overlap * bGive;
  const rvx = b.vx - a.vx;
  const rvy = b.vy - a.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return null;
  const impulse = -vn * 0.72;
  a.vx -= nx * impulse * aGive;
  a.vy -= ny * impulse * aGive;
  b.vx += nx * impulse * bGive;
  b.vy += ny * impulse * bGive;
  const force = Math.abs(vn);
  if (force <= 55) return null;
  a.hp -= (force - 45) * 0.1;
  b.hp -= (force - 45) * 0.1;
  if (a.hp <= 0) { a.hp = 0; a.wrecked = true; }
  if (b.hp <= 0) { b.hp = 0; b.wrecked = true; }
  const record = { a, b, force, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if (effects) effects.sparks(record.x, record.y, Math.atan2(ny, nx));
  return record;
}

// Circle-versus-circle car collisions, resolved pairwise over the full
// car list. Returns a list of impacts {a, b, force} for effects and sound.
export function collideCars(cars, effects) {
  const impacts = [];
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const hit = resolveCarPair(cars[i], cars[j], effects);
      if (hit) impacts.push(hit);
    }
  }
  return impacts;
}
