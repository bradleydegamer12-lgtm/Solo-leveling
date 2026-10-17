import React, { useMemo, useState } from "react";
import { useStore } from "../state/store.jsx";
import { Btn, Chip, Panel, Particles, SectionTitle } from "./ui.jsx";
import { ArrowLeft, ArrowRight, Check, SkipForward, Shield } from "lucide-react";

/* ── Original brand artwork (hand-drawn SVG, no external assets) ── */
export function HeroSigil({ size = 120, className = "" }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} role="img" aria-label="Shadow System sigil">
      <defs>
        <linearGradient id="sig-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id="sig-b" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#312e81" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      <path d="M60 6 106 32v56L60 114 14 88V32z" fill="url(#sig-b)" stroke="url(#sig-a)" strokeWidth="3" />
      <path d="M60 18 94 38v44L60 102 26 82V38z" fill="none" stroke="rgba(167,139,250,.45)" strokeWidth="1.5" />
      <path d="M60 34c10 8 15 17 15 27 0 12-7 20-15 25-8-5-15-13-15-25 0-10 5-19 15-27z" fill="rgba(6,6,14,.85)" stroke="url(#sig-a)" strokeWidth="2" />
      <circle cx="60" cy="60" r="6" fill="#22d3ee" opacity=".95" />
      <path d="M35 47h10M75 47h10M35 73h10M75 73h10" stroke="rgba(167,139,250,.7)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/* ── Reusable onboarding field pickers (shared with Profile editing) ── */

export const EXPERIENCE_OPTIONS = [
  { value: "beginner", label: "BEGINNER", hint: "New or returning after a break" },
  { value: "intermediate", label: "INTERMEDIATE", hint: "Training semi-regularly" },
  { value: "advanced", label: "ADVANCED", hint: "Consistent, experienced training" },
];

export const GOAL_OPTIONS = [
  { value: "strength", label: "BUILD STRENGTH", hint: "Force, control and progressive work" },
  { value: "endurance", label: "IMPROVE ENDURANCE", hint: "Sustain effort for longer" },
  { value: "mobility", label: "IMPROVE MOBILITY", hint: "Move well, recover faster" },
  { value: "habits", label: "DEVELOP HABITS", hint: "Consistency first, intensity later" },
  { value: "general", label: "GENERAL FITNESS", hint: "A balanced mix of everything" },
];

export const EQUIPMENT_OPTIONS = [
  { value: "none", label: "NO EQUIPMENT", hint: "Bodyweight only" },
  { value: "bands", label: "RESISTANCE BANDS", hint: "Loop or tube bands" },
  { value: "dumbbells", label: "DUMBBELLS", hint: "A pair of dumbbells" },
  { value: "gym", label: "FULL GYM", hint: "Machines, barbells, cables" },
];

