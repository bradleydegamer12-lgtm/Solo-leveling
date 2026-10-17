// Workout plan + session generation, exercise swapping and difficulty adjustment.

import { EXERCISES, EXERCISE_MAP, LEVEL_RANK, getExercise, exerciseMinutes } from "./exercises.js";
import { weekdayOf, dateKey } from "./dates.js";
import { workoutXp } from "./progression.js";

export const TYPES = {
  strength: { key: "strength", label: "STRENGTH", tagline: "Build force and control", icon: "dumbbell" },
  endurance: { key: "endurance", label: "ENDURANCE", tagline: "Sustain effort longer", icon: "activity" },
  mobility: { key: "mobility", label: "MOBILITY", tagline: "Move well, recover faster", icon: "stretch" },
};

const TYPE_ROTATION = {
  strength: ["strength", "endurance", "strength", "mobility"],
  endurance: ["endurance", "strength", "endurance", "mobility"],
  mobility: ["mobility", "strength", "mobility", "endurance"],
  habits: ["strength", "endurance", "mobility", "strength"],
  general: ["endurance", "strength", "endurance", "mobility"],
};

/** Keyword filter for movements the player must avoid. */
export function isAllowed(exercise, avoidText = "") {
  if (!avoidText || !avoidText.trim()) return true;
  const words = avoidText
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !["and", "the", "with", "not", "for", "avoid", "when", "have", "has"].includes(w));
  if (!words.length) return true;
  // Match against name/tags/cues only — free-text steps contain generic phrases
  // like "shoulder-width" that would otherwise filter out harmless movements.
  const haystack = [
    exercise.name,
    exercise.cat,
    (exercise.tags || []).join(" "),
    exercise.cue || "",
    exercise.caution || "",
  ]
    .join(" ")
    .toLowerCase();

  const stems = new Set();
  for (const w of words) {
    stems.add(w);
    if (w.endsWith("ing") && w.length > 5) stems.add(w.slice(0, -3)); // jumping → jump
    if (w.endsWith("s") && w.length > 4) stems.add(w.slice(0, -1)); // knees → knee
  }
  return ![...stems].some((w) => new RegExp(`\\b${w}`).test(haystack));
}

function gearOk(exercise, equipment) {
  const owned = equipment && equipment.length ? equipment : ["none"];
  return exercise.equip.some((e) => owned.includes(e));
}

function levelOk(exercise, experience) {
  const max = LEVEL_RANK[experience] ?? 0;
  return LEVEL_RANK[exercise.level] <= max;
}

function poolFor(profile, { type, avoid }) {
  return EXERCISES.filter(
    (e) =>
      e.pool === "main" &&
      e.cat === type &&
      gearOk(e, profile.equipment) &&
      levelOk(e, profile.experience) &&
      isAllowed(e, avoid),
  );
}

function pick(list, count, used) {
  const fresh = list.filter((e) => !used.has(e.id));
  const source = fresh.length >= count ? fresh : list;
  const out = [];
  const bag = [...source];
  while (out.length < count && bag.length) {
    const i = Math.floor(Math.random() * bag.length);
    const [item] = bag.splice(i, 1);
    if (!used.has(item.id)) {
      used.add(item.id);
      out.push(item);
    }
    if (!bag.length && out.length < count) break;
  }
  return out;
}

function toItem(exercise, offset = 0) {
  return {
    id: exercise.id,
    sets: exercise.sets || 3,
    reps: exercise.reps || null,
    seconds: exercise.seconds || null,
    rest: exercise.rest || 40,
    done: [],
    // Small deterministic per-set variation so "3 × 8" feels alive without randomness.
    offset,
  };
}

function describeMain(type, count) {
  if (type === "strength") return count >= 6 ? "FULL-BODY FORGE" : "FULL-BODY FORGE";
  if (type === "endurance") return "TEMPO RUN";
  return "FLEX FLOW";
}

/**
 * Build a complete session: warm-up → main block → cooldown.
 * `minutes` shapes how many main exercises are selected.
 */
