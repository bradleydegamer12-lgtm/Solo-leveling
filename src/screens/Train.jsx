import React, { useMemo, useState } from "react";
import { useStore } from "../state/store.jsx";
import { EXERCISES, EXERCISE_MAP } from "../state/exercises.js";
import { buildSession, planForToday, sessionProgress, RECOVERY_TIPS, TYPES } from "../state/workouts.js";
import { estimateMinutes } from "../state/workouts.js";
import { workoutXp } from "../state/progression.js";
import { dateKey } from "../state/dates.js";
import { Panel, Btn, Chip, SectionTitle, Modal, EmptyState, ProgressBar } from "../components/ui.jsx";
import {
  Dumbbell, Activity, Wind, Play, RefreshCw, BookOpen, Moon, Timer, Swords, ChevronRight, ListChecks, Info,
} from "lucide-react";

const TYPE_ICON = { strength: Dumbbell, endurance: Activity, mobility: Wind };
const LEVELS = [
  { value: "beginner", label: "BEGINNER" },
  { value: "intermediate", label: "INTERMEDIATE" },
  { value: "advanced", label: "ADVANCED" },
];
const DURATIONS = [15, 20, 30, 45, 60];

function SessionPreview({ session, onStart, onRegenerate }) {
  const steps = session.phases.flatMap((p) => p.items.map((i) => ({ ...i, phase: p })));
  return (
    <Panel hud className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="hud-label">PREVIEW</p>
          <h3 className="font-display text-lg text-white tracking-[0.06em]">{session.name}</h3>
          <p className="text-xs text-[#8f8ab5] mt-0.5">
            {session.type.toUpperCase()} · ~{session.estMinutes} min · {steps.length} exercises · est +{session.estXp} XP
          </p>
        </div>
        <button type="button" className="btn btn-quiet btn-sm" onClick={onRegenerate} aria-label="Regenerate preview">
          <RefreshCw size={14} /> REROLL
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {session.phases.map((phase) => (
          <div key={phase.key}>
            <p className="hud-label text-[0.6rem] mb-1.5">{phase.label}</p>
            <ul className="space-y-1">
              {phase.items.map((item, i) => {
                const ex = EXERCISE_MAP[item.id];
                return (
                  <li key={`${item.id}-${i}`} className="flex items-center justify-between gap-3 text-sm px-2.5 py-1.5 rounded-lg bg-[rgba(6,6,14,.5)] border border-[rgba(255,255,255,.06)]">
                    <span className="text-[#b9b5d6] truncate">{ex?.name || item.id}</span>
                    <span className="text-[0.7rem] text-[#7d79a3] num flex-none">
                      {item.sets} × {item.seconds ? `${item.seconds}s` : `${item.reps}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <Btn block size="lg" className="mt-4" onClick={onStart}>
        <Play size={17} /> ENTER SESSION
      </Btn>
    </Panel>
  );
}

export default function Train({ onNavigate }) {
  const { state, dispatch } = useStore();
  const profile = state.profile;
  const today = dateKey();
  const plan = planForToday(profile, today, state.progress.workouts.at(-1)?.type || null);

  const [type, setType] = useState(plan.isRestDay ? "mobility" : plan.type);
  const [minutes, setMinutes] = useState(profile.sessionMinutes || 30);
  const [level, setLevel] = useState(profile.experience || "beginner");
  const [gear, setGear] = useState(profile.equipment?.[0] || "none");
  const [nonce, setNonce] = useState(0);
  const [libraryFilter, setLibraryFilter] = useState("all");
  const [detail, setDetail] = useState(null);

  const gearOptions = useMemo(() => {
    const owned = profile.equipment?.length ? profile.equipment : ["none"];
    return owned;
  }, [profile.equipment]);

  const tempProfile = useMemo(
    () => ({ ...profile, experience: level, equipment: [gear] }),
    [profile, level, gear],
  );

  const preview = useMemo(
    () => buildSession(tempProfile, { type, minutes, source: { kind: "manual" } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tempProfile, type, minutes, nonce],
  );

  const startPreview = () => {
    if (state.activeWorkout) return onNavigate("train");
    dispatch({ type: "workout/start", session: preview, source: { kind: "manual" } });
  };

  const startPlan = () => {
    if (state.activeWorkout) return onNavigate("train");
    const session = buildSession(profile, { type: plan.type, minutes: plan.minutes, source: { kind: "plan" } });
    dispatch({ type: "workout/start", session, source: { kind: "plan" } });
  };

  const startQuickMobility = () => {
    if (state.activeWorkout) return onNavigate("train");
    const session = buildSession(profile, { type: "mobility", minutes: 8, source: { kind: "quick" }, name: "QUICK FLOW" });
    dispatch({ type: "workout/start", session, source: { kind: "quick" } });
  };

  const library = EXERCISES.filter((e) => e.pool === "main" && (libraryFilter === "all" || e.cat === libraryFilter));

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="hud-label">TRAIN</p>
          <h1 className="text-2xl font-display text-white tracking-[0.08em]">WORKOUT ENGINE</h1>
        </div>
        <div className="text-right">
          <p className="text-[0.7rem] text-[#8f8ab5]">{profile.experience.toUpperCase()}</p>
          <p className="text-[0.7rem] text-[#7d79a3]">{(profile.equipment || []).map((g) => g.toUpperCase()).join(" · ")}</p>
        </div>
      </header>

      {/* Active session banner */}
      {state.activeWorkout && (
        <Panel glow className="p-4 border-[rgba(167,139,250,.6)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="hud-label text-[#fbbf24]">SESSION IN PROGRESS</p>
              <p className="font-display text-white tracking-[0.05em] truncate">{state.activeWorkout.session.name}</p>
              <p className="text-xs text-[#8f8ab5]">
                {sessionProgress(state.activeWorkout.session).pct}% complete · started{" "}
                {new Date(state.activeWorkout.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <Btn onClick={() => onNavigate("resume-workout")}>
              <Play size={16} /> RESUME
            </Btn>
          </div>
        </Panel>
      )}

      {/* Today's protocol */}
      <section>
        <SectionTitle right={<span className="hud-label">{plan.isRestDay ? "RECOVERY DAY" : "SCHEDULED"}</span>}>
          {plan.isRestDay ? "RECOVERY PROTOCOL" : "TODAY'S PROTOCOL"}
        </SectionTitle>
        <Panel className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg text-white tracking-[0.06em]">{plan.title}</h3>
              <p className="text-xs text-[#8f8ab5] mt-0.5">
                {plan.subtitle} · {plan.minutes} min · {plan.isRestDay ? "optional movement" : `${plan.type} focus`}
              </p>
            </div>
            {React.createElement(TYPE_ICON[plan.type] || Dumbbell, { size: 24, className: "text-[#a78bfa]" })}
          </div>
          <p className="text-xs text-[#a5a1c4] leading-relaxed mt-2.5">{plan.note}</p>
          <div className="flex flex-wrap gap-2 mt-3.5">
            <Btn className="flex-1" onClick={plan.isRestDay ? startQuickMobility : startPlan} disabled={Boolean(state.activeWorkout)}>
              {plan.isRestDay ? "GENTLE FLOW" : "START PROTOCOL"} <Play size={15} />
            </Btn>
            <Btn variant="ghost" onClick={startQuickMobility} disabled={Boolean(state.activeWorkout)}>
              <Timer size={15} /> 8-MIN MOBILITY
            </Btn>
          </div>
        </Panel>
      </section>

      {/* Session builder */}
      <section>
        <SectionTitle sub="Tune any session to your gear, time and energy.">CUSTOM SESSION</SectionTitle>

        <div className="space-y-3">
          <div>
            <p className="hud-label mb-1.5">FOCUS</p>
            <div className="flex flex-wrap gap-2">
              {Object.values(TYPES).map((t) => (
                <Chip key={t.key} active={type === t.key} onClick={() => setType(t.key)}>
                  {React.createElement(TYPE_ICON[t.key], { size: 14 })}
                  {t.label}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="hud-label mb-1.5">DURATION</p>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((m) => (
                <Chip key={m} active={minutes === m} onClick={() => setMinutes(m)} className="min-w-[58px] justify-center">
                  {m}′
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="hud-label mb-1.5">DIFFICULTY</p>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((l) => (
                <Chip key={l.value} active={level === l.value} onClick={() => setLevel(l.value)}>
                  {l.label}
                </Chip>
              ))}
            </div>
          </div>

          {gearOptions.length > 1 && (
            <div>
              <p className="hud-label mb-1.5">EQUIPMENT</p>
              <div className="flex flex-wrap gap-2">
                {gearOptions.map((g) => (
                  <Chip key={g} active={gear === g} onClick={() => setGear(g)}>
                    {g.toUpperCase()}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <SessionPreview key={`${type}-${minutes}-${level}-${gear}-${nonce}`} session={preview} onStart={startPreview} onRegenerate={() => setNonce((n) => n + 1)} />
        </div>
      </section>

      {/* Exercise library */}
      <section>
        <SectionTitle
          right={
            <span className="text-[0.7rem] text-[#8f8ab5] num">{library.length} MOVES</span>
          }
          sub="Technique, sets and safety notes for every movement."
        >
          EXERCISE LIBRARY
        </SectionTitle>

        <div className="flex flex-wrap gap-2 mb-3">
          {[
            { value: "all", label: "ALL" },
            { value: "strength", label: "STRENGTH" },
            { value: "endurance", label: "CARDIO" },
            { value: "mobility", label: "MOBILITY" },
          ].map((f) => (
            <Chip key={f.value} active={libraryFilter === f.value} onClick={() => setLibraryFilter(f.value)}>
              {f.label}
            </Chip>
          ))}
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {library.map((ex) => (
            <li key={ex.id}>
              <button
                type="button"
                className="option-card w-full"
                onClick={() => setDetail(ex)}
                aria-label={`View ${ex.name}`}
              >
                <span className="flex items-center justify-between w-full gap-2">
                  <span className="font-display text-[0.82rem] text-white tracking-[0.04em] truncate">{ex.name}</span>
                  <ChevronRight size={15} className="text-[#7d79a3] flex-none" />
                </span>
                <span className="text-[0.7rem] text-[#8f8ab5]">
                  {ex.sets} × {ex.seconds ? `${ex.seconds}s` : `${ex.reps}`} · {ex.level} · {ex.equip.join("/")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Recovery */}
      <section>
        <SectionTitle sub="Rest days are scheduled, not skipped.">RECOVERY & REST</SectionTitle>
        <Panel className="p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Moon size={16} className="text-[#22d3ee]" />
            <span className="font-display text-sm tracking-[0.1em] text-white">
              {plan.isRestDay ? "Today is a planned rest day" : `Rest days: ${[0, 1, 2, 3, 4, 5, 6].filter((d) => !(profile.preferredDays || []).includes(d)).map((d) => ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][d]).join(" · ") || "—"}`}
            </span>
          </div>
          <ul className="space-y-1.5">
            {RECOVERY_TIPS.map((tip) => (
              <li key={tip} className="text-xs text-[#a5a1c4] flex gap-2 leading-relaxed">
                <span className="text-[#34d399]">◆</span> {tip}
              </li>
            ))}
          </ul>
          <p className="text-[0.7rem] text-[#6b6790] mt-3 leading-relaxed">
            Sharp pain, dizziness or exhaustion are stop signals — pause the session and log a recovery day.
            The system rewards consistency, not punishment.
          </p>
        </Panel>
      </section>

      {/* Exercise detail modal */}
      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.name || ""} sub={detail ? `${detail.cat.toUpperCase()} · ${detail.level.toUpperCase()} · ${detail.equip.join(" / ")}` : ""}>
        {detail && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <span className="chip !min-h-[30px] !text-[0.7rem] num">
                <ListChecks size={13} /> {detail.sets} × {detail.seconds ? `${detail.seconds}s` : `${detail.reps}`}
              </span>
              <span className="chip !min-h-[30px] !text-[0.7rem] num">
                <Timer size={13} /> {detail.rest}s rest
              </span>
            </div>
            <p className="text-sm text-[#22d3ee] border-l-2 border-[rgba(34,211,238,.6)] pl-3">{detail.cue}</p>
            <ol className="space-y-2">
              {detail.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm text-[#b9b5d6] leading-relaxed">
                  <span className="w-5 h-5 grid place-items-center rounded bg-[rgba(139,92,246,.2)] border border-[rgba(167,139,250,.45)] text-[0.7rem] text-[#a78bfa] flex-none num">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
            {detail.caution && (
              <p className="text-xs text-[#fbbf24] bg-[rgba(251,191,36,.08)] border border-[rgba(251,191,36,.3)] rounded-lg p-2.5 leading-relaxed">
                ⚠ {detail.caution}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
