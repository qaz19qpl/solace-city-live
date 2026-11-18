// hud.js — everything drawn over the world: the live minimap, wanted
// stars, health and armour, the speedometer, mission banners, dialogue
// boxes, and the menus (title, pause, busted, wasted). Buttons register
// themselves into S.uiButtons as they draw, so main.js can click them.

import { clamp } from './random.js';

const VIEW_W = 1280;
const VIEW_H = 800;

export function makeMinimapBase(city) {
  const c = document.createElement('canvas');
  c.width = 232;
  c.height = 160;
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
  for (const b of city.buildings) g.fillRect(b.x * sx, b.y * sy, Math.max(1.5, b.w * sx), Math.max(1.5, b.h * sy));
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

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(12,18,24,0.62)';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

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
  const x = 16;
  const y = VIEW_H - 176;
  const w = 232;
  const h = 160;
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

export function drawHUD(ctx, S) {
  const p = S.player;

  drawMinimap(ctx, S);
  drawObjectiveArrow(ctx, S);

  // Health and armour, under the minimap's left edge.
  const bx = 16;
  const by = VIEW_H - 176 - 40;
  ctx.fillStyle = 'rgba(12,18,24,0.62)';
  roundRect(ctx, bx, by, 232, 32, 8);
  ctx.fill();
  ctx.fillStyle = '#3a3f45';
  roundRect(ctx, bx + 8, by + 6, 216, 8, 4);
  ctx.fill();
  ctx.fillStyle = p.hp > 30 ? '#e84c3d' : '#ff7a5c';
  if (p.hp > 0) {
    roundRect(ctx, bx + 8, by + 6, 216 * clamp(p.hp / p.maxHp, 0, 1), 8, 4);
    ctx.fill();
  }
  ctx.fillStyle = '#3a3f45';
  roundRect(ctx, bx + 8, by + 19, 216, 7, 4);
  ctx.fill();
  if (p.armour > 0) {
    ctx.fillStyle = '#7fc4e8';
    roundRect(ctx, bx + 8, by + 19, 216 * clamp(p.armour / 100, 0, 1), 7, 4);
    ctx.fill();
  }

  // Cash, stars, weapon — top right.
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

  // Objective — top left.
  const objective = S.missions.objectiveText();
  panel(ctx, 16, 14, Math.min(560, 24 + objective.length * 7.4), 52);
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

  // Speedometer — bottom right while driving.
  if (p.car) {
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

  // Bust meter.
  if (S.wanted.bust > 0.02) {
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

  // Interaction prompt.
  if (S.prompt && S.mode === 'play') {
    ctx.font = '700 17px system-ui, sans-serif';
    const tw = ctx.measureText(S.prompt).width + 34;
    panel(ctx, VIEW_W / 2 - tw / 2, VIEW_H - 76, tw, 34);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(S.prompt, VIEW_W / 2, VIEW_H - 53);
  }

  // Mission banner: fades in fast, holds, fades out at the end.
  if (S.bannerT > 0) {
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

  // District toast.
  if (S.districtT > 0) {
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

  // Dialogue box.
  if (S.dialogue) {
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

  // Hurt vignette.
  if (p.hurtT > 0) {
    const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 260, VIEW_W / 2, VIEW_H / 2, 640);
    grad.addColorStop(0, 'rgba(200,30,20,0)');
    grad.addColorStop(1, `rgba(200,30,20,${0.35 * clamp(p.hurtT * 2, 0, 1)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

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

export function drawMenus(ctx, S) {
  S.uiButtons = [];
  if (S.mode === 'play') return;

  if (S.mode === 'title') {
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
  } else if (S.mode === 'busted') {
    ctx.font = '900 84px system-ui, sans-serif';
    ctx.fillStyle = '#5ea0ff';
    ctx.strokeStyle = 'rgba(4,10,30,0.8)';
    ctx.lineWidth = 10;
    ctx.strokeText('BUSTED', VIEW_W / 2, 330);
    ctx.fillText('BUSTED', VIEW_W / 2, 330);
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('The SCPD thanks you for stopping. Bail and "fees" cost you 10% of your cash.', VIEW_W / 2, 380);
    ctx.fillText('Press ENTER to respawn at City Hall', VIEW_W / 2, 424);
  } else if (S.mode === 'wasted') {
    ctx.font = '900 84px system-ui, sans-serif';
    ctx.fillStyle = '#e84c3d';
    ctx.strokeStyle = 'rgba(30,4,4,0.8)';
    ctx.lineWidth = 10;
    ctx.strokeText('WASTED', VIEW_W / 2, 330);
    ctx.fillText('WASTED', VIEW_W / 2, 330);
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Coral Clinic patched you up and billed 10% of your cash for the thread.', VIEW_W / 2, 380);
    ctx.fillText('Press ENTER to respawn at Coral Clinic', VIEW_W / 2, 424);
  }
}
