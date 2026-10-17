// Daily quest board: generation, progress derivation and claim validation.

import { dateKey, weekdayOf } from "./dates.js";
import { XP_REWARDS, workoutXp } from "./progression.js";

/**
 * Quests are generated per day from the player's goal, experience and recovery needs.
 * `context.isRestDay` swaps the main quest for a recovery quest — rest always counts.
 */
export function generateQuests(profile, key = dateKey(), context = {}) {
  const isRestDay = Boolean(context.isRestDay);
  const wantsMobility = profile.goal === "mobility" || profile.goal === "general" || profile.experience === "beginner";

  const quests = [
    {
      id: "daily_workout",
      kind: isRestDay ? "recovery" : "workout",
      title: isRestDay ? "LOG YOUR RECOVERY DAY" : "COMPLETE TODAY'S WORKOUT",
      desc: isRestDay
        ? "Planned rest is part of the program. Confirm your recovery day to keep the streak alive."
        : "Finish your scheduled training session — any session of 10+ minutes counts.",
      xp: isRestDay ? XP_REWARDS.questRecovery : XP_REWARDS.questWorkout,
      target: 1,
      progress: 0,
      claimed: false,
      accent: isRestDay ? "cyan" : "violet",
    },
    {
      id: "mobility",
      kind: "mobility",
      title: "SHORT MOBILITY FLOW",
      desc: wantsMobility
        ? "Run a 5–10 minute mobility flow to protect joints and recovery."
        : "Loosen up with a quick guided flow — your future self will thank you.",
      xp: XP_REWARDS.questMobility,
      target: 1,
      progress: 0,
      claimed: false,
      accent: "cyan",
    },
    {
      id: "movement",
      kind: "movement",
      title: "TAKE A MOVEMENT BREAK",
      desc: "Stand up, walk for a few minutes and reset your posture. Claim after you move.",
      xp: XP_REWARDS.questMovement,
      target: 1,
      progress: 0,
      claimed: false,
      accent: "blue",
    },
    {
      id: "hydration",
      kind: "hydration",
      title: "HYDRATION CHECK-IN",
      desc: "Log 2 glasses of water today. Steady hydration, not forced chugging.",
      xp: XP_REWARDS.questHydration,
      target: 2,
      progress: 0,
      claimed: false,
      accent: "blue",
    },
    {
      id: "reflection",
      kind: "reflection",
      title: "RECORD A REFLECTION",
      desc: "Note how today went — energy, effort, or anything to change next session.",
      xp: XP_REWARDS.questReflection,
      target: 1,
      progress: 0,
      claimed: false,
      accent: "violet",
    },
  ];

  return { date: key, isRestDay, items: quests };
}

/** Derive live progress for each quest from the rest of the state. */
export function computeProgress(state) {
  const key = state.quests?.date || dateKey();
  const workouts = state.progress.workouts.filter((w) => w.date === key);
  const daily = state.daily?.date === key ? state.daily : { hydration: 0, reflections: [], movement: false, restMarked: false };
  const isRestDay = state.quests?.isRestDay;

  return {
    // Main quest: a workout, OR a logged recovery day — rest always counts.
    daily_workout: Math.min(
      1,
      workouts.length || (isRestDay || daily.restMarked ? 1 : 0),
    ),
    mobility: Math.min(1, workouts.filter((w) => w.type === "mobility").length),
    movement: daily.movement ? 1 : 0,
    hydration: Math.min(2, daily.hydration || 0),
    reflection: daily.reflections?.length ? 1 : 0,
  };
}

export function isClaimable(state, quest) {
  if (!quest || quest.claimed) return false;
  const progress = computeProgress(state)[quest.id] || 0;
  return progress >= quest.target;
}

export function questSummary(state) {
  const items = state.quests?.items || [];
  const claimed = items.filter((q) => q.claimed).length;
  const claimable = items.filter((q) => isClaimable(state, q)).length;
  const availableXp = items.filter((q) => !q.claimed).reduce((sum, q) => sum + q.xp, 0);
  return { total: items.length, claimed, claimable, availableXp };
}

/** XP bonus for clearing the entire board. */
export function boardClearBonus(state) {
  const items = state.quests?.items || [];
  if (!items.length) return 0;
  return items.every((q) => q.claimed) ? 30 : 0;
}

export function expectedWorkoutXp(session) {
  return workoutXp(session.estMinutes, session.type);
}
