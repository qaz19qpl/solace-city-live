// combat.js — fists, the pistol, bullets in flight, pickups on the ground
// and the armed guards who protect other people's money. Bullets are
// honest line-steppers: they stop at walls, cars and people, in that
// order of checking, and every shot fired in public is a crime somebody
// probably saw.

import { makePed, hurtPed } from './people.js';
import { angleTo, distance } from './random.js';

export function spawnPickup(S, x, y, kind, amount = 0) {
  S.pickups.push({ x, y, kind, amount, bobT: S.rng.range(0, 6) });
}

export function fireBullet(S, x, y, angle, from) {
  S.bullets.push({
    x, y,
    vx: Math.cos(angle) * 980,
    vy: Math.sin(angle) * 980,
    life: 0.55,
    from, // 'player' | 'guard'
    damage: from === 'player' ? 34 : 9,
  });
}

export function playerShoot(S) {
  const p = S.player;
  if (!p.hasPistol || p.ammo <= 0 || p.fireCd > 0 || p.car) return;
  p.fireCd = 0.21;
  p.ammo -= 1;
  const a = p.aimAngle;
  const mx = p.x + Math.cos(a) * 16;
  const my = p.y + Math.sin(a) * 16;
  fireBullet(S, mx, my, a + S.rng.range(-0.012, 0.012), 'player');
  S.effects.muzzle(mx, my, a);
  S.audio.shot();
  S.reportCrime('shot', p.x, p.y);
  scareAndAlert(S, p.x, p.y);
}

export function playerPunch(S) {
  const p = S.player;
  if (p.punchCd > 0 || p.car) return;
  p.punchCd = 0.34;
  const a = p.aimAngle;
  const hx = p.x + Math.cos(a) * 26;
  const hy = p.y + Math.sin(a) * 26;
  S.audio.punch();
  let hit = false;
  for (const ped of S.peds) {
    if (ped.state === 'down' || ped.state === 'dead') continue;
    if (distance(hx, hy, ped.x, ped.y) < 20) {
      hurtPed(S, ped, 16, 'fist');
      hit = true;
    }
  }
  for (const cop of S.cops) {
    if (cop.state === 'chase' && distance(hx, hy, cop.x, cop.y) < 20) {
      cop.hp -= 16;
      hit = true;
      S.reportCrime('assaultCop', p.x, p.y);
      if (cop.hp <= 0) {
        cop.state = 'down';
        cop.downT = 5;
        S.effects.bloodlessPuff(cop.x, cop.y);
      }
    }
  }
  for (const car of S.cars) {
    if (distance(hx, hy, car.x, car.y) < car.len * 0.5) {
      car.hp -= 3;
      S.effects.sparks(hx, hy, a);
      hit = true;
    }
  }
  if (hit) S.reportCrime('assault', p.x, p.y);
}

function scareAndAlert(S, x, y) {
  for (const ped of S.peds) {
    if (ped.role === 'guard' && distance(ped.x, ped.y, x, y) < 340) {
      ped.alert = 1;
    }
  }
}

export function createGuard(rng, x, y) {
  const guard = makePed(rng, x, y, 'guard');
  guard.role = 'guard';
  guard.hp = 60;
  guard.shirt = '#4a4a42';
  guard.pants = '#2c2c28';
  guard.alert = 0;
  guard.fireCd = rng.range(0.4, 1.2);
  guard.strafeDir = rng.chance(0.5) ? 1 : -1;
  guard.postX = x;
  guard.postY = y;
  guard.patrolA = rng.range(0, Math.PI * 2);
  return guard;
}

export function updateGuard(guard, dt, S) {
  if (guard.state === 'down' || guard.state === 'dead') return;
  if (guard.state === 'flee') guard.state = 'stand';
  const p = S.player;
  const d = distance(guard.x, guard.y, p.x, p.y);
  const canSee = d < 300 && S.city.losClear(guard.x, guard.y, p.x, p.y);
  if (canSee) guard.alert = 1;
  else guard.alert = Math.max(0, (guard.alert || 0) - dt * 0.08);

  guard.fireCd -= dt;
  if (guard.alert > 0 && canSee) {
    guard.angle = angleTo(guard.x, guard.y, p.x, p.y);
    // Keep a shooter's distance: close in past 230, back off under 120.
    let mx = 0;
    let my = 0;
    const away = d < 120 ? 1 : d > 230 ? -1 : 0;
    if (away !== 0) {
      mx = Math.cos(guard.angle) * -away;
      my = Math.sin(guard.angle) * -away;
    }
    // Strafe sideways while shooting, like they mean it.
    mx += Math.cos(guard.angle + Math.PI / 2) * guard.strafeDir * 0.7;
    my += Math.sin(guard.angle + Math.PI / 2) * guard.strafeDir * 0.7;
    if (S.rng.chance(dt * 0.25)) guard.strafeDir *= -1;
    const ml = Math.sqrt(mx * mx + my * my) || 1;
    guard.x += (mx / ml) * 74 * dt;
    guard.y += (my / ml) * 74 * dt;
    const pos = { x: guard.x, y: guard.y };
    S.city.collideCircle(pos, 8);
    guard.x = pos.x;
    guard.y = pos.y;

    if (guard.fireCd <= 0 && d < 300) {
      guard.fireCd = S.rng.range(0.75, 1.3);
      const a = angleTo(guard.x, guard.y, p.x, p.y) + S.rng.range(-0.055, 0.055);
      fireBullet(S, guard.x + Math.cos(a) * 14, guard.y + Math.sin(a) * 14, a, 'guard');
      S.effects.muzzle(guard.x + Math.cos(a) * 14, guard.y + Math.sin(a) * 14, a);
      if (d < 620) S.audio.shot();
    }
  } else {
    // Idle patrol around the post.
    guard.patrolA += dt * 0.4;
    const tx = guard.postX + Math.cos(guard.patrolA) * 26;
    const ty = guard.postY + Math.sin(guard.patrolA) * 26;
    const a = angleTo(guard.x, guard.y, tx, ty);
    if (distance(guard.x, guard.y, tx, ty) > 6) {
      guard.x += Math.cos(a) * 40 * dt;
      guard.y += Math.sin(a) * 40 * dt;
      guard.angle = a;
    }
  }
}

