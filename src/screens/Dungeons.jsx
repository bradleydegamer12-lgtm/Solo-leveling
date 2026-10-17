import React, { useState } from "react";
import { useStore } from "../state/store.jsx";
import { DUNGEONS, bossProgress, dungeonStatus, getDungeon } from "../state/dungeons.js";
import { buildSession } from "../state/workouts.js";
import { dateKey, weekDays, weekdayLabel, labelFor } from "../state/dates.js";
import { Panel, Btn, Chip, SectionTitle, ProgressBar, RankBadge, Modal, EmptyState } from "../components/ui.jsx";
import {
  Swords, Clock, Zap, ShieldAlert, Trophy, ChevronRight, Lock, Moon, CheckCircle2, Skull, Flame,
} from "lucide-react";

function DifficultyBadge({ level }) {
  const colors = { E: "#9ca3af", D: "#10b981", C: "#22d3ee", B: "#3b82f6", A: "#a78bfa", S: "#f59e0b" };
  return (
    <span
      className="w-8 h-9 grid place-items-center font-display font-bold text-sm clip-path-[polygon(50%_0%,93%_25%,93%_75%,50%_100%,7%_75%,7%_25%)]"
      style={{
        background: colors[level] || colors.E,
        color: "#0a0a14",
        clipPath: "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)",
        boxShadow: `0 0 14px ${colors[level] || colors.E}66`,
      }}
      aria-label={`Difficulty ${level}`}
    >
      {level}
    </span>
  );
}

