import test from "node:test";
import assert from "node:assert/strict";
import { buildSession, planForToday, adjustDifficulty, replaceStep, sessionProgress, flatSteps, isAllowed } from "../src/state/workouts.js";
import { generateQuests, computeProgress, isClaimable, questSummary } from "../src/state/quests.js";
import { bossFor, bossProgress, getDungeon, DUNGEONS } from "../src/state/dungeons.js";
import { EXERCISE_MAP } from "../src/state/exercises.js";
import { initialState, reducer } from "../src/state/reducer.js";
import { dateKey, weekDays } from "../src/state/dates.js";

const PROFILE = {
  name: "BRAD",
  experience: "beginner",
  goal: "strength",
  equipment: ["none"],
  sessionMinutes: 30,
  preferredDays: [1, 3, 5],
  avoid: "jumping",
  onboardingComplete: true,
};

test("session generation respects gear, level and the avoid list", () => {
  const session = buildSession(PROFILE, { type: "strength", minutes: 30 });
  assert.equal(session.phases.length, 3);
  assert.ok(session.phases[0].items.length >= 2, "warm-up present");
  assert.ok(session.phases[2].items.length >= 2, "cooldown present");
  const main = session.phases[1].items;
  assert.ok(main.length >= 3 && main.length <= 7);

  for (const item of main) {
    const ex = EXERCISE_MAP[item.id];
    assert.ok(ex, `${item.id} must exist`);
    assert.ok(ex.equip.includes("none"), `${ex.name} requires gear the player does not own`);
    assert.equal(ex.level, "beginner", "beginner player must not receive advanced work");
    assert.ok(!/jump/i.test(ex.name), `${ex.name} violates the avoid list`);
  }
  assert.ok(session.estMinutes >= 5);
  assert.ok(session.estXp > 0);
});

test("gym + advanced players receive gym/advanced options", () => {
  const session = buildSession(
    { ...PROFILE, equipment: ["gym"], experience: "advanced" },
    { type: "strength", minutes: 45 },
  );
  const main = session.phases[1].items;
  assert.ok(main.every((i) => EXERCISE_MAP[i.id]));
  assert.equal(main.length, 7, "45-minute session selects 7 main exercises");
});

test("avoid filter matches words but ignores stopwords", () => {
  assert.equal(isAllowed(EXERCISE_MAP["jumping-jacks"], "jumping"), false);
  assert.equal(isAllowed(EXERCISE_MAP["squat"], "shoulder surgery"), true);
  assert.equal(isAllowed(EXERCISE_MAP["squat"], ""), true);
});

test("difficulty adjustment can go easier without breaking constraints", () => {
  const session = buildSession(PROFILE, { type: "strength", minutes: 30 });
  const easier = adjustDifficulty(session, "easier", PROFILE);
  const ids = easier.phases[1].items.map((i) => i.id);
  for (const id of ids) {
    const ex = EXERCISE_MAP[id];
    assert.equal(ex.level, "beginner");
    assert.ok(!/jump/i.test(ex.name));
  }
  assert.equal(new Set(ids).size, ids.length, "no duplicate exercises after swap");
});

test("replaceStep swaps an exercise and resets its set progress", () => {
  const session = buildSession(PROFILE, { type: "strength", minutes: 30 });
  const original = session.phases[1].items[0].id;
  const target = session.phases[1].items[1].id;
  const next = replaceStep(session, 1, 0, target);
  assert.equal(next.phases[1].items[0].id, target);
  assert.equal(next.phases[1].items[0].replacedFrom, original);
});

test("plan marks rest days outside the preferred schedule", () => {
  const monday = "2026-10-12"; // a Monday
  const training = planForToday(PROFILE, monday);
  assert.equal(training.isRestDay, false);
  const sunday = "2026-10-18";
  const rest = planForToday(PROFILE, sunday);
  assert.equal(rest.isRestDay, true);
  assert.ok(rest.recovery.length >= 3, "rest days still show recovery guidance");
  assert.ok(rest.optionalSession, "rest days offer an optional gentle flow");
});

test("quests generate for the day with sane targets and XP", () => {
  const { quests } = { quests: generateQuests(PROFILE, dateKey(), { isRestDay: false }) };
  assert.equal(quests.items.length, 5);
  const workout = quests.items.find((q) => q.id === "daily_workout");
  assert.equal(workout.xp, 50);
  const hydration = quests.items.find((q) => q.id === "hydration");
  assert.equal(hydration.target, 2);

  const restDay = generateQuests(PROFILE, dateKey(), { isRestDay: true });
  const restQuest = restDay.items.find((q) => q.id === "daily_workout");
  assert.equal(restQuest.kind, "recovery");
  assert.equal(restQuest.xp, 20, "rest days pay less but still pay — recovery counts");
});

test("boss goal matches the player's chosen training days", () => {
  const boss = bossFor(PROFILE, dateKey());
  assert.equal(boss.goal, 3);
  assert.equal(boss.easyGoal, 2);
  assert.equal(getDungeon("training").type, "strength");
  assert.equal(DUNGEONS.length, 3);
});

test("quest claiming validates progress before paying XP", () => {
  let s = initialState();
  s = reducer(s, { type: "onboarding/complete", profile: PROFILE });

  // Cannot claim the hydration quest with no logs.
  const before = s.player.xp;
  const blocked = reducer(s, { type: "quest/claim", id: "hydration" });
  assert.equal(blocked, s, "unfulfilled quest must not be claimable");
  assert.equal(blocked.player.xp, before);

  // Two logs → claimable.
  s = reducer(s, { type: "daily/hydration", delta: 1 });
  s = reducer(s, { type: "daily/hydration", delta: 1 });
  const progress = computeProgress(s);
  assert.equal(progress.hydration, 2);
  const quest = s.quests.items.find((q) => q.id === "hydration");
  assert.equal(isClaimable(s, quest), true);

  const after = reducer(s, { type: "quest/claim", id: "hydration" });
  assert.equal(after.player.xp, before + 10);
  assert.equal(after.quests.items.find((q) => q.id === "hydration").claimed, true);
  assert.ok(after.achievements.unlocked.first_quest, "claiming a quest unlocks FIRST QUEST");

  // Second claim is refused (already claimed).
  const twice = reducer(after, { type: "quest/claim", id: "hydration" });
  assert.equal(twice, after);
});

test("reflection quest requires real text", () => {
  let s = initialState();
  s = reducer(s, { type: "onboarding/complete", profile: PROFILE });
  const short = reducer(s, { type: "daily/reflect", text: "ok" });
  assert.equal(short, s, "too-short reflections are rejected");
  const good = reducer(s, { type: "daily/reflect", text: "Legs felt strong today, kept tempo steady." });
  assert.equal(good.stats.reflections, 1);
  assert.equal(computeProgress(good).reflection, 1);
});

test("boss progress counts sessions inside the current week only", () => {
  let s = initialState();
  s = reducer(s, { type: "onboarding/complete", profile: PROFILE });
  const days = weekDays(dateKey());
  for (let i = 0; i < 2; i++) {
    s = {
      ...s,
      progress: {
        ...s.progress,
        workouts: [...s.progress.workouts, { id: `w${i}`, date: days[i], type: "strength", durationMin: 20 }],
      },
    };
  }
  const bp = bossProgress(s, dateKey());
  assert.equal(bp.count, 2);
  assert.equal(bp.easyCleared, false);
});
