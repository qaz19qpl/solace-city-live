// city.js — builds Solace City from a fixed seed: a grid of avenues, five
// districts of pastel blocks, a marina with a pier, and La Brisa beach
// running down the east edge to an animated sea. Also owns every spatial
// question the other systems ask: what is road, what is solid, what is
// water, and whether two points can see each other.

import { RNG, clamp } from './random.js';

export const ROAD_W = 116;
const PITCH = 396;
const VX = [170, 566, 962, 1358, 1754, 2150]; // vertical avenue centres
const HY = [170, 566, 962, 1358, 1754]; // horizontal street centres
export const WORLD_W = 2900;
export const WORLD_H = 1980;
const SAND_X = 2268;
const SEA_X = 2540;

const ROOF_COLORS = [
  '#e8b4a0', '#f2d5a7', '#dfe8ee', '#f6e7c8', '#e6a58e', '#cfe3d8',
  '#f4c6c6', '#dce9f7', '#efe3b8', '#d9c8e8', '#f9e2ae', '#c8dde6',
];
const TRIM_COLORS = ['#b8543f', '#2e7f86', '#d9a441', '#46689c', '#7a9e43', '#a04a72'];

const BUILDING_NAMES = [
  'Hotel Marisol', 'La Brisa Café', 'Sol&Co Bank', 'TideMart', 'Coral Clinic',
  'Faro Nightclub', 'Palmera Mall', 'Dockside Diner', 'Sunbyte Arcade',
  'Marina Motors', 'Casa Azul', 'The Salty Anchor', 'Palm Court Apts',
  'Solace City Hall', 'Biblioteca Sol', 'Mercado Central', 'Torre Brisa',
  'Condos Alamar', 'Seabreeze Laundry', 'Oficina Postal', 'Tidepool Gym',
  'Solace Pharmacy', 'Bar El Faro', 'Marina Chandlery', 'Sunset Records',
  'Clínica Coral', 'Hotel Brisa Alta', 'Panadería Sol', 'Banco del Puerto',
  'Cine Coral', 'Florería Alba', 'Taller Hermanos Ruiz', 'Hotel Dunas',
  'Café Miramar', 'Joyas del Mar', 'Puerto Suites', 'La Ola Books',
  'Gimnasio Faro', 'Droguería Sol', 'Teatro Brisa',
];

const DISTRICTS = [
  { name: 'Old Port', x: 0, y: 0, w: 962, h: 962 },
  { name: 'Coral Heights', x: 962, y: 0, w: 792, h: 566 },
  { name: 'Marina Bay', x: 1754, y: 0, w: 514, h: 962 },
  { name: 'Downtown Solace', x: 962, y: 566, w: 792, h: 792 },
  { name: 'South Yards', x: 0, y: 962, w: 962, h: 1018 },
  { name: 'Palm District', x: 962, y: 1358, w: 1306, h: 622 },
  { name: 'La Brisa Beach', x: 2268, y: 0, w: 632, h: 1980 },
];

