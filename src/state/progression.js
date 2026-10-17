// Progression math: XP curve, hunter ranks, rewards and honest activity-derived attributes.

export const RANKS = [
  { rank: "E", minLevel: 1 },
  { rank: "D", minLevel: 4 },
  { rank: "C", minLevel: 8 },
  { rank: "B", minLevel: 13 },
  { rank: "A", minLevel: 19 },
  { rank: "S", minLevel: 26 },
];

export const MAX_LEVEL = 60;
export const RANK_ORDER = ["E", "D", "C", "B", "A", "S"];

/** XP required to advance FROM `level` to `level + 1`. Level 1 needs 300. */
export function xpToNext(level) {
  return 250 + level * 50;
}

/** Total XP required to first reach `level` (level 1 = 0). */
export function totalXpForLevel(level) {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToNext(l);
  return total;
}

export function rankForLevel(level) {
  let current = RANKS[0];
  for (const r of RANKS) if (level >= r.minLevel) current = r;
  return current.rank;
}

export function nextRankInfo(level) {
  const next = RANKS.find((r) => r.minLevel > level);
  if (!next) return null;
  return { rank: next.rank, atLevel: next.minLevel };
}

/**
 * Apply XP to a player record.
 * Returns { player, levelUp, rankUp } where levelUp/rankUp describe what happened.
 */
export function applyXp(player, amount) {
  const safeAmount = Math.max(0, Math.round(amount));
  const before = { level: player.level, rank: player.rank };
  let level = player.level;
  let xp = player.xp + safeAmount;
  const gained = [];

  while (level < MAX_LEVEL && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
    gained.push(level);
  }
  if (level >= MAX_LEVEL) xp = Math.min(xp, xpToNext(level));

  const rank = rankForLevel(level);
  return {
    player: {
      ...player,
      level,
      xp,
      rank,
      xpTotal: (player.xpTotal || 0) + safeAmount,
    },
    levelUp: gained.length ? { from: before.level, to: level, levels: gained } : null,
    rankUp: rank !== before.rank ? { from: before.rank, to: rank } : null,
  };
}

/** XP awarded for finishing a workout session. Rewards duration and consistency, not body metrics. */
export function workoutXp(minutes, type) {
  const base = { strength: 25, endurance: 25, mobility: 20 }[type] ?? 20;
  const time = Math.min(Math.max(minutes, 5), 90) * 1.4;
  return Math.round(base + time);
}

export const XP_REWARDS = {
  questWorkout: 50,
  questRecovery: 20,
  questMobility: 20,
  questMovement: 10,
  questHydration: 10,
  questReflection: 10,
  bossClear: 150,
};

const EXPERIENCE_BASE = {
  beginner: { strength: 8, endurance: 8, mobility: 6, discipline: 10 },
  intermediate: { strength: 12, endurance: 11, mobility: 10, discipline: 12 },
  advanced: { strength: 15, endurance: 14, mobility: 13, discipline: 13 },
};

/**
 * Attributes are deliberately derived ONLY from logged activity and consistency.
 * The app never claims to measure real-world strength without a test.
 */
export function computeAttributes({
  experience = "beginner",
  workouts = [],
  streak = 0,
  weeksHit = 0,
}) {
  const base = EXPERIENCE_BASE[experience] || EXPERIENCE_BASE.beginner;
  const count = (type) => workouts.filter((w) => w.type === type).length;

  const strengthSessions = count("strength");
  const enduranceSessions = count("endurance");
  const mobilitySessions = count("mobility");
  const activeDays = new Set(workouts.map((w) => w.date)).size;

  const clamp = (n) => Math.max(1, Math.min(99, Math.round(n)));

  return {
    strength: clamp(base.strength + strengthSessions * 2 + activeDays * 0.25),
    endurance: clamp(base.endurance + enduranceSessions * 2 + activeDays * 0.25),
    mobility: clamp(base.mobility + mobilitySessions * 2),
    discipline: clamp(
      base.discipline +
        Math.min(streak, 30) * 0.6 +
        Math.min(weeksHit, 20) * 1 +
        Math.min(activeDays, 60) * 0.1,
    ),
  };
}

export const ATTRIBUTE_INFO = {
  strength: {
    label: "STRENGTH",
    hint: "Grows from completed strength sessions and active days.",
  },
  endurance: {
    label: "ENDURANCE",
    hint: "Grows from conditioning sessions and active days.",
  },
  mobility: {
    label: "MOBILITY",
    hint: "Grows from mobility and recovery sessions.",
  },
  discipline: {
    label: "DISCIPLINE",
    hint: "Grows from streaks and weekly consistency — the stat that keeps the rest alive.",
  },
};

/** Weekly workout target based on the player's chosen training days (3–5). */
export function weeklyGoal(profile) {
  const days = Array.isArray(profile?.preferredDays) ? profile.preferredDays.length : 4;
  return Math.max(2, Math.min(5, days || 4));
}

/** Streak bookkeeping. Returns the next streak value for an activity on `today`. */
export function nextStreak(streak, lastActiveDate, today) {
  if (!lastActiveDate) return 1;
  if (lastActiveDate === today) return Math.max(1, streak);
  const gap = Math.round(
    (new Date(today) - new Date(lastActiveDate)) / 86400000,
  );
  if (gap === 1) return streak + 1;
  return 1;
}

export function rankProgress(level, xp) {
  const next = nextRankInfo(level);
  if (!next) return { done: true, pct: 100, label: "MAX RANK" };
  const span = next.atLevel - level;
  const spanXp = totalXpForLevel(next.atLevel) - totalXpForLevel(level);
  const pct = Math.max(0, Math.min(100, (xp / spanXp) * 100));
  return {
    done: false,
    pct,
    label: `${span} LEVEL${span > 1 ? "S" : ""} TO ${next.rank}-CLASS`,
    nextRank: next.rank,
  };
}
