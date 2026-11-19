// missions.js — Dario Venn's story: five jobs for three people who all
// claim they are doing him a favour.
//
// Lena Marsh runs the marina, Big Sal Okafor lends money at rates that
// should be illegal, and Priya Anand can make any car disappear — for a
// price, she will also make one appear in your hands. The engine runs one
// mission at a time: walk up to the glowing contact, hear them out,
// follow the gold marker, get paid. Failing a job (busted, wasted, out of
// time) costs the job, never the story.
//
// Each job is a builder that fills in a mission record M: its objective
// and target for the HUD, an update(dt) that runs every frame, an
// onCarStolen hook for the jobs that care, and a cleanup() that takes its
// actors off the street when the job ends for any reason.

import { makePed } from './people.js';
import { makeCar, SPORTS_MODEL } from './cars.js';
import { createGuard, spawnPickup } from './combat.js';
import { angleTo, distance } from './random.js';

export const CONTACTS = {
  lena: { name: 'Lena Marsh', x: 2228, y: 655, shirt: '#c2452d', pants: '#31404f' },
  sal: { name: 'Big Sal Okafor', x: 631, y: 1423, shirt: '#31456e', pants: '#23272e' },
  priya: { name: 'Priya Anand', x: 1293, y: 800, shirt: '#2e7f86', pants: '#3d3d55' },
};

export const MISSION_DEFS = [
  {
    title: 'First Run',
    contact: 'lena',
    reward: 250,
    intro: [
      ['Lena Marsh', 'Dario Venn. Still breathing, I see. A package is waiting at the Old Port yard, and it needs to be downtown before anyone starts asking what is inside it.'],
      ['Dario Venn', 'What is inside it?'],
      ['Lena Marsh', 'Fish, officially. Drive it like it is fish. The doorway on the west side of the block, south of Coral Park.'],
    ],
  },
  {
    title: 'The Debtor',
    contact: 'sal',
    reward: 400,
    intro: [
      ['Big Sal Okafor', 'Rudy Pells borrowed four hundred from me to fix his boat. The boat is fine. Rudy is the problem.'],
      ['Dario Venn', 'You want me to break his legs?'],
      ['Big Sal Okafor', 'I want my four hundred. He is by the Coral Park gates, limbering up. Catch him, remind him, and come back with my money. Try not to enjoy it.'],
    ],
  },
  {
    title: 'Hot Metal',
    contact: 'priya',
    reward: 650,
    intro: [
      ['Priya Anand', 'A red Vantara Sunfire sits parked in Coral Heights, and its owner has stopped paying for it. The bank wants it back. I want it first.'],
      ['Dario Venn', 'And if the alarm has opinions?'],
      ['Priya Anand', 'Then drive like the alarm is right. Bring it to my garage door, paint intact. Ninety seconds of fame, Dario. Two minutes, maximum.'],
    ],
  },
  {
    title: 'The Getaway',
    contact: 'lena',
    reward: 800,
    intro: [
      ['Lena Marsh', 'Tonight I stop being a courier, Dario. There is a vault at the Sol&Co Bank downtown, and my name is finally on the right side of it.'],
      ['Dario Venn', 'You are robbing your own bank.'],
      ['Lena Marsh', 'I am withdrawing my future. Bring a car to the bank steps. When I come out, we drive to the Old Port hideout and we do not stop for anyone wearing blue.'],
    ],
  },
  {
    title: 'Pier 9 Clear-Out',
    contact: 'sal',
    reward: 1500,
    intro: [
      ['Big Sal Okafor', 'The freight boys at Pier 9 hired "auditors" — men with guns and no sense of humour — to lean on my warehouse. Lean back.'],
      ['Dario Venn', 'Five of them, Sal. I counted from the roof.'],
      ['Big Sal Okafor', 'Then take this pistol and count louder. Clear the yard, and we are square forever. That is the last favour, Dario. Make it count.'],
    ],
  },
];

// --- the five jobs ---------------------------------------------------------

