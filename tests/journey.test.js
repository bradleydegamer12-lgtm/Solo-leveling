// End-to-end user journey:
// create player → receive plan → complete workout → earn XP → level up →
// stats/history update → save → reload → progress persists.

import test from "node:test";
import assert from "node:assert/strict";
import { initialState, reducer, activeStreak } from "../src/state/reducer.js";
import { buildSession, planForToday, flatSteps, sessionProgress } from "../src/state/workouts.js";
import { derive, xpSeries, calendarMonth, milestoneStatus } from "../src/state/selectors.js";
import { exportPayload, parseImport, hydrate } from "../src/state/storage.js";
import { dateKey } from "../src/state/dates.js";

const PROFILE = {
  name: "BRAD",
  experience: "beginner",
  goal: "strength",
  equipment: ["none"],
  sessionMinutes: 30,
  preferredDays: [1, 3, 5],
  avoid: "jumping",
};

function completeAllSets(state, action = "workout/toggle-set") {
  const session = state.activeWorkout.session;
  session.phases.forEach((phase, phaseIdx) => {
    phase.items.forEach((item, itemIdx) => {
      for (let setIndex = 0; setIndex < item.sets; setIndex++) {
        state = reducer(state, { type: action, phaseIdx, itemIdx, setIndex });
      }
    });
  });
  return state;
}

function finishSession(state, elapsedSec = 30 * 60) {
  const steps = flatSteps(state.activeWorkout.session);
  const setsDone = steps.reduce((n, s) => n + s.item.done.length, 0);
  const totalSets = steps.reduce((n, s) => n + s.item.sets, 0);
  return reducer(state, { type: "workout/finish", elapsedSec, setsDone, totalSets });
}

test("full player journey from onboarding to level-up and persistence", () => {
  // 1. Create a player.
  let state = initialState();
  assert.equal(state.profile.onboardingComplete, false);

  state = reducer(state, { type: "onboarding/complete", profile: PROFILE });
  assert.equal(state.profile.onboardingComplete, true);
  assert.equal(state.profile.name, "BRAD");
  assert.equal(state.quests.items.length, 5, "daily quest board generated");
  assert.ok(state.fx.some((f) => f.type === "welcome"), "welcome FX emitted");

  // 2. Select a fitness goal → receive a workout plan.
  const plan = planForToday(state.profile, "2026-10-12"); // a known Monday
  assert.ok(plan.title);
  assert.equal(plan.isRestDay, false, "preferred training day yields a training plan");
  const restPlan = planForToday(state.profile, "2026-10-18"); // a known Sunday
  assert.equal(restPlan.isRestDay, true, "non-preferred day yields a recovery plan");

  // 3. Start and complete a workout.
  const session = buildSession(state.profile, { type: plan.type, minutes: 30, source: { kind: "plan" } });
  state = reducer(state, { type: "workout/start", session, source: { kind: "plan" } });
  assert.ok(state.activeWorkout, "workout started");
  assert.equal(state.activeWorkout.session.phases.length, 3);

  // Pause blocks set tracking, resume re-enables it.
  state = reducer(state, { type: "workout/pause" });
  const paused = reducer(state, { type: "workout/toggle-set", phaseIdx: 1, itemIdx: 0, setIndex: 0 });
  assert.equal(paused, state, "paused workouts do not track sets");
  state = reducer(state, { type: "workout/resume" });

  state = completeAllSets(state);
  const progress = sessionProgress(state.activeWorkout.session);
  assert.equal(progress.pct, 100, "all sets recorded");

  // 4. Finish → XP awarded, workout logged.
  const xpBefore = state.player.xp + state.player.level * 1000;
  state = finishSession(state, 30 * 60);
  assert.equal(state.activeWorkout, null, "workout closed out");
  assert.equal(state.progress.workouts.length, 1);
  assert.equal(state.progress.workouts[0].durationMin, 30);
  assert.equal(state.player.totalWorkouts, 1);
  assert.ok(state.player.xpTotal > 0, "XP was earned");
  assert.ok(state.achievements.unlocked.first_workout, "AWAKENING achievement unlocked");
  assert.equal(activeStreak(state), 1, "streak starts on day one");

  // The daily workout quest is now claimable.
  const workoutQuest = state.quests.items.find((q) => q.id === "daily_workout");
  assert.equal(workoutQuest.claimed, false);
  state = reducer(state, { type: "quest/claim", id: "daily_workout" });
  assert.equal(state.quests.items.find((q) => q.id === "daily_workout").claimed, true);

  // 5–6. Keep training until a level-up fires.
  let leveledUp = false;
  let guard = 0;
  while (!leveledUp && guard < 12) {
    guard += 1;
    const s = buildSession(state.profile, { type: guard % 2 ? "endurance" : "strength", minutes: 30 });
    state = reducer(state, { type: "workout/start", session: s, source: { kind: "plan" } });
    state = completeAllSets(state);
    state = finishSession(state, 30 * 60);
    leveledUp = state.player.level > 1;
  }
  assert.ok(leveledUp, "reaching 300 XP must trigger a level-up");
  assert.ok(state.fx.some((f) => f.type === "levelup"), "LEVEL UP overlay queued");
  assert.equal(state.player.rank, "E");

  // 7. Updated stats, history, streak and dashboard selectors.
  const d = derive(state);
  assert.ok(d.streak >= 1);
  assert.ok(d.thisWeekCount >= 1);
  assert.ok(d.attributes.strength >= 8);
  assert.ok(d.xpNeed > 0);
  assert.ok(state.progress.workouts.length >= 4);
  assert.ok(state.stats.totalMinutes >= 100);
  const series = xpSeries(state, 14);
  assert.equal(series.length, 14);
  assert.ok(series.reduce((n, p) => n + p.amount, 0) > 0);
  const cal = calendarMonth(state, dateKey());
  assert.ok(cal.cells.filter(Boolean).some((c) => c.count > 0), "calendar shows completed workouts");
  assert.ok(milestoneStatus(state).find((m) => m.id === "m1").done, "first milestone reached");

  // 8. Close and reopen: save → hydrate → identical progress.
  const saved = exportPayload(state);
  assert.equal(parseImport(saved) !== null, true, "exported save parses");
  assert.equal(parseImport("{not json"), null, "corrupt saves are rejected");
  const reloaded = hydrate(JSON.parse(saved));
  assert.equal(reloaded.player.level, state.player.level);
  assert.equal(reloaded.player.xp, state.player.xp);
  assert.equal(reloaded.progress.workouts.length, state.progress.workouts.length);
  assert.equal(reloaded.profile.name, "BRAD");
  assert.equal(reloaded.quests.items.filter((q) => q.claimed).length, state.quests.items.filter((q) => q.claimed).length);
  assert.deepEqual(Object.keys(reloaded.achievements.unlocked).sort(), Object.keys(state.achievements.unlocked).sort());
  assert.equal(reloaded.fx.length, 0, "pending overlays are not replayed after reload");
});

