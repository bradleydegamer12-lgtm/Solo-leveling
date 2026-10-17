// Pure reducer — every state transition in SHADOW SYSTEM lives here so it can be
// unit tested without a browser (see tests/journey.test.js).

import { dateKey, weekDays, weekKey, diffDays } from "./dates.js";
import {
  applyXp,
  workoutXp,
  rankForLevel,
  XP_REWARDS,
} from "./progression.js";
import { generateQuests, computeProgress, isClaimable, boardClearBonus } from "./quests.js";
import { planForToday, flatSteps, isSessionComplete, adjustDifficulty, replaceStep } from "./workouts.js";;
import { bossFor, bossProgress, dungeonStatus, getDungeon } from "./dungeons.js";
import { evaluateAchievements } from "./achievements.js";

const uid = () => `fx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export function initialState() {
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
    player: {
      level: 1,
      xp: 0,
      rank: "E",
      xpTotal: 0,
      totalWorkouts: 0,
      streak: 0,
      longestStreak: 0,
      lastActiveDate: null,
    },
    progress: { workouts: [], xpEvents: [], restLogs: [] },
    daily: null,
    quests: null,
    activeWorkout: null,
    dungeons: { clears: {}, boss: {} },
    stats: {
      claimedQuests: 0,
      hydrationClaims: 0,
      reflections: 0,
      restDaysLogged: 0,
      movementBreaks: 0,
      totalMinutes: 0,
      boardCleared: 0,
    },
    achievements: { unlocked: {} },
    settings: {
      sound: true,
      motion: "auto", // auto | on | off
      particles: true,
      textScale: "normal", // normal | large
      reducedMotionSystem: false,
      theme: "violet", // unlockable accent theme
    },
    fx: [],
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function pushFx(state, entry) {
  return { ...state, fx: [...(state.fx || []), { id: uid(), ...entry }] };
}

function pushFxMany(state, entries) {
  if (!entries.length) return state;
  return { ...state, fx: [...(state.fx || []), ...entries.map((e) => ({ id: uid(), ...e }))] };
}

function addXpEvent(state, amount, source, key = dateKey()) {
  const events = [...(state.progress.xpEvents || []), { date: key, amount, source }];
  return { ...state, progress: { ...state.progress, xpEvents: events.slice(-600) } };
}

/** Award XP, detect level-ups and rank-ups, emit overlay events. */
function awardXp(state, amount, source) {
  if (!amount) return { state, events: [] };
  const result = applyXp(state.player, amount);
  let next = {
    ...state,
    player: result.player,
    progress: { ...state.progress, xpEvents: [...(state.progress.xpEvents || []), { date: dateKey(), amount, source }].slice(-600) },
  };
  const events = [];
  if (result.levelUp) events.push({ type: "levelup", ...result.levelUp, xp: amount });
  if (result.rankUp) events.push({ type: "rankup", ...result.rankUp });
  return { state: next, events };
}

function touchStreak(state) {
  const today = dateKey();
  const p = state.player;
  if (p.lastActiveDate === today) return state;
  const gap = p.lastActiveDate ? diffDays(today, p.lastActiveDate) : null;
  const streak = gap === null ? 1 : gap === 1 ? p.streak + 1 : 1;
  return {
    ...state,
    player: {
      ...p,
      streak,
      lastActiveDate: today,
      longestStreak: Math.max(p.longestStreak || 0, streak),
    },
  };
}

/** Effective streak — a missed day naturally breaks it without mutating state on load. */
export function activeStreak(state) {
  const { streak, lastActiveDate } = state.player;
  if (!lastActiveDate) return 0;
  const gap = diffDays(dateKey(), lastActiveDate);
  if (gap <= 1) return streak;
  return 0;
}

function ensureDaily(state) {
  const today = dateKey();
  if (state.daily && state.daily.date === today) return state;
  return {
    ...state,
    daily: { date: today, hydration: 0, reflections: [], movement: false, restMarked: false },
  };
}

function ensureQuests(state) {
  const today = dateKey();
  if (state.quests && state.quests.date === today) return state;
  const plan = planForToday(state.profile, today, lastWorkoutType(state));
  return { ...state, quests: generateQuests(state.profile, today, { isRestDay: plan.isRestDay }) };
}

function lastWorkoutType(state) {
  const list = state.progress.workouts;
  return list.length ? list[list.length - 1].type : null;
}

/** Run after every real mutation: achievements are pure tests over state. */
function withAchievements(state) {
  const fresh = evaluateAchievements(state);
  if (!fresh.length) return state;
  const unlocked = { ...state.achievements.unlocked };
  const entries = fresh.map((id) => {
    unlocked[id] = new Date().toISOString();
    return { type: "achievement", achievementId: id };
  });
  return pushFxMany({ ...state, achievements: { unlocked } }, entries);
}

function logWorkout(state, record) {
  const workouts = [...state.progress.workouts, record].slice(-400);
  const player = { ...state.player, totalWorkouts: state.player.totalWorkouts + 1 };
  return {
    ...state,
    player,
    progress: { ...state.progress, workouts },
    stats: { ...state.stats, totalMinutes: (state.stats.totalMinutes || 0) + record.durationMin },
  };
}

// ── reducer ───────────────────────────────────────────────────────────────────

export function reducer(inputState, action) {
  const state = inputState;
  let next = state;
  let mutated = false;
  let events = [];
  const today = dateKey();

  switch (action.type) {
    case "hydrate": {
      next = action.state;
      break;
    }

    case "onboarding/complete": {
      const profile = { ...state.profile, ...action.profile, onboardingComplete: true };
      const base = { ...state, profile };
      const withDaily = ensureDaily(base);
      const plan = planForToday(profile, today, null);
      next = { ...withDaily, quests: generateQuests(profile, today, { isRestDay: plan.isRestDay }) };
      next = pushFx(next, { type: "welcome", name: profile.name });
      mutated = true;
      break;
    }

    case "profile/update": {
      const profile = { ...state.profile, ...action.profile };
      const base = { ...state, profile };
      const plan = planForToday(profile, today, lastWorkoutType(state));
      const regenerated = generateQuests(profile, today, { isRestDay: plan.isRestDay });
      // Preserve today's claim history when the board regenerates.
      if (state.quests?.date === today) {
        const claimed = new Set(state.quests.items.filter((q) => q.claimed).map((q) => q.id));
        regenerated.items = regenerated.items.map((q) => ({ ...q, claimed: claimed.has(q.id) }));
      }
      next = { ...base, quests: regenerated };
      mutated = true;
      break;
    }

    case "quests/roll": {
      next = ensureDaily(state);
      next = ensureQuests(next);
      mutated = next !== state;
      break;
    }

    case "daily/hydration": {
      const daily = ensureDaily(state).daily;
      next = ensureDaily({
        ...state,
        daily: { ...daily, hydration: Math.max(0, Math.min(8, daily.hydration + (action.delta || 1))) },
      });
      mutated = true;
      break;
    }

    case "daily/movement": {
      const daily = ensureDaily(state).daily;
      if (daily.movement) { next = state; break; }
      next = {
        ...state,
        daily: { ...daily, movement: true },
        stats: { ...state.stats, movementBreaks: (state.stats.movementBreaks || 0) + 1 },
      };
      mutated = true;
      break;
    }

    case "daily/rest": {
      const daily = ensureDaily(state).daily;
      if (daily.restMarked) { next = state; break; }
      next = {
        ...state,
        daily: { ...daily, restMarked: true },
        progress: { ...state.progress, restLogs: [...new Set([...(state.progress.restLogs || []), today])].slice(-200) },
        stats: { ...state.stats, restDaysLogged: (state.stats.restDaysLogged || 0) + 1 },
      };
      next = touchStreak(next);
      mutated = true;
      break;
    }

    case "daily/reflect": {
      const text = String(action.text || "").trim();
      if (text.length < 10) { next = state; break; }
      const daily = ensureDaily(state).daily;
      next = {
        ...state,
        daily: { ...daily, reflections: [...daily.reflections, { text: text.slice(0, 400), at: new Date().toISOString() }] },
        stats: { ...state.stats, reflections: (state.stats.reflections || 0) + 1 },
      };
      mutated = true;
      break;
    }

    case "quest/claim": {
      const quests = ensureQuests(state);
      const quest = quests.quests.items.find((q) => q.id === action.id);
      if (!quest || !isClaimable(quests, quest)) { next = state; break; }

      const items = quests.quests.items.map((q) => (q.id === quest.id ? { ...q, claimed: true } : q));
      const stats = { ...quests.stats, claimedQuests: (quests.stats.claimedQuests || 0) + 1 };
      if (quest.id === "hydration") stats.hydrationClaims = (stats.hydrationClaims || 0) + 1;
      if (quest.id === "reflection") stats.reflections = stats.reflections || 0;

      // If the player chose recovery over a scheduled workout, the main quest
      // pays the recovery rate — training is rewarded, but so is honest rest.
      const trainedToday = quests.progress.workouts.some((w) => w.date === today);
      const viaRecovery = quest.id === "daily_workout" && !quests.quests.isRestDay && !trainedToday;
      const paidXp = viaRecovery ? Math.min(quest.xp, XP_REWARDS.questRecovery) : quest.xp;

      let next2 = { ...quests, quests: { ...quests.quests, items }, stats };

      // Board clear bonus when every quest of the day is claimed.
      const cleared = items.every((q) => q.claimed);
      const bonus = cleared && !quests.quests.clearedBonus ? boardClearBonus(next2) : 0;
      if (bonus) next2 = { ...next2, quests: { ...next2.quests, clearedBonus: true } };

      const awarded = awardXp(next2, paidXp + bonus, `quest:${quest.id}`);
      next2 = awarded.state;
      events = awarded.events;
      next2 = touchStreak(next2);
      next2 = pushFx(next2, {
        type: "quest",
        questId: quest.id,
        xp: paidXp + bonus,
        title: viaRecovery ? "RECOVERY LOGGED" : quest.title,
        bonus,
      });
      mutated = true;
      next = next2;
      break;
    }

    case "workout/start": {
      if (state.activeWorkout) { next = state; break; }
      next = {
        ...state,
        activeWorkout: {
          session: action.session,
          source: action.source || { kind: "plan" },
          startedAt: new Date().toISOString(),
          elapsedSec: 0,
          paused: false,
        },
      };
      mutated = true;
      break;
    }

    case "workout/persist": {
      if (!state.activeWorkout) { next = state; break; }
      next = { ...state, activeWorkout: { ...state.activeWorkout, elapsedSec: action.elapsedSec ?? state.activeWorkout.elapsedSec } };
      break;
    }

    case "workout/pause": {
      if (!state.activeWorkout || state.activeWorkout.paused) { next = state; break; }
      next = { ...state, activeWorkout: { ...state.activeWorkout, paused: true } };
      mutated = true;
      break;
    }

    case "workout/resume": {
      if (!state.activeWorkout || !state.activeWorkout.paused) { next = state; break; }
      next = { ...state, activeWorkout: { ...state.activeWorkout, paused: false } };
      mutated = true;
      break;
    }

    case "workout/toggle-set": {
      const aw = state.activeWorkout;
      if (!aw || aw.paused) { next = state; break; }
      const { phaseIdx, itemIdx, setIndex } = action;
      const session = structuredClone(aw.session);
      const item = session.phases[phaseIdx]?.items[itemIdx];
      if (!item) { next = state; break; }
      const done = new Set(item.done);
      if (done.has(setIndex)) done.delete(setIndex);
      else if (done.size < item.sets) done.add(setIndex);
      item.done = [...done].sort((a, b) => a - b);
      next = { ...state, activeWorkout: { ...aw, session } };
      mutated = true;
      break;
    }

    case "workout/replace": {
      const aw = state.activeWorkout;
      if (!aw || !action.newId) { next = state; break; }
      next = { ...state, activeWorkout: { ...aw, session: replaceStep(aw.session, action.phaseIdx, action.itemIdx, action.newId) } };
      mutated = true;
      break;
    }

    case "workout/adjust": {
      const aw = state.activeWorkout;
      if (!aw) { next = state; break; }
      const session = adjustDifficulty(aw.session, action.direction, state.profile);
      next = { ...state, activeWorkout: { ...aw, session } };
      mutated = true;
      break;
    }

    case "workout/abandon": {
      if (!state.activeWorkout) { next = state; break; }
      next = { ...state, activeWorkout: null };
      next = pushFx(next, { type: "notice", message: "SESSION DISCARDED — nothing was logged." });
      mutated = true;
      break;
    }

    case "workout/finish": {
      const aw = state.activeWorkout;
      if (!aw) { next = state; break; }

      const minutes = Math.max(0, Math.round((action.elapsedSec || 0) / 60));
      const setsDone = action.setsDone ?? 0;
      const totalSets = action.totalSets ?? 0;
      const valid = minutes >= 5 || setsDone >= 4;

      if (!valid) {
        next = { ...state, activeWorkout: null };
        next = pushFx(next, {
          type: "notice",
          message: "SESSION TOO SHORT TO LOG — warm up properly next time. Nothing was awarded.",
        });
        mutated = true;
        break;
      }

      const session = aw.session;
      const source = aw.source || { kind: "plan" };
      const exercises = flatSteps(session).map((s) => s.exercise?.name || s.item.id);
      let baseXp = workoutXp(minutes, session.type);
      let dungeonBonus = 0;
      const partial = !isSessionComplete(session) && setsDone < totalSets * 0.6;
      // A session that qualifies by completed sets always logs at least one minute.
      const loggedMinutes = Math.max(1, minutes);

      let working = {
        ...state,
        activeWorkout: null,
      };

      working = logWorkout(working, {
        id: `w_${Date.now().toString(36)}`,
        date: today,
        name: session.name,
        type: session.type,
        durationMin: loggedMinutes,
        exercises: exercises.slice(0, 24),
        setsDone,
        totalSets,
        xp: baseXp,
        source: source.kind,
        dungeonId: source.dungeonId || null,
        completedAt: new Date().toISOString(),
      });

      const record = working.progress.workouts[working.progress.workouts.length - 1];

      // Dungeon clears award bonus XP once per day per dungeon; repeats still count.
      if (source.kind === "dungeon" && source.dungeonId) {
        const dungeon = getDungeon(source.dungeonId);
        const status = dungeonStatus(working, dungeon, today);
        if (dungeon) {
          const easy = Boolean(source.easy);
          const prev = working.dungeons.clears[dungeon.id] || { count: 0 };
          working = {
            ...working,
            dungeons: {
              ...working.dungeons,
              clears: {
                ...working.dungeons.clears,
                [dungeon.id]: {
                  count: prev.count + 1,
                  lastDate: today,
                  bestMinutes: prev.bestMinutes ? Math.min(prev.bestMinutes, loggedMinutes) : loggedMinutes,
                },
              },
            },
          };
          if (status.canAward) {
            dungeonBonus = easy ? dungeon.easyXp : dungeon.xp;
            working = pushFx(working, { type: "dungeon", dungeonId: dungeon.id, xp: dungeonBonus, easy });
          }
        }
      }

      const totalAward = baseXp + dungeonBonus;
      const awarded = awardXp(working, totalAward, `workout:${session.type}`);
      working = awarded.state;
      events = awarded.events;

      working = touchStreak(working);
      working = pushFx(working, {
        type: "workout",
        xp: totalAward,
        name: session.name,
        minutes: loggedMinutes,
        setsDone,
        totalSets,
        partial,
      });

      // Weekly boss readiness check.
      const bp = bossProgress(working, today);
      if (!bp.cleared && bp.count >= bp.boss.easyGoal) {
        working = pushFx(working, { type: "boss_ready", count: bp.count, goal: bp.boss.goal });
      }

      next = working;
      mutated = true;
      break;
    }

    case "boss/claim": {
      const bp = bossProgress(state, today);
      const mode = action.mode === "easy" ? "easy" : "full";
      const required = mode === "easy" ? bp.boss.easyGoal : bp.boss.goal;
      const already = mode === "easy" ? bp.easyCleared : bp.cleared;
      if (already || bp.count < required) { next = state; break; }

      const xp = mode === "easy" ? bp.boss.easyXp : bp.boss.xp;
      let working = {
        ...state,
        dungeons: {
          ...state.dungeons,
          boss: {
            ...state.dungeons.boss,
            week: mode === "full" ? bp.boss.week : state.dungeons.boss.week,
            easyWeek: mode === "easy" ? bp.boss.week : state.dungeons.boss.easyWeek,
            clearedCount: (state.dungeons.boss.clearedCount || 0) + 1,
            lastCleared: today,
            mode,
          },
        },
      };
      const awarded = awardXp(working, xp, "boss");
      working = awarded.state;
      events = awarded.events;
      working = touchStreak(working);
      working = pushFx(working, { type: "boss", xp, mode });
      next = working;
      mutated = true;
      break;
    }

    case "settings/update": {
      next = { ...state, settings: { ...state.settings, ...action.settings } };
      mutated = true;
      break;
    }

    case "fx/clear": {
      next = { ...state, fx: action.id ? state.fx.filter((f) => f.id !== action.id) : [] };
      break;
    }

    case "data/reset": {
      next = initialState();
      break;
    }

    case "data/import": {
      next = action.state;
      mutated = true;
      break;
    }

    default:
      next = state;
  }

  if (next === state) return state;

  // Achievements run after every real mutation (and after hydration/import).
  next = withAchievements(next);
  if (events.length) next = pushFxMany(next, events.filter((e) => !next.fx.some((f) => f.type === e.type && f.level === e.level)));
  return next;
}
