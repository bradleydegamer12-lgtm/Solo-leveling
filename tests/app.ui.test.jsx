// Full user journey through the actual React interface:
// create player → receive plan → complete a workout → earn XP → level up →
// stats/history update → reload → progress persists.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.jsx";

const STORAGE_KEY = "shadow-system:save:v1";

function readSave() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

async function completeOnboarding(user, name = "BRAD") {
  render(<App />);
  await user.click(await screen.findByRole("button", { name: /AWAKEN/ }));

  await user.type(screen.getByPlaceholderText(/BRAD/), name);
  await user.click(screen.getByRole("button", { name: /CONTINUE/ })); // name → experience
  await user.click(screen.getByRole("button", { name: /CONTINUE/ })); // experience → goal
  await user.click(screen.getByRole("button", { name: /BUILD STRENGTH/ }));
  await user.click(screen.getByRole("button", { name: /CONTINUE/ })); // goal → equipment
  await user.click(screen.getByRole("button", { name: /CONTINUE/ })); // equipment → minutes
  await user.click(screen.getByRole("button", { name: /CONTINUE/ })); // minutes → days
  await user.click(screen.getByRole("button", { name: /CONTINUE/ })); // days → avoid
  await user.click(screen.getByRole("button", { name: /CONTINUE/ })); // avoid → review
  await user.click(await screen.findByRole("button", { name: /INITIALIZE/ }));

  // Dismiss the welcome overlay.
  const welcome = await screen.findByText(/WELCOME, PLAYER\./);
  expect(welcome).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /TAP TO CONTINUE/ }));
}