export function buildSession(profile, { type = "strength", minutes = 30, source = {}, name } = {}) {
  const used = new Set();
  const avoid = profile.avoid || "";

  // Warm-up (2) + cooldown (2) are always bodyweight/prep friendly.
  const warmPool = EXERCISES.filter((e) => e.pool === "warmup" && isAllowed(e, avoid));
  const coolPool = EXERCISES.filter((e) => e.pool === "cooldown" && isAllowed(e, avoid));

  const mainPool = poolFor(profile, { type, avoid });
  const fallbackPool = EXERCISES.filter((e) => e.pool === "main" && e.cat === type && isAllowed(e, avoid));
  const selectable = mainPool.length ? mainPool : fallbackPool.length ? fallbackPool : EXERCISES.filter((e) => e.pool === "main");

  const mainCount = Math.max(3, Math.min(7, Math.round((minutes - 12) / 5)));

  const session = {
    id: `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: name || describeMain(type),
    type,
    goal: profile.goal,
    source,
    createdAt: new Date().toISOString(),
    phases: [
      { key: "warmup", label: "WARM-UP", note: "Raise the temperature — easy effort.", items: pick(warmPool, 2, used).map(toItem) },
      { key: "main", label: "MAIN BLOCK", note: "Working sets. Leave 1–2 reps in reserve.", items: pick(selectable, mainCount, used).map(toItem) },
      { key: "cooldown", label: "COOL-DOWN", note: "Down-shift and breathe.", items: pick(coolPool, 2, used).map(toItem) },
    ],
  };

  session.estMinutes = estimateMinutes(session);
  session.estXp = workoutXp(session.estMinutes, type);
  return session;
}

export function estimateMinutes(session) {
  let total = 0;
  for (const phase of session.phases) {
    for (const item of phase.items) {
      total += exerciseMinutes(EXERCISE_MAP[item.id]) * (item.sets / (EXERCISE_MAP[item.id]?.sets || 1));
    }
  }
  return Math.max(5, Math.round(total));
}

export function flatSteps(session) {
  const out = [];
  session.phases.forEach((phase, pi) => {
    phase.items.forEach((item, ii) => out.push({ phase, phaseIdx: pi, item, itemIdx: ii, exercise: EXERCISE_MAP[item.id] }));
  });
  return out;
}

export function sessionProgress(session) {
  const steps = flatSteps(session);
  let done = 0;
  let total = 0;
  for (const s of steps) {
    total += s.item.sets;
    done += s.item.done.length;
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0, exercises: steps.length };
}

export function isSessionComplete(session) {
  return sessionProgress(session).pct >= 60; // ≥60% of sets counts as a completed session
}

/** Replace one exercise instance inside a session. */
export function replaceStep(session, phaseIdx, itemIdx, newId) {
  const next = structuredClone(session);
  const phase = next.phases[phaseIdx];
  const old = phase.items[itemIdx];
  const template = EXERCISE_MAP[newId];
  if (!template) return next;
  phase.items[itemIdx] = {
    ...toItem(template),
    sets: old.sets,
    replacedFrom: old.replacedFrom || old.id,
    done: [],
  };
  recalc(next);
  return next;
}

/** Easier / harder variants of a session, respecting gear, level and avoid list. */
export function adjustDifficulty(session, direction, profile) {
  const next = structuredClone(session);
  const avoid = profile.avoid || "";
  const used = new Set(next.phases.flatMap((p) => p.items.map((i) => i.id)));

  for (const item of next.phases.find((p) => p.key === "main").items) {
    const current = EXERCISE_MAP[item.id];
    const preferred = direction === "easier" ? current.easier : current.harder;
    let target = preferred ? EXERCISE_MAP[preferred] : null;

    if (
      !target ||
      !gearOk(target, profile.equipment) ||
      !levelOk(target, profile.experience) ||
      !isAllowed(target, avoid) ||
      used.has(target.id)
    ) {
      const wanted = LEVEL_RANK[current.level] + (direction === "easier" ? -1 : 1);
      target =
        EXERCISES.find(
          (e) =>
            e.pool === "main" &&
            e.cat === current.cat &&
            LEVEL_RANK[e.level] === Math.max(0, Math.min(2, wanted)) &&
            gearOk(e, profile.equipment) &&
            isAllowed(e, avoid) &&
            !used.has(e.id),
        ) || null;
    }

    if (target && target.id !== item.id) {
      used.delete(item.id);
      used.add(target.id);
      item.id = target.id;
      item.reps = target.reps || null;
      item.seconds = target.seconds || null;
      item.sets = target.sets || item.sets;
      item.rest = target.rest || item.rest;
      item.done = [];
      item.difficultyShift = direction;
    }
  }
  recalc(next);
  return next;
}

function recalc(session) {
  session.estMinutes = estimateMinutes(session);
  session.estXp = workoutXp(session.estMinutes, session.type);
}

/** Candidates for the in-workout "replace exercise" picker. */
export function replacementCandidates(session, phaseIdx, itemIdx, profile) {
  const current = session.phases[phaseIdx].items[itemIdx];
  const inSession = new Set(session.phases.flatMap((p) => p.items.map((i) => i.id)));
  const cat = EXERCISE_MAP[current.id]?.cat || "strength";
  return EXERCISES.filter(
    (e) =>
      e.pool === "main" &&
      e.cat === cat &&
      !inSession.has(e.id) &&
      gearOk(e, profile.equipment) &&
      isAllowed(e, profile.avoid || ""),
  ).slice(0, 12);
}

// ── Daily plan ───────────────────────────────────────────────────────────────

export const RECOVERY_TIPS = [
  "Sleep 7–9 hours — recovery is when adaptation happens.",
  "Drink water steadily through the day; pale straw colour is the target.",
  "Mild soreness is normal. Sharp or joint pain is a stop signal.",
  "Take a 10-minute walk on rest days to keep blood moving.",
  "Rest days count as progress — they are built into your plan.",
];

export function trainingTypeFor(profile, key, lastWorkoutType = null) {
  const rotation = TYPE_ROTATION[profile.goal] || TYPE_ROTATION.general;
  let type = rotation[weekdayOf(key) % rotation.length];
  if (type === lastWorkoutType && rotation.length > 1) {
    type = rotation[(weekdayOf(key) + 1) % rotation.length];
  }
  return type;
}

export function planForToday(profile, key = dateKey(), lastWorkoutType = null) {
  const preferred = profile.preferredDays?.length ? profile.preferredDays : [1, 3, 5];
  const isTrainingDay = preferred.includes(weekdayOf(key));

  if (!isTrainingDay) {
    return {
      date: key,
      isRestDay: true,
      type: "mobility",
      title: "RECOVERY PROTOCOL",
      subtitle: "Rest and recharge",
      minutes: 10,
      note: "Today is a planned rest day. Light movement only — recovery is part of the program.",
      optionalSession: {
        type: "mobility",
        minutes: 10,
        label: "Optional gentle mobility flow",
      },
      recovery: RECOVERY_TIPS,
    };
  }

  const type = trainingTypeFor(profile, key, lastWorkoutType);
  const typeInfo = TYPES[type] || TYPES.strength;
  const minutes = Number(profile.sessionMinutes) || 30;
  const intensity = profile.experience === "beginner" ? "BEGINNER" : profile.experience === "intermediate" ? "INTERMEDIATE" : "ADVANCED";

  return {
    date: key,
    isRestDay: false,
    type,
    title: `${typeInfo.label} PROTOCOL`,
    subtitle: typeInfo.tagline,
    minutes,
    intensity,
    note:
      profile.experience === "beginner"
        ? "Start easy. Stops before failure — you should finish feeling capable of one more round."
        : "Work at a challenging but repeatable pace. Technique beats speed.",
    recovery: RECOVERY_TIPS.slice(0, 3),
  };
}