function BossCard({ onEnter }) {
  const { state, dispatch } = useStore();
  const today = dateKey();
  const bp = bossProgress(state, today);
  const { boss, count, cleared, easyCleared } = bp;
  const days = weekDays(today);

  const canFull = count >= boss.goal && !cleared;
  const canEasy = count >= boss.easyGoal && !easyCleared;

  return (
    <Panel hud glow className="p-4 sm:p-5 overflow-hidden relative border-[rgba(248,113,113,.35)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="hud-label text-[#f87171]">WEEKLY BOSS · {boss.week}</p>
          <h2 className="text-2xl font-display font-bold text-white tracking-[0.06em]">{boss.name}</h2>
          <p className="text-xs text-[#8f8ab5] mt-0.5">{boss.subtitle} · resets Monday</p>
        </div>
        <div className="w-12 h-12 grid place-items-center rounded-2xl bg-[rgba(248,113,113,.1)] border border-[rgba(248,113,113,.45)] text-[#f87171] flex-none">
          <Skull size={24} />
        </div>
      </div>

      <p className="text-sm text-[#b9b5d6] mt-3 leading-relaxed">{boss.description}</p>

      {/* Week progress */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="hud-label">WEEKLY PROGRESS</span>
          <span className="num text-sm font-display text-white">
            {count} <span className="text-[#7d79a3]">/ {boss.goal}</span>
          </span>
        </div>
        <ProgressBar pct={bp.fullPct} tone={cleared ? "green" : "violet"} height={10} />
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[0.65rem] text-[#7d79a3]">Slayer route: {boss.easyGoal} sessions</span>
          <span className="text-[0.65rem] text-[#a78bfa] num">{bp.fullPct}%</span>
        </div>
      </div>

      {/* Week strip */}
      <div className="flex gap-1.5 mt-3.5">
        {days.map((key) => {
          const done = state.progress.workouts.some((w) => w.date === key);
          return (
            <div key={key} className="flex-1 text-center">
              <div
                className={`h-8 rounded-md grid place-items-center border text-[0.6rem] font-display ${
                  done
                    ? "bg-gradient-to-br from-[#7c3aed] to-[#0891b2] border-[rgba(167,139,250,.8)] text-white"
                    : "border-[rgba(255,255,255,.1)] text-[#6b6790]"
                }`}
              >
                {done ? <CheckCircle2 size={14} /> : weekdayLabel(key)[0]}
              </div>
            </div>
          );
        })}
      </div>

      <ul className="mt-3.5 space-y-1">
        {boss.requirements.map((r) => (
          <li key={r} className="text-xs text-[#a5a1c4] flex gap-2">
            <Zap size={13} className="text-[#fbbf24] flex-none mt-0.5" /> {r}
          </li>
        ))}
      </ul>

      <div className="mt-3.5 p-2.5 rounded-lg bg-[rgba(34,211,238,.07)] border border-[rgba(34,211,238,.25)]">
        <p className="text-[0.7rem] text-[#7dd3fc] leading-relaxed">
          <ShieldAlert size={12} className="inline -mt-0.5 mr-1" />
          {boss.recovery}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mt-4">
        <Btn className="flex-1" onClick={onEnter} disabled={Boolean(state.activeWorkout)}>
          <Swords size={16} /> CHALLENGE BOSS ROUTE
        </Btn>
        <Btn variant={canFull ? "success" : "quiet"} onClick={() => dispatch({ type: "boss/claim", mode: "full" })} disabled={!canFull}>
          {cleared ? "FULL CLEARED" : `CLAIM FULL (${boss.xp} XP)`}
        </Btn>
        <Btn variant={canEasy ? "ghost" : "quiet"} onClick={() => dispatch({ type: "boss/claim", mode: "easy" })} disabled={!canEasy}>
          {easyCleared && !cleared ? "SLAYER CLEARED" : `SLAYER (${boss.easyXp} XP)`}
        </Btn>
      </div>

      {(cleared || easyCleared) && (
        <p className="mt-3 text-xs text-[#34d399] flex items-center gap-1.5">
          <Trophy size={14} /> Defeated {state.dungeons.boss.lastCleared ? labelFor(state.dungeons.boss.lastCleared) : ""}
          {cleared && easyCleared ? " · both routes" : ""}
        </p>
      )}
    </Panel>
  );
}

function DungeonCard({ dungeon, onEnter, onInspect }) {
  const { state } = useStore();
  const today = dateKey();
  const status = dungeonStatus(state, dungeon, today);
  const [easy, setEasy] = useState(false);
  const Icon = dungeon.type === "strength" ? Swords : dungeon.type === "endurance" ? Flame : Moon;

  return (
    <Panel className={`p-4 ${status.clearedToday ? "border-[rgba(52,211,153,.4)]" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <DifficultyBadge level={dungeon.difficulty} />
          <div className="min-w-0">
            <h3 className="font-display text-base text-white tracking-[0.07em]">{dungeon.name}</h3>
            <p className="text-[0.7rem] text-[#8f8ab5]">{dungeon.subtitle}</p>
          </div>
        </div>
        <div className="w-9 h-9 grid place-items-center rounded-xl bg-[rgba(6,6,14,.6)] border border-[rgba(139,92,246,.3)] text-[#a78bfa] flex-none">
          <Icon size={17} />
        </div>
      </div>

      <p className="text-xs text-[#a5a1c4] mt-2.5 leading-relaxed">{dungeon.description}</p>

      <div className="flex flex-wrap gap-2 mt-3">
        <span className="chip !min-h-[30px] !text-[0.7rem]">
          <Clock size={13} /> {easy ? dungeon.easyMinutes : dungeon.estMinutes} MIN
        </span>
        <span className="chip !min-h-[30px] !text-[0.7rem] !border-[rgba(167,139,250,.55)] !text-[#c4b5fd]">
          <Zap size={13} /> {easy ? dungeon.easyXp : dungeon.xp} XP
        </span>
        <span className="chip !min-h-[30px] !text-[0.7rem]">
          {status.count > 0 ? `CLEARED ×${status.count}` : "UNCLAIMED"}
        </span>
      </div>

      <div className="mt-3">
        <p className="hud-label text-[0.6rem] mb-1">REQUIRED</p>
        <ul className="space-y-0.5">
          {dungeon.requirements.map((r) => (
            <li key={r} className="text-[0.72rem] text-[#8f8ab5] flex gap-2">
              <span className="text-[#a78bfa]">▸</span> {r}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 p-2.5 rounded-lg bg-[rgba(34,211,238,.06)] border border-[rgba(34,211,238,.22)]">
        <p className="text-[0.7rem] text-[#7dd3fc] leading-relaxed">{dungeon.recovery}</p>
      </div>

      {status.clearedToday && (
        <p className="mt-2.5 text-[0.72rem] text-[#34d399] flex items-center gap-1.5">
          <CheckCircle2 size={13} /> Cleared today — repeat clears still count, bonus XP returns tomorrow.
        </p>
      )}

      <div className="flex items-center gap-2 mt-3.5">
        <div className="flex gap-1.5" role="group" aria-label="Route difficulty">
          <Chip active={!easy} onClick={() => setEasy(false)} className="!min-h-[36px]">
            STANDARD
          </Chip>
          <Chip active={easy} onClick={() => setEasy(true)} className="!min-h-[36px]">
            NOVICE
          </Chip>
        </div>
        <Btn size="sm" className="flex-1" onClick={() => onEnter(dungeon, easy)} disabled={Boolean(state.activeWorkout)}>
          ENTER <ChevronRight size={15} />
        </Btn>
      </div>
      <p className="text-[0.65rem] text-[#6b6790] mt-1.5">{easy ? dungeon.easyNote : "You can stop at any time — partial sessions don't count against you."}</p>

      <button type="button" className="text-[0.7rem] text-[#7d79a3] underline mt-2 hover:text-white" onClick={() => onInspect(dungeon)}>
        View requirements & recovery
      </button>
    </Panel>
  );
}

export default function Dungeons() {
  const { state, dispatch } = useStore();
  const [inspected, setInspected] = useState(null);

  const enterDungeon = (dungeon, easy) => {
    if (state.activeWorkout) return;
    const profile = easy
      ? { ...state.profile, experience: "beginner" }
      : state.profile;
    const session = buildSession(profile, {
      type: dungeon.type,
      minutes: easy ? dungeon.easyMinutes : dungeon.estMinutes,
      name: easy ? `${dungeon.name} · NOVICE` : dungeon.name,
      source: { kind: "dungeon", dungeonId: dungeon.id, easy },
    });
    dispatch({
      type: "workout/start",
      session,
      source: { kind: "dungeon", dungeonId: dungeon.id, easy },
    });
  };

  const enterBoss = () => {
    if (state.activeWorkout) return;
    const boss = bossProgress(state, dateKey()).boss;
    const session = buildSession(state.profile, {
      type: state.profile.goal === "endurance" ? "endurance" : "strength",
      minutes: 25,
      name: "WEEKLY BOSS · GATEKEEPER",
      source: { kind: "dungeon", dungeonId: "boss_run" },
    });
    dispatch({ type: "workout/start", session, source: { kind: "boss_run" } });
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="hud-label">DUNGEONS</p>
        <h1 className="text-2xl font-display text-white tracking-[0.08em]">CHALLENGE GATES</h1>
        <p className="text-xs text-[#8f8ab5] mt-1">
          Original fantasy challenges built from real workouts — every gate has an easier route and a stop-anytime rule.
        </p>
      </header>

      <BossCard onEnter={enterBoss} />

      <section>
        <SectionTitle right={<span className="hud-label">3 GATES OPEN</span>} sub="Clear them daily for bonus XP.">
          DUNGEON LIST
        </SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {DUNGEONS.map((d) => (
            <DungeonCard key={d.id} dungeon={d} onEnter={enterDungeon} onInspect={setInspected} />
          ))}
        </div>
      </section>

      <Panel className="p-4">
        <p className="hud-label mb-2">HOW GATES WORK</p>
        <ul className="space-y-1.5 text-xs text-[#a5a1c4] leading-relaxed">
          <li>◆ Dungeons are ordinary workouts with a theme — no extreme endurance tests.</li>
          <li>◆ Bonus XP for a dungeon pays once per day; repeats still train you and count toward quests.</li>
          <li>◆ Novice routes use easier variations and shorter durations for less XP.</li>
          <li>◆ Stop at any time. Sessions under 5 minutes are simply not logged.</li>
        </ul>
      </Panel>

      <Modal
        open={Boolean(inspected)}
        onClose={() => setInspected(null)}
        title={inspected?.name || ""}
        sub={inspected ? `${inspected.subtitle} · difficulty ${inspected.difficulty}` : ""}
      >
        {inspected && (
          <div className="space-y-3 text-sm">
            <p className="text-[#b9b5d6] leading-relaxed">{inspected.description}</p>
            <div>
              <p className="hud-label mb-1.5">REQUIRED</p>
              <ul className="space-y-1">
                {inspected.requirements.map((r) => (
                  <li key={r} className="text-[#b9b5d6] flex gap-2">
                    <Zap size={14} className="text-[#fbbf24] flex-none mt-0.5" /> {r}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-3 rounded-lg bg-[rgba(34,211,238,.07)] border border-[rgba(34,211,238,.28)]">
              <p className="hud-label mb-1 text-[#7dd3fc]">RECOVERY GUIDANCE</p>
              <p className="text-xs text-[#a5a1c4] leading-relaxed">{inspected.recovery}</p>
            </div>
            <div className="flex gap-2">
              <span className="chip !text-[0.72rem]"><Clock size={13} /> {inspected.estMinutes} min</span>
              <span className="chip !text-[0.72rem]"><Zap size={13} /> {inspected.xp} XP</span>
              <span className="chip !text-[0.72rem]"><Swords size={13} /> {inspected.type}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
