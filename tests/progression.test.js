import test from "node:test";
import assert from "node:assert/strict";
import {
  xpToNext,
  totalXpForLevel,
  rankForLevel,
  applyXp,
  workoutXp,
  computeAttributes,
  weeklyGoal,
  nextStreak,
  rankProgress,
} from "../src/state/progression.js";

test("level 1 requires 300 XP and the curve rises steadily", () => {
  assert.equal(xpToNext(1), 300);
  assert.equal(xpToNext(2), 350);
  assert.ok(xpToNext(10) > xpToNext(5));
  assert.equal(totalXpForLevel(1), 0);
  assert.equal(totalXpForLevel(2), 300);
});

test("ranks unlock at configured levels", () => {
  assert.equal(rankForLevel(1), "E");
  assert.equal(rankForLevel(3), "E");
  assert.equal(rankForLevel(4), "D");
  assert.equal(rankForLevel(8), "C");
  assert.equal(rankForLevel(13), "B");
  assert.equal(rankForLevel(19), "A");
  assert.equal(rankForLevel(26), "S");
});

test("applyXp levels up exactly once at the threshold", () => {
  const player = { level: 1, xp: 290, rank: "E", xpTotal: 290 };
  const r1 = applyXp(player, 5);
  assert.equal(r1.player.level, 1);
  assert.equal(r1.player.xp, 295);
  assert.equal(r1.levelUp, null);

  const r2 = applyXp(r1.player, 20);
  assert.equal(r2.player.level, 2);
  assert.equal(r2.player.xp, 15);
  assert.equal(r2.levelUp.from, 1);
  assert.equal(r2.levelUp.to, 2);
  assert.equal(r2.rankUp, null);
});

test("applyXp handles multi-level jumps and emits a rank-up", () => {
  const player = { level: 3, xp: 400, rank: "E", xpTotal: 900 };
  // Level 3 needs 400 → clears to level 4, then 500 for level 4 → leftover
  const r = applyXp(player, 600);
  assert.ok(r.player.level >= 4);
  assert.ok(r.rankUp, "crossing level 4 must promote E → D");
  assert.equal(r.rankUp.to, "D");
});

test("rewarded XP stays within a sane range", () => {
  for (const min of [5, 15, 30, 45, 60, 90]) {
    const xp = workoutXp(min, "strength");
    assert.ok(xp >= 30 && xp <= 160, `${min}min → ${xp}`);
  }
  assert.ok(workoutXp(20, "mobility") <= workoutXp(20, "strength"));
});

test("attributes grow only with logged activity and consistency", () => {
  const base = computeAttributes({ experience: "beginner", workouts: [], streak: 0, weeksHit: 0 });
  const trained = computeAttributes({
    experience: "beginner",
    workouts: Array.from({ length: 6 }, (_, i) => ({ type: i % 2 ? "endurance" : "strength", date: `2026-10-0${i + 1}` })),
    streak: 6,
    weeksHit: 2,
  });
  assert.ok(trained.strength > base.strength, "strength must rise with strength sessions");
  assert.ok(trained.endurance > base.endurance);
  assert.ok(trained.discipline > base.discipline);
  assert.equal(trained.mobility, base.mobility, "mobility sessions not done → no mobility growth");
  for (const v of Object.values(trained)) assert.ok(v >= 1 && v <= 99);
});

test("weekly goal respects player preference within 2–5", () => {
  assert.equal(weeklyGoal({ preferredDays: [1] }), 2);
  assert.equal(weeklyGoal({ preferredDays: [1, 2, 3, 4, 5, 6, 0] }), 5);
  assert.equal(weeklyGoal({ preferredDays: [1, 3, 5] }), 3);
  assert.equal(weeklyGoal({}), 4);
});

test("streak continues across consecutive days and resets after a gap", () => {
  assert.equal(nextStreak(0, null, "2026-10-10"), 1);
  assert.equal(nextStreak(3, "2026-10-10", "2026-10-10"), 3);
  assert.equal(nextStreak(3, "2026-10-10", "2026-10-11"), 4);
  assert.equal(nextStreak(3, "2026-10-10", "2026-10-13"), 1);
});

test("rank progress reports distance to the next rank", () => {
  const p = rankProgress(1, 150);
  assert.equal(p.done, false);
  assert.equal(p.nextRank, "D");
  assert.ok(p.pct > 0 && p.pct < 100);
  assert.equal(rankProgress(26, 100).done, true);
});
