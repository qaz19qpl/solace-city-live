// random.js — a seeded random number generator plus the small math helpers
// the whole game shares. The city is built from a fixed seed so Solace City
// looks the same on every visit and in every screenshot.

export const TAU = Math.PI * 2;

export function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

// Shortest signed turn from one heading to another, in (-PI, PI].
export function angleDelta(from, to) {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function turnToward(angle, target, maxStep) {
  const d = angleDelta(angle, target);
  if (Math.abs(d) <= maxStep) return target;
  return angle + Math.sign(d) * maxStep;
}

export class RNG {
  constructor(seed) {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  // mulberry32: small, fast, good enough for palms and paint colours.
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(lo, hi) {
    return lo + this.next() * (hi - lo);
  }

  int(lo, hi) {
    return Math.floor(this.range(lo, hi + 1));
  }

  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  chance(p) {
    return this.next() < p;
  }

  // A point scattered inside a rectangle, kept off its edges by `pad`.
  pointIn(rect, pad = 0) {
    return {
      x: this.range(rect.x + pad, rect.x + rect.w - pad),
      y: this.range(rect.y + pad, rect.y + rect.h - pad),
    };
  }
}
