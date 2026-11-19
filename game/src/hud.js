// hud.js — everything drawn over the world.
//
// The live minimap, wanted stars, health and armour bars, the speedometer,
// mission banners, dialogue boxes, and the menus (title, pause, busted,
// wasted). Buttons register themselves into S.uiButtons as they draw, so
// main.js can click them. All coordinates are canvas pixels (1280x800).
//
// The pause menu also shows a small career card from S.stats, so a
// returning player can see what Dario has been up to.

import { clamp } from './random.js';

const VIEW_W = 1280;
const VIEW_H = 800;
const MAP_X = 16;
const MAP_Y = VIEW_H - 176;
const MAP_W = 232;
const MAP_H = 160;

// The minimap's static layer, painted once: grass, sand, sea, roads and
// rooftops, scaled to the minimap's size. Dots for the player, the police
// and the objective are drawn live on top of it each frame.
export function makeMinimapBase(city) {
  const c = document.createElement('canvas');
  c.width = MAP_W;
  c.height = MAP_H;
  const g = c.getContext('2d');
  const sx = c.width / city.W;
  const sy = c.height / city.H;
  g.fillStyle = '#6f9e4e';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#eed9a0';
  g.fillRect(city.sandX * sx, 0, (city.seaX - city.sandX) * sx, c.height);
  g.fillStyle = '#2fa8c8';
  g.fillRect(city.seaX * sx, 0, c.width - city.seaX * sx, c.height);
  g.fillStyle = '#43474e';
  for (const x of city.vx) g.fillRect((x - city.roadW / 2) * sx, 0, city.roadW * sx, c.height);
  for (const y of city.hy) g.fillRect(0, (y - city.roadW / 2) * sy, city.sandX * sx, city.roadW * sy);
  g.fillStyle = 'rgba(240,235,220,0.85)';
  for (const b of city.buildings) {
    g.fillRect(b.x * sx, b.y * sy, Math.max(1.5, b.w * sx), Math.max(1.5, b.h * sy));
  }
  return c;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// A dark glass panel with a thin light edge.
function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(12,18,24,0.62)';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// A horizontal meter: dark track, coloured fill, rounded ends.
function meter(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = '#3a3f45';
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = color;
    roundRect(ctx, x, y, w * clamp(frac, 0, 1), h, h / 2);
    ctx.fill();
  }
}

// A clickable menu button; registers itself for main.js's hit test.
function button(ctx, S, id, x, y, w, h, label, enabled = true) {
  ctx.fillStyle = enabled ? 'rgba(255,176,66,0.92)' : 'rgba(90,90,90,0.5)';
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.fillStyle = enabled ? '#22180a' : '#aaaaaa';
  ctx.font = '700 19px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
  if (enabled) S.uiButtons.push({ id, x, y, w, h });
}

function drawStars(ctx, x, y, stars, flash) {
  ctx.font = '26px system-ui, sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i < 5; i++) {
    const on = i < stars;
    ctx.fillStyle = on ? (flash ? '#ff5252' : '#ffd94d') : 'rgba(255,255,255,0.22)';
    ctx.fillText('★', x - (4 - i) * 30, y);
  }
}

