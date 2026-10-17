// Persistent storage (localStorage) with graceful failure handling.
// LIMITATION: data lives only in this browser on this device. There is no
// account, no cloud sync and no server — see Profile → Data & Storage.

const STORAGE_KEY = "shadow-system:save:v1";

// localStorage-safe defaults (kept here to avoid an import cycle with reducer.js).
function freshDefaults() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    profile: {
      name: "",
      experience: "beginner",
      goal: "general",
      equipment: ["none"],
      sessionMinutes: 30,
      preferredDays: [1, 3, 5],
      avoid: "",
      onboardingComplete: false,
    },
    player: { level: 1, xp: 0, rank: "E", xpTotal: 0, totalWorkouts: 0, streak: 0, longestStreak: 0, lastActiveDate: null },
    progress: { workouts: [], xpEvents: [], restLogs: [] },
    stats: { claimedQuests: 0, hydrationClaims: 0, reflections: 0, restDaysLogged: 0, movementBreaks: 0, totalMinutes: 0, boardCleared: 0 },
    achievements: { unlocked: {} },
    settings: { sound: true, motion: "auto", particles: true, textScale: "normal", theme: "violet", reducedMotionSystem: false },
    dungeons: { clears: {}, boss: {} },
    daily: null,
    quests: null,
    activeWorkout: null,
  };
}

/** Merge a saved payload over fresh defaults so old saves never crash new builds. */
export function hydrate(raw) {
  const base = freshDefaults();
  if (!raw || typeof raw !== "object") return null;
  return {
    ...base,
    ...raw,
    fx: [],
    profile: { ...base.profile, ...(raw.profile || {}) },
    player: { ...base.player, ...(raw.player || {}) },
    progress: { ...base.progress, ...(raw.progress || {}) },
    stats: { ...base.stats, ...(raw.stats || {}) },
    achievements: { ...base.achievements, ...(raw.achievements || {}) },
    settings: { ...base.settings, ...(raw.settings || {}) },
    dungeons: { ...base.dungeons, ...(raw.dungeons || {}), clears: { ...(raw.dungeons?.clears || {}) }, boss: { ...(raw.dungeons?.boss || {}) } },
    daily: raw.daily || null,
    quests: raw.quests || null,
    activeWorkout: raw.activeWorkout || null,
  };
}

export function readRaw() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writeState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, fx: [] }));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || "Storage unavailable" };
  }
}

export function clearState() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export function exportPayload(state) {
  return JSON.stringify({ ...state, fx: [], exportedAt: new Date().toISOString() }, null, 2);
}

/** Parse and sanity-check a player-supplied save file. Returns null when unusable. */
export function parseImport(text) {
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object") return null;
    if (!data.profile || typeof data.profile !== "object") return null;
    if (!data.player || typeof data.player.level !== "number") return null;
    if (!Array.isArray(data.progress?.workouts)) return null;
    return data;
  } catch {
    return null;
  }
}
