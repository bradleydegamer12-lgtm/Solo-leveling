import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../state/store.jsx";
import { EXERCISE_MAP } from "../state/exercises.js";
import { flatSteps, sessionProgress, replacementCandidates, estimateMinutes } from "../state/workouts.js";
import { workoutXp } from "../state/progression.js";
import { Btn, Panel, ProgressBar, Modal, Chip, useMotion, ConfirmDialog } from "../components/ui.jsx";
import { playCue, buzz } from "../lib/audio.js";
import {
  Pause, Play, SkipForward, X, RefreshCw, ArrowDownWideNarrow, ArrowUpNarrowWide,
  Check, Timer, ListChecks, Flag, Info, ChevronDown,
} from "lucide-react";

function formatClock(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ── Rest timer overlay between sets ── */
function RestTimer({ seconds, onSkip, onExtend, paused }) {
  const [left, setLeft] = useState(seconds);
  const motion = useMotion();

  useEffect(() => {
    setLeft(seconds);
  }, [seconds]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setLeft((v) => (v <= 1 ? 0 : v - 1)), 1000);
    return () => clearInterval(id);
  }, [paused, seconds]);

  const done = left <= 0;
  useEffect(() => {
    if (done) playCue("quest");
  }, [done]);

  const pct = ((seconds - left) / seconds) * 100;

  return (
    <div className="glass hud p-4 text-center">
      <p className="hud-label mb-2">{done ? "REST COMPLETE" : "RESTING"}</p>
      <div className={`num font-display text-4xl font-bold ${done ? "text-[#34d399]" : "text-white text-glow"} ${motion && !done ? "" : ""}`}>
        {formatClock(left)}
      </div>
      <div className="mt-2.5">
        <ProgressBar pct={pct} tone={done ? "green" : "cyan"} height={6} />
      </div>
      <div className="flex gap-2 justify-center mt-3">
        <Btn variant="ghost" size="sm" onClick={onExtend}>
          +15s
        </Btn>
        <Btn variant={done ? "success" : "quiet"} size="sm" onClick={onSkip}>
          {done ? "NEXT SET" : "SKIP REST"}
        </Btn>
      </div>
    </div>
  );
}

