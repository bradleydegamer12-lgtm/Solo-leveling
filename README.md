# SHADOW SYSTEM

**A dark-fantasy fitness RPG.** Real workouts become quests, consistency earns XP, and personal
progress unlocks hunter ranks from **E → S**. Original brand, original artwork — inspired by the
solo-leveling genre, not affiliated with any official franchise.

Mobile-first, works on phones, tablets and desktop browsers.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm test           # 25 logic tests (node --test): progression, plans, quests, full journey
npm run test:ui    # 7 UI tests (vitest + testing-library): the real React interface
npm run test:all   # both suites
npm run build      # production build → dist/
```

---

## What's in it

**Five working tabs** (bottom navigation):

| Tab | What it does |
| --- | --- |
| **HOME** | Animated PLAYER STATUS panel (level, rank, XP bar, attributes, weekly strip), today's protocol, the daily quest board with claim gating, quick actions (water, movement break, reflection). |
| **TRAIN** | Today's scheduled protocol, a custom session builder (focus / duration / difficulty / gear with live preview and re-roll), a full exercise library with technique instructions, and recovery guidance. |
| **DUNGEONS** | Three original themed gates + the Weekly Boss. Difficulty, duration, required work, XP, completion status and recovery notes. Every gate has a **Novice route**; the boss has a reduced **Slayer route**. |
| **PROGRESS** | Stats cards, XP-over-time chart, weekly activity bars, calendar (workouts · recovery days · planned rest), workout history, personal milestones, and the unlockable **shadow collection** (companions, titles, badges). |
| **PROFILE** | Editable training parameters, system settings (sound, animations, particles, text size), **unlockable display themes** (Violet Ghost default · Azure Oracle at level 3 · Ember Monarch at rank C · Verdant Warden at a 7-day streak), data export/import/reset, and a plain-language explanation of how progression works. |

**The workout engine** is a real session runner: warm-up → main block → cooldown, per-set
tracking, rest timers with skip/extend, pause/resume, skip-exercise, replace-exercise,
easier/harder difficulty shifting, live progress, finish summary and XP payout. Sessions are
persisted, so closing the app mid-workout and reopening resumes it.

---

## Progression system

- **XP** — workouts (duration + type), daily quests, mobility flows, dungeon bonuses, weekly boss.
  Level 1 requires 300 XP, then +50 per level.
- **Ranks** — E (lv 1) → D (4) → C (8) → B (13) → A (19) → S (26).
- **Attributes** — STRENGTH / ENDURANCE / MOBILITY / DISCIPLINE are computed **only from logged
  activity and consistency**. The app never claims to measure muscle, body composition or calories.
- **Unlocks** — badges, titles and shadow companions come from the achievement collection;
  display themes unlock at level 3, rank C and a 7-day streak (never purchases). Rank colours are
  semantic and never reskinned.
- **Streaks** — consecutive active days; a logged rest day keeps the streak alive, a missed day
  resets it to 1.
- **Safety built into the economy** — rest, recovery, hydration, movement breaks and reflections
  are all rewarded. Nothing rewards training through pain, dehydration, skipped meals or sleep
  loss. Sessions under 5 minutes with almost no completed sets are not logged.

Daily quests are generated per day from the player's goal, experience and recovery needs, and the
main quest swaps to a recovery quest on scheduled rest days.

---

## Data storage & limitations

> **This demo has no backend, no accounts and no cloud sync.**

- All progress lives in `localStorage` under `shadow-system:save:v1`, **on this device and browser
  only**.
- Clearing site data, private browsing or switching devices will lose progress — use
  **Profile → Export Save** to keep a copy, and **Import Save** to restore it.
- There is no login, so there is no multi-user separation. If you clear your data, it is gone.
- The UI states this openly in *Profile → Data & Storage* and shows a warning banner if storage is
  unavailable (e.g. blocked by the browser).
- No secrets, tokens, paid services or third-party APIs are used. Sounds are synthesized with the
  Web Audio API — zero audio assets.

---

## Tech & structure

- **Vite + React 19 + Tailwind CSS v4** — no UI framework, no chart library (SVG charts are
  hand-rolled), only `lucide-react` for icons.
- **Pure reducer + selectors** (`src/state/`) — every state transition is testable without a
  browser.
  - `progression.js` XP/rank/attributes · `workouts.js` plan & session generation ·
    `quests.js` daily board · `dungeons.js` gates & boss · `achievements.js` collection ·
    `reducer.js` all mutations · `selectors.js` charts/calendar/milestones ·
    `storage.js` persistence with validation.
- **Screens** in `src/screens/`, **design-system components** in `src/components/`.

```
src/
  App.jsx              # shell: tab routing, onboarding gate, error boundary
  main.jsx
  styles/app.css       # tokens, glass/HUD panels, buttons, bars, overlays, motion switches
  state/               # pure logic (unit tested)
  components/          # ui, Nav, Onboarding, Overlays
  screens/             # Home, Train, ActiveWorkout, Dungeons, Progress, Profile
tests/                 # 25 logic tests + 7 UI journey tests
```

## Accessibility & performance

- Respects `prefers-reduced-motion`; in-app switches disable **animations**, **particles** and
  **sound** independently; a **large text** mode sets the root font size.
- ≥44px touch targets, visible focus rings, ARIA labels/roles on controls, and contrast tuned for
  dark backgrounds.
- Animations are CSS transform/opacity only, capped particle counts, no background video, no
  heavy libraries — built to stay smooth on budget Android devices.

## Disclaimer

General fitness motivation only — not medical advice. Stop if something hurts and consult a
professional about medical conditions.