export function updateGuards(dt, S) {
  for (const ped of S.peds) {
    if (ped.role === 'guard') updateGuard(ped, dt, S);
  }
}

function bulletHitsPerson(S, b, person, radius) {
  return distance(b.x, b.y, person.x, person.y) < radius;
}

export function updateBullets(dt, S) {
  for (let i = S.bullets.length - 1; i >= 0; i--) {
    const b = S.bullets[i];
    b.life -= dt;
    let dead = b.life <= 0;
    const steps = 2;
    for (let s = 0; s < steps && !dead; s++) {
      b.x += (b.vx * dt) / steps;
      b.y += (b.vy * dt) / steps;

      if (S.city.buildingAt(b.x, b.y) || b.x < 0 || b.y < 0 || b.x > S.city.W || b.y > S.city.H) {
        S.effects.sparks(b.x, b.y, Math.atan2(-b.vy, -b.vx));
        dead = true;
        break;
      }

      // Cars soak up bullets meant for people.
      for (const car of S.cars) {
        if (distance(b.x, b.y, car.x, car.y) < car.len * 0.46) {
          car.hp -= b.damage * 0.5;
          if (car.hp <= 0 && !car.wrecked) {
            car.hp = 0;
            car.wrecked = true;
            S.effects.burst(car.x, car.y, { count: 22, color: '#ff9a3c', speed: 170, life: 0.6, size: 3.4 });
            if (distance(car.x, car.y, S.player.x, S.player.y) < 640) S.audio.crash(0.8);
          }
          if (S.player.car === car && b.from === 'guard') {
            S.damagePlayer(b.damage * 0.3, 'shot');
          }
          S.effects.sparks(b.x, b.y, Math.atan2(-b.vy, -b.vx));
          dead = true;
          break;
        }
      }
      if (dead) break;

      if (b.from === 'player') {
        for (const ped of S.peds) {
          if (ped.state === 'down' || ped.state === 'dead') continue;
          if (bulletHitsPerson(S, b, ped, 11)) {
            hurtPed(S, ped, b.damage, 'shot');
            dead = true;
            break;
          }
        }
        if (!dead) {
          for (const cop of S.cops) {
            if (cop.state !== 'chase') continue;
            if (bulletHitsPerson(S, b, cop, 11)) {
              cop.hp -= b.damage;
              S.reportCrime('assaultCop', S.player.x, S.player.y);
              if (cop.hp <= 0) {
                cop.state = 'down';
                cop.downT = 5;
                S.effects.bloodlessPuff(cop.x, cop.y);
              }
              dead = true;
              break;
            }
          }
        }
      } else {
        // Guard bullets only hunt the player.
        const p = S.player;
        if (!p.car && bulletHitsPerson(S, b, p, 11)) {
          S.damagePlayer(b.damage, 'shot');
          dead = true;
        }
      }
    }
    if (dead) S.bullets.splice(i, 1);
  }
}

export function updatePickups(dt, S) {
  const p = S.player;
  for (let i = S.pickups.length - 1; i >= 0; i--) {
    const pk = S.pickups[i];
    pk.bobT += dt * 3;
    if (distance(pk.x, pk.y, p.x, p.y) < 24) {
      let taken = true;
      if (pk.kind === 'health') {
        if (p.hp >= p.maxHp) taken = false;
        else {
          p.hp = Math.min(p.maxHp, p.hp + 40);
          S.effects.floatText(p.x, p.y - 20, '+ HEALTH', '#7be495');
        }
      } else if (pk.kind === 'armour') {
        if (p.armour >= 100) taken = false;
        else {
          p.armour = 100;
          S.effects.floatText(p.x, p.y - 20, '+ ARMOUR', '#9fd8ff');
        }
      } else if (pk.kind === 'ammo') {
        p.ammo += pk.amount || 12;
        p.hasPistol = true;
        S.effects.floatText(p.x, p.y - 20, `+ ${pk.amount || 12} AMMO`, '#ffd76e');
      } else if (pk.kind === 'cash') {
        S.addCash(pk.amount || 20, pk.x, pk.y);
      }
      if (taken) {
        S.audio.pickup();
        S.pickups.splice(i, 1);
      }
    }
  }
}
