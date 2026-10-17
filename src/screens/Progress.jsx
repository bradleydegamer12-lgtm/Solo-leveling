import React, { useMemo, useState } from "react";
import { useStore } from "../state/store.jsx";
import { derive, xpSeries, weeklyBars, calendarMonth, milestoneStatus, rankLadder } from "../state/selectors.js";
import { ACHIEVEMENTS, getAchievement } from "../state/achievements.js";
import { labelFor, dateKey, weekdayLabel, relativeDayLabel } from "../state/dates.js";
import { Panel, Btn, Chip, SectionTitle, Segmented, EmptyState, ProgressBar, StatBar, RankBadge, Modal, useMotion } from "../components/ui.jsx";
import {
  BarChart3, CalendarDays, History, Trophy, Dumbbell, Activity, Wind, Flame, Clock, Target, TrendingUp,
  Lock, Sparkles, Award, Swords, Moon, Footprints,
} from "lucide-react";

/* ── Lightweight SVG charts (no chart library — keeps the bundle small) ── */

function XpChart({ data }) {
  const motion = useMotion();
  const width = 640;
  const height = 160;
  const max = Math.max(100, ...data.map((d) => d.amount));
  const step = data.length > 1 ? width / (data.length - 1) : width;

  const points = data.map((d, i) => [i * step, height - (d.amount / max) * (height - 18) - 6]);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[150px]" role="img" aria-label="XP earned over the last 14 days">
        <defs>
          <linearGradient id="xp-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="xp-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" y1={height * f} x2={width} y2={height * f} stroke="rgba(139,92,246,.14)" strokeWidth="1" />
        ))}
        <path d={area} fill="url(#xp-fill)" />
        <path d={line} fill="none" stroke="url(#xp-line)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"
          style={motion ? { strokeDasharray: 1600, strokeDashoffset: 0, animation: "none" } : undefined} />
        {points.map((p, i) =>
          data[i].amount > 0 ? (
            <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="#0a0a14" stroke="#22d3ee" strokeWidth="2" />
          ) : null,
        )}
      </svg>
      <div className="flex justify-between mt-1 text-[0.6rem] text-[#6b6790] num">
        <span>{labelFor(data[0].date)}</span>
        <span>{labelFor(data[Math.floor(data.length / 2)].date)}</span>
        <span>{labelFor(data[data.length - 1].date)}</span>
      </div>
    </div>
  );
}

