// render.js — draws Solace City.
//
// The city itself never changes, so the ground, roads, parks, lots,
// rooftops and palm trunks are painted once into an offscreen layer at
// boot and blitted each frame. Only the living things are drawn live:
// the glittering sea, the boats, the swaying fronds, the cars, the people
// and the effects. The camera transform is applied by main.js; this file
// works purely in world coordinates and culls to the visible rectangle.

import { RNG } from './random.js';

// Decoration that must not flicker: sea sparkles, beach umbrellas, boats.
const sparkles = [];
const umbrellas = [];
const boats = [];
{
  const rng = new RNG(777);
  for (let i = 0; i < 130; i++) {
    sparkles.push({ x: 2560 + rng.range(0, 320), y: rng.range(10, 1960), p: rng.range(0, 6) });
  }
  for (let i = 0; i < 9; i++) {
    umbrellas.push({ x: 2330 + rng.range(0, 150), y: 120 + i * 210 + rng.range(-40, 40), c: rng.pick(['#e4572e', '#2e86ab', '#f2c14e', '#e88ca0']) });
  }
  for (let i = 0; i < 4; i++) {
    boats.push({ x: 2660 + rng.range(0, 180), y: 240 + i * 430 + rng.range(-60, 60), c: rng.pick(['#f4f1ea', '#d95f4b', '#5b8dd9']) });
  }
}

// A rounded-rectangle path (fill or stroke it after calling this).
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paintBlockAprons(g, city) {
  for (let i = 0; i < city.vx.length - 1; i++) {
    for (let j = 0; j < city.hy.length - 1; j++) {
      const bx = city.vx[i] + city.roadW / 2;
      const by = city.hy[j] + city.roadW / 2;
      g.fillStyle = '#cfc7b4';
      g.fillRect(bx, by, 280, 280);
      g.fillStyle = '#b7ad97';
      g.fillRect(bx + 14, by + 14, 252, 252);
    }
  }
}

function paintParks(g, city) {
  for (const park of city.parks) {
    g.fillStyle = '#8cbb60';
    g.fillRect(park.x - 14, park.y - 14, park.w + 28, park.h + 28);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let x = park.x - 14; x < park.x + park.w + 14; x += 36) {
      g.fillRect(x, park.y - 14, 18, park.h + 28);
    }
  }
}

function paintLots(g, city) {
  for (const lot of city.lots) {
    g.fillStyle = '#8f9296';
    g.fillRect(lot.x, lot.y, lot.w, lot.h);
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.lineWidth = 2;
    for (let x = lot.x + 10; x < lot.x + lot.w - 8; x += 26) {
      g.beginPath();
      g.moveTo(x, lot.y + 6);
      g.lineTo(x, lot.y + lot.h - 6);
      g.stroke();
    }
  }
}

function paintAvenues(g, city) {
  // Sidewalk shoulder first, asphalt on top.
  g.fillStyle = '#d8d0ba';
  for (const x of city.vx) g.fillRect(x - city.roadW / 2 - 7, 0, city.roadW + 14, city.H);
  for (const y of city.hy) g.fillRect(0, y - city.roadW / 2 - 7, city.sandX, city.roadW + 14);
  g.fillStyle = '#41454c';
  for (const x of city.vx) g.fillRect(x - city.roadW / 2, 0, city.roadW, city.H);
  for (const y of city.hy) g.fillRect(0, y - city.roadW / 2, city.sandX, city.roadW);

  // The promenade between the last avenue and the sand.
  g.fillStyle = '#e3d9c2';
  g.fillRect(2208, 0, 60, city.H);

  // Lane dashes.
  g.strokeStyle = '#f5d76e';
  g.lineWidth = 3;
  g.setLineDash([22, 18]);
  for (const x of city.vx) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, city.H);
    g.stroke();
  }
  for (const y of city.hy) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(city.sandX, y);
    g.stroke();
  }
  g.setLineDash([]);

  // Crosswalks at every intersection.
  g.fillStyle = 'rgba(240,240,235,0.75)';
  for (const x of city.vx) {
    for (const y of city.hy) {
      for (let s = -2; s <= 2; s++) {
        g.fillRect(x - city.roadW / 2 - 12, y + s * 20 - 5, 8, 10);
        g.fillRect(x + city.roadW / 2 + 4, y + s * 20 - 5, 8, 10);
        g.fillRect(x + s * 20 - 5, y - city.roadW / 2 - 12, 10, 8);
        g.fillRect(x + s * 20 - 5, y + city.roadW / 2 + 4, 10, 8);
      }
    }
  }
}

