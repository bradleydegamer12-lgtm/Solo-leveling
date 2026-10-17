import test from "node:test";
import assert from "node:assert/strict";
import { THEMES, getTheme, isThemeUnlocked, resolveTheme } from "../src/state/themes.js";

const player = (over = {}) => ({
  player: { level: 1, rank: "E", streak: 0, longestStreak: 0, ...over },
});

test("theme catalogue ships the default plus three unlockables", () => {
  assert.equal(THEMES.length, 4);
  assert.equal(THEMES[0].id, "violet");
  assert.ok(THEMES.every((t) => t.swatch?.length === 2 && t.name && t.hint));
  assert.equal(getTheme("nope").id, "violet");
});

test("themes lock behind healthy milestones, never purchases", () => {
  const fresh = player();
  assert.equal(isThemeUnlocked(getTheme("violet"), fresh), true);
  assert.equal(isThemeUnlocked(getTheme("cyan"), fresh), false, "cyan needs level 3");
  assert.equal(isThemeUnlocked(getTheme("ember"), fresh), false, "ember needs rank C");
  assert.equal(isThemeUnlocked(getTheme("verdant"), fresh), false, "verdant needs a 7-day streak");

  assert.equal(isThemeUnlocked(getTheme("cyan"), player({ level: 3 })), true);
  assert.equal(isThemeUnlocked(getTheme("ember"), player({ rank: "C" })), true);
  assert.equal(isThemeUnlocked(getTheme("ember"), player({ rank: "S" })), true, "higher ranks keep it");
  assert.equal(isThemeUnlocked(getTheme("verdant"), player({ longestStreak: 7 })), true);
  assert.equal(isThemeUnlocked(getTheme("verdant"), player({ longestStreak: 6 })), false);
});

test("resolveTheme falls back to violet for locked or unknown saves", () => {
  assert.equal(resolveTheme("cyan", player({ level: 5 })), "cyan");
  assert.equal(resolveTheme("cyan", player({ level: 1 })), "violet", "stale locked save must not crash");
  assert.equal(resolveTheme("quantum", player({ level: 99 })), "violet");
  assert.equal(resolveTheme(undefined, player()), "violet");
});
