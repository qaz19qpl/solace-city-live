// random.js — the shared dice and geometry kit.
//
// Solace City is generated from one fixed seed, so the streets, the
// rooftops and the palms are the same on every visit and every screenshot.
// Everything below is deterministic except the particle layer, which is
// allowed to be noisy. The modules import from here instead of reinventing
// clamps and angle wraps in five places.
//
// Two families live here: pure geometry helpers (clamp, lerp, distance,
// the angle family) and the RNG class — mulberry32, a tiny seeded
// generator with a long period and no surprises. The city builder, the
// traffic spawner and the crowd each draw from their own instance, so
// changing one system's appetite never shifts another's.

export const TAU = Math.PI * 2;

// Fold `value` into [lo, hi].
export function clamp(value, lo, hi) {
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

// Straight-line blend between two numbers.
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Euclidean distance between two points.
export function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.hypot(dx, dy);
}

// Heading from (x1, y1) toward (x2, y2), in screen radians (y down).
export function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

// Wrap a raw angle difference into (-PI, PI].
function wrapDelta(d) {
  if (d > Math.PI) return d - TAU;
  if (d < -Math.PI) return d + TAU;
  return d;
}

// Shortest signed rotation from `from` to `to`, wrapped into (-PI, PI].
export function angleDelta(from, to) {
  return wrapDelta((to - from) % TAU);
}

// Move `angle` toward `target` by at most `maxStep` radians.
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

  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let mix = this.state;
    mix = Math.imul(mix ^ (mix >>> 15), mix | 1);
    mix ^= mix + Math.imul(mix ^ (mix >>> 7), mix | 61);
    return ((mix ^ (mix >>> 14)) >>> 0) / 4294967296;
  }

  // Float in [lo, hi).
  range(lo, hi) {
    return lo + this.next() * (hi - lo);
  }

  // Integer in [lo, hi], both ends inclusive.
  int(lo, hi) {
    return Math.floor(this.range(lo, hi + 1));
  }

  // One element of a non-empty list, uniformly.
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }

  // True with probability `p` (0..1).
  chance(p) {
    return this.next() < p;
  }

  // A point scattered inside `rect`, kept `pad` away from its edges.
  pointIn(rect, pad = 0) {
    return {
      x: this.range(rect.x + pad, rect.x + rect.w - pad),
      y: this.range(rect.y + pad, rect.y + rect.h - pad),
    };
  }
}
