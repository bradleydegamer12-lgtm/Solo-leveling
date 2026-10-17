// Every tab must be functional: Train builds sessions, Dungeons award clears,
// Progress charts render from real data, Profile settings persist.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/App.jsx";

const STORAGE_KEY = "shadow-system:save:v1";
const readSave = () => JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");

async function onboard(user, name = "TABS") {
  render(<App />);
  await user.click(await screen.findByRole("button", { name: /AWAKEN/ }));
  await user.type(screen.getByPlaceholderText(/BRAD/), name);
  await user.click(screen.getByRole("button", { name: /CONTINUE/ }));
  await user.click(screen.getByRole("button", { name: /CONTINUE/ }));
  await user.click(screen.getByRole("button", { name: /CONTINUE/ }));
  await user.click(screen.getByRole("button", { name: /CONTINUE/ }));
  await user.click(screen.getByRole("button", { name: /CONTINUE/ }));
  await user.click(screen.getByRole("button", { name: /CONTINUE/ }));
  await user.click(screen.getByRole("button", { name: /CONTINUE/ }));
  await user.click(await screen.findByRole("button", { name: /INITIALIZE/ }));
  await user.click(await screen.findByRole("button", { name: /TAP TO CONTINUE/ }));
}

async function finishCurrentWorkout(user, { minimize = false } = {}) {
  if (minimize) await user.click(screen.getByRole("button", { name: /Minimise workout/ }));
  for (let i = 0; i < 10; i++) {
    const open = screen.queryAllByRole("button", { name: /^Complete set/ });
    if (!open.length) break;
    await user.click(open[0]);
  }
  await user.click(screen.getByRole("button", { name: /FINISH SESSION/ }));
  await user.click(await screen.findByRole("button", { name: /CLAIM REWARDS/ }));
}

