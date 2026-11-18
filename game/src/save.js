// save.js — the localStorage save game. One slot holds Dario's cash, story
// progress, health kit and lifetime tallies, so Continue on the title
// screen picks the story up where it stopped.

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

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    const fresh = defaultSave();
    return {
      ...fresh,
      ...data,
      stats: { ...fresh.stats, ...(data.stats || {}) },
    };
  } catch {
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
