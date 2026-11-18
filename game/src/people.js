// people.js — the pedestrians of Solace City. They stroll the sidewalk
// rings from corner to corner, chat in pairs, run from gunfire and bad
// driving, and — if a car finds them anyway — go down in a puff of dust.
// Witnesses matter: a watching pedestrian is how most crimes get reported.

import { angleTo, clamp, distance, turnToward } from './random.js';

export const PED_COLORS = ['#e2725b', '#5b8dd9', '#f2c14e', '#7ab648', '#c86dd7', '#48c2a6', '#e88ca0', '#8d9db6', '#d9d3c3', '#4a6fa5'];
const SKIN_TONES = ['#f2c9a0', '#d9a066', '#a0663a', '#7a4a26', '#ffe0bd'];

let pedSerial = 1;

export function makePed(rng, x, y, kind = 'ped') {
  return {
    kind,
    id: pedSerial++,
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: 0,
    walkSpeed: rng.range(52, 78),
    hp: 30,
    state: 'walk', // 'walk' | 'flee' | 'down' | 'dead' | 'stand'
    target: null,
    waitT: 0,
    fleeX: 0,
    fleeY: 0,
    fleeT: 0,
    downT: 0,
    shirt: rng.pick(PED_COLORS),
    skin: rng.pick(SKIN_TONES),
    pants: rng.pick(['#33404f', '#5c4a3a', '#707a88', '#28323f', '#7a3b3b']),
    name: null,
    role: null, // 'contact' | 'debtor' | 'guard' | 'passenger' for mission folk
  };
}

export function createCrowd(city, rng, count = 42) {
  const peds = [];
  for (let k = 0; k < count; k++) {
    const p = city.sidewalkPoints[rng.int(0, city.sidewalkPoints.length - 1)];
    peds.push(makePed(rng, p.x + rng.range(-6, 6), p.y + rng.range(-6, 6)));
  }
  return peds;
}

function pickStrollTarget(ped, S) {
  const pts = S.city.sidewalkPoints;
  let best = null;
  for (let tries = 0; tries < 8; tries++) {
    const cand = pts[S.rng.int(0, pts.length - 1)];
    const d = distance(ped.x, ped.y, cand.x, cand.y);
    if (d > 60 && d < 460) {
      best = cand;
      break;
    }
    if (!best) best = cand;
  }
  ped.target = best ? { x: best.x + S.rng.range(-5, 5), y: best.y + S.rng.range(-5, 5) } : null;
}

// Make everyone in earshot run from a point (a gunshot, a crash, a car
// mounting the pavement).
export function scareCrowd(S, x, y, radius = 210) {
  for (const ped of S.peds) {
    if (ped.state !== 'walk' && ped.state !== 'stand') continue;
    if (ped.role === 'contact' || ped.role === 'guard') continue;
    if (distance(ped.x, ped.y, x, y) < radius) {
      ped.state = 'flee';
      ped.fleeX = x;
      ped.fleeY = y;
      ped.fleeT = S.rng.range(1.6, 3.2);
    }
  }
}

export function hurtPed(S, ped, amount, cause) {
  if (ped.state === 'dead') return;
  ped.hp -= amount;
  if (ped.hp <= 0) {
    ped.state = 'down';
    ped.downT = 6;
    S.effects.bloodlessPuff(ped.x, ped.y);
    if (cause === 'car') S.onPedRunOver(ped);
    else if (cause === 'shot' || cause === 'fist') S.onPedAttacked(ped, cause);
  } else if (cause !== 'car') {
    ped.state = 'flee';
    ped.fleeX = S.player.x;
    ped.fleeY = S.player.y;
    ped.fleeT = 2.4;
  }
}

export function updatePed(ped, dt, S) {
  if (ped.state === 'dead') return;
  if (ped.state === 'down') {
    ped.downT -= dt;
    ped.speed = 0;
    if (ped.downT <= 0) {
      if (ped.hp <= -25 || ped.role === 'guard') {
        ped.state = 'dead';
      } else {
        // Solace City is forgiving: most people get back up, shaken.
        ped.hp = 12;
        ped.state = 'flee';
        ped.fleeX = S.player.x;
        ped.fleeY = S.player.y;
        ped.fleeT = 2;
      }
    }
    return;
  }
  if (ped.role === 'contact' || ped.role === 'guard') return; // missions drive them

  let moveX = 0;
  let moveY = 0;
  let speed = 0;

  if (ped.state === 'flee') {
    ped.fleeT -= dt;
    const away = angleTo(ped.fleeX, ped.fleeY, ped.x, ped.y);
    moveX = Math.cos(away);
    moveY = Math.sin(away);
    speed = 196;
    if (ped.fleeT <= 0) ped.state = 'walk';
  } else {
    if (ped.waitT > 0) {
      ped.waitT -= dt;
      ped.speed = 0;
      return;
    }
    if (!ped.target || distance(ped.x, ped.y, ped.target.x, ped.target.y) < 9) {
      if (S.rng.chance(0.3)) {
        ped.waitT = S.rng.range(0.8, 3.2);
        ped.state = 'stand';
        ped.speed = 0;
        return;
      }
      ped.state = 'walk';
      pickStrollTarget(ped, S);
    }
    if (ped.target) {
      const a = angleTo(ped.x, ped.y, ped.target.x, ped.target.y);
      moveX = Math.cos(a);
      moveY = Math.sin(a);
      speed = ped.walkSpeed;
      ped.angle = turnToward(ped.angle, a, 8 * dt);
    }
  }

  if (speed > 0) {
    ped.x += moveX * speed * dt;
    ped.y += moveY * speed * dt;
    ped.speed = speed;
    ped.walkPhase = (ped.walkPhase || 0) + dt * speed * 0.11;
    if (speed > 100) ped.angle = turnToward(ped.angle, Math.atan2(moveY, moveX), 10 * dt);
    const pos = { x: ped.x, y: ped.y };
    S.city.collideCircle(pos, 8);
    ped.x = pos.x;
    ped.y = pos.y;
  } else {
    ped.speed = 0;
  }
}

export function updateCrowd(dt, S) {
  for (const ped of S.peds) updatePed(ped, dt, S);
  // Keep the crowd near the action, same trick as traffic.
  for (const ped of S.peds) {
    if (ped.role) continue;
    const d = distance(ped.x, ped.y, S.player.x, S.player.y);
    if (d > 1250 && (ped.state === 'walk' || ped.state === 'stand')) {
      const pts = S.city.sidewalkPoints;
      for (let tries = 0; tries < 10; tries++) {
        const cand = pts[S.rng.int(0, pts.length - 1)];
        const cd = distance(cand.x, cand.y, S.player.x, S.player.y);
        if (cd > 380 && cd < 800) {
          ped.x = cand.x;
          ped.y = cand.y;
          ped.target = null;
          break;
        }
      }
    }
  }
  // Remove the truly gone (guards stay as evidence a while).
  for (let i = S.peds.length - 1; i >= 0; i--) {
    const ped = S.peds[i];
    if (ped.state === 'dead') {
      ped.corpseT = (ped.corpseT || 20) - dt;
      if (ped.corpseT <= 0) S.peds.splice(i, 1);
    }
  }
  void clamp;
}