function paintShore(g, city) {
  g.fillStyle = '#eed9a0';
  g.fillRect(city.sandX, 0, city.seaX - city.sandX, city.H);
  const seaGrad = g.createLinearGradient(city.seaX, 0, city.W, 0);
  seaGrad.addColorStop(0, '#3fb6cf');
  seaGrad.addColorStop(1, '#1f7fa8');
  g.fillStyle = seaGrad;
  g.fillRect(city.seaX, 0, city.W - city.seaX, city.H);

  // The marina pier.
  g.fillStyle = '#9a7c55';
  g.fillRect(city.pier.x, city.pier.y, city.pier.w, city.pier.h);
  for (const f of city.fingers) g.fillRect(f.x, f.y, f.w, f.h);
  g.strokeStyle = 'rgba(70,50,25,0.5)';
  g.lineWidth = 2;
  for (let x = city.pier.x + 12; x < city.pier.x + city.pier.w; x += 24) {
    g.beginPath();
    g.moveTo(x, city.pier.y);
    g.lineTo(x, city.pier.y + city.pier.h);
    g.stroke();
  }
}

function paintBuildings(g, city) {
  for (const b of city.buildings) {
    // Sun from the north-west: shadows fall south-east.
    g.fillStyle = 'rgba(40,35,20,0.28)';
    g.fillRect(b.x + 9, b.y + 12, b.w, b.h);
    g.fillStyle = b.roof;
    g.fillRect(b.x, b.y, b.w, b.h);
    g.strokeStyle = b.trim;
    g.lineWidth = 3;
    g.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3);
    g.strokeStyle = 'rgba(60,50,40,0.25)';
    g.lineWidth = 1.5;
    g.strokeRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
    // Roof clutter: AC boxes, seeded by position so they never flicker.
    g.fillStyle = 'rgba(90,90,90,0.35)';
    const units = 1 + ((b.x * 7 + b.y * 13) % 3);
    for (let k = 0; k < units; k++) {
      const ax = b.x + 16 + ((b.x + k * 53) % Math.max(20, b.w - 40));
      const ay = b.y + 16 + ((b.y + k * 37) % Math.max(20, b.h - 40));
      g.fillRect(ax, ay, 12, 9);
    }
    if (b.name && b.w > 92) {
      g.fillStyle = b.trim;
      g.fillRect(b.x, b.y, b.w, 17);
      g.fillStyle = '#ffffff';
      g.font = '700 10.5px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText(b.name.toUpperCase(), b.x + b.w / 2, b.y + 12.5);
    }
  }
}

function paintPalmTrunks(g, city) {
  g.strokeStyle = '#8a6f4d';
  g.lineWidth = 3;
  for (const palm of city.palms) {
    g.beginPath();
    g.moveTo(palm.x - 3, palm.y + 3);
    g.lineTo(palm.x, palm.y);
    g.stroke();
  }
}

// Paint the whole static city once. Called lazily on the first frame.
function buildStaticLayer(city) {
  const layer = document.createElement('canvas');
  layer.width = city.W;
  layer.height = city.H;
  const g = layer.getContext('2d');
  g.fillStyle = '#79a84f';
  g.fillRect(0, 0, city.W, city.H);
  paintBlockAprons(g, city);
  paintParks(g, city);
  paintLots(g, city);
  paintAvenues(g, city);
  paintShore(g, city);
  paintBuildings(g, city);
  paintPalmTrunks(g, city);
  return layer;
}

let staticLayer = null;
let staticFor = null;