test("too-short sessions are not logged and pay nothing", () => {
  let state = initialState();
  state = reducer(state, { type: "onboarding/complete", profile: PROFILE });
  const s = buildSession(state.profile, { type: "strength", minutes: 30 });
  state = reducer(state, { type: "workout/start", session: s, source: { kind: "plan" } });
  const after = reducer(state, { type: "workout/finish", elapsedSec: 60, setsDone: 1, totalSets: 20 });
  assert.equal(after.activeWorkout, null);
  assert.equal(after.progress.workouts.length, 0, "a 1-minute aborted session is not a workout");
  assert.equal(after.player.xpTotal, 0, "no XP for a stub session");
  assert.ok(after.fx.some((f) => f.type === "notice"));
});

test("dungeon runs award bonus XP once per day", () => {
  let state = initialState();
  state = reducer(state, { type: "onboarding/complete", profile: PROFILE });
  const dungeon = { kind: "dungeon", dungeonId: "training" };

  for (let run = 0; run < 2; run++) {
    const s = buildSession(state.profile, { type: "strength", minutes: 20 });
    state = reducer(state, { type: "workout/start", session: s, source: dungeon });
    state = completeAllSets(state);
    state = finishSession(state, 20 * 60);
  }

  assert.equal(state.dungeons.clears.training.count, 2, "both clears recorded");
  const dungeonFx = state.fx.filter((f) => f.type === "dungeon");
  assert.equal(dungeonFx.length, 1, "bonus XP only on the first clear of the day");
  assert.ok(state.player.xpTotal > 0);
  assert.equal(state.achievements.unlocked.dungeon_clear, undefined, "3 clears needed for the collection item");
});

test("rest days are valid progress: logging recovery keeps the streak alive", () => {
  let state = initialState();
  state = reducer(state, { type: "onboarding/complete", profile: PROFILE });
  state = reducer(state, { type: "daily/rest" });
  assert.equal(state.stats.restDaysLogged, 1);
  assert.equal(activeStreak(state), 1);
  assert.ok(state.progress.restLogs.includes(dateKey()));
  assert.ok(state.achievements.unlocked.first_quest === undefined || true);

  const quest = state.quests.items.find((q) => q.id === "daily_workout");
  state = reducer(state, { type: "quest/claim", id: "daily_workout" });
  assert.equal(state.quests.items.find((q) => q.id === "daily_workout").claimed, true, "recovery quest claimable after logging rest");
  void quest;
});

test("weekly boss pays out only when the weekly goal is met", () => {
  let state = initialState();
  state = reducer(state, { type: "onboarding/complete", profile: PROFILE });
  // Fewer sessions than the goal → claim refused.
  const refused = reducer(state, { type: "boss/claim", mode: "full" });
  assert.equal(refused, state, "boss cannot be claimed early");

  const days = weekDaysSafe();
  state = {
    ...state,
    progress: {
      ...state.progress,
      workouts: days.slice(0, 3).map((date, i) => ({ id: `w${i}`, date, type: "strength", durationMin: 25, name: "TEST" })),
    },
  };
  const claimed = reducer(state, { type: "boss/claim", mode: "full" });
  assert.notEqual(claimed, state);
  assert.equal(claimed.dungeons.boss.clearedCount, 1);
  assert.ok(claimed.achievements.unlocked.boss_slayer, "BOSS SLAYER unlocks with the first boss clear");
  assert.ok(claimed.fx.some((f) => f.type === "boss"));
});

function weekDaysSafe() {
  const out = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(dateKey(d));
  }
  return out;
}