export default function ActiveWorkout({ onMinimize }) {
  const { state, dispatch } = useStore();
  const aw = state.activeWorkout;
  const session = aw?.session;

  const [elapsed, setElapsed] = useState(aw?.elapsedSec || 0);
  const [rest, setRest] = useState(null); // seconds
  const [replaceTarget, setReplaceTarget] = useState(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const persistRef = useRef(0);

  const steps = useMemo(() => (session ? flatSteps(session) : []), [session]);
  const progress = useMemo(() => (session ? sessionProgress(session) : null), [session]);

  // Which exercise is "current": first one with incomplete sets.
  const currentIndex = useMemo(() => {
    const i = steps.findIndex((s) => s.item.done.length < s.item.sets);
    return i === -1 ? steps.length - 1 : i;
  }, [steps]);
  const current = steps[currentIndex];

  // Session clock — pauses with the workout, keeps running during rest.
  useEffect(() => {
    if (!aw || aw.paused) return;
    const id = setInterval(() => setElapsed((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, [aw, aw?.paused]);

  // Persist elapsed time periodically so a reload resumes honestly.
  useEffect(() => {
    if (!aw) return;
    persistRef.current += 1;
    if (persistRef.current % 15 === 0) {
      dispatch({ type: "workout/persist", elapsedSec: elapsed });
    }
  }, [elapsed, aw, dispatch]);

  useEffect(() => {
    if (aw) dispatch({ type: "workout/persist", elapsedSec: elapsed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aw?.paused]);

  if (!aw || !session || !current) return null;

  const toggleSet = (setIndex) => {
    dispatch({ type: "workout/toggle-set", phaseIdx: current.phaseIdx, itemIdx: current.itemIdx, setIndex });
    const willComplete = current.item.done.includes(setIndex) === false;
    if (willComplete) {
      buzz(14);
      const allDone = current.item.done.length + 1 >= current.item.sets;
      if (allDone) {
        playCue("quest");
        setRest(current.item.rest || 40);
      } else {
        playCue("click");
        setRest(Math.round((current.item.rest || 40) * 0.6));
      }
    }
  };

  const skipExercise = () => {
    if (currentIndex < steps.length - 1) {
      setRest(null);
      const el = document.getElementById(`step-${currentIndex + 1}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      playCue("click");
    }
  };

  const finish = () => {
    const setsDone = steps.reduce((n, s) => n + s.item.done.length, 0);
    const totalSets = steps.reduce((n, s) => n + s.item.sets, 0);
    dispatch({ type: "workout/persist", elapsedSec: elapsed });
    dispatch({ type: "workout/finish", elapsedSec: elapsed, setsDone, totalSets });
    setConfirmFinish(false);
    setRest(null);
  };

  const doReplace = (ex) => {
    dispatch({ type: "workout/replace", phaseIdx: replaceTarget.phaseIdx, itemIdx: replaceTarget.itemIdx, newId: ex.id });
    setReplaceTarget(null);
    playCue("click");
  };

  const adjust = (direction) => {
    dispatch({ type: "workout/adjust", direction });
    playCue(direction === "easier" ? "rest" : "quest");
  };

  const candidates = replaceTarget
    ? replacementCandidates(session, replaceTarget.phaseIdx, replaceTarget.itemIdx, state.profile)
    : [];
  const replaceItem = replaceTarget ? session.phases[replaceTarget.phaseIdx].items[replaceTarget.itemIdx] : null;
  const exercise = current.exercise;
  const estXp = workoutXp(Math.max(5, Math.round(elapsed / 60)), session.type);

  return (
    <div className="fixed inset-0 z-[55] bg-[#05050b] overflow-y-auto">
      {/* HUD header */}
      <div className="sticky top-0 z-10 bg-[rgba(6,6,14,.92)] backdrop-blur border-b border-[rgba(139,92,246,.3)]">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="hud-label truncate">{session.name}</p>
              <div className="flex items-center gap-2.5 mt-0.5">
                <span className="num font-display text-lg text-white">{formatClock(elapsed)}</span>
                <span className="text-[0.7rem] text-[#8f8ab5] num">
                  {currentIndex + 1}/{steps.length} exercises · ~{estXp} XP
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-none">
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() => {
                  dispatch({ type: "workout/persist", elapsedSec: elapsed });
                  onMinimize?.();
                }}
                aria-label="Minimise workout"
              >
                <ChevronDown size={15} />
              </button>
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() => dispatch({ type: aw.paused ? "workout/resume" : "workout/pause" })}
                aria-label={aw.paused ? "Resume workout" : "Pause workout"}
              >
                {aw.paused ? <Play size={15} /> : <Pause size={15} />}
                {aw.paused ? "RESUME" : "PAUSE"}
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => setConfirmAbandon(true)}
                aria-label="Discard workout"
              >
                <X size={15} />
              </button>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <ProgressBar pct={progress.pct} tone="violet" height={7} />
            <span className="text-[0.7rem] num text-[#a78bfa] flex-none">{progress.pct}%</span>
          </div>
        </div>
      </div>

      {aw.paused && (
        <div className="max-w-2xl mx-auto px-4 pt-3">
          <div className="glass-soft p-3 text-center border-[rgba(251,191,36,.4)]">
            <p className="font-display text-sm tracking-[0.14em] text-[#fbbf24]">SESSION PAUSED</p>
            <p className="text-xs text-[#8f8ab5] mt-0.5">Timer stopped. Resume when you're ready — no pressure.</p>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-4 pb-40 space-y-4">
        {/* Rest timer */}
        {rest !== null && !aw.paused && (
          <RestTimer
            seconds={rest}
            paused={aw.paused}
            onSkip={() => setRest(null)}
            onExtend={() => setRest((v) => (v || 0) + 15)}
          />
        )}

        {/* Difficulty controls */}
        <div className="flex items-center justify-between gap-2">
          <span className="hud-label">BLOCK {current.phase.label}</span>
          <div className="flex gap-1.5">
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => adjust("easier")}>
              <ArrowDownWideNarrow size={14} /> EASIER
            </button>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => adjust("harder")}>
              <ArrowUpNarrowWide size={14} /> HARDER
            </button>
          </div>
        </div>

        {/* Current exercise */}
        <Panel hud glow className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="hud-label">{current.phase.label} · {current.phase.note}</p>
              <h2 className="text-xl font-display text-white tracking-[0.05em] mt-1">{exercise?.name || current.item.id}</h2>
              <p className="text-xs text-[#a5a1c4] mt-1">
                {current.item.sets} × {current.item.seconds ? `${current.item.seconds}s` : `${current.item.reps} reps`}
                {current.item.replacedFrom && EXERCISE_MAP[current.item.replacedFrom] && (
                  <span className="text-[#7d79a3]"> · swapped from {EXERCISE_MAP[current.item.replacedFrom].name}</span>
                )}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 flex-none">
              <button
                type="button"
                className="btn btn-quiet btn-sm"
                onClick={() => setReplaceTarget({ phaseIdx: current.phaseIdx, itemIdx: current.itemIdx })}
              >
                <RefreshCw size={13} /> REPLACE
              </button>
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => setShowDetails(true)}>
                <Info size={13} /> FORM
              </button>
            </div>
          </div>

          {exercise?.cue && (
            <p className="mt-3 text-sm text-[#22d3ee] leading-snug border-l-2 border-[rgba(34,211,238,.6)] pl-3">
              {exercise.cue}
            </p>
          )}

          {/* Set tracker */}
          <div className="mt-4">
            <p className="hud-label mb-2 flex items-center gap-1.5">
              <ListChecks size={13} /> TAP EACH COMPLETED SET
            </p>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: current.item.sets }, (_, i) => {
                const done = current.item.done.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleSet(i)}
                    aria-pressed={done}
                    aria-label={done ? `Set ${i + 1} of ${current.item.sets} completed` : `Complete set ${i + 1} of ${current.item.sets}`}
                    disabled={aw.paused}
                    className={`w-14 h-14 rounded-xl border font-display text-lg num transition-all ${
                      done
                        ? "bg-gradient-to-br from-[#059669] to-[#0d9488] border-[rgba(52,211,153,.8)] text-[#04120d] shadow-[0_0_16px_rgba(52,211,153,.5)]"
                        : "bg-[rgba(6,6,14,.7)] border-[rgba(139,92,246,.4)] text-[#a5a1c4] hover:border-[rgba(167,139,250,.8)]"
                    }`}
                  >
                    {done ? <Check size={20} className="mx-auto" /> : i + 1}
                  </button>
                );
              })}
              <div className="w-14 h-14 rounded-xl border border-dashed border-[rgba(255,255,255,.14)] grid place-items-center text-[#6b6790]">
                <Timer size={17} />
                <span className="text-[0.55rem] -mt-3">{current.item.rest}s</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Btn variant="ghost" size="sm" className="flex-1" onClick={skipExercise} disabled={currentIndex >= steps.length - 1}>
              <SkipForward size={14} /> SKIP EXERCISE
            </Btn>
            <Btn
              variant="quiet"
              size="sm"
              className="flex-1"
              onClick={() => setRest(current.item.rest || 40)}
            >
              <Timer size={14} /> START REST
            </Btn>
          </div>
        </Panel>

        {/* Full exercise list */}
        <Panel className="p-4">
          <p className="hud-label mb-3">SESSION QUEUE</p>
          <ol className="space-y-1.5">
            {steps.map((s, i) => {
              const complete = s.item.done.length >= s.item.sets;
              const active = i === currentIndex;
              return (
                <li
                  key={`${s.item.id}-${i}`}
                  id={`step-${i}`}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    active
                      ? "border-[rgba(167,139,250,.7)] bg-[rgba(139,92,246,.14)]"
                      : complete
                        ? "border-[rgba(52,211,153,.3)] bg-[rgba(52,211,153,.06)]"
                        : "border-[rgba(255,255,255,.07)]"
                  }`}
                >
                  <span className={`w-5 h-5 grid place-items-center rounded flex-none text-[0.65rem] ${complete ? "bg-[#059669] text-black" : "bg-[rgba(255,255,255,.08)] text-[#8f8ab5]"}`}>
                    {complete ? <Check size={12} /> : i + 1}
                  </span>
                  <span className={`flex-1 truncate ${complete ? "text-[#8f8ab5] line-through" : active ? "text-white" : "text-[#a5a1c4]"}`}>
                    {s.exercise?.name || s.item.id}
                  </span>
                  <span className="text-[0.7rem] text-[#7d79a3] num flex-none">
                    {s.item.done.length}/{s.item.sets}
                  </span>
                  <span className="text-[0.6rem] text-[#6b6790] tracking-wider flex-none hidden sm:inline">{s.phase.label}</span>
                </li>
              );
            })}
          </ol>
        </Panel>

        {/* Finish */}
        <div className="fixed bottom-0 left-0 right-0 z-10 bg-[linear-gradient(180deg,transparent,rgba(5,5,11,.96)_35%)] pt-6 pb-[calc(14px+env(safe-area-inset-bottom,0px))] px-4">
          <div className="max-w-2xl mx-auto flex gap-2">
            <Btn variant="ghost" onClick={() => setConfirmFinish(true)} className="flex-1">
              <Flag size={16} /> FINISH SESSION
            </Btn>
          </div>
        </div>
      </div>

      {/* Replace exercise picker */}
      <Modal
        open={Boolean(replaceTarget)}
        onClose={() => setReplaceTarget(null)}
        title="REPLACE EXERCISE"
        sub={replaceItem ? `Replacing ${EXERCISE_MAP[replaceItem.id]?.name || replaceItem.id} — same muscle target, your gear.` : ""}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {candidates.map((ex) => (
            <button key={ex.id} type="button" className="option-card" onClick={() => doReplace(ex)}>
              <span className="font-display text-[0.8rem] tracking-[0.06em] text-white">{ex.name}</span>
              <span className="text-[0.7rem] text-[#8f8ab5]">
                {ex.sets} × {ex.seconds ? `${ex.seconds}s` : `${ex.reps} reps`} · {ex.level}
              </span>
            </button>
          ))}
          {candidates.length === 0 && (
            <p className="text-sm text-[#8f8ab5] col-span-full py-4 text-center">
              No other exercises match your gear and safety list right now.
            </p>
          )}
        </div>
      </Modal>

      {/* Form details */}
      <Modal open={showDetails} onClose={() => setShowDetails(false)} title={exercise?.name || ""} sub={exercise ? `${exercise.cat.toUpperCase()} · ${exercise.level}` : ""}>
        {exercise && (
          <div className="space-y-3">
            <ol className="space-y-2">
              {exercise.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm text-[#b9b5d6] leading-relaxed">
                  <span className="w-5 h-5 grid place-items-center rounded bg-[rgba(139,92,246,.2)] border border-[rgba(167,139,250,.45)] text-[0.7rem] text-[#a78bfa] flex-none num">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
            {exercise.caution && (
              <p className="text-xs text-[#fbbf24] bg-[rgba(251,191,36,.08)] border border-[rgba(251,191,36,.3)] rounded-lg p-2.5 leading-relaxed">
                ⚠ {exercise.caution}
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* Finish summary */}
      <ConfirmDialog
        open={confirmFinish}
        title="FINISH SESSION?"
        message={`You've completed ${progress.done}/${progress.total} sets in ${formatClock(elapsed)}. Finishing logs this workout and awards XP (${estXp} estimated). Sessions under 5 minutes with almost no sets completed will not be logged.`}
        confirmLabel="CLAIM REWARDS"
        onConfirm={finish}
        onCancel={() => setConfirmFinish(false)}
      />

      <ConfirmDialog
        open={confirmAbandon}
        title="DISCARD SESSION?"
        message="Your current progress will be thrown away. Nothing is logged and no XP is awarded."
        confirmLabel="DISCARD"
        danger
        onConfirm={() => {
          dispatch({ type: "workout/abandon" });
          setConfirmAbandon(false);
          setRest(null);
        }}
        onCancel={() => setConfirmAbandon(false)}
      />
    </div>
  );
}
