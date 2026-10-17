// Unlockable display themes. Pure data + predicates so they unit-test cleanly.

export const THEMES = [
  {
    id: "violet",
    name: "VIOLET GHOST",
    desc: "The system's default palette.",
    swatch: ["#7c3aed", "#22d3ee"],
    hint: "Default",
    test: () => true,
  },
  {
    id: "cyan",
    name: "AZURE ORACLE",
    desc: "Cold gate-light for deep focus.",
    swatch: ["#0891b2", "#22d3ee"],
    hint: "Reach Level 3",
    test: (state) => state.player.level >= 3,
  },
  {
    id: "ember",
    name: "EMBER MONARCH",
    desc: "Burnt gold for C-class hunters and above.",
    swatch: ["#d97706", "#fbbf24"],
    hint: "Reach Rank C",
    test: (state) => ["C", "B", "A", "S"].includes(state.player.rank),
  },
  {
    id: "verdant",
    name: "VERDANT WARDEN",
    desc: "Deep green earned through unbroken consistency.",
    swatch: ["#059669", "#34d399"],
    hint: "7-day streak",
    test: (state) => (state.player.longestStreak || 0) >= 7,
  },
];

export function getTheme(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

export function isThemeUnlocked(theme, state) {
  try {
    return Boolean(theme.test(state));
  } catch {
    return theme.id === "violet";
  }
}

/** Applied theme id — falls back to violet if a save references a locked/unknown theme. */
export function resolveTheme(id, state) {
  const theme = THEMES.find((t) => t.id === id);
  if (!theme) return "violet";
  return isThemeUnlocked(theme, state) ? theme.id : "violet";
}
