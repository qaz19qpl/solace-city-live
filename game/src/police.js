// police.js — the Solace City Police Department.
//
// Crimes the public sees build heat; heat becomes stars; stars become
// interceptors on the road graph and officers on foot. Stay unseen and
// the heat bleeds away. Get held at a standstill with an officer on you
// and the bust meter fills. Interceptors that cannot see you work the
// avenue grid toward your nearest intersection, breadth-first.
//
// The department is one object with a small fleet (cars) and a roster
// (cops on foot). Both lists mirror entries in the shared S.cars /
// S.cops arrays, so the renderer and the collision code see them too.

import { makeCar, stepCar, POLICE_MODEL, speedOf, carSpeed } from './cars.js';
import { angleDelta, angleTo, clamp, distance, turnToward } from './random.js';

const CARS_PER_STAR = [0, 1, 2, 3, 4, 5];

export function starsForHeat(heat) {
  if (heat <= 0) return 0;
  return Math.min(5, Math.ceil(heat / 100));
}

export function makeCop(rng, x, y) {
  return {
    kind: 'cop',
    id: 1000 + Math.floor(rng.range(0, 8999)),
    x, y,
    angle: 0,
    speed: 0,
    walkSpeed: 210,
    hp: 45,
    state: 'chase', // 'chase' | 'down' | 'dead'
    target: null,
    waitT: 0,
    downT: 0,
    walkPhase: 0,
    shirt: '#22355e',
    skin: '#d9a066',
    pants: '#1b2740',
    name: null,
    role: null,
    corpseT: 0,
  };
}

// Breadth-first next step over the avenue grid (30 nodes; trivial cost).
// Returns the intersection after `from` on a shortest path to `to`.
function nextNodeToward(city, from, to) {
  if (from.i === to.i && from.j === to.j) return null;
  const key = (i, j) => i * 10 + j;
  const cameFrom = new Map();
  const queue = [[from.i, from.j]];
  cameFrom.set(key(from.i, from.j), null);
  while (queue.length) {
    const [ci, cj] = queue.shift();
    if (ci === to.i && cj === to.j) break;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = ci + di;
      const nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= city.vx.length || nj >= city.hy.length) continue;
      if (cameFrom.has(key(ni, nj))) continue;
      cameFrom.set(key(ni, nj), [ci, cj]);
      queue.push([ni, nj]);
    }
  }
  let cur = [to.i, to.j];
  let before = cameFrom.get(key(cur[0], cur[1]));
  if (!before) return null;
  while (before && !(before[0] === from.i && before[1] === from.j)) {
    cur = before;
    before = cameFrom.get(key(cur[0], cur[1]));
    if (!before) return null;
  }
  return { i: cur[0], j: cur[1] };
}

// Where should this interceptor aim? Direct pursuit when it can see the
// player, otherwise the next grid node toward the player's intersection.
function pursuitTarget(S, car) {
  const p = S.player;
  const d = distance(car.x, car.y, p.x, p.y);
  const seen = d < 460 && S.city.losClear(car.x, car.y, p.x, p.y);
  if (seen || d < 240) {
    // Lead the target a little.
    const lead = p.car ? 0.32 : 0.1;
    return { x: p.x + p.vx * lead, y: p.y + p.vy * lead, direct: true, d };
  }
  const from = S.city.nearestIntersection(car.x, car.y);
  const to = S.city.nearestIntersection(p.x, p.y);
  const next = nextNodeToward(S.city, from, to);
  const node = next ? S.city.intersection(next.i, next.j) : { x: p.x, y: p.y };
  if (distance(car.x, car.y, node.x, node.y) < 34) return { x: p.x, y: p.y, direct: false, d };
  return { x: node.x, y: node.y, direct: false, d };
}

