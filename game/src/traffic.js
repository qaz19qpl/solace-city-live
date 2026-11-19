// traffic.js — the everyday drivers of Solace City.
//
// Each traffic car runs a route over the avenue grid, intersection to
// intersection, in the right-hand lane. They brake for whatever is in
// front of them — you included — and honk when you deserve it. Cars that
// wander to the far side of town are quietly recycled near the player,
// so the streets around the action never feel empty.
//
// A traffic car is just a car with a route: two intersections, the one
// it came from and the one it is driving to. At the far end it picks a
// new turn, never the U-turn it just came from.

import { ROAD_W } from './city.js';
import { makeCar, stepCar, speedOf } from './cars.js';
import { angleDelta, clamp, distance } from './random.js';

const TRAFFIC_COUNT = 14;
const LANE = ROAD_W * 0.24;

// The lane-corrected point for the far end of a leg (ai,aj) -> (bi,bj).
function lanePoint(city, ai, aj, bi, bj) {
  const a = city.intersection(ai, aj);
  const b = city.intersection(bi, bj);
  const dx = Math.sign(b.x - a.x);
  const dy = Math.sign(b.y - a.y);
  // Right-hand side of the direction of travel (screen coords, y down).
  const rx = -dy;
  const ry = dx;
  return { x: b.x + rx * LANE, y: b.y + ry * LANE };
}

// A random next intersection from (bi,bj), never the U-turn back to (ai,aj).
function pickNext(city, rng, ai, aj, bi, bj) {
  const options = [];
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const ni = bi + di;
    const nj = bj + dj;
    if (ni < 0 || nj < 0 || ni >= city.vx.length || nj >= city.hy.length) continue;
    if (ni === ai && nj === aj) continue;
    options.push([ni, nj]);
  }
  if (options.length === 0) return [ai, aj];
  return options[rng.int(0, options.length - 1)];
}

export function createTraffic(city, rng, cars) {
  const drivers = [];

  function spawnDriver() {
    const i = rng.int(0, city.vx.length - 1);
    const j = rng.int(0, city.hy.length - 1);
    const [ni, nj] = pickNext(city, rng, i, j, i, j);
    const node = city.intersection(i, j);
    const target = lanePoint(city, ni, nj, i, j);
    const model = rng.int(0, 5);
    const car = makeCar(model, node.x, node.y, Math.atan2(target.y - node.y, target.x - node.x), rng);
    car.driver = 'traffic';
    car.route = { ai: ni, aj: nj, bi: i, bj: j };
    car.cruise = rng.range(0.45, 0.7);
    cars.push(car);
    drivers.push(car);
    return car;
  }

  for (let k = 0; k < TRAFFIC_COUNT; k++) spawnDriver();

  // Whatever is directly ahead of this car: another car, or a pedestrian
  // standing in the road. Returns it, or null when the way is clear.
  function obstacleAhead(car, S) {
    const sp = speedOf(car);
    const look = 42 + sp * 0.38;
    const ax = car.x + Math.cos(car.angle) * look;
    const ay = car.y + Math.sin(car.angle) * look;
    for (const other of S.cars) {
      if (other === car) continue;
      if (distance(ax, ay, other.x, other.y) < 30) return other;
    }
    for (const ped of S.peds) {
      if (ped.state === 'down' || ped.state === 'dead') continue;
      if (!S.city.isRoad(ped.x, ped.y)) continue;
      if (distance(ax, ay, ped.x, ped.y) < 30) return ped;
    }
    return null;
  }

  // One car, one frame: follow the lane to the next intersection.
  function driveCar(car, dt, S) {
    if (car.wrecked) return;
    const route = car.route;
    const target = lanePoint(S.city, route.ai, route.aj, route.bi, route.bj);
    if (distance(car.x, car.y, target.x, target.y) < 30) {
      const [ni, nj] = pickNext(S.city, S.rng, route.ai, route.aj, route.bi, route.bj);
      car.route = { ai: route.bi, aj: route.bj, bi: ni, bj: nj };
      return;
    }
    const want = Math.atan2(target.y - car.y, target.x - car.x);
    const delta = angleDelta(car.angle, want);
    const steer = clamp(delta * 2.4, -1, 1);
    let throttle = car.cruise;
    if (Math.abs(delta) > 0.45) throttle = 0.28;

    const blocker = obstacleAhead(car, S);
    if (blocker) {
      const sp = speedOf(car);
      throttle = sp > 30 ? -0.7 : 0;
      if (sp < 8 && car.honkCd <= 0 && distance(car.x, car.y, S.player.x, S.player.y) < 520) {
        S.audio.honk();
        car.honkCd = S.rng.range(1.6, 3.4);
      }
    }
    const impact = stepCar(car, { throttle, steer, handbrake: false }, dt, S.city, S.effects);
    if (impact > 90 && distance(car.x, car.y, S.player.x, S.player.y) < 600) {
      S.audio.crash(0.5);
    }
  }

  // Quietly recycle any car that has wandered to the far side of the city.
  function recycleFarCars(S) {
    for (const car of drivers) {
      const d = distance(car.x, car.y, S.player.x, S.player.y);
      if (d <= 1500) continue;
      const node = S.city.nearestIntersection(S.player.x + S.rng.range(-900, 900), S.player.y + S.rng.range(-900, 900));
      const [ni, nj] = pickNext(S.city, S.rng, node.i, node.j, node.i, node.j);
      car.x = node.x;
      car.y = node.y;
      car.vx = 0;
      car.vy = 0;
      car.hp = 100;
      car.wrecked = false;
      car.route = { ai: ni, aj: nj, bi: node.i, bj: node.j };
      const target = lanePoint(S.city, ni, nj, node.i, node.j);
      car.angle = Math.atan2(target.y - node.y, target.x - node.x);
    }
  }

  return {
    drivers,
    update(dt, S) {
      for (const car of drivers) driveCar(car, dt, S);
      // Keep the streets around the player populated.
      this.recycleT = (this.recycleT || 0) - dt;
      if (this.recycleT <= 0) {
        this.recycleT = 2.5;
        recycleFarCars(S);
      }
    },
  };
}