function WeeklyBars({ data, goal }) {
  const max = Math.max(goal, ...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-2 h-[130px]">
      {data.map((d, i) => {
        const pct = (d.count / max) * 100;
        const hit = d.count >= goal;
        return (
          <div key={d.week} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
            <span className={`text-[0.65rem] num ${hit ? "text-[#34d399]" : d.count ? "text-[#a78bfa]" : "text-[#4b4870]"}`}>
              {d.count}
            </span>
            <div className="w-full rounded-t-md bg-[rgba(6,6,14,.7)] border border-[rgba(255,255,255,.07)] flex items-end min-h-[6px]"
              style={{ height: "100%" }}>
              <div
                className="w-full rounded-t-md transition-all duration-700"
                style={{
                  height: `${Math.max(6, pct)}%`,
                  background: hit
                    ? "linear-gradient(180deg,#34d399,#0891b2)"
                    : "linear-gradient(180deg,#a78bfa,#4f46e5)",
                  boxShadow: hit ? "0 0 12px rgba(52,211,153,.5)" : "0 0 10px rgba(139,92,246,.4)",
                }}
              />
            </div>
            <span className="text-[0.55rem] text-[#6b6790]">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Calendar ── */
function Calendar({ state, monthKey, onMonth }) {
  const cal = useMemo(() => calendarMonth(state, monthKey), [state, monthKey]);
  const typeColor = { strength: "#a78bfa", endurance: "#38bdf8", mobility: "#34d399" };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => onMonth(-1)} aria-label="Previous month">‹ PREV</button>
        <p className="font-display text-sm tracking-[0.14em] text-white">{cal.label}</p>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => onMonth(1)} aria-label="Next month">NEXT ›</button>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-center text-[0.6rem] text-[#6b6790] font-display">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cal.cells.map((cell, i) =>
          cell ? (
            <div
              key={cell.key}
              title={`${cell.key} · ${cell.count} workout${cell.count === 1 ? "" : "s"}${cell.isRestLogged ? " · recovery logged" : ""}`}
              className={`aspect-square rounded-lg border relative grid place-items-center text-[0.7rem] ${
                cell.count
                  ? "border-[rgba(167,139,250,.75)] bg-[rgba(139,92,246,.18)] text-white"
                  : cell.isRestLogged
                    ? "border-[rgba(34,211,238,.4)] bg-[rgba(34,211,238,.08)] text-[#22d3ee]"
                    : cell.plannedRest
                      ? "border-[rgba(255,255,255,.08)] text-[#4b4870]"
                      : "border-[rgba(255,255,255,.05)] text-[#3f3c63]"
              } ${cell.isToday ? "ring-1 ring-[#22d3ee]" : ""} ${cell.isFuture ? "opacity-40" : ""}`}
            >
              <span className="num">{cell.day}</span>
              {cell.count > 0 && (
                <span className="absolute bottom-1 flex gap-0.5">
                  {cell.types.slice(0, 3).map((t) => (
                    <span key={t} className="w-1 h-1 rounded-full" style={{ background: typeColor[t] || "#a78bfa" }} />
                  ))}
                </span>
              )}
              {cell.count === 0 && cell.isRestLogged && (
                <Moon size={10} className="absolute bottom-1 text-[#22d3ee]" />
              )}
            </div>
          ) : (
            <div key={`blank-${i}`} className="aspect-square" />
          ),
        )}
      </div>

      <div className="flex flex-wrap gap-3 mt-3 text-[0.65rem] text-[#8f8ab5]">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[rgba(139,92,246,.6)]" /> Workout</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[rgba(34,211,238,.3)]" /> Recovery logged</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm border border-[rgba(255,255,255,.15)]" /> Planned rest</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm border border-[#22d3ee]" /> Today</span>
      </div>
    </div>
  );
}

/* ── Collection (achievements) ── */
function Collection({ state }) {
  const unlocked = state.achievements?.unlocked || {};
  const [filter, setFilter] = useState("all");
  const groups = ["SHADOW", "TITLE", "BADGE"];
  const unlockedCount = Object.keys(unlocked).length;

  const visible = ACHIEVEMENTS.filter((a) =>
    filter === "all" ? true : filter === "unlocked" ? Boolean(unlocked[a.id]) : !unlocked[a.id],
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <span className="text-xs text-[#8f8ab5] num">
          {unlockedCount}/{ACHIEVEMENTS.length} UNLOCKED
        </span>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "unlocked", label: "Owned" },
            { value: "locked", label: "Locked" },
          ]}
        />
      </div>

      {groups.map((group) => {
        const items = visible.filter((a) => a.reward.type === group);
        if (!items.length) return null;
        return (
          <div key={group} className="mb-5">
            <p className="hud-label mb-2">{group === "SHADOW" ? "SHADOW COMPANIONS" : group === "TITLE" ? "TITLES" : "BADGES"}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {items.map((a) => {
                const has = Boolean(unlocked[a.id]);
                const at = unlocked[a.id];
                return (
                  <Panel
                    key={a.id}
                    className={`p-3 text-center ${has ? "glow-ring" : ""}`}
                    aria-label={`${a.name} ${has ? "unlocked" : "locked"}`}
                  >
                    <div className={`mx-auto w-11 h-11 grid place-items-center rounded-xl mb-2 ${has ? "unlock-flash" : "locked-item"}`}
                      style={{
                        background: has ? "linear-gradient(135deg,rgba(124,58,237,.6),rgba(8,145,178,.4))" : "rgba(255,255,255,.05)",
                        border: `1px solid ${has ? "rgba(167,139,250,.7)" : "rgba(255,255,255,.1)"}`,
                      }}>
                      {has ? (
                        group === "SHADOW" ? <Footprints size={20} className="text-white" /> : group === "TITLE" ? <Award size={20} className="text-white" /> : <Trophy size={20} className="text-white" />
                      ) : (
                        <Lock size={18} className="text-[#6b6790]" />
                      )}
                    </div>
                    <p className={`font-display text-[0.7rem] tracking-[0.08em] ${has ? "text-white" : "text-[#6b6790]"}`}>
                      {has ? a.reward.name : "???"}
                    </p>
                    <p className="text-[0.62rem] text-[#7d79a3] mt-0.5 leading-tight">{a.desc}</p>
                    <p className={`text-[0.58rem] mt-1.5 tracking-[0.1em] ${has ? "text-[#22d3ee]" : "text-[#4b4870]"}`}>
                      {has ? `UNLOCKED ${labelFor(at.slice(0, 10))}` : a.rarity}
                    </p>
                  </Panel>
                );
              })}
            </div>
          </div>
        );
      })}
      {visible.length === 0 && <EmptyState icon={Trophy} title="NOTHING HERE YET" hint="Keep completing quests and dungeons to fill the collection." />}
    </div>
  );
}