function drawMinimap(ctx, S) {
  const x = MAP_X;
  const y = MAP_Y;
  const w = MAP_W;
  const h = MAP_H;
  ctx.save();
  roundRect(ctx, x, y, w, h, 10);
  ctx.clip();
  ctx.drawImage(S.minimapBase, x, y);
  const sx = w / S.city.W;
  const sy = h / S.city.H;
  const dot = (wx, wy, color, r = 3) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + wx * sx, y + wy * sy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const car of S.police.cars) {
    if (!car.wrecked) dot(car.x, car.y, Math.floor(S.time * 4) % 2 ? '#3fa9ff' : '#bfe3ff', 3);
  }
  for (const cop of S.cops) {
    if (cop.state === 'chase') dot(cop.x, cop.y, '#3fa9ff', 2.2);
  }
  const target = S.missions.currentTarget();
  if (target) {
    const pulse = 3.4 + Math.sin(S.time * 5) * 1.1;
    dot(target.x, target.y, '#ffd94d', pulse);
    dot(target.x, target.y, '#221a00', 1.4);
  }
  // Player arrow.
  const px = x + S.player.x * sx;
  const py = y + S.player.y * sy;
  ctx.translate(px, py);
  ctx.rotate(S.player.angle + Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111111';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4.4, 5);
  ctx.lineTo(-4.4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  roundRect(ctx, x, y, w, h, 10);
  ctx.stroke();
}

// A gold arrow at the screen edge pointing at an off-screen objective.
function drawObjectiveArrow(ctx, S) {
  const target = S.missions.currentTarget();
  if (!target) return;
  const dx = target.x - S.player.x;
  const dy = target.y - S.player.y;
  const distPx = Math.sqrt(dx * dx + dy * dy);
  const screenX = S.player.x - S.camera.x + VIEW_W / 2;
  const screenY = S.player.y - S.camera.y + VIEW_H / 2;
  const tx = target.x - S.camera.x + VIEW_W / 2;
  const ty = target.y - S.camera.y + VIEW_H / 2;
  if (tx > -20 && tx < VIEW_W + 20 && ty > -20 && ty < VIEW_H + 20) return; // visible already
  const ang = Math.atan2(ty - screenY, tx - screenX);
  const ex = clamp(screenX + Math.cos(ang) * 460, 46, VIEW_W - 46);
  const ey = clamp(screenY + Math.sin(ang) * 300, 60, VIEW_H - 60);
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(ang);
  ctx.fillStyle = '#ffd94d';
  ctx.strokeStyle = 'rgba(20,16,0,0.7)';
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-8, -9);
  ctx.lineTo(-8, 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(distPx / 10)}m`, ex, ey + 24);
}

function drawVitals(ctx, S) {
  const p = S.player;
  const bx = MAP_X;
  const by = MAP_Y - 40;
  ctx.fillStyle = 'rgba(12,18,24,0.62)';
  roundRect(ctx, bx, by, MAP_W, 32, 8);
  ctx.fill();
  meter(ctx, bx + 8, by + 6, MAP_W - 16, 8, p.hp / p.maxHp, p.hp > 30 ? '#e84c3d' : '#ff7a5c');
  if (p.armour > 0) meter(ctx, bx + 8, by + 19, MAP_W - 16, 7, p.armour / 100, '#7fc4e8');
  else meter(ctx, bx + 8, by + 19, MAP_W - 16, 7, 0, '#7fc4e8');
}

function drawTopRight(ctx, S) {
  const p = S.player;
  ctx.textAlign = 'right';
  ctx.font = '800 30px system-ui, sans-serif';
  ctx.fillStyle = '#8be26a';
  ctx.strokeStyle = 'rgba(10,20,8,0.6)';
  ctx.lineWidth = 4;
  const cashText = `$${S.cash}`;
  ctx.strokeText(cashText, VIEW_W - 18, 40);
  ctx.fillText(cashText, VIEW_W - 18, 40);
  const flash = S.wanted.bust > 0.05 && Math.floor(S.time * 6) % 2 === 0;
  drawStars(ctx, VIEW_W - 18, 78, S.wanted.stars, flash);
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  const weapon = p.car ? 'DRIVING' : p.hasPistol ? `PISTOL · ${p.ammo}` : 'FISTS';
  ctx.fillText(weapon, VIEW_W - 18, 104);
}

function drawObjective(ctx, S) {
  const objective = S.missions.objectiveText();
  panel(ctx, 16, 14, Math.min(560, 24 + objective.length * 8.4), 52);
  ctx.textAlign = 'left';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillStyle = '#ffd94d';
  ctx.fillText(S.activeDistrict.toUpperCase(), 28, 34);
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(objective, 28, 56);
  const M = S.missions.active;
  if (M && M.timer !== null && M.timer !== undefined) {
    const t = Math.max(0, M.timer);
    const label = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.fillStyle = t < 30 ? '#ff6b5c' : '#ffffff';
    ctx.fillText(label, 28, 84);
  }
}

function drawSpeedo(ctx, S) {
  const p = S.player;
  if (!p.car) return;
  const mph = Math.round(Math.abs(p.speedMag) * 0.16);
  ctx.textAlign = 'right';
  ctx.font = '800 40px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(10,10,10,0.55)';
  ctx.lineWidth = 5;
  ctx.strokeText(String(mph), VIEW_W - 52, VIEW_H - 22);
  ctx.fillText(String(mph), VIEW_W - 52, VIEW_H - 22);
  ctx.font = '700 14px system-ui, sans-serif';
  ctx.fillText('MPH', VIEW_W - 18, VIEW_H - 22);
}

function drawBustMeter(ctx, S) {
  if (S.wanted.bust <= 0.02) return;
  const w = 320;
  panel(ctx, VIEW_W / 2 - w / 2, VIEW_H - 120, w, 34);
  ctx.fillStyle = '#ff5252';
  roundRect(ctx, VIEW_W / 2 - w / 2 + 6, VIEW_H - 114, (w - 12) * clamp(S.wanted.bust, 0, 1), 12, 6);
  ctx.fill();
  ctx.font = '800 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('BUSTED', VIEW_W / 2, VIEW_H - 94);
}

function drawPrompt(ctx, S) {
  if (!S.prompt || S.mode !== 'play') return;
  ctx.font = '700 17px system-ui, sans-serif';
  const tw = ctx.measureText(S.prompt).width + 34;
  panel(ctx, VIEW_W / 2 - tw / 2, VIEW_H - 76, tw, 34);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(S.prompt, VIEW_W / 2, VIEW_H - 53);
}

function drawBanner(ctx, S) {
  if (S.bannerT <= 0) return;
  const fadeIn = clamp((3.4 - S.bannerT) / 0.25, 0, 1);
  const fadeOut = clamp(S.bannerT / 0.5, 0, 1);
  ctx.globalAlpha = Math.min(fadeIn, fadeOut);
  ctx.textAlign = 'center';
  ctx.font = '900 44px system-ui, sans-serif';
  ctx.fillStyle = '#ffd94d';
  ctx.strokeStyle = 'rgba(20,14,0,0.75)';
  ctx.lineWidth = 7;
  ctx.strokeText(S.bannerTitle, VIEW_W / 2, 150);
  ctx.fillText(S.bannerTitle, VIEW_W / 2, 150);
  ctx.font = '600 19px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.strokeText(S.bannerSub, VIEW_W / 2, 182);
  ctx.fillText(S.bannerSub, VIEW_W / 2, 182);
  ctx.globalAlpha = 1;
}

function drawDistrictToast(ctx, S) {
  if (S.districtT <= 0) return;
  ctx.globalAlpha = clamp(S.districtT, 0, 1) * 0.9;
  ctx.textAlign = 'center';
  ctx.font = '800 25px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(10,14,10,0.6)';
  ctx.lineWidth = 5;
  ctx.strokeText(S.activeDistrict, VIEW_W / 2, VIEW_H - 196);
  ctx.fillText(S.activeDistrict, VIEW_W / 2, VIEW_H - 196);
  ctx.globalAlpha = 1;
}

function drawDialogue(ctx, S) {
  if (!S.dialogue) return;
  const line = S.dialogue.lines[S.dialogue.idx];
  panel(ctx, 190, VIEW_H - 150, VIEW_W - 380, 96);
  ctx.textAlign = 'left';
  ctx.font = '800 15px system-ui, sans-serif';
  ctx.fillStyle = '#ffd94d';
  ctx.fillText(line[0].toUpperCase(), 214, VIEW_H - 122);
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  wrapText(ctx, line[1], 214, VIEW_H - 96, VIEW_W - 428, 22);
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.textAlign = 'right';
  ctx.fillText('E ▸', VIEW_W - 214, VIEW_H - 66);
}

function drawHurtVignette(ctx, S) {
  const p = S.player;
  if (p.hurtT <= 0) return;
  const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 260, VIEW_W / 2, VIEW_H / 2, 640);
  grad.addColorStop(0, 'rgba(200,30,20,0)');
  grad.addColorStop(1, `rgba(200,30,20,${0.35 * clamp(p.hurtT * 2, 0, 1)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

export function drawHUD(ctx, S) {
  drawMinimap(ctx, S);
  drawObjectiveArrow(ctx, S);
  drawVitals(ctx, S);
  drawTopRight(ctx, S);
  drawObjective(ctx, S);
  drawSpeedo(ctx, S);
  drawBustMeter(ctx, S);
  drawPrompt(ctx, S);
  drawBanner(ctx, S);
  drawDistrictToast(ctx, S);
  drawDialogue(ctx, S);
  drawHurtVignette(ctx, S);
}

// Word-wrap `text` into a box starting at (x, y).
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawTitle(ctx, S) {
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, 'rgba(16,42,66,0.55)');
  grad.addColorStop(0.55, 'rgba(16,42,66,0.25)');
  grad.addColorStop(1, 'rgba(24,16,8,0.72)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.font = '900 96px system-ui, sans-serif';
  ctx.fillStyle = '#ffd94d';
  ctx.strokeStyle = 'rgba(30,18,0,0.85)';
  ctx.lineWidth = 12;
  ctx.strokeText('SOLACE CITY', VIEW_W / 2, 218);
  ctx.fillText('SOLACE CITY', VIEW_W / 2, 218);
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('a sun-soaked crime story — five favours, one way out', VIEW_W / 2, 262);

  const hasSave = !!S.existingSave;
  button(ctx, S, 'new', VIEW_W / 2 - 130, 330, 260, 52, 'NEW GAME');
  button(ctx, S, 'continue', VIEW_W / 2 - 130, 396, 260, 52, 'CONTINUE', hasSave);

  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const lines = [
    'WASD / arrows — move & drive      Mouse — aim      Click — shoot / punch',
    'E — enter car · talk · advance      Space — handbrake      Shift — run',
    'P or Esc — pause      M — mute',
    'Steal cars. Run jobs. Do not get caught standing still.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 512 + i * 26));
}

function drawCareerCard(ctx, S) {
  const st = S.stats;
  const rows = [
    ['Missions done', st.missionsDone],
    ['Cars stolen', st.thefts],
    ['Pedestrians run over', st.runovers],
    ['Times busted', st.busted],
    ['Times wasted', st.wasted],
  ];
  panel(ctx, VIEW_W / 2 - 170, 548, 340, 34 + rows.length * 24);
  ctx.textAlign = 'left';
  ctx.font = '800 14px system-ui, sans-serif';
  ctx.fillStyle = '#ffd94d';
  ctx.fillText('DARIO VENN — SO FAR', VIEW_W / 2 - 154, 572);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  rows.forEach(([label, value], i) => {
    const y = 596 + i * 24;
    ctx.fillText(label, VIEW_W / 2 - 154, y);
    ctx.textAlign = 'right';
    ctx.fillText(String(value), VIEW_W / 2 + 154, y);
    ctx.textAlign = 'left';
  });
}

function bigWord(ctx, text, y, color, outline) {
  ctx.font = '900 84px system-ui, sans-serif';
  ctx.fillStyle = color;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 10;
  ctx.strokeText(text, VIEW_W / 2, y);
  ctx.fillText(text, VIEW_W / 2, y);
}

export function drawMenus(ctx, S) {
  S.uiButtons = [];
  if (S.mode === 'play') return;

  if (S.mode === 'title') {
    drawTitle(ctx, S);
    return;
  }

  ctx.fillStyle = 'rgba(8,10,14,0.66)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';

  if (S.mode === 'pause') {
    ctx.font = '900 54px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('PAUSED', VIEW_W / 2, 300);
    button(ctx, S, 'resume', VIEW_W / 2 - 120, 350, 240, 50, 'RESUME');
    button(ctx, S, 'mute', VIEW_W / 2 - 120, 414, 240, 50, S.audio.muted ? 'UNMUTE (M)' : 'MUTE (M)');
    button(ctx, S, 'restart', VIEW_W / 2 - 120, 478, 240, 50, 'QUIT TO TITLE');
    drawCareerCard(ctx, S);
  } else if (S.mode === 'busted') {
    bigWord(ctx, 'BUSTED', 330, '#5ea0ff', 'rgba(4,10,30,0.8)');
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('The SCPD thanks you for stopping. Bail and "fees" cost you 10% of your cash.', VIEW_W / 2, 380);
    ctx.fillText('Press ENTER to respawn at City Hall', VIEW_W / 2, 424);
  } else if (S.mode === 'wasted') {
    bigWord(ctx, 'WASTED', 330, '#e84c3d', 'rgba(30,4,4,0.8)');
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Coral Clinic patched you up and billed 10% of your cash for the thread.', VIEW_W / 2, 380);
    ctx.fillText('Press ENTER to respawn at Coral Clinic', VIEW_W / 2, 424);
  }
}
