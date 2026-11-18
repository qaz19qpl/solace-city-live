// cars.js — Solace City's six street cars plus the police interceptor:
// their shapes, paint, top speeds and the arcade physics every driver
// (player, traffic, police) shares. Cars collide as two circles, front
// and rear axle, which keeps them honest against building corners.

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

export function carSpeed(car) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  return car.vx * fx + car.vy * fy;
}

export function speedOf(car) {
  return Math.sqrt(car.vx * car.vx + car.vy * car.vy);
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
  let fx = Math.cos(car.angle);
  let fy = Math.sin(car.angle);
  let rx = -fy;
  let ry = fx;

  let vf = car.vx * fx + car.vy * fy;
  let vr = car.vx * rx + car.vy * ry;

  // Engine and drag.
  const throttle = clamp(control.throttle, -1, 1);
  if (throttle > 0) vf += model.accel * throttle * dt;
  else if (throttle < 0) {
    // Brake first, then reverse.
    if (vf > 12) vf -= 420 * dt;
    else vf += model.accel * 0.55 * throttle * dt;
  }
  const dragK = control.handbrake ? 0.25 : 0.55;
  vf -= vf * dragK * dt;
  if (!control.handbrake && throttle === 0) vf -= vf * 0.8 * dt;
  const top = model.topSpeed;
  vf = clamp(vf, -top * 0.38, top);

  // Grip kills sideways slide; the handbrake lets the tail hang out.
  const grip = control.handbrake ? 1.7 : model.grip;
  vr *= Math.exp(-grip * dt);

  // Steering bites harder the faster you go, up to a point.
  const steerAuthority = clamp(vf / 130, -1, 1);
  car.angle += clamp(control.steer, -1, 1) * 2.55 * steerAuthority * (control.handbrake ? 1.3 : 1) * dt;

  fx = Math.cos(car.angle);
  fy = Math.sin(car.angle);
  rx = -fy;
  ry = fx;
  car.vx = fx * vf + rx * vr;
  car.vy = fy * vf + ry * vr;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  // Tyre smoke and skid marks while sliding.
  const sliding = Math.abs(vr) > 52 || (control.handbrake && Math.abs(vf) > 85);
  const rearX = car.x - fx * car.len * 0.32;
  const rearY = car.y - fy * car.len * 0.32;
  const wl = { x: rearX + rx * car.wid * 0.42, y: rearY + ry * car.wid * 0.42 };
  const wr = { x: rearX - rx * car.wid * 0.42, y: rearY - ry * car.wid * 0.42 };
  if (sliding && effects) {
    if (car.skidL) {
      effects.addSkid(car.skidL.x, car.skidL.y, wl.x, wl.y);
      effects.addSkid(car.skidR.x, car.skidR.y, wr.x, wr.y);
    }
    car.smokeCd -= dt;
    if (car.smokeCd <= 0) {
      effects.smoke(rearX, rearY);
      car.smokeCd = 0.05;
    }
  }
  car.skidL = wl;
  car.skidR = wr;

  // Building and world collision on the two axle circles.
  let impact = 0;
  const r = car.wid * 0.54;
  for (const s of [0.32, -0.32]) {
    const p = { x: car.x + fx * car.len * s, y: car.y + fy * car.len * s };
    const before = { ...p };
    if (city.collideCircle(p, r)) {
      const pushX = p.x - before.x;
      const pushY = p.y - before.y;
      car.x += pushX;
      car.y += pushY;
      const into = -(car.vx * pushX + car.vy * pushY);
      if (into > 0) {
        const pushLen = Math.sqrt(pushX * pushX + pushY * pushY) || 1;
        const nx = pushX / pushLen;
        const ny = pushY / pushLen;
        const vn = car.vx * nx + car.vy * ny;
        car.vx -= nx * vn * 1.25;
        car.vy -= ny * vn * 1.25;
        impact = Math.max(impact, Math.abs(vn));
      }
    }
  }

  if (impact > 40 && effects) {
    effects.sparks(car.x + fx * car.len * 0.4, car.y + fy * car.len * 0.4, car.angle);
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

// Circle-versus-circle car collisions, resolved pairwise by the caller on
// the full car list. Returns a list of impacts {a, b, force} for effects.
export function collideCars(cars, effects) {
  const impacts = [];
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const minD = (a.len + b.len) * 0.36;
      const d2 = dx * dx + dy * dy;
      if (d2 >= minD * minD || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const overlap = (minD - d) / 2;
      const aStatic = a.driver === 'parked' && !a.wrecked ? 0.25 : 1;
      const bStatic = b.driver === 'parked' && !b.wrecked ? 0.25 : 1;
      a.x -= nx * overlap * aStatic;
      a.y -= ny * overlap * aStatic;
      b.x += nx * overlap * bStatic;
      b.y += ny * overlap * bStatic;
      const rvx = b.vx - a.vx;
      const rvy = b.vy - a.vy;
      const vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        const impulse = -vn * 0.72;
        a.vx -= nx * impulse * aStatic;
        a.vy -= ny * impulse * aStatic;
        b.vx += nx * impulse * bStatic;
        b.vy += ny * impulse * bStatic;
        const force = Math.abs(vn);
        if (force > 55) {
          a.hp -= (force - 45) * 0.1;
          b.hp -= (force - 45) * 0.1;
          if (a.hp <= 0) { a.hp = 0; a.wrecked = true; }
          if (b.hp <= 0) { b.hp = 0; b.wrecked = true; }
          impacts.push({ a, b, force, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
          if (effects) {
            effects.sparks((a.x + b.x) / 2, (a.y + b.y) / 2, Math.atan2(ny, nx));
          }
        }
      }
    }
  }
  return impacts;
}