/* ── Main screen ── */
export default function Progress() {
  const { state } = useStore();
  const derived = derive(state);
  const [tab, setTab] = useState("overview");
  const [monthOffset, setMonthOffset] = useState(0);

  const today = dateKey();
  const series = useMemo(() => xpSeries(state, 14), [state]);
  const bars = useMemo(() => weeklyBars(state, 8), [state]);
  const milestones = milestoneStatus(state);
  const unlocked = Object.keys(state.achievements?.unlocked || {}).length;

  const monthAnchor = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return dateKey(d);
  }, [monthOffset]);

  const history = [...state.progress.workouts].reverse();
  const totalXp = state.player.xpTotal || 0;
  const typeIcon = { strength: Dumbbell, endurance: Activity, mobility: Wind };

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="hud-label">PROGRESS</p>
          <h1 className="text-2xl font-display text-white tracking-[0.08em]">HUNTER RECORD</h1>
        </div>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "overview", label: "Stats" },
            { value: "calendar", label: "Calendar" },
            { value: "history", label: "History" },
            { value: "collection", label: "Collection" },
          ]}
        />
      </header>

      {tab === "overview" && (
        <div className="space-y-5">
          {/* Headline cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { label: "WORKOUTS", value: state.progress.workouts.length, icon: Swords, tone: "#a78bfa" },
              { label: "MINUTES", value: derived.totalMinutes, icon: Clock, tone: "#38bdf8" },
              { label: "AVG SESSION", value: `${derived.avgMinutes}′`, icon: Target, tone: "#22d3ee" },
              { label: "STREAK", value: `${derived.streak}d`, icon: Flame, tone: "#fbbf24" },
            ].map((c) => (
              <Panel key={c.label} className="p-3">
                <c.icon size={15} style={{ color: c.tone }} />
                <div className="font-display text-xl text-white num mt-1.5 leading-none">{c.value}</div>
                <div className="hud-label text-[0.55rem] mt-1">{c.label}</div>
              </Panel>
            ))}
          </div>

          {/* XP chart */}
          <Panel className="p-4">
            <SectionTitle right={<span className="text-[0.7rem] text-[#a78bfa] num">{totalXp} TOTAL XP</span>}>
              XP OVER TIME · 14 DAYS
            </SectionTitle>
            <XpChart data={series} />
          </Panel>

          {/* Weekly activity */}
          <Panel className="p-4">
            <SectionTitle right={<span className="text-[0.7rem] text-[#8f8ab5] num">GOAL {derived.weeklyGoal}/WK</span>}>
              WEEKLY ACTIVITY
            </SectionTitle>
            <WeeklyBars data={bars} goal={derived.weeklyGoal} />
            <div className="mt-3 flex items-center justify-between text-xs text-[#8f8ab5]">
              <span>Weeks at goal: <span className="text-[#34d399] num">{derived.weeksHit}</span></span>
              <span>Active days: <span className="text-[#a78bfa] num">{derived.activeDays}</span></span>
            </div>
          </Panel>

          {/* Attributes */}
          <Panel className="p-4">
            <SectionTitle sub="Derived from logged activity and consistency — never invented measurements.">
              ATTRIBUTES
            </SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
              <StatBar kind="strength" label="STRENGTH" value={derived.attributes.strength} hint="From strength sessions" />
              <StatBar kind="endurance" label="ENDURANCE" value={derived.attributes.endurance} hint="From conditioning sessions" />
              <StatBar kind="mobility" label="MOBILITY" value={derived.attributes.mobility} hint="From mobility sessions" />
              <StatBar kind="discipline" label="DISCIPLINE" value={derived.attributes.discipline} hint="From streaks and weekly consistency" />
            </div>
            <p className="text-[0.7rem] text-[#6b6790] mt-3 leading-relaxed">
              The system does not measure muscle, body composition or calories — it tracks what you actually did.
            </p>
          </Panel>

          {/* Milestones */}
          <Panel className="p-4">
            <SectionTitle right={<span className="text-[0.7rem] text-[#8f8ab5] num">{milestones.filter((m) => m.done).length}/{milestones.length}</span>}>
              PERSONAL MILESTONES
            </SectionTitle>
            <ul className="space-y-2">
              {milestones.map((m) => (
                <li key={m.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${m.done ? "border-[rgba(52,211,153,.35)] bg-[rgba(52,211,153,.06)]" : "border-[rgba(255,255,255,.07)]"}`}>
                  <div className={`w-7 h-7 grid place-items-center rounded-lg flex-none ${m.done ? "bg-[#059669] text-black" : "bg-[rgba(255,255,255,.06)] text-[#6b6790]"}`}>
                    {m.done ? <Sparkles size={14} /> : <Lock size={13} />}
                  </div>
                  <div className="min-w-0">
                    <p className={`font-display text-[0.78rem] tracking-[0.08em] ${m.done ? "text-white" : "text-[#8f8ab5]"}`}>{m.label}</p>
                    <p className="text-[0.7rem] text-[#7d79a3]">{m.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          {/* Rank ladder */}
          <Panel className="p-4">
            <SectionTitle right={<span className="text-[0.7rem] text-[#a78bfa]">LEVEL {state.player.level}</span>}>
              RANK LADDER
            </SectionTitle>
            <div className="flex items-center justify-between gap-2">
              {rankLadder(state.player.level).map((r) => (
                <div key={r.rank} className="flex flex-col items-center gap-1.5 flex-1">
                  <RankBadge rank={r.rank} size={r.rank === state.player.rank ? 46 : 34} className={r.achieved ? "" : "opacity-30 grayscale"} />
                  <span className="text-[0.58rem] text-[#7d79a3] num">LV {r.minLevel}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {tab === "calendar" && (
        <Panel className="p-4">
          <Calendar state={state} monthKey={monthAnchor} onMonth={(dir) => setMonthOffset((v) => v + dir)} />
        </Panel>
      )}

      {tab === "history" && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <EmptyState
              icon={History}
              title="NO SESSIONS LOGGED"
              hint="Complete your first workout and it appears here with duration, exercises and XP."
            />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <span className="chip !min-h-[32px] !text-[0.7rem]">{history.length} sessions</span>
                <span className="chip !min-h-[32px] !text-[0.7rem]">{derived.totalMinutes} minutes</span>
                <span className="chip !min-h-[32px] !text-[0.7rem]">{state.progress.restLogs?.length || 0} recovery days</span>
              </div>
              <ul className="space-y-2.5">
                {history.map((w) => {
                  const Icon = typeIcon[w.type] || Dumbbell;
                  return (
                    <li key={w.id}>
                      <Panel className="p-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-9 h-9 grid place-items-center rounded-xl bg-[rgba(6,6,14,.6)] border border-[rgba(139,92,246,.3)] text-[#a78bfa] flex-none">
                              <Icon size={16} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-display text-[0.85rem] text-white tracking-[0.05em] truncate">{w.name}</p>
                              <p className="text-[0.7rem] text-[#8f8ab5]">
                                {relativeDayLabel(w.date, today)} · {w.type} · {w.durationMin} min
                                {w.source === "dungeon" && " · dungeon"}
                              </p>
                            </div>
                          </div>
                          <span className="font-display text-sm num text-[#a78bfa] flex-none">+{w.xp}</span>
                        </div>
                        <p className="text-[0.68rem] text-[#6b6790] mt-2 line-clamp-2">
                          {w.exercises?.slice(0, 6).join(" · ")}
                          {w.exercises?.length > 6 ? ` · +${w.exercises.length - 6} more` : ""}
                        </p>
                      </Panel>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}

      {tab === "collection" && <Collection state={state} />}
    </div>
  );
}