export const MINUTE_OPTIONS = [15, 20, 30, 45, 60];
export const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function OptionGrid({ options, value, onSelect, columns = "sm:grid-cols-2" }) {
  return (
    <div className={`grid grid-cols-1 gap-2 ${columns}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className="option-card"
          aria-pressed={value === opt.value}
          onClick={() => onSelect(opt.value)}
        >
          <span className="flex items-center gap-2 font-display text-sm tracking-[0.1em]">
            {value === opt.value && <Check size={15} className="text-[#22d3ee]" />}
            {opt.label}
          </span>
          {opt.hint && <span className="text-xs text-[#8f8ab5] leading-snug">{opt.hint}</span>}
        </button>
      ))}
    </div>
  );
}

export function MultiEquipment({ value, onChange }) {
  const toggle = (v) => {
    if (v === "none") return onChange(["none"]);
    const next = value.filter((x) => x !== "none");
    onChange(value.includes(v) ? (next.length ? next : ["none"]) : [...next, v]);
  };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {EQUIPMENT_OPTIONS.map((opt) => {
        const active = value.includes(opt.value);
        return (
          <button key={opt.value} type="button" className="option-card" aria-pressed={active} onClick={() => toggle(opt.value)}>
            <span className="flex items-center gap-2 font-display text-sm tracking-[0.1em]">
              {active && <Check size={15} className="text-[#22d3ee]" />}
              {opt.label}
            </span>
            <span className="text-xs text-[#8f8ab5]">{opt.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

export function DaysPicker({ value, onChange }) {
  const toggle = (d) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort());
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Preferred workout days">
      {DAY_LABELS.map((d, i) => (
        <Chip key={d} active={value.includes(i)} onClick={() => toggle(i)} className="min-w-[64px] justify-center">
          {d}
        </Chip>
      ))}
    </div>
  );
}

/* ── The onboarding flow ── */

const STEPS = ["intro", "name", "experience", "goal", "equipment", "minutes", "days", "avoid", "review"];

export default function Onboarding() {
  const { dispatch } = useStore();
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    name: "",
    experience: "beginner",
    goal: "general",
    equipment: ["none"],
    sessionMinutes: 30,
    preferredDays: [1, 3, 5],
    avoid: "",
  });

  const step = STEPS[stepIndex];
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const next = () => {
    setError("");
    if (step === "name" && !draft.name.trim()) {
      setError("Enter a name to identify your hunter.");
      return;
    }
    if (step === "days" && draft.preferredDays.length === 0) {
      setError("Choose at least one training day.");
      return;
    }
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  };
  const back = () => {
    setError("");
    setStepIndex((i) => Math.max(0, i - 1));
  };
  const skip = () => {
    setError("");
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1));
  };

  const finish = () => {
    dispatch({
      type: "onboarding/complete",
      profile: {
        ...draft,
        name: (draft.name.trim() || "PLAYER").slice(0, 16),
        preferredDays: draft.preferredDays.length ? draft.preferredDays : [1, 3, 5],
        sessionMinutes: Number(draft.sessionMinutes) || 30,
        avoid: draft.avoid.trim(),
      },
    });
  };

  const progressPct = ((stepIndex + 1) / STEPS.length) * 100;

  const reviewRows = useMemo(
    () => [
      { label: "PLAYER", value: draft.name || "PLAYER" },
      { label: "EXPERIENCE", value: draft.experience.toUpperCase() },
      { label: "GOAL", value: (GOAL_OPTIONS.find((g) => g.value === draft.goal) || {}).label },
      { label: "EQUIPMENT", value: draft.equipment.map((e) => (EQUIPMENT_OPTIONS.find((o) => o.value === e) || {}).label).join(" · ") },
      { label: "SESSION", value: `${draft.sessionMinutes} MIN` },
      { label: "DAYS", value: draft.preferredDays.map((d) => DAY_LABELS[d]).join(" · ") || "—" },
      { label: "AVOID", value: draft.avoid.trim() || "Nothing declared" },
    ],
    [draft],
  );

  return (
    <div className="min-h-screen flex flex-col px-5 pt-6 pb-10 max-w-lg mx-auto w-full">
      {/* progress header */}
      {step !== "intro" && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={back}
              className="btn btn-quiet btn-sm"
              disabled={stepIndex === 0}
              aria-label="Previous step"
            >
              <ArrowLeft size={14} /> BACK
            </button>
            <span className="hud-label num">
              STEP {stepIndex} / {STEPS.length - 1}
            </span>
          </div>
          <div className="stat-track">
            <div className="stat-fill" style={{ width: `${progressPct}%`, background: "linear-gradient(90deg,#7c3aed,#22d3ee)" }} />
          </div>
        </div>
      )}

      <div className="flex-1" key={step}>
        {step === "intro" && (
          <div className="min-h-[70vh] flex flex-col items-center justify-center text-center rise">
            <div className="relative mb-6">
              <Particles count={12} />
              <div className="float">
                <HeroSigil size={148} />
              </div>
            </div>
            <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-[0.14em] text-white text-glow">
              SHADOW SYSTEM
            </h1>
            <p className="mt-3 hud-label text-[#22d3ee] text-glow-cyan">A FITNESS RPG · ORIGINAL WORKS</p>
            <p className="mt-6 text-sm text-[#a5a1c4] leading-relaxed max-w-[34ch]">
              Real workouts become quests. Consistency earns XP. Every session you complete pushes
              your hunter rank higher.
            </p>
            <Btn size="lg" className="mt-8 w-full sm:w-auto px-10" onClick={next}>
              AWAKEN <ArrowRight size={17} />
            </Btn>
            <p className="mt-4 text-[0.7rem] text-[#6b6790]">Your progress is stored on this device only.</p>
          </div>
        )}

        {step === "name" && (
          <div className="rise">
            <SectionTitle>IDENTIFY YOURSELF</SectionTitle>
            <h2 className="text-2xl font-display text-white tracking-[0.08em] mb-1">What shall the system call you?</h2>
            <p className="text-sm text-[#8f8ab5] mb-5">This appears on your status screen. You can change it later.</p>
            <label className="block">
              <span className="hud-label">PLAYER NAME</span>
              <input
                className="field mt-1.5"
                value={draft.name}
                maxLength={16}
                autoFocus
                placeholder="e.g. BRAD"
                onChange={(e) => set({ name: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && next()}
              />
            </label>
            {error && <p className="text-xs text-[#f87171] mt-2">{error}</p>}
          </div>
        )}

        {step === "experience" && (
          <div className="rise">
            <SectionTitle>ASSESSMENT</SectionTitle>
            <h2 className="text-2xl font-display text-white tracking-[0.08em] mb-1">Your training experience</h2>
            <p className="text-sm text-[#8f8ab5] mb-5">Sets difficulty and volume. Honest answers get better plans.</p>
            <OptionGrid options={EXPERIENCE_OPTIONS} value={draft.experience} onSelect={(experience) => set({ experience })} />
          </div>
        )}

        {step === "goal" && (
          <div className="rise">
            <SectionTitle>PRIMARY OBJECTIVE</SectionTitle>
            <h2 className="text-2xl font-display text-white tracking-[0.08em] mb-1">What are you here to achieve?</h2>
            <p className="text-sm text-[#8f8ab5] mb-5">Shapes your daily protocol and quest board.</p>
            <OptionGrid options={GOAL_OPTIONS} value={draft.goal} onSelect={(goal) => set({ goal })} />
          </div>
        )}

        {step === "equipment" && (
          <div className="rise">
            <SectionTitle right={<button type="button" className="btn btn-quiet btn-sm" onClick={skip}>SKIP</button>}>
              LOADOUT
            </SectionTitle>
            <h2 className="text-2xl font-display text-white tracking-[0.08em] mb-1">Available equipment</h2>
            <p className="text-sm text-[#8f8ab5] mb-5">Select everything you can train with. Pick multiple if needed.</p>
            <MultiEquipment value={draft.equipment} onChange={(equipment) => set({ equipment })} />
          </div>
        )}

        {step === "minutes" && (
          <div className="rise">
            <SectionTitle right={<button type="button" className="btn btn-quiet btn-sm" onClick={skip}>SKIP</button>}>
              TIME BUDGET
            </SectionTitle>
            <h2 className="text-2xl font-display text-white tracking-[0.08em] mb-1">Time per session</h2>
            <p className="text-sm text-[#8f8ab5] mb-5">Short and consistent beats long and rare.</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {MINUTE_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  className="option-card items-center text-center"
                  aria-pressed={draft.sessionMinutes === m}
                  onClick={() => set({ sessionMinutes: m })}
                >
                  <span className="font-display text-xl text-white num">{m}</span>
                  <span className="text-[0.65rem] text-[#8f8ab5] tracking-[0.14em]">MIN</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "days" && (
          <div className="rise">
            <SectionTitle right={<button type="button" className="btn btn-quiet btn-sm" onClick={skip}>SKIP</button>}>
              SCHEDULE
            </SectionTitle>
            <h2 className="text-2xl font-display text-white tracking-[0.08em] mb-1">Preferred workout days</h2>
            <p className="text-sm text-[#8f8ab5] mb-5">Other days become built-in recovery days.</p>
            <DaysPicker value={draft.preferredDays} onChange={(preferredDays) => set({ preferredDays })} />
            {draft.preferredDays.length > 0 && (
              <p className="text-xs text-[#22d3ee] mt-3">
                {draft.preferredDays.length} training day{draft.preferredDays.length > 1 ? "s" : ""} per week ·
                weekly goal {Math.min(5, Math.max(2, draft.preferredDays.length))} sessions
              </p>
            )}
            {error && <p className="text-xs text-[#f87171] mt-2">{error}</p>}
          </div>
        )}

        {step === "avoid" && (
          <div className="rise">
            <SectionTitle right={<button type="button" className="btn btn-quiet btn-sm" onClick={skip}>SKIP</button>}>
              SAFETY PARAMETERS
            </SectionTitle>
            <h2 className="text-2xl font-display text-white tracking-[0.08em] mb-1">Movements to avoid</h2>
            <p className="text-sm text-[#8f8ab5] mb-5">
              Injuries, restrictions, exercises you hate — the system filters them out of your plans.
            </p>
            <textarea
              className="field min-h-[110px] resize-y"
              placeholder="e.g. jumping, knee pain, burpees…"
              value={draft.avoid}
              maxLength={200}
              onChange={(e) => set({ avoid: e.target.value })}
            />
            <p className="text-[0.7rem] text-[#6b6790] mt-1.5">
              Optional. This app is not medical advice — clear any new program with a professional if you have a condition.
            </p>
          </div>
        )}

        {step === "review" && (
          <div className="rise">
            <SectionTitle>FINAL REVIEW</SectionTitle>
            <h2 className="text-2xl font-display text-white tracking-[0.08em] mb-4">Confirm your parameters</h2>
            <Panel hud className="p-4">
              <dl className="space-y-2.5">
                {reviewRows.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-4">
                    <dt className="hud-label flex-none">{row.label}</dt>
                    <dd className="text-sm text-right text-white font-display tracking-[0.06em]">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
            <p className="text-xs text-[#8f8ab5] mt-4 flex items-start gap-2">
              <Shield size={15} className="text-[#34d399] flex-none mt-0.5" />
              A beginner-friendly plan will be generated from these parameters. Rest days, recovery and
              mobility are built in — the system never asks you to train through pain.
            </p>
            <Btn size="lg" block className="mt-5" onClick={finish}>
              INITIALIZE <ArrowRight size={17} />
            </Btn>
          </div>
        )}
      </div>

      {/* navigation footer */}
      {step !== "intro" && step !== "review" && (
        <div className="mt-8 flex gap-2">
          {step === "name" && (
            <Btn variant="quiet" onClick={() => { setError(""); setStepIndex((i) => i + 1); }}>
              <SkipForward size={15} /> USE DEFAULT
            </Btn>
          )}
          <Btn block onClick={next}>
            CONTINUE <ArrowRight size={16} />
          </Btn>
        </div>
      )}
    </div>
  );
}
