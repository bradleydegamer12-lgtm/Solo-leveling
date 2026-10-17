// Unlockable shadow collection: companions, titles and badges earned through healthy milestones.

export const ACHIEVEMENTS = [
  {
    id: "first_quest",
    name: "FIRST QUEST",
    desc: "Claim your first daily quest.",
    reward: { type: "SHADOW", name: "Novice Shade" },
    rarity: "COMMON",
    test: (s) => (s.stats.claimedQuests || 0) >= 1,
  },
  {
    id: "first_workout",
    name: "AWAKENING",
    desc: "Complete your first real workout.",
    reward: { type: "SHADOW", name: "Ashen Sentinel" },
    rarity: "COMMON",
    test: (s) => s.progress.workouts.length >= 1,
  },
  {
    id: "seven_day",
    name: "SEVEN-DAY CONSISTENCY",
    desc: "Keep a 7-day activity streak.",
    reward: { type: "SHADOW", name: "Umbral Strider" },
    rarity: "RARE",
    test: (s) => Math.max(s.player.streak, s.player.longestStreak) >= 7,
  },
  {
    id: "strength_beginner",
    name: "STRENGTH BEGINNER",
    desc: "Complete 5 strength sessions.",
    reward: { type: "BADGE", name: "Iron Sigil" },
    rarity: "COMMON",
    test: (s) => s.progress.workouts.filter((w) => w.type === "strength").length >= 5,
  },
  {
    id: "mobility_master",
    name: "MOBILITY MASTER",
    desc: "Complete 10 mobility or recovery sessions.",
    reward: { type: "SHADOW", name: "Fluid Shade" },
    rarity: "RARE",
    test: (s) => s.progress.workouts.filter((w) => w.type === "mobility").length >= 10,
  },
  {
    id: "dungeon_clear",
    name: "DUNGEON CLEAR",
    desc: "Clear dungeons 3 times.",
    reward: { type: "SHADOW", name: "Dungeon Stalker" },
    rarity: "RARE",
    test: (s) => Object.values(s.dungeons?.clears || {}).reduce((n, r) => n + (r.count || 0), 0) >= 3,
  },
  {
    id: "recovery_specialist",
    name: "RECOVERY SPECIALIST",
    desc: "Log 5 rest or recovery days.",
    reward: { type: "BADGE", name: "Stillwater Seal" },
    rarity: "COMMON",
    test: (s) => (s.stats.restDaysLogged || 0) >= 5,
  },
  {
    id: "hydration_habit",
    name: "HYDRATION HABIT",
    desc: "Claim the hydration quest 7 times.",
    reward: { type: "SHADOW", name: "Tide Warden" },
    rarity: "COMMON",
    test: (s) => (s.stats.hydrationClaims || 0) >= 7,
  },
  {
    id: "reflective_mind",
    name: "REFLECTIVE MIND",
    desc: "Write 5 workout reflections.",
    reward: { type: "TITLE", name: "The Thoughtful" },
    rarity: "COMMON",
    test: (s) => (s.stats.reflections || 0) >= 5,
  },
  {
    id: "boss_slayer",
    name: "BOSS SLAYER",
    desc: "Defeat a Weekly Boss.",
    reward: { type: "TITLE", name: "Gatebreaker" },
    rarity: "EPIC",
    test: (s) => Boolean(s.dungeons?.boss?.clearedCount),
  },
  {
    id: "ten_workouts",
    name: "TEN FIGHTS WON",
    desc: "Complete 10 workouts.",
    reward: { type: "SHADOW", name: "Iron Wraith" },
    rarity: "RARE",
    test: (s) => s.progress.workouts.length >= 10,
  },
  {
    id: "level_5",
    name: "LEVEL 5 REACHED",
    desc: "Reach level 5.",
    reward: { type: "BADGE", name: "Rising Flame" },
    rarity: "COMMON",
    test: (s) => s.player.level >= 5,
  },
  {
    id: "rank_d",
    name: "D-CLASS HUNTER",
    desc: "Attain hunter rank D.",
    reward: { type: "TITLE", name: "D-Class Hunter" },
    rarity: "RARE",
    test: (s) => ["D", "C", "B", "A", "S"].includes(s.player.rank),
  },
  {
    id: "rank_c",
    name: "C-CLASS HUNTER",
    desc: "Attain hunter rank C.",
    reward: { type: "SHADOW", name: "Gloom Herald" },
    rarity: "EPIC",
    test: (s) => ["C", "B", "A", "S"].includes(s.player.rank),
  },
  {
    id: "hundred_xp",
    name: "SOUL HARVEST",
    desc: "Earn 2,500 total XP.",
    reward: { type: "BADGE", name: "Soul Ember" },
    rarity: "RARE",
    test: (s) => (s.player.xpTotal || 0) >= 2500,
  },
];

export function collectionGroups() {
  return ["SHADOW", "TITLE", "BADGE"];
}

/** Returns ids of achievements unlocked for the first time by this state. */
export function evaluateAchievements(state) {
  const unlocked = state.achievements?.unlocked || {};
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (unlocked[a.id]) continue;
    let hit = false;
    try {
      hit = Boolean(a.test(state));
    } catch {
      hit = false;
    }
    if (hit) fresh.push(a.id);
  }
  return fresh;
}

export function getAchievement(id) {
  return ACHIEVEMENTS.find((a) => a.id === id) || null;
}