describe("tab functionality", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it("Train: builds a custom session, opens the library, and handles pause/minimise/resume/discard", async () => {
    const user = userEvent.setup();
    await onboard(user);

    await user.click(screen.getByRole("button", { name: /^TRAIN/ }));
    expect(await screen.findByText(/WORKOUT ENGINE/)).toBeInTheDocument();

    // Session builder: switch focus/duration/difficulty and reroll the preview.
    await user.click(screen.getByRole("button", { name: /ENDURANCE/ }));
    await user.click(screen.getByRole("button", { name: /^45/ }));
    await user.click(screen.getByRole("button", { name: /INTERMEDIATE/ }));
    expect(screen.getByText(/PREVIEW/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /regenerate preview/i }));

    // Exercise library detail modal.
    const firstMove = screen.getAllByRole("button", { name: /View / })[0];
    await user.click(firstMove);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Close/ }));

    // Enter the session → engine opens → minimise → resume banner → discard.
    await user.click(screen.getByRole("button", { name: /ENTER SESSION/ }));
    expect(await screen.findByRole("button", { name: /FINISH SESSION/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Minimise workout/ }));
    expect(await screen.findByText(/SESSION IN PROGRESS/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /RESUME/ }));
    expect(await screen.findByRole("button", { name: /FINISH SESSION/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Minimise workout/ }));
    expect(await screen.findByText(/SESSION IN PROGRESS/)).toBeInTheDocument();

    // Discard path.
    await user.click(screen.getByRole("button", { name: /RESUME/ }));
    await user.click(await screen.findByRole("button", { name: /Minimise workout/ }));
    await screen.findByText(/SESSION IN PROGRESS/);
    await user.click(screen.getByRole("button", { name: /RESUME/ }));
    await screen.findByRole("button", { name: /FINISH SESSION/ });
    await user.click(screen.getByLabelText("Discard workout"));
    await user.click(await screen.findByRole("button", { name: /DISCARD/ }));
    await waitFor(() => expect(screen.queryByText(/SESSION IN PROGRESS/)).not.toBeInTheDocument());
    expect(readSave().activeWorkout).toBeNull();
    expect(readSave().progress.workouts).toHaveLength(0);
  });

  it("Dungeons: entering a gate starts a dungeon run and clearing pays bonus XP", async () => {
    const user = userEvent.setup();
    await onboard(user);

    await user.click(screen.getByRole("button", { name: /^DUNGEONS/ }));
    expect(await screen.findByText(/CHALLENGE GATES/)).toBeInTheDocument();
    expect((screen.getAllByText(/WEEKLY BOSS/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/TRAINING DUNGEON|ENDURANCE DUNGEON|MOBILITY DUNGEON/)).toHaveLength(3);

    // Boss cannot be claimed with zero sessions this week.
    const fullClaim = screen.getByRole("button", { name: /CLAIM FULL/ });
    expect(fullClaim).toBeDisabled();

    // Enter the Training Dungeon on the novice route.
    const novices = screen.getAllByRole("button", { name: /NOVICE/ });
    await user.click(novices[0]);
    await user.click(screen.getAllByRole("button", { name: /^ENTER/ })[0]);
    expect(await screen.findByRole("button", { name: /FINISH SESSION/ })).toBeInTheDocument();
    expect(readSave().activeWorkout.source.kind).toBe("dungeon");

    for (let i = 0; i < 10; i++) {
      const open = screen.queryAllByRole("button", { name: /^Complete set/ });
      if (!open.length) break;
      await user.click(open[0]);
    }
    await user.click(screen.getByRole("button", { name: /FINISH SESSION/ }));
    await user.click(await screen.findByRole("button", { name: /CLAIM REWARDS/ }));

    await waitFor(() => {
      const s = readSave();
      expect(s.dungeons.clears.training.count).toBe(1);
      expect(s.player.xpTotal).toBeGreaterThan(50);
      expect(s.progress.workouts).toHaveLength(1);
    });
    expect(await screen.findByText(/DUNGEON CLEAR/)).toBeInTheDocument();
  });

  it("Progress: charts, calendar, history and collection render from real data", async () => {
    const user = userEvent.setup();
    await onboard(user);

    // Log a workout first so history/calendar have data.
    await user.click(screen.getByRole("button", { name: /START WORKOUT|GENTLE/ }));
    await screen.findByRole("button", { name: /FINISH SESSION/ });
    await finishCurrentWorkout(user);

    await user.click(screen.getByRole("button", { name: /^PROGRESS/ }));
    expect(await screen.findByText(/HUNTER RECORD/)).toBeInTheDocument();

    // Overview: charts are present and drawn from logged XP/workouts.
    expect(screen.getByRole("img", { name: /XP earned over the last 14 days/ })).toBeInTheDocument();
    expect(screen.getByText(/PERSONAL MILESTONES/)).toBeInTheDocument();
    expect(screen.getByText(/FIRST BLOOD/)).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /^Rank / }).length).toBeGreaterThanOrEqual(6);

    // Calendar month grid shows the logged day.
    await user.click(screen.getByRole("tab", { name: /Calendar/ }));
    expect(await screen.findByText(/\d{4}/)).toBeInTheDocument();
    expect(document.querySelector('[title*="1 workout"]')).toBeTruthy();

    // History lists the session.
    await user.click(screen.getByRole("tab", { name: /History/ }));
    expect(await screen.findByText(/Today · \w+ · \d+ min/)).toBeInTheDocument();

    // Collection shows locked silhouettes plus the unlocked first workout.
    await user.click(screen.getByRole("tab", { name: /Collection/ }));
    expect(await screen.findByText(/SHADOW COMPANIONS/)).toBeInTheDocument();
    expect(screen.getByText("Ashen Sentinel")).toBeInTheDocument(); // first_workout reward
    expect(screen.getAllByText("???").length).toBeGreaterThan(0); // locked silhouettes
  });

  it("Profile: settings persist and reset requires confirmation", async () => {
    const user = userEvent.setup();
    await onboard(user, "SETTINGS");

    await user.click(screen.getByRole("button", { name: /^PROFILE/ }));
    expect(await screen.findByText(/HUNTER DOSSIER/)).toBeInTheDocument();

    // Text scale toggle reaches the document root.
    await user.click(screen.getByRole("tab", { name: /^Large/ }));
    await waitFor(() => expect(document.documentElement.getAttribute("data-text-scale")).toBe("large"));
    expect(readSave().settings.textScale).toBe("large");

    // Motion setting persists.
    await user.click(screen.getByRole("tab", { name: /^Off/ }));
    await waitFor(() => expect(readSave().settings.motion).toBe("off"));

    // Edit profile modal validates an empty name.
    await user.click(screen.getByRole("button", { name: /Edit player profile/ }));
    const nameInput = screen.getByDisplayValue("SETTINGS");
    await user.clear(nameInput);
    await user.click(screen.getByRole("button", { name: /SAVE CHANGES/ }));
    expect(await screen.findByText(/A player name is required/)).toBeInTheDocument();
    await user.type(nameInput, "RENAMED");
    await user.click(screen.getByRole("button", { name: /SAVE CHANGES/ }));
    await waitFor(() => expect(readSave().profile.name).toBe("RENAMED"));

    // Reset requires confirmation — cancel keeps data.
    await user.click(screen.getByRole("button", { name: /RESET DATA/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /CANCEL/ }));
    expect(readSave().profile.name).toBe("RENAMED");
  });

  it("unlockable themes: locked at level 1, equip and persist once earned", async () => {
    const user = userEvent.setup();
    await onboard(user, "THEMER");
    await user.click(screen.getByRole("button", { name: /^PROFILE/ }));
    await screen.findByText(/DISPLAY THEME/);

    // Locked themes are disabled; default palette is active.
    const lockedCyan = screen.getByRole("button", { name: /AZURE ORACLE/ });
    expect(lockedCyan).toBeDisabled();
    expect(screen.getByRole("button", { name: /VIOLET GHOST/ })).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.getAttribute("data-theme")).toBe("violet");

    // Reaching level 3 unlocks it.
    const save = readSave();
    save.player.level = 3;
    save.player.xp = 100;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
    cleanup();
    render(<App />);
    await screen.findByRole("heading", { name: "THEMER" });
    await user.click(screen.getByRole("button", { name: /^PROFILE/ }));
    await screen.findByText(/DISPLAY THEME/);

    const cyan = screen.getByRole("button", { name: /AZURE ORACLE/ });
    expect(cyan).toBeEnabled();
    await user.click(cyan);
    await waitFor(() => expect(document.documentElement.getAttribute("data-theme")).toBe("cyan"));
    expect(readSave().settings.theme).toBe("cyan");
    expect(within(cyan).getByText(/EQUIPPED/)).toBeInTheDocument();
  });
});