function missionFirstRun(S, M) {
  const PACKAGE = { x: 470, y: 370 };
  const DOORWAY = { x: 1013, y: 1150 };
  S.missionItem = { x: PACKAGE.x, y: PACKAGE.y, kind: 'package' };
  M.objective = 'Pick up the package at the Old Port yard';
  M.target = { ...PACKAGE };
  M.update = () => {
    switch (M.stage) {
      case 0: {
        if (distance(S.player.x, S.player.y, PACKAGE.x, PACKAGE.y) < 28) {
          S.missionItem = null;
          M.stage = 1;
          M.timer = 240;
          M.objective = 'Deliver the package downtown — west doorway, south of Coral Park';
          M.target = { ...DOORWAY };
          S.banner('PACKAGE ON BOARD', 'Downtown, and do not open it');
        }
        break;
      }
      case 1: {
        if (distance(S.player.x, S.player.y, DOORWAY.x, DOORWAY.y) < 36) M.finish();
        break;
      }
    }
  };
  M.cleanup = () => { S.missionItem = null; };
}

function missionDebtor(S, M) {
  const debtor = makePed(S.rng, 1423, 1027);
  debtor.role = 'debtor';
  debtor.name = 'Rudy Pells';
  debtor.shirt = '#e8b93e';
  debtor.hp = 30;
  S.peds.push(debtor);
  M.debtor = debtor;
  M.stamina = 1;
  M.objective = 'Catch Rudy Pells by the Coral Park gates';
  M.target = { x: debtor.x, y: debtor.y };
  M.update = (dt) => {
    const p = S.player;
    const d = distance(p.x, p.y, debtor.x, debtor.y);
    M.target = { x: debtor.x, y: debtor.y };
    if (debtor.state === 'down' || debtor.state === 'dead' || d < 24) {
      S.banner('GOT HIM', 'Rudy suddenly remembers the money');
      M.finish();
      return;
    }
    if (d < 175 && debtor.state !== 'down') {
      M.stamina = Math.max(0, M.stamina - dt / 15);
      const speed = 148 + 88 * M.stamina;
      const away = angleTo(p.x, p.y, debtor.x, debtor.y);
      // He cuts toward the nearest intersection when he can: corners are
      // where slow chasers give up.
      const node = S.city.nearestIntersection(debtor.x, debtor.y);
      const toNode = angleTo(debtor.x, debtor.y, node.x, node.y);
      const blend = Math.abs(Math.sin((away - toNode) / 2)) < 0.5 ? toNode : away;
      debtor.x += Math.cos(blend) * speed * dt;
      debtor.y += Math.sin(blend) * speed * dt;
      debtor.angle = blend;
      debtor.speed = speed;
      const pos = { x: debtor.x, y: debtor.y };
      S.city.collideCircle(pos, 8);
      debtor.x = pos.x;
      debtor.y = pos.y;
    } else {
      M.stamina = Math.min(1, M.stamina + dt / 20);
      debtor.speed = 0;
    }
  };
  M.cleanup = () => {
    const idx = S.peds.indexOf(debtor);
    if (idx >= 0) S.peds.splice(idx, 1);
  };
}

function missionHotMetal(S, M) {
  const GARAGE = { x: 1350, y: 830 };
  const car = makeCar(SPORTS_MODEL, 1150, 609, 0, S.rng, '#e33f4e');
  car.owner = 'mission-target';
  car.driver = 'parked';
  S.cars.push(car);
  M.targetCar = car;
  M.objective = 'Steal the red Vantara Sunfire in Coral Heights';
  M.target = { x: car.x, y: car.y };
  M.update = () => {
    M.target = { x: car.x, y: car.y };
    if (car.wrecked) {
      M.fail('The Sunfire is a write-off. Priya will not pay for scrap.');
      return;
    }
    if (M.stage !== 1) return;
    M.target = { ...GARAGE };
    if (S.player.car === car && distance(car.x, car.y, GARAGE.x, GARAGE.y) < 62) {
      if (car.hp < 25) {
        M.fail('Too smashed up — Priya wanted a car, not a sculpture.');
        return;
      }
      // Priya takes the keys; Dario walks away richer.
      S.player.car = null;
      car.driver = 'parked';
      car.owner = null;
      car.x = 1330;
      car.y = 838;
      car.vx = 0;
      car.vy = 0;
      S.player.x = 1300;
      S.player.y = 872;
      M.finish();
    }
  };
  M.onCarStolen = (stolen) => {
    if (stolen === car && M.stage === 0) {
      M.stage = 1;
      M.timer = 150;
      M.objective = 'Deliver the Sunfire to Priya’s garage — fast, and in one piece';
      S.wanted.heat = Math.max(S.wanted.heat, 200);
      S.banner('HOT METAL', 'Two stars and counting — move!');
    }
  };
  M.cleanup = () => { if (car.owner === 'mission-target') car.owner = null; };
}

