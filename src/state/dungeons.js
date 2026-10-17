// Dungeon challenges and the weekly boss — all workout-themed, never dangerous.

import { weekKey, weekDays, dateKey, addDays } from "./dates.js";
import { weeklyGoal, XP_REWARDS } from "./progression.js";

export const DUNGEONS = [
  {
    id: "training",
    name: "TRAINING DUNGEON",
    subtitle: "The Iron Gate",
    type: "strength",
    difficulty: "E",
    estMinutes: 15,
    xp: 70,
    description: "A short full-body strength crawl. Clean reps beat speed.",
    requirements: ["Full-body circuit", "3 rounds minimum", "Controlled tempo"],
    recovery: "Rest 60–90s between rounds. Stop any set that causes pain.",
    easyMinutes: 10,
    easyXp: 45,
    easyNote: "Novice route: fewer rounds, easier variations.",
  },
  {
    id: "endurance",
    name: "ENDURANCE DUNGEON",
    subtitle: "The Long Corridor",
    type: "endurance",
    difficulty: "D",
    estMinutes: 20,
    xp: 85,
    description: "Sustained conditioning through intervals you can actually finish.",
    requirements: ["Work / rest intervals", "Steady breathing", "Pace you can repeat"],
    recovery: "Walk it out for 2 minutes after. Rehydrate — no training through dizziness.",
    easyMinutes: 12,
    easyXp: 55,
    easyNote: "Novice route: shorter intervals, low-impact swaps.",
  },
  {
    id: "mobility",
    name: "MOBILITY DUNGEON",
    subtitle: "The Silent Vault",
    type: "mobility",
    difficulty: "E",
    estMinutes: 12,
    xp: 55,
    description: "A guided flow to unlock hips, spine and shoulders.",
    requirements: ["Slow transitions", "Breath-led holds", "No bouncing"],
    recovery: "Mild tension is fine; sharp pain is not. Skip any position that hurts.",
    easyMinutes: 8,
    easyXp: 35,
    easyNote: "Novice route: shorter holds, supported positions.",
  },
];

export function getDungeon(id) {
  return DUNGEONS.find((d) => d.id === id) || null;
}

/** Weekly boss: a realistic weekly activity goal derived from the player's chosen days. */
export function bossFor(profile, key = dateKey()) {
  const wk = weekKey(key);
  const goal = weeklyGoal(profile);
  const easyGoal = Math.max(2, goal - 2);
  const days = weekDays(key);

  return {
    id: "weekly_boss",
    name: "WEEKLY BOSS",
    subtitle: "The Gatekeeper",
    week: wk,
    goal,
    easyGoal,
    xp: XP_REWARDS.bossClear,
    easyXp: Math.round(XP_REWARDS.bossClear * 0.6),
    days,
    description: `Finish ${goal} training sessions before the week resets on Sunday.`,
    requirements: [
      `${goal} sessions this week`,
      "Any workout type counts",
      "Rest days never reduce progress",
    ],
    recovery: "Split sessions across the week — two-a-days are not required. Stop if you are sore or run down.",
    easyNote: `Slayer route: ${easyGoal} sessions for reduced XP.`,
  };
}

export function bossProgress(state, key = dateKey()) {
  const boss = bossFor(state.profile, key);
  const days = new Set(weekDays(key));
  const sessions = state.progress.workouts.filter((w) => days.has(w.date));
  const claim = state.dungeons?.boss || {};
  const done = claim.week === boss.week;
  return {
    boss,
    count: sessions.length,
    pct: Math.min(100, Math.round((sessions.length / boss.easyGoal) * 100)),
    fullPct: Math.min(100, Math.round((sessions.length / boss.goal) * 100)),
    cleared: done,
    easyCleared: claim.easyWeek === boss.week,
    sessions,
  };
}

export function dungeonStatus(state, dungeon, key = dateKey()) {
  const record = state.dungeons?.clears?.[dungeon.id];
  const clearedToday = record?.lastDate === key;
  return {
    clearedToday,
    count: record?.count || 0,
    lastDate: record?.lastDate || null,
    bestMinutes: record?.bestMinutes || null,
    canAward: !clearedToday,
  };
}
