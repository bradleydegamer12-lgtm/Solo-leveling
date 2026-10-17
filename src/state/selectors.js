// Derived read-model selectors — everything the UI shows that is computed from state.

import { dateKey, lastDays, weekDays, weekKey, parseKey, addDays, diffDays } from "./dates.js";
import { computeAttributes, xpToNext, rankProgress, weeklyGoal, RANKS } from "./progression.js";
import { activeStreak } from "./reducer.js";
import { questSummary } from "./quests.js";

export function derive(state) {
  const streak = activeStreak(state);
  const workouts = state.progress.workouts;
  const today = dateKey();
  const thisWeek = new Set(weekDays(today));
  const weekWorkouts = workouts.filter((w) => thisWeek.has(w.date));

  // Weeks where the player hit their weekly goal (consistency input for DISCIPLINE).
  const perWeek = new Map();
  for (const w of workouts) perWeek.set(weekKey(w.date), (perWeek.get(weekKey(w.date)) || 0) + 1);
  const goal = weeklyGoal(state.profile);
  const weeksHit = [...perWeek.values()].filter((n) => n >= goal).length;

  const attributes = computeAttributes({
    experience: state.profile.experience,
    workouts,
    streak,
    weeksHit,
  });

  const xpNeed = xpToNext(state.player.level);
  const xpPct = Math.min(100, Math.round((state.player.xp / xpNeed) * 100));
  const rank = rankProgress(state.player.level, state.player.xp);

  const totalMinutes = workouts.reduce((n, w) => n + (w.durationMin || 0), 0);
  const avgMinutes = workouts.length ? Math.round(totalMinutes / workouts.length) : 0;
  const activeDays = new Set(workouts.map((w) => w.date)).size;

  return {
    streak,
    thisWeekCount: weekWorkouts.length,
    weeklyGoal: goal,
    weekWorkouts,
    weeksHit,
    attributes,
    xpNeed,
    xpPct,
    rankProgress: rank,
    totalMinutes,
    avgMinutes,
    activeDays,
    quests: questSummary(state),
  };
}

/** XP earned per day over the last `days` days — powers the XP-over-time chart. */
export function xpSeries(state, days = 14) {
  const keys = lastDays(dateKey(), days);
  const totals = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const ev of state.progress.xpEvents || []) {
    if (ev.date in totals) totals[ev.date] += ev.amount;
  }
  return keys.map((date) => ({ date, amount: totals[date] }));
}

/** Workouts per week over the last `weeks` weeks. */
export function weeklyBars(state, weeks = 8) {
  const today = dateKey();
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const anchor = addDays(today, -i * 7);
    const wk = weekKey(anchor);
    const days = new Set(weekDays(anchor));
    const count = state.progress.workouts.filter((w) => days.has(w.date)).length;
    out.push({ week: wk, label: `W${wk.split("-W")[1]}`, count });
  }
  return out;
}

/** Month grid for the progress calendar. */
export function calendarMonth(state, reference = dateKey()) {
  const ref = parseKey(reference);
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = first.getDay(); // 0 = Sunday
  const today = dateKey();
  const preferred = state.profile.preferredDays || [];

  const cells = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = dateKey(new Date(year, month, d));
    const workouts = state.progress.workouts.filter((w) => w.date === key);
    const isTrainingDay = preferred.includes(new Date(year, month, d).getDay());
    cells.push({
      key,
      day: d,
      workouts,
      count: workouts.length,
      isRestLogged: (state.progress.restLogs || []).includes(key),
      plannedRest: !isTrainingDay,
      isToday: key === today,
      isFuture: diffDays(key, today) > 0,
      types: [...new Set(workouts.map((w) => w.type))],
    });
  }
  return { year, month, cells, label: `${["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"][month]} ${year}` };
}

export const MILESTONES = [
  { id: "m1", label: "FIRST BLOOD", desc: "Complete your first workout", test: (s) => s.progress.workouts.length >= 1 },
  { id: "m2", label: "TEN SESSIONS", desc: "Complete 10 workouts", test: (s) => s.progress.workouts.length >= 10 },
  { id: "m3", label: "STREAK OF 7", desc: "Stay active 7 days in a row", test: (s) => Math.max(s.player.longestStreak || 0, 0) >= 7 },
  { id: "m4", label: "STRONGEST WEEK", desc: "Hit your weekly goal", test: (s) => derive(s).weeksHit >= 1 },
  { id: "m5", label: "TEN HOURS MOVED", desc: "Accumulate 600 minutes of training", test: (s) => s.progress.workouts.reduce((n, w) => n + (w.durationMin || 0), 0) >= 600 },
  { id: "m6", label: "GATE CRASHER", desc: "Defeat a Weekly Boss", test: (s) => Boolean(s.dungeons?.boss?.clearedCount) },
  { id: "m7", label: "C-CLASS ASCENT", desc: "Reach rank C", test: (s) => ["C","B","A","S"].includes(s.player.rank) },
];

export function milestoneStatus(state) {
  return MILESTONES.map((m) => {
    let done = false;
    try { done = Boolean(m.test(state)); } catch { done = false; }
    return { ...m, done };
  });
}

/** Rank ladder for the status screen. */
export function rankLadder(level) {
  return RANKS.map((r) => ({ ...r, achieved: level >= r.minLevel }));
}