function drawStatic(ctx, S, view) {
  if (staticFor !== S.city) {
    staticLayer = buildStaticLayer(S.city);
    staticFor = S.city;
  }
  ctx.drawImage(staticLayer, view.x, view.y, view.w, view.h, view.x, view.y, view.w, view.h);
}

// The animated sea: glitter, umbrellas, boats at anchor.
function drawSeaLife(ctx, S) {
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  for (const sp of sparkles) {
    const alpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(S.time * 1.7 + sp.p));
    ctx.globalAlpha = alpha;
    const wob = Math.sin(S.time * 0.9 + sp.p) * 4;
    ctx.beginPath();
    ctx.moveTo(sp.x + wob, sp.y);
    ctx.lineTo(sp.x + wob + 12, sp.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const u of umbrellas) {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(u.x + 4, u.y + 5, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = u.c;
    ctx.beginPath();
    ctx.arc(u.x, u.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.arc(u.x, u.y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const b of boats) {
    const bob = Math.sin(S.time * 1.3 + b.y) * 2.5;
    ctx.save();
    ctx.translate(b.x, b.y + bob);
    ctx.fillStyle = b.c;
    rr(ctx, -20, -7, 40, 14, 6);
    ctx.fill();
    ctx.fillStyle = '#8a6f4d';
    ctx.fillRect(-1, -20, 2, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(2, -19);
    ctx.lineTo(2, -6);
    ctx.lineTo(13, -6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawPalmFronds(ctx, S) {
  for (const palm of S.city.palms) {
    ctx.strokeStyle = 'rgba(46,125,50,0.9)';
    ctx.lineWidth = 2.6;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + palm.x * 0.01;
      const sway = Math.sin(S.time * 1.4 + palm.x + k) * 1.6;
      ctx.beginPath();
      ctx.moveTo(palm.x, palm.y);
      ctx.quadraticCurveTo(
        palm.x + Math.cos(a) * 11 * palm.s,
        palm.y + Math.sin(a) * 11 * palm.s - 3,
        palm.x + Math.cos(a) * 17 * palm.s + sway,
        palm.y + Math.sin(a) * 15 * palm.s + 3,
      );
      ctx.stroke();
    }
    ctx.fillStyle = '#6d4c2f';
    ctx.beginPath();
    ctx.arc(palm.x, palm.y, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawCar(ctx, car, S) {
  const model = car.model;
  ctx.save();
  ctx.translate(car.x, car.y);
  // Shadow.
  ctx.fillStyle = 'rgba(30,28,18,0.3)';
  rr(ctx, -car.len / 2 + 4, -car.wid / 2 + 5, car.len, car.wid, 7);
  ctx.fill();
  ctx.rotate(car.angle);
  // Wheels.
  ctx.fillStyle = '#17181a';
  const wx = car.len * 0.31;
  const wy = car.wid * 0.5 - 2;
  for (const [x, y] of [[wx, -wy], [wx, wy], [-wx, -wy], [-wx, wy]]) {
    rr(ctx, x - 5, y - 2.5, 10, 5, 2);
    ctx.fill();
  }
  // Body.
  ctx.fillStyle = car.wrecked ? '#3c3a38' : car.color;
  rr(ctx, -car.len / 2, -car.wid / 2, car.len, car.wid, 6);
  ctx.fill();
  if (model === 6) {
    // Interceptor livery: white doors under the black.
    ctx.fillStyle = '#eef1f4';
    rr(ctx, -car.len * 0.18, -car.wid / 2 + 1, car.len * 0.36, car.wid - 2, 4);
    ctx.fill();
  }
  if (model === 5) {
    ctx.fillStyle = '#221f1a';
    rr(ctx, -6, -5, 12, 10, 2);
    ctx.fill();
    ctx.fillStyle = '#f7b731';
    ctx.font = '700 7px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 2.5);
  }
  // Cabin: windscreen, roof, rear window.
  ctx.fillStyle = 'rgba(24,34,44,0.9)';
  rr(ctx, car.len * 0.08, -car.wid * 0.36, car.len * 0.13, car.wid * 0.72, 3);
  ctx.fill();
  ctx.fillStyle = car.wrecked ? '#4a4744' : car.color;
  rr(ctx, -car.len * 0.16, -car.wid * 0.38, car.len * 0.22, car.wid * 0.76, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(24,34,44,0.85)';
  rr(ctx, -car.len * 0.27, -car.wid * 0.34, car.len * 0.09, car.wid * 0.68, 3);
  ctx.fill();
  // A passenger's head, when the story has one riding along.
  if (S.passenger && S.player.car === car) {
    ctx.fillStyle = '#d9a066';
    ctx.beginPath();
    ctx.arc(-car.len * 0.05, -car.wid * 0.18, 3.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Lights.
  ctx.fillStyle = '#fff6c9';
  ctx.fillRect(car.len / 2 - 2, -car.wid * 0.32, 2.5, 4);
  ctx.fillRect(car.len / 2 - 2, car.wid * 0.32 - 4, 2.5, 4);
  ctx.fillStyle = '#d23b2e';
  ctx.fillRect(-car.len / 2 - 0.5, -car.wid * 0.32, 2.5, 4);
  ctx.fillRect(-car.len / 2 - 0.5, car.wid * 0.32 - 4, 2.5, 4);
  if (model === 6) {
    const phase = Math.floor(car.flashT * 5) % 2;
    ctx.fillStyle = phase ? '#ff4040' : '#ffd0d0';
    ctx.fillRect(-5, -car.wid * 0.26, 10, 4.4);
    ctx.fillStyle = phase ? '#cfe4ff' : '#3f7fff';
    ctx.fillRect(-5, car.wid * 0.26 - 4.4, 10, 4.4);
  }
  if (car.wrecked) {
    ctx.fillStyle = 'rgba(20,20,20,0.35)';
    rr(ctx, -car.len / 2, -car.wid / 2, car.len, car.wid, 6);
    ctx.fill();
  }
  ctx.restore();
  // A dying car smokes from the bonnet.
  if (car.hp < 32 && !car.wrecked && Math.random() < 0.25) {
    S.effects.smoke(car.x + Math.cos(car.angle) * car.len * 0.4, car.y + Math.sin(car.angle) * car.len * 0.4);
  }
}

export function drawPerson(ctx, person, S) {
  const down = person.state === 'down' || person.state === 'dead';
  ctx.save();
  ctx.translate(person.x, person.y);
  ctx.fillStyle = 'rgba(30,28,18,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 3, down ? 13 : 8, down ? 6 : 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(person.angle + Math.PI / 2);
  if (down) {
    ctx.rotate(Math.PI / 2.3);
    ctx.fillStyle = person.shirt;
    rr(ctx, -11, -5, 22, 10, 5);
    ctx.fill();
    ctx.fillStyle = person.skin;
    ctx.beginPath();
    ctx.arc(13, 0, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  // Legs scissor while moving.
  const stride = person.speed > 4 ? Math.sin(person.walkPhase || 0) * 4 : 0;
  ctx.strokeStyle = person.pants;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-3, 6 + stride);
  ctx.moveTo(0, 0);
  ctx.lineTo(3, 6 - stride);
  ctx.stroke();
  // Body and head.
  ctx.fillStyle = person.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = person.skin;
  ctx.beginPath();
  ctx.arc(0, -1.5, 4.3, 0, Math.PI * 2);
  ctx.fill();
  if (person.kind === 'cop') {
    // Cap and brim.
    ctx.fillStyle = '#16263f';
    ctx.beginPath();
    ctx.arc(0, -1.5, 4.6, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-5.5, -2.4, 11, 2);
  }
  if (person.role === 'guard' || (person.kind === 'player' && S.player.hasPistol)) {
    ctx.strokeStyle = '#26261f';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(4, 2);
    ctx.lineTo(14, -2);
    ctx.stroke();
  }
  ctx.restore();

  // Floating labels for the people the story cares about.
  if (person.role === 'contact') {
    const bob = Math.sin(S.time * 3.2) * 3;
    ctx.fillStyle = '#ffd94d';
    ctx.strokeStyle = 'rgba(30,22,0,0.8)';
    ctx.font = '900 19px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeText('!', person.x, person.y - 24 + bob);
    ctx.fillText('!', person.x, person.y - 24 + bob);
  }
  if ((person.role === 'contact' || person.role === 'mission' || person.role === 'debtor') && person.name) {
    ctx.font = '700 11.5px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(15,15,10,0.55)';
    const labelW = ctx.measureText(person.name).width + 10;
    rr(ctx, person.x - labelW / 2, person.y - 40, labelW, 15, 4);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(person.name, person.x, person.y - 28.5);
  }
}

function drawPickups(ctx, S) {
  for (const pk of S.pickups) {
    const bob = Math.sin(pk.bobT) * 2.5;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,30,30,0.35)';
    ctx.stroke();
    if (pk.kind === 'health') {
      ctx.fillStyle = '#e23b30';
      ctx.fillRect(-2, -6, 4, 12);
      ctx.fillRect(-6, -2, 12, 4);
    } else if (pk.kind === 'armour') {
      ctx.fillStyle = '#3f7fbf';
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(6, -4);
      ctx.lineTo(6, 2);
      ctx.quadraticCurveTo(6, 7, 0, 8);
      ctx.quadraticCurveTo(-6, 7, -6, 2);
      ctx.lineTo(-6, -4);
      ctx.closePath();
      ctx.fill();
    } else if (pk.kind === 'ammo') {
      ctx.fillStyle = '#7a5c22';
      ctx.fillRect(-6, -4, 12, 8);
      ctx.fillStyle = '#ffd94d';
      ctx.fillRect(-6, -4, 12, 3);
    } else if (pk.kind === 'cash') {
      ctx.fillStyle = '#58a34c';
      ctx.fillRect(-7, -4, 14, 8);
      ctx.fillStyle = '#e8f5d8';
      ctx.font = '800 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', 0, 3);
    }
    ctx.restore();
  }
  // The mission package, pulsing gold on the ground.
  if (S.missionItem) {
    const it = S.missionItem;
    const pulse = 0.6 + 0.4 * Math.sin(S.time * 5);
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#8a6f4d';
    ctx.fillRect(-8, -8, 16, 16);
    ctx.strokeStyle = '#5d4a30';
    ctx.strokeRect(-8, -8, 16, 16);
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 8);
    ctx.stroke();
    ctx.restore();
  }
}

// The tall gold beacon over the current objective.
function drawTargetBeacon(ctx, S) {
  const target = S.missions.currentTarget();
  if (!target || S.mode !== 'play') return;
  const pulse = 0.5 + 0.5 * Math.sin(S.time * 4);
  ctx.save();
  ctx.globalAlpha = 0.1 + pulse * 0.1;
  ctx.fillStyle = '#ffd94d';
  ctx.fillRect(target.x - 7, target.y - 340, 14, 340);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#ffd94d';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(target.x, target.y, 20 + pulse * 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawWorld(ctx, S, view) {
  drawStatic(ctx, S, view);
  drawSeaLife(ctx, S);
  S.effects.drawSkids(ctx);
  drawPickups(ctx, S);
  drawTargetBeacon(ctx, S);

  for (const car of S.cars) {
    if (car.x < view.x - 80 || car.y < view.y - 80 || car.x > view.x + view.w + 80 || car.y > view.y + view.h + 80) continue;
    drawCar(ctx, car, S);
  }
  for (const ped of S.peds) drawPerson(ctx, ped, S);
  for (const cop of S.cops) drawPerson(ctx, cop, S);
  if (!S.player.car) drawPerson(ctx, S.playerView, S);

  // Bullets as short bright tracers.
  ctx.strokeStyle = '#ffe9a3';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (const b of S.bullets) {
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
  }
  ctx.stroke();

  drawPalmFronds(ctx, S);
  S.effects.drawParticles(ctx);
  S.effects.drawTexts(ctx);
}