function missionGetaway(S, M) {
  const BANK_STEPS = { x: 1100, y: 1005 };
  const HIDEOUT = { x: 470, y: 1560 };
  let bankLena = null;
  M.objective = 'Meet Lena at the Sol&Co Bank steps, downtown';
  M.target = { ...BANK_STEPS };
  M.update = () => {
    const p = S.player;
    switch (M.stage) {
      case 0: {
        if (distance(p.x, p.y, BANK_STEPS.x, BANK_STEPS.y) < 60) {
          bankLena = makePed(S.rng, 1050, 990);
          bankLena.role = 'mission';
          bankLena.name = 'Lena Marsh';
          bankLena.shirt = '#c2452d';
          S.peds.push(bankLena);
          M.stage = 1;
          M.objective = 'Bring a car to Lena — she is done any second';
          M.target = { x: 1050, y: 990 };
          S.banner('RENDEZVOUS', 'Lena is inside. Wheels. Now.');
        }
        break;
      }
      case 1: {
        M.target = { x: bankLena.x, y: bankLena.y };
        if (p.car && distance(p.x, p.y, bankLena.x, bankLena.y) < 52) {
          const idx = S.peds.indexOf(bankLena);
          if (idx >= 0) S.peds.splice(idx, 1);
          bankLena = null;
          S.passenger = 'Lena Marsh';
          S.wanted.heat = Math.max(S.wanted.heat, 300);
          M.stage = 2;
          M.objective = 'Get Lena to the Old Port hideout — do not stop';
          M.target = { ...HIDEOUT };
          S.banner('GO GO GO', 'Three stars. The hideout, Dario.');
          S.audio.missionSting();
        }
        break;
      }
      case 2: {
        if (p.car && distance(p.x, p.y, HIDEOUT.x, HIDEOUT.y) < 48) {
          S.passenger = null;
          S.wanted.heat = 0; // Lena knows people. The heat simply goes away.
          const lena = makePed(S.rng, 446, 1520);
          lena.role = 'mission';
          lena.name = 'Lena Marsh';
          lena.shirt = '#c2452d';
          S.peds.push(lena);
          window.setTimeout(() => {
            const idx = S.peds.indexOf(lena);
            if (idx >= 0) S.peds.splice(idx, 1);
          }, 6000);
          M.finish();
        }
        break;
      }
    }
  };
  M.cleanup = () => {
    if (bankLena) {
      const idx = S.peds.indexOf(bankLena);
      if (idx >= 0) S.peds.splice(idx, 1);
    }
    S.passenger = null;
  };
}

function missionClearOut(S, M) {
  const POSTS = [
    [1832, 1502], [1978, 1502], [1900, 1642], [1846, 1622], [1962, 1622],
  ];
  M.guards = POSTS.map(([x, y]) => {
    const g = createGuard(S.rng, x, y);
    S.peds.push(g);
    return g;
  });
  spawnPickup(S, 1790, 1560, 'health');
  spawnPickup(S, 1790, 1610, 'ammo', 24);
  M.objective = 'Clear the Pier 9 yard (0/5)';
  M.target = { x: 1900, y: 1560 };
  const stillUp = () => M.guards.filter((g) => g.state !== 'down' && g.state !== 'dead' && S.peds.includes(g)).length;
  M.update = () => {
    const down = M.guards.length - stillUp();
    M.objective = `Clear the Pier 9 yard (${down}/5)`;
    if (down >= 5) M.finish();
  };
  M.cleanup = () => {
    for (const g of M.guards) {
      const idx = S.peds.indexOf(g);
      if (idx >= 0) S.peds.splice(idx, 1);
    }
  };
}

const BUILDERS = [missionFirstRun, missionDebtor, missionHotMetal, missionGetaway, missionClearOut];

// --- the engine -----------------------------------------------------------

