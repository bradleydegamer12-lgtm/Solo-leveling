import React, { useState } from "react";
import { useStore } from "../state/store.jsx";
import { derive, rankLadder } from "../state/selectors.js";
import { planForToday, buildSession, RECOVERY_TIPS } from "../state/workouts.js";
import { computeProgress, isClaimable, questSummary } from "../state/quests.js";
import { dateKey, weekDays, weekdayLabel, labelFor } from "../state/dates.js";
import { Panel, Btn, Chip, XpBar, StatBar, RankBadge, SectionTitle, Modal, Particles, ProgressBar } from "../components/ui.jsx";
import { HeroSigil } from "../components/Onboarding.jsx";
import {
  Flame, Droplets, Footprints, NotebookPen, Zap, Check, ChevronRight, Swords, Moon, Sparkles, Dumbbell, Activity, Wind,
} from "lucide-react";

const QUEST_ICONS = {
  workout: Dumbbell,
  recovery: Moon,
  mobility: Wind,
  movement: Footprints,
  hydration: Droplets,
  reflection: NotebookPen,
};

const QUEST_COLORS = {
  violet: "#a78bfa",
  cyan: "#22d3ee",
  blue: "#38bdf8",
};

function QuestRow({ quest, progress, onClaim }) {
  const Icon = QUEST_ICONS[quest.kind] || Zap;
  const color = QUEST_COLORS[quest.accent] || "#a78bfa";
  const pct = Math.min(100, (progress / quest.target) * 100);
  const claimable = progress >= quest.target && !quest.claimed;

  return (
    <li
      className={`glass-soft p-3.5 flex items-start gap-3 transition-all duration-300 ${
        quest.claimed ? "opacity-60" : claimable ? "shadow-[0_0_18px_rgba(139,92,246,.22)] border-[rgba(167,139,250,.45)]" : ""
      }`}
    >
      <div
        className="w-9 h-9 grid place-items-center rounded-xl flex-none border"
        style={{ background: `${color}18`, borderColor: `${color}55`, color }}
      >
        {quest.claimed ? <Check size={17} className="text-[#34d399]" /> : <Icon size={17} />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className={`font-display text-[0.8rem] tracking-[0.09em] uppercase ${quest.claimed ? "line-through text-[#8f8ab5]" : "text-white"}`}>
            {quest.title}
          </h3>
          <span className="font-display text-[0.72rem] num flex-none" style={{ color }}>
            +{quest.xp} XP
          </span>
        </div>
        <p className="text-xs text-[#8f8ab5] leading-snug mt-0.5">{quest.desc}</p>

        {quest.target > 1 && !quest.claimed && (
          <div className="mt-2 flex items-center gap-2">
            <ProgressBar pct={pct} tone="cyan" height={6} />
            <span className="text-[0.7rem] num text-[#8f8ab5] flex-none">
              {progress}/{quest.target}
            </span>
          </div>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="hud-label text-[0.6rem]">
            {quest.claimed ? "COMPLETED" : claimable ? "READY TO CLAIM" : "IN PROGRESS"}
          </span>
          {claimable && (
            <Btn size="sm" onClick={() => onClaim(quest.id)} aria-label={`Claim ${quest.title}`}>
              CLAIM <Zap size={13} />
            </Btn>
          )}
        </div>
      </div>
    </li>
  );
}

function StatusPanel({ state, derived }) {
  const { player, profile } = state;
  const ladder = rankLadder(player.level);

  return (
    <Panel hud glow className="p-4 sm:p-5 overflow-hidden">
      <Particles count={8} />
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="hud-label">PLAYER STATUS</p>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-[0.06em] truncate">
              {profile.name || "PLAYER"}
            </h2>
            <p className="text-[0.7rem] text-[#8f8ab5] tracking-[0.16em] font-display mt-0.5">
              LEVEL {String(player.level).padStart(2, "0")} · {player.rank}-CLASS HUNTER
            </p>
          </div>
          <div className="flex flex-col items-center gap-1 flex-none">
            <div className="pulse-ring rounded-2xl">
              <RankBadge rank={player.rank} size={62} />
            </div>
          </div>
        </div>

        {/* XP */}
        <div className="mt-4">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="hud-label">XP</span>
            <span className="num text-sm text-white font-display">
              {player.xp} <span className="text-[#7d79a3]">/ {derived.xpNeed}</span>
            </span>
          </div>
          <XpBar pct={derived.xpPct} />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[0.65rem] text-[#22d3ee] tracking-[0.14em] font-display">
              {derived.rankProgress.done ? "MAX RANK ACHIEVED" : derived.rankProgress.label}
            </span>
            <span className="text-[0.65rem] text-[#7d79a3] num">{derived.xpPct}%</span>
          </div>
        </div>

        {/* Rank ladder */}
        <div className="flex items-center justify-between gap-1 mt-4">
          {ladder.map((r) => (
            <div key={r.rank} className="flex flex-col items-center gap-1 flex-1">
              <div
                className={`w-full h-1.5 rounded-full ${r.achieved ? "" : "opacity-30"}`}                  style={{
                    background: r.achieved
                      ? "linear-gradient(90deg, var(--accent-deep), var(--accent-3))"
                      : "rgba(255,255,255,.12)",
                    boxShadow: r.achieved ? "0 0 8px rgba(var(--accent-rgb), .6)" : "none",
                  }}
              />
              <span className={`font-display text-[0.6rem] ${r.rank === state.player.rank ? "text-white" : "text-[#7d79a3]"}`}>
                {r.rank}
              </span>
            </div>
          ))}
        </div>

        {/* headline stats */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { label: "WORKOUTS", value: player.totalWorkouts, icon: Swords },
            { label: "THIS WEEK", value: `${derived.thisWeekCount}/${derived.weeklyGoal}`, icon: Activity },
            { label: "STREAK", value: `${derived.streak}d`, icon: Flame },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-[rgba(6,6,14,.55)] border border-[rgba(139,92,246,.18)] px-2 py-2 text-center">
              <s.icon size={13} className="mx-auto mb-0.5 text-[#a78bfa]" />
              <div className="font-display text-lg text-white num leading-none">{s.value}</div>
              <div className="hud-label text-[0.55rem] mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* attributes */}
        <div className="mt-4 pt-3.5 border-t border-[rgba(139,92,246,.18)]">
          <p className="hud-label mb-2.5">ATTRIBUTES · EARNED FROM ACTIVITY</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5">
            <StatBar kind="strength" label="STRENGTH" value={derived.attributes.strength} hint="Grows from completed strength sessions." />
            <StatBar kind="endurance" label="ENDURANCE" value={derived.attributes.endurance} hint="Grows from conditioning sessions." />
            <StatBar kind="mobility" label="MOBILITY" value={derived.attributes.mobility} hint="Grows from mobility and recovery sessions." />
            <StatBar kind="discipline" label="DISCIPLINE" value={derived.attributes.discipline} hint="Grows from streaks and weekly consistency." />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function WeekStrip({ state }) {
  const today = dateKey();
  const days = weekDays(today);
  const workouts = new Set(state.progress.workouts.map((w) => w.date));
  const rests = new Set(state.progress.restLogs || []);
  const preferred = state.profile.preferredDays || [];

  return (
    <div className="flex items-center justify-between gap-1.5">
      {days.map((key) => {
        const isToday = key === today;
        const trained = workouts.has(key);
        const rested = rests.has(key);
        const planned = preferred.includes(new Date(key + "T00:00:00").getDay());
        return (
          <div key={key} className="flex flex-col items-center gap-1 flex-1">
            <div
              className={`w-full max-w-[38px] aspect-square rounded-lg grid place-items-center border text-[0.6rem] font-display ${
                trained
                  ? "bg-gradient-to-br from-[#7c3aed] to-[#0891b2] border-[rgba(167,139,250,.8)] text-white shadow-[0_0_12px_rgba(139,92,246,.5)]"
                  : rested
                    ? "bg-[rgba(34,211,238,.12)] border-[rgba(34,211,238,.45)] text-[#22d3ee]"
                    : isToday
                      ? "border-[rgba(167,139,250,.7)] text-[#a78bfa]"
                      : planned
                        ? "border-[rgba(255,255,255,.14)] text-[#6b6790]"
                        : "border-[rgba(255,255,255,.07)] text-[#4b4870]"
              }`}
              title={key}
            >
              {trained ? <Check size={13} /> : rested ? "Z" : weekdayLabel(key)[0]}
            </div>
            <span className={`text-[0.55rem] tracking-wider ${isToday ? "text-white" : "text-[#6b6790]"}`}>
              {weekdayLabel(key)[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function Home({ onNavigate }) {
  const { state, dispatch } = useStore();
  const derived = derive(state);
  const today = dateKey();
  const plan = planForToday(state.profile, today, state.progress.workouts.at(-1)?.type || null);
  const progress = computeProgress(state);
  const summary = questSummary(state);
  const daily = state.daily || { hydration: 0, reflections: [], movement: false };
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [reflectionText, setReflectionText] = useState("");
  const [reflectionError, setReflectionError] = useState("");

  const startPlan = (type, minutes, source) => {
    if (state.activeWorkout) {
      onNavigate("train");
      return;
    }
    const session = buildSession(state.profile, { type, minutes, source });
    dispatch({ type: "workout/start", session, source });
  };

  const saveReflection = () => {
    if (reflectionText.trim().length < 10) {
      setReflectionError("Write at least a sentence (10+ characters).");
      return;
    }
    dispatch({ type: "daily/reflect", text: reflectionText });
    setReflectionText("");
    setReflectionError("");
    setReflectionOpen(false);
  };

  const claimedQuests = state.quests?.items.filter((q) => q.claimed) || [];
  const openQuests = state.quests?.items.filter((q) => !q.claimed) || [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 grid place-items-center rounded-xl bg-[rgba(139,92,246,.12)] border border-[rgba(139,92,246,.35)] flex-none">
            <HeroSigil size={30} />
          </div>
          <div className="min-w-0">
            <p className="hud-label">SHADOW SYSTEM</p>
            <p className="text-[0.7rem] text-[#7d79a3]">{labelFor(today, { withYear: true })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip !min-h-[34px] !py-1" title="Current consistency streak">
            <Flame size={14} className={derived.streak > 0 ? "text-[#fbbf24]" : "text-[#6b6790]"} />
            <span className="num">{derived.streak}</span>
          </span>
        </div>
      </header>

      <StatusPanel state={state} derived={derived} />

      {/* Today's protocol */}
      <Panel className="p-4">
        <SectionTitle right={<span className="hud-label">{plan.isRestDay ? "RECOVERY" : plan.intensity || "PROTOCOL"}</span>}>
          {plan.isRestDay ? "TODAY: REST DAY" : "TODAY'S PROTOCOL"}
        </SectionTitle>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-lg text-white tracking-[0.06em]">{plan.title}</h3>
            <p className="text-xs text-[#8f8ab5] mt-0.5">
              {plan.subtitle} · ~{plan.minutes} min
            </p>
          </div>
          <div className="w-11 h-11 grid place-items-center rounded-xl bg-[rgba(6,6,14,.6)] border border-[rgba(139,92,246,.3)] text-[#a78bfa] flex-none">
            {plan.isRestDay ? <Moon size={20} /> : plan.type === "endurance" ? <Activity size={20} /> : plan.type === "mobility" ? <Wind size={20} /> : <Dumbbell size={20} />}
          </div>
        </div>
        <p className="text-xs text-[#a5a1c4] leading-relaxed mt-2.5">{plan.note}</p>

        <div className="flex flex-wrap gap-2 mt-3.5">
          {state.activeWorkout ? (
            <Btn block onClick={() => onNavigate("train")}>
              RESUME ACTIVE SESSION <ChevronRight size={16} />
            </Btn>
          ) : plan.isRestDay ? (
            <>
              <Btn className="flex-1" onClick={() => startPlan("mobility", 10, { kind: "quick" })}>
                GENTLE MOBILITY FLOW
              </Btn>
              <Btn variant="ghost" onClick={() => dispatch({ type: "daily/rest" })}>
                <Moon size={15} /> LOG REST
              </Btn>
            </>
          ) : (
            <>
              <Btn className="flex-1" onClick={() => startPlan(plan.type, plan.minutes, { kind: "plan" })}>
                START WORKOUT <Swords size={16} />
              </Btn>
              <Btn variant="ghost" onClick={() => dispatch({ type: "daily/rest" })}>
                <Moon size={15} /> REST TODAY
              </Btn>
            </>
          )}
        </div>

        {plan.isRestDay && (
          <ul className="mt-3 space-y-1">
            {RECOVERY_TIPS.slice(0, 3).map((tip) => (
              <li key={tip} className="text-[0.72rem] text-[#8f8ab5] flex gap-2">
                <Check size={13} className="text-[#34d399] flex-none mt-0.5" /> {tip}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Daily quests */}
      <section>
        <SectionTitle
          right={
            <span className="text-[0.7rem] text-[#8f8ab5] num">
              {summary.claimed}/{summary.total} CLAIMED
            </span>
          }
          sub={`${summary.availableXp} XP still on the board`}
        >
          DAILY QUESTS
        </SectionTitle>

        <div className="mb-3">
          <WeekStrip state={state} />
        </div>

        {openQuests.length === 0 ? (
          <Panel className="p-5 text-center">
            <Sparkles size={22} className="mx-auto text-[#fbbf24] mb-2" />
            <p className="font-display text-sm tracking-[0.14em] text-white">BOARD CLEARED</p>
            <p className="text-xs text-[#8f8ab5] mt-1">Every quest claimed. Recovery and rest still count — see you tomorrow.</p>
          </Panel>
        ) : (
          <ul className="space-y-2.5 stagger">
            {openQuests.map((q) => (
              <QuestRow key={q.id} quest={q} progress={progress[q.id] || 0} onClaim={(id) => dispatch({ type: "quest/claim", id })} />
            ))}
          </ul>
        )}

        {claimedQuests.length > 0 && (
          <div className="mt-3">
            <p className="hud-label mb-2">COMPLETED TODAY</p>
            <ul className="space-y-2">
              {claimedQuests.map((q) => (
                <QuestRow key={q.id} quest={q} progress={progress[q.id] ?? q.target} onClaim={() => {}} />
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section>
        <SectionTitle>QUICK ACTIONS</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            type="button"
            className="option-card items-center text-center"
            onClick={() => dispatch({ type: "daily/hydration", delta: 1 })}
          >
            <Droplets size={17} className="text-[#38bdf8]" />
            <span className="font-display text-[0.72rem] tracking-[0.1em]">+ WATER</span>
            <span className="text-[0.68rem] text-[#8f8ab5] num">{daily.hydration || 0} logged</span>
          </button>

          <button
            type="button"
            className="option-card items-center text-center"
            aria-pressed={Boolean(daily.movement)}
            onClick={() => dispatch({ type: "daily/movement" })}
          >
            <Footprints size={17} className={daily.movement ? "text-[#34d399]" : "text-[#a78bfa]"} />
            <span className="font-display text-[0.72rem] tracking-[0.1em]">MOVEMENT</span>
            <span className="text-[0.68rem] text-[#8f8ab5]">{daily.movement ? "done" : "take a break"}</span>
          </button>

          <button type="button" className="option-card items-center text-center" onClick={() => setReflectionOpen(true)}>
            <NotebookPen size={17} className="text-[#a78bfa]" />
            <span className="font-display text-[0.72rem] tracking-[0.1em]">REFLECT</span>
            <span className="text-[0.68rem] text-[#8f8ab5]">{daily.reflections?.length ? "logged" : "journal"}</span>
          </button>

          <button type="button" className="option-card items-center text-center" onClick={() => startPlan("mobility", 8, { kind: "quick" })}>
            <Wind size={17} className="text-[#22d3ee]" />
            <span className="font-display text-[0.72rem] tracking-[0.1em]">MOBILITY</span>
            <span className="text-[0.68rem] text-[#8f8ab5]">8 min flow</span>
          </button>
        </div>
      </section>

      {/* Reflection modal */}
      <Modal
        open={reflectionOpen}
        onClose={() => setReflectionOpen(false)}
        title="WORKOUT REFLECTION"
        sub="How did today go? Energy, effort, or what to change next time."
        footer={
          <>
            <Btn variant="quiet" onClick={() => setReflectionOpen(false)}>
              CANCEL
            </Btn>
            <Btn onClick={saveReflection}>
              SAVE REFLECTION <Check size={15} />
            </Btn>
          </>
        }
      >
        <textarea
          className="field min-h-[120px] resize-y"
          placeholder="Legs felt strong today. Kept the tempo steady and stopped one rep short on every set…"
          value={reflectionText}
          maxLength={400}
          onChange={(e) => {
            setReflectionText(e.target.value);
            setReflectionError("");
          }}
        />
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[0.7rem] text-[#f87171]">{reflectionError}</span>
          <span className="text-[0.7rem] text-[#6b6790] num">{reflectionText.trim().length}/400</span>
        </div>
      </Modal>
    </div>
  );
}
