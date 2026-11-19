// save.js — the one-slot localStorage save.
//
// Dario's cash, story progress, pistol and lifetime tallies live in a
// single key, so the title screen's Continue picks the story up where it
// stopped. Everything here is defensive: a corrupt or missing slot just
// means a fresh start, never a crash.
//
// The shape is fixed by `defaultSave`; loading merges whatever survived
// onto a fresh shape, so an old or partial save can never leave a hole
// where the game expects a number.

const SAVE_KEY = 'solace-city-save-v1';

export function defaultSave() {
  return {
    cash: 60,
    nextMission: 0,
    storyDone: false,
    ammo: 24,
    hasPistol: false,
    stats: { thefts: 0, runovers: 0, missionsDone: 0, busted: 0, wasted: 0 },
  };
}

// Layer stored data over a fresh save so missing fields fall back.
function mergeSave(data) {
  const fresh = defaultSave();
  if (typeof data !== 'object' || data === null) return null;
  return {
    ...fresh,
    ...data,
    stats: { ...fresh.stats, ...(data.stats || {}) },
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return mergeSave(JSON.parse(raw));
  } catch {
    // Corrupt JSON or a browser that blocks storage: no save, no problem.
    return null;
  }
}

export function storeSave(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Private mode or a full disk: the game simply runs unsaved.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