export function createMissionEngine(S) {
  const engine = {
    active: null,
    contactPed: null,

    // Put the current contact on the street (or take them off it).
    refreshContact() {
      if (this.contactPed) {
        const idx = S.peds.indexOf(this.contactPed);
        if (idx >= 0) S.peds.splice(idx, 1);
        this.contactPed = null;
      }
      if (S.storyDone || this.active) return;
      const def = MISSION_DEFS[S.nextMission];
      if (!def) return;
      const spot = CONTACTS[def.contact];
      const ped = makePed(S.rng, spot.x, spot.y);
      ped.role = 'contact';
      ped.name = spot.name;
      ped.shirt = spot.shirt;
      ped.pants = spot.pants;
      ped.state = 'stand';
      S.peds.push(ped);
      this.contactPed = ped;
    },

    currentTarget() {
      if (this.active && this.active.target) return this.active.target;
      if (!S.storyDone && !this.active) {
        const def = MISSION_DEFS[S.nextMission];
        if (def) {
          const spot = CONTACTS[def.contact];
          return { x: spot.x, y: spot.y };
        }
      }
      return null;
    },

    objectiveText() {
      if (this.active) return this.active.objective;
      if (S.storyDone) return 'Story complete — Solace City is yours. Cause some trouble.';
      const def = MISSION_DEFS[S.nextMission];
      if (def) return `Meet ${CONTACTS[def.contact].name} — “${def.title}”`;
      return 'Free roam';
    },

    // E next to the contact opens the briefing dialogue.
    talk() {
      if (this.active || S.storyDone || !this.contactPed) return false;
      if (distance(S.player.x, S.player.y, this.contactPed.x, this.contactPed.y) > 52) return false;
      const idx = S.nextMission;
      const def = MISSION_DEFS[idx];
      S.dialogue = {
        lines: def.intro,
        idx: 0,
        onDone: () => this.activate(idx),
      };
      return true;
    },

    activate(idx) {
      const def = MISSION_DEFS[idx];
      const M = {
        idx,
        def,
        stage: 0,
        timer: null,
        objective: '',
        target: null,
        update: () => {},
        cleanup: () => {},
        onCarStolen: null,
        finish: () => engine.complete(M),
        fail: (reason) => engine.fail(M, reason),
      };
      this.active = M;
      BUILDERS[idx](S, M);
      if (idx === 4 && !S.player.hasPistol) {
        S.player.hasPistol = true;
        S.player.ammo += 36;
        S.effects.floatText(S.player.x, S.player.y - 26, 'SAL GAVE YOU A PISTOL', '#ffd76e');
      }
      S.banner(def.title.toUpperCase(), `For ${CONTACTS[def.contact].name} — $${def.reward}`);
      S.audio.missionSting();
      this.refreshContact();
    },

    complete(M) {
      if (this.active !== M) return;
      this.active = null;
      M.cleanup();
      S.addCash(M.def.reward, S.player.x, S.player.y);
      S.stats.missionsDone += 1;
      S.banner('MISSION COMPLETE', `${M.def.title} — $${M.def.reward}`);
      S.audio.cash();
      if (M.idx >= MISSION_DEFS.length - 1) {
        S.storyDone = true;
        S.banner('STORY COMPLETE', 'Dario Venn is a free man. Solace City remains.');
      }
      S.nextMission = Math.min(M.idx + 1, MISSION_DEFS.length - 1);
      S.persist();
      this.refreshContact();
    },

    fail(M, reason) {
      if (this.active !== M) return;
      this.active = null;
      M.cleanup();
      S.banner('MISSION FAILED', reason || 'It fell apart. The contact is still waiting.');
      S.audio.failSting();
      this.refreshContact();
    },

    // Busted or wasted mid-mission ends the job, not the story.
    interrupted(kind) {
      if (!this.active) return;
      const M = this.active;
      this.active = null;
      M.cleanup();
      const why = kind === 'busted'
        ? 'Arrested mid-job. The contact pretends not to know you.'
        : 'You woke up in hospital. The job is off.';
      S.banner('MISSION FAILED', why);
      this.refreshContact();
    },

    handleCarStolen(car) {
      if (this.active && this.active.onCarStolen) this.active.onCarStolen(car);
    },

    update(dt) {
      const M = this.active;
      if (!M) return;
      if (M.timer !== null && M.timer !== undefined) {
        M.timer -= dt;
        if (M.timer <= 0) {
          this.fail(M, 'Out of time. The contact is still waiting.');
          return;
        }
      }
      M.update(dt);
    },
  };
  return engine;
}