export function buildCity(seed = 20261118) {
  const rng = new RNG(seed);
  const buildings = [];
  const parks = [];
  const lots = [];
  const palms = [];
  const parkedSpots = [];
  const sidewalkPoints = [];
  const usedNames = new Set();

  function nextName() {
    for (let tries = 0; tries < 12; tries++) {
      const name = BUILDING_NAMES[rng.int(0, BUILDING_NAMES.length - 1)];
      if (!usedNames.has(name)) {
        usedNames.add(name);
        return name;
      }
    }
    return null;
  }

  function addBuilding(x, y, w, h, named = true) {
    const b = {
      x, y, w, h,
      roof: rng.pick(ROOF_COLORS),
      trim: rng.pick(TRIM_COLORS),
      name: named && rng.chance(0.72) ? nextName() : null,
      floors: rng.int(2, 9),
    };
    buildings.push(b);
    return b;
  }

  function ringPoints(rect, step = 74) {
    for (let x = rect.x + 8; x < rect.x + rect.w - 4; x += step) {
      sidewalkPoints.push({ x, y: rect.y + 7 });
      sidewalkPoints.push({ x, y: rect.y + rect.h - 7 });
    }
    for (let y = rect.y + 8; y < rect.y + rect.h - 4; y += step) {
      sidewalkPoints.push({ x: rect.x + 7, y });
      sidewalkPoints.push({ x: rect.x + rect.w - 7, y });
    }
  }

  // The twenty city blocks between the avenues.
  for (let i = 0; i < VX.length - 1; i++) {
    for (let j = 0; j < HY.length - 1; j++) {
      const bx = VX[i] + ROAD_W / 2;
      const by = HY[j] + ROAD_W / 2;
      const block = { x: bx, y: by, w: PITCH - ROAD_W, h: PITCH - ROAD_W };
      ringPoints(block);

      const isMarinaYard = i === 4 && (j === 1 || j === 3);
      const isOldPort = i === 0 && j === 0;
      let pattern;
      if (isMarinaYard) pattern = 'warehouse';
      else if (isOldPort) pattern = 'warehouse';
      else {
        const roll = rng.next();
        pattern = roll < 0.42 ? 'quad' : roll < 0.62 ? 'tower' : roll < 0.78 ? 'shops' : roll < 0.89 ? 'park' : 'lot';
      }

      const inner = { x: bx + 16, y: by + 16, w: block.w - 32, h: block.h - 32 };
      if (pattern === 'quad') {
        const qw = (inner.w - 36) / 3;
        const qh = (inner.h - 24) / 2;
        for (let cx = 0; cx < 3; cx++) {
          for (let cy = 0; cy < 2; cy++) {
            addBuilding(inner.x + cx * (qw + 18), inner.y + cy * (qh + 24), qw, qh);
          }
        }
      } else if (pattern === 'tower') {
        addBuilding(inner.x + 12, inner.y + 8, inner.w - 128, inner.h - 90);
        addBuilding(inner.x + 12, inner.y + inner.h - 66, inner.w - 128, 58);
        const lot = { x: inner.x + inner.w - 78, y: inner.y + 8, w: 66, h: inner.h - 16 };
        lots.push(lot);
        for (let k = 0; k < 3; k++) {
          parkedSpots.push({ x: lot.x + 33, y: lot.y + 34 + k * 76, angle: Math.PI / 2 });
        }
      } else if (pattern === 'shops') {
        const sw = (inner.w - 20) / 2;
        addBuilding(inner.x, inner.y, sw, 88);
        addBuilding(inner.x + sw + 20, inner.y, sw, 88);
        addBuilding(inner.x, inner.y + inner.h - 88, sw, 88);
        addBuilding(inner.x + sw + 20, inner.y + inner.h - 88, sw, 88);
        const lot = { x: inner.x + 30, y: inner.y + 106, w: inner.w - 60, h: inner.h - 212 };
        lots.push(lot);
        for (let k = 0; k < 3; k++) {
          parkedSpots.push({ x: lot.x + 40 + k * 74, y: lot.y + lot.h / 2, angle: 0 });
        }
      } else if (pattern === 'park') {
        parks.push({ ...inner });
        for (let k = 0; k < 7; k++) {
          const p = rng.pointIn(inner, 26);
          palms.push({ x: p.x, y: p.y, s: rng.range(0.8, 1.25) });
        }
      } else if (pattern === 'lot') {
        addBuilding(inner.x, inner.y, 74, 54, false); // the lot attendant's hut
        lots.push({ ...inner });
        for (let r = 0; r < 2; r++) {
          for (let k = 0; k < 4; k++) {
            if (rng.chance(0.72)) {
              parkedSpots.push({ x: inner.x + 38 + k * 62, y: inner.y + 52 + r * 130, angle: Math.PI / 2 });
            }
          }
        }
      } else if (pattern === 'warehouse') {
        addBuilding(inner.x, inner.y, inner.w - 70, 84, false);
        addBuilding(inner.x, inner.y + inner.h - 84, inner.w - 70, 84, false);
        buildings[buildings.length - 2].name = j === 3 && i === 4 ? 'Pier 9 Freight' : 'Almacén del Puerto';
        buildings[buildings.length - 1].name = null;
        const yard = { x: inner.x + inner.w - 58, y: inner.y, w: 58, h: inner.h };
        lots.push(yard);
        parkedSpots.push({ x: yard.x + 29, y: yard.y + 60, angle: Math.PI / 2 });
        parkedSpots.push({ x: yard.x + 29, y: yard.y + 190, angle: Math.PI / 2 });
      }
    }
  }

  // Beach kiosks on the sand: churros, boards, bait, ice cream.
  const KIOSK_NAMES = ['Churros La Ola', 'Tablas Surf Rental', 'Helados Brisa', 'Bait & Tackle Sol', 'Jugos Tropicales', 'Sombra Beach Goods'];
  for (let k = 0; k < 6; k++) {
    const kb = addBuilding(2306, 130 + k * 310, 52, 36, false);
    kb.name = KIOSK_NAMES[k];
    kb.floors = 1;
  }

  // Street parking along a few avenue shoulders.
  for (let k = 0; k < 9; k++) {
    const roadY = HY[k % HY.length];
    parkedSpots.push({ x: 320 + k * 235, y: roadY + ROAD_W / 2 - 15, angle: 0 });
  }

  // Palms down the beach promenade and scattered on corners.
  for (let y = 60; y < WORLD_H - 40; y += 92) {
    palms.push({ x: 2236, y: y + rng.range(-8, 8), s: rng.range(0.9, 1.3) });
  }
  for (let k = 0; k < 26; k++) {
    const bx = rng.pick(VX) + (rng.chance(0.5) ? ROAD_W / 2 + 10 : -ROAD_W / 2 - 10);
    const by = rng.pick(HY) + rng.range(-160, 160);
    if (bx < SAND_X - 30) palms.push({ x: bx, y: clamp(by, 20, WORLD_H - 20), s: rng.range(0.75, 1.1) });
  }

  const pier = { x: SEA_X, y: 596, w: 330, h: 54 };
  const fingers = [
    { x: SEA_X + 60, y: 520, w: 26, h: 76 },
    { x: SEA_X + 60, y: 650, w: 26, h: 76 },
    { x: SEA_X + 210, y: 520, w: 26, h: 76 },
    { x: SEA_X + 210, y: 650, w: 26, h: 76 },
  ];

  const city = {
    W: WORLD_W,
    H: WORLD_H,
    vx: VX,
    hy: HY,
    roadW: ROAD_W,
    sandX: SAND_X,
    seaX: SEA_X,
    buildings,
    parks,
    lots,
    palms,
    parkedSpots,
    sidewalkPoints,
    districts: DISTRICTS,
    pier,
    fingers,

    isRoad(x, y) {
      if (x >= SAND_X) return false;
      for (const cx of VX) if (Math.abs(x - cx) <= ROAD_W / 2) return true;
      for (const cy of HY) if (Math.abs(y - cy) <= ROAD_W / 2) return true;
      return false;
    },

    onPier(x, y) {
      if (x >= pier.x && x <= pier.x + pier.w && y >= pier.y && y <= pier.y + pier.h) return true;
      for (const f of fingers) {
        if (x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h) return true;
      }
      return false;
    },

    isWater(x, y) {
      return x >= SEA_X && !this.onPier(x, y);
    },

    isSand(x, y) {
      return x >= SAND_X && x < SEA_X;
    },

    buildingAt(x, y) {
      for (const b of buildings) {
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
      }
      return null;
    },

    // Push a circle out of every building, the sea and the world edge.
    // Returns true when the circle had to be moved.
    collideCircle(pos, r) {
      let hit = false;
      for (const b of buildings) {
        const nx = clamp(pos.x, b.x, b.x + b.w);
        const ny = clamp(pos.y, b.y, b.y + b.h);
        const dx = pos.x - nx;
        const dy = pos.y - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 < r * r) {
          hit = true;
          if (d2 > 0.0001) {
            const d = Math.sqrt(d2);
            pos.x = nx + (dx / d) * r;
            pos.y = ny + (dy / d) * r;
          } else {
            // Centre inside the box: leave by the shortest side.
            const left = pos.x - b.x;
            const right = b.x + b.w - pos.x;
            const top = pos.y - b.y;
            const bottom = b.y + b.h - pos.y;
            const m = Math.min(left, right, top, bottom);
            if (m === left) pos.x = b.x - r;
            else if (m === right) pos.x = b.x + b.w + r;
            else if (m === top) pos.y = b.y - r;
            else pos.y = b.y + b.h + r;
          }
        }
      }
      if (pos.x < r) { pos.x = r; hit = true; }
      if (pos.y < r) { pos.y = r; hit = true; }
      if (pos.y > WORLD_H - r) { pos.y = WORLD_H - r; hit = true; }
      if (pos.x > WORLD_W - r) { pos.x = WORLD_W - r; hit = true; }
      // The sea is a wall unless you are standing on the pier.
      if (pos.x + r > SEA_X && !this.onPier(pos.x, pos.y)) {
        if (pos.x < SEA_X + 60) { pos.x = SEA_X - r; hit = true; }
      }
      return hit;
    },

    // Buildings block sight; sample the segment in short steps.
    losClear(x1, y1, x2, y2) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const steps = Math.max(1, Math.floor(len / 26));
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        if (this.buildingAt(x1 + dx * t, y1 + dy * t)) return false;
      }
      return true;
    },

    nearestIntersection(x, y) {
      let best = null;
      let bestD = Infinity;
      for (let i = 0; i < VX.length; i++) {
        for (let j = 0; j < HY.length; j++) {
          const dx = VX[i] - x;
          const dy = HY[j] - y;
          const d = dx * dx + dy * dy;
          if (d < bestD) {
            bestD = d;
            best = { i, j, x: VX[i], y: HY[j] };
          }
        }
      }
      return best;
    },

    intersection(i, j) {
      return { x: VX[i], y: HY[j] };
    },

    districtAt(x, y) {
      for (const d of DISTRICTS) {
        if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
      }
      return 'Solace City';
    },
  };

  return city;
}