export function createPolice() {
  const dept = {
    cars: [],
    cops: [],
    spawnT: 0,

    policeSeePlayer(S) {
      const p = S.player;
      for (const car of this.cars) {
        if (car.wrecked) continue;
        if (distance(car.x, car.y, p.x, p.y) < 430 && S.city.losClear(car.x, car.y, p.x, p.y)) return true;
      }
      for (const cop of this.cops) {
        if (cop.state !== 'chase') continue;
        if (distance(cop.x, cop.y, p.x, p.y) < 300 && S.city.losClear(cop.x, cop.y, p.x, p.y)) return true;
      }
      return false;
    },

    spawnCar(S) {
      const p = S.player;
      for (let tries = 0; tries < 10; tries++) {
        const ang = S.rng.range(0, Math.PI * 2);
        const dist = S.rng.range(620, 820);
        const node = S.city.nearestIntersection(p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist);
        const spot = S.city.intersection(node.i, node.j);
        if (distance(spot.x, spot.y, p.x, p.y) < 480) continue;
        const car = makeCar(POLICE_MODEL, spot.x, spot.y, 0, S.rng);
        car.driver = 'police';
        car.droppedCop = false;
        S.cars.push(car);
        this.cars.push(car);
        return;
      }
    },

    update(dt, S) {
      const W = S.wanted;
      const stars = starsForHeat(W.heat);
      W.stars = stars;

      // Being seen holds the heat; hiding bleeds it.
      if (this.policeSeePlayer(S)) {
        W.lastSeenAgo = 0;
      } else {
        W.lastSeenAgo += dt;
        if (W.lastSeenAgo > 5 && W.heat > 0) {
          W.heat = Math.max(0, W.heat - dt * (stars >= 4 ? 5.5 : 9));
        }
      }

      // Fleet size follows the stars.
      const alive = this.cars.filter((c) => !c.wrecked);
      this.spawnT -= dt;
      if (alive.length < CARS_PER_STAR[stars] && this.spawnT <= 0) {
        this.spawnCar(S);
        this.spawnT = 1.4;
      }
      // When the heat dies, the fleet drifts away.
      for (let i = this.cars.length - 1; i >= 0; i--) {
        const car = this.cars[i];
        const d = distance(car.x, car.y, S.player.x, S.player.y);
        if ((stars === 0 && d > 700) || d > 1700) {
          const idx = S.cars.indexOf(car);
          if (idx >= 0) S.cars.splice(idx, 1);
          this.cars.splice(i, 1);
        }
      }

      this.driveCars(dt, S, stars);
      this.updateCops(dt, S, stars);
      this.updateBust(dt, S, stars);

      const sirenNear = stars > 0 && this.cars.some((c) => !c.wrecked && distance(c.x, c.y, S.player.x, S.player.y) < 760);
      S.audio.setSiren(sirenNear);
    },

    driveCars(dt, S, stars) {
      const p = S.player;
      for (const car of this.cars) {
        if (car.wrecked) continue;
        const target = pursuitTarget(S, car);
        let throttle = 0.92;
        if (target.direct) {
          if (!p.car && target.d < 64) throttle = 0; // don't run him down, box him in
          if (p.car && target.d < 40) throttle = 0.55;
        }
        const want = Math.atan2(target.y - car.y, target.x - car.x);
        const delta = angleDelta(car.angle, want);
        const steer = clamp(delta * 2.6, -1, 1);
        if (Math.abs(delta) > 1.9 && speedOf(car) > 60) throttle = -0.5;
        const handbrake = Math.abs(delta) > 1.1 && speedOf(car) > 200;
        const impact = stepCar(car, { throttle, steer, handbrake }, dt, S.city, S.effects);
        if (impact > 120) S.audio.crash(0.4);

        // An officer steps out when the car stops near an on-foot player.
        if (!car.droppedCop && stars >= 2 && !p.car && target.d < 90 && speedOf(car) < 30) {
          car.droppedCop = true;
          const cop = makeCop(S.rng, car.x + 18, car.y + 10);
          this.cops.push(cop);
          S.cops.push(cop);
        }
      }
    },

    updateCops(dt, S, stars) {
      const p = S.player;
      // Reinforce on foot at three stars and up.
      const onFoot = this.cops.filter((c) => c.state === 'chase').length;
      if (stars >= 3 && onFoot < stars - 1) {
        const car = this.cars.find((c) => !c.wrecked);
        if (car && distance(car.x, car.y, p.x, p.y) < 380) {
          const cop = makeCop(S.rng, car.x - 16, car.y - 12);
          this.cops.push(cop);
          S.cops.push(cop);
        }
      }
      for (let i = this.cops.length - 1; i >= 0; i--) {
        const cop = this.cops[i];
        const remove = () => {
          this.cops.splice(i, 1);
          const idx = S.cops.indexOf(cop);
          if (idx >= 0) S.cops.splice(idx, 1);
        };
        if (cop.state === 'down') {
          cop.downT -= dt;
          if (cop.downT <= 0) {
            cop.state = 'dead';
            cop.corpseT = 16;
          }
          continue;
        }
        if (cop.state === 'dead') {
          cop.corpseT -= dt;
          if (cop.corpseT <= 0) remove();
          continue;
        }
        const d = distance(cop.x, cop.y, p.x, p.y);
        if (stars === 0 || d > 1500) {
          remove();
          continue;
        }
        if (d > 12) {
          const heading = angleTo(cop.x, cop.y, p.x, p.y);
          cop.angle = turnToward(cop.angle, heading, 9 * dt);
          const speed = d > 200 ? 214 : 178;
          cop.x += Math.cos(heading) * speed * dt;
          cop.y += Math.sin(heading) * speed * dt;
          cop.speed = speed;
          cop.walkPhase = (cop.walkPhase || 0) + dt * speed * 0.11;
          const pos = { x: cop.x, y: cop.y };
          S.city.collideCircle(pos, 8);
          cop.x = pos.x;
          cop.y = pos.y;
        } else {
          cop.speed = 0;
          cop.angle = angleTo(cop.x, cop.y, p.x, p.y);
        }
      }
    },

    // The bust meter: held still with an officer on you, it fills.
    updateBust(dt, S, stars) {
      const W = S.wanted;
      const p = S.player;
      if (stars === 0 || S.mode !== 'play') {
        W.bust = Math.max(0, W.bust - dt * 0.8);
        return;
      }
      const playerSlow = p.car ? Math.abs(carSpeed(p.car)) < 26 : p.speedMag < 24;
      let held = false;
      if (playerSlow) {
        for (const cop of this.cops) {
          if (cop.state === 'chase' && distance(cop.x, cop.y, p.x, p.y) < 30) held = true;
        }
        const near = p.car ? 58 : 56;
        for (const car of this.cars) {
          if (!car.wrecked && distance(car.x, car.y, p.x, p.y) < near && speedOf(car) < 40) held = true;
        }
      }
      if (held) {
        W.bust += dt / 2.3;
        if (W.bust >= 1) {
          W.bust = 0;
          S.onBusted();
        }
      } else {
        W.bust = Math.max(0, W.bust - dt * 0.55);
      }
    },

    // Called when the player respawns: the slate is wiped clean.
    clearAll(S) {
      for (const car of this.cars) {
        const idx = S.cars.indexOf(car);
        if (idx >= 0) S.cars.splice(idx, 1);
      }
      for (const cop of this.cops) {
        const idx = S.cops.indexOf(cop);
        if (idx >= 0) S.cops.splice(idx, 1);
      }
      this.cars = [];
      this.cops = [];
      S.wanted.heat = 0;
      S.wanted.stars = 0;
      S.wanted.bust = 0;
      S.wanted.lastSeenAgo = 0;
      S.audio.setSiren(false);
    },
  };
  return dept;
}
