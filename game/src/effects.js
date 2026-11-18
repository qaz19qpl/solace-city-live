// effects.js — the juice: impact sparks, dust, tyre smoke, skid marks that
// fade in the sun, floating "+$250" texts and camera shake. Purely visual;
// nothing here touches game state.

import { clamp } from './random.js';

export class Effects {
  constructor() {
    this.particles = [];
    this.skids = [];
    this.texts = [];
    this.shakeMag = 0;
  }

  shake(amount) {
    this.shakeMag = Math.min(16, this.shakeMag + amount);
  }

  burst(x, y, opts = {}) {
    const {
      count = 10, color = '#ffd76e', speed = 130, life = 0.45,
      size = 2.4, gravity = 0, spread = Math.PI * 2, angle = 0, drag = 2.2,
    } = opts;
    for (let i = 0; i < count; i++) {
      if (this.particles.length > 700) return;
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed * (0.35 + Math.random() * 0.85);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: life * (0.6 + Math.random() * 0.7),
        maxLife: life,
        size: size * (0.6 + Math.random() * 0.8),
        color, gravity, drag,
      });
    }
  }

  sparks(x, y, angle) {
    this.burst(x, y, { count: 12, color: '#ffca55', speed: 210, life: 0.35, size: 2, angle, spread: 1.6 });
    this.burst(x, y, { count: 5, color: '#fff3c4', speed: 130, life: 0.25, size: 1.6, angle, spread: 1.6 });
  }

  dust(x, y) {
    this.burst(x, y, { count: 6, color: 'rgba(214,196,160,0.55)', speed: 55, life: 0.7, size: 5, drag: 3 });
  }

  smoke(x, y) {
    this.burst(x, y, { count: 2, color: 'rgba(70,70,70,0.4)', speed: 26, life: 0.8, size: 6, drag: 2 });
  }

  muzzle(x, y, angle) {
    this.burst(x, y, { count: 4, color: '#ffe9a3', speed: 160, life: 0.09, size: 2.6, angle, spread: 0.5, drag: 6 });
  }

  bloodlessPuff(x, y) {
    // A knocked-down scuffle puff — comic dust, no gore.
    this.burst(x, y, { count: 8, color: 'rgba(230,220,200,0.6)', speed: 70, life: 0.4, size: 4, drag: 3 });
  }

  addSkid(x1, y1, x2, y2) {
    this.skids.push({ x1, y1, x2, y2, alpha: 0.5 });
    if (this.skids.length > 500) this.skids.splice(0, this.skids.length - 500);
  }

  floatText(x, y, text, color = '#ffe066') {
    this.texts.push({ x, y, text, color, life: 1.5 });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      const dragK = Math.max(0, 1 - p.drag * dt);
      p.vx *= dragK;
      p.vy = p.vy * dragK + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.skids.length - 1; i >= 0; i--) {
      this.skids[i].alpha -= dt * 0.012;
      if (this.skids[i].alpha <= 0.02) this.skids.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 34 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    this.shakeMag = Math.max(0, this.shakeMag - dt * 26);
  }

  shakeOffset() {
    if (this.shakeMag <= 0.1) return { x: 0, y: 0 };
    return {
      x: (Math.random() - 0.5) * 2 * this.shakeMag,
      y: (Math.random() - 0.5) * 2 * this.shakeMag,
    };
  }

  drawSkids(ctx) {
    ctx.lineCap = 'round';
    for (const s of this.skids) {
      ctx.strokeStyle = `rgba(30,28,26,${clamp(s.alpha, 0, 0.55)})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      const t = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = t;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + t * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawTexts(ctx) {
    ctx.textAlign = 'center';
    ctx.font = '700 17px system-ui, sans-serif';
    for (const t of this.texts) {
      ctx.globalAlpha = clamp(t.life / 1.5, 0, 1);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(20,20,20,0.65)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