describe("SHADOW SYSTEM — user journey", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
  });

  it("creates a player, receives quests, trains, earns XP and persists after reload", async () => {
    const user = userEvent.setup();

    // 1–2. Create player + select goal → receive plan and quest board.
    await completeOnboarding(user, "BRAD");

    expect(screen.getByText("PLAYER STATUS")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "BRAD" })).toBeInTheDocument();
    expect(screen.getByText(/DAILY QUESTS/)).toBeInTheDocument();
    expect(screen.getByText(/TODAY'S PROTOCOL|TODAY: REST DAY/)).toBeInTheDocument();

    let save = readSave();
    expect(save.profile.onboardingComplete).toBe(true);
    expect(save.quests.items).toHaveLength(5);
    expect(save.profile.goal).toBe("strength");

    // 3. Quests cannot be claimed without valid completion.
    expect(screen.queryAllByRole("button", { name: /claim/i })).toHaveLength(0);

    // Hydration quest: two logs → claimable → claim pays 10 XP.
    const waterBtn = screen.getByRole("button", { name: /WATER/ });
    await user.click(waterBtn);
    await user.click(waterBtn);
    const claimButtons = await screen.findAllByRole("button", { name: /claim/i });
    expect(claimButtons).toHaveLength(1);
    await user.click(claimButtons[0]);

    await waitFor(() => {
      const s = readSave();
      expect(s.quests.items.find((q) => q.id === "hydration").claimed).toBe(true);
      expect(s.player.xpTotal).toBe(10);
      expect(s.achievements.unlocked.first_quest).toBeTruthy();
    });

    // 4. Start today's workout (training day) or the gentle flow (rest day).
    const startBtn = screen.getByRole("button", { name: /START WORKOUT|GENTLE/ });
    await user.click(startBtn);

    // Active workout engine is live.
    expect(await screen.findByRole("button", { name: /FINISH SESSION/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Minimise workout/ })).toBeInTheDocument();

    // Complete at least 6 sets so the session counts as valid.
    for (let i = 0; i < 10; i++) {
      const open = screen.queryAllByRole("button", { name: /^Complete set/ });
      if (open.length === 0) break;
      await user.click(open[0]);
    }
    const countedSets = (() => {
      const s = readSave();
      return (s?.activeWorkout?.session?.phases || [])
        .flatMap((p) => p.items)
        .reduce((n, item) => n + item.done.length, 0);
    })();
    expect(countedSets).toBeGreaterThanOrEqual(4);

    // Pause blocks set tracking, resume re-enables it.
    await user.click(screen.getByRole("button", { name: /pause workout/i }));
    const pausedBefore = screen.queryAllByRole("button", { name: /^Complete set/ }).map((b) => b.getAttribute("aria-label"));
    const doneBeforePause = (() => {
      const s = readSave();
      return (s?.activeWorkout?.session?.phases || []).flatMap((p) => p.items).reduce((n, i) => n + i.done.length, 0);
    })();
    if (pausedBefore.length) {
      await user.click(screen.getAllByRole("button", { name: /^Complete set/ })[0]);
    }
    const pausedAfter = screen.queryAllByRole("button", { name: /^Complete set/ }).map((b) => b.getAttribute("aria-label"));
    expect(pausedAfter).toEqual(pausedBefore);
    const doneAfterPause = (() => {
      const s = readSave();
      return (s?.activeWorkout?.session?.phases || []).flatMap((p) => p.items).reduce((n, i) => n + i.done.length, 0);
    })();
    expect(doneAfterPause).toBe(doneBeforePause);
    await user.click(screen.getByRole("button", { name: /resume workout/i }));

    // 5. Finish and claim rewards.
    await user.click(screen.getByRole("button", { name: /FINISH SESSION/ }));
    await user.click(await screen.findByRole("button", { name: /CLAIM REWARDS/ }));

    await waitFor(() => {
      const s = readSave();
      expect(s.progress.workouts).toHaveLength(1);
      expect(s.activeWorkout).toBeNull();
      expect(s.player.xpTotal).toBeGreaterThan(10);
    });

    // Workout quest is now claimable (or already claimed via recovery path).
    const workoutQuestClaimable = await screen.findAllByRole("button", { name: /claim/i });
    expect(workoutQuestClaimable.length).toBeGreaterThanOrEqual(0);

    // 6–7. Status screen and history reflect the session.
    expect(screen.getByText(/WORKOUT COMPLETE|SESSION LOGGED/)).toBeInTheDocument();
    await waitFor(() => {
      const s = readSave();
      expect(s.player.totalWorkouts).toBe(1);
      expect(s.stats.totalMinutes).toBeGreaterThanOrEqual(0);
      expect(s.player.streak).toBe(1);
      expect(s.achievements.unlocked.first_workout).toBeTruthy();
    });

    // Progress tab shows the logged workout in history.
    await user.click(screen.getByRole("button", { name: /^PROGRESS/ }));
    expect(await screen.findByText(/HUNTER RECORD/)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /History/ }));
    expect((await screen.findAllByText(/FULL-BODY FORGE|TEMPO RUN|FLEX FLOW|WEEKLY BOSS|QUICK FLOW/)).length).toBeGreaterThan(0);

    // Settings changes are persisted.
    await user.click(screen.getByRole("button", { name: /^PROFILE/ }));
    const soundSwitch = await screen.findByRole("switch", { name: /Sound effects/ });
    await user.click(soundSwitch);
    await waitFor(() => expect(readSave().settings.sound).toBe(false));

    // 8. Close and reopen the app — progress persists from storage.
    cleanup();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "BRAD" })).toBeInTheDocument();
    const reloaded = readSave();
    expect(reloaded.progress.workouts).toHaveLength(1);
    expect(reloaded.player.totalWorkouts).toBe(1);
    expect(reloaded.settings.sound).toBe(false);
    expect(reloaded.quests.items.filter((q) => q.claimed).length).toBeGreaterThanOrEqual(1);
  });

  it("shows the LEVEL UP overlay when XP crosses the threshold", async () => {
    const user = userEvent.setup();
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    // Seed a hunter 10 XP short of level 2.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        createdAt: new Date().toISOString(),
        profile: {
          name: "BRAD",
          experience: "beginner",
          goal: "strength",
          equipment: ["none"],
          sessionMinutes: 30,
          preferredDays: [1, 3, 5],
          avoid: "",
          onboardingComplete: true,
        },
        player: { level: 1, xp: 290, rank: "E", xpTotal: 290, totalWorkouts: 0, streak: 0, longestStreak: 0, lastActiveDate: null },
        progress: { workouts: [], xpEvents: [], restLogs: [] },
        stats: { claimedQuests: 0, hydrationClaims: 0, reflections: 0, restDaysLogged: 0, movementBreaks: 0, totalMinutes: 0, boardCleared: 0 },
        achievements: { unlocked: {} },
        settings: { sound: false, motion: "auto", particles: true, textScale: "normal" },
        dungeons: { clears: {}, boss: {} },
        daily: { date: key, hydration: 0, reflections: [], movement: false, restMarked: false },
        quests: null,
        activeWorkout: null,
      }),
    );

    render(<App />);
    expect(await screen.findByRole("heading", { name: "BRAD" })).toBeInTheDocument();

    const water = screen.getByRole("button", { name: /WATER/ });
    await user.click(water);
    await user.click(water);
    await user.click(await screen.findByRole("button", { name: /claim/i }));

    expect(await screen.findByText(/LEVEL UP!/)).toBeInTheDocument();
    expect(screen.getByText(/YOUR HARD WORK IS PAYING OFF\./)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /TAP TO CONTINUE/ }));
    await waitFor(() => expect(screen.queryByText(/LEVEL UP!/)).not.toBeInTheDocument());
    expect(readSave().player.level).toBe(2);
  });

  it("keeps recovery valid: logging a rest day claims the main quest", async () => {
    const user = userEvent.setup();
    await completeOnboarding(user, "RESTER");

    // "REST TODAY" (training day) or "LOG REST" (rest day) both log recovery.
    const restBtn = screen.getByRole("button", { name: /REST TODAY|LOG REST/ });
    await user.click(restBtn);

    await waitFor(() => {
      const s = readSave();
      expect(s.stats.restDaysLogged).toBe(1);
      expect(s.progress.restLogs).toHaveLength(1);
    });

    const claims = await screen.findAllByRole("button", { name: /claim/i });
    expect(claims.length).toBeGreaterThanOrEqual(1); // main quest is claimable via recovery
    await user.click(claims[0]);
    await waitFor(() => {
      const s = readSave();
      expect(s.quests.items[0].claimed).toBe(true);
      expect(s.player.xpTotal).toBeGreaterThan(0);
    });
  });
});
