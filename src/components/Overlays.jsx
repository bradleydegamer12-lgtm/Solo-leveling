import React, { useEffect } from "react";
import { useStore } from "../state/store.jsx";
import { getAchievement } from "../state/achievements.js";
import { useMotion, Btn, RankBadge } from "./ui.jsx";
import { Trophy, Zap, Flame, Swords, Sparkles, ShieldCheck, Info, Droplets } from "lucide-react";

/* Big cinematic overlays — one at a time, tap or timer to dismiss.
   Priority matters: when several events fire together (e.g. level-up + achievement)
   the most important one shows first, then the queue drains in order. */
const BIG_FX = ["levelup", "rankup", "achievement", "boss", "welcome"];

function pickOverlay(fxList) {
  for (const type of BIG_FX) {
    const hit = fxList.find((f) => f.type === type);
    if (hit) return hit;
  }
  return null;
}

function BigOverlay({ fx, onDismiss }) {
  const motion = useMotion();

  useEffect(() => {
    const ms = fx.type === "achievement" ? 3200 : 3000;
    const t = setTimeout(onDismiss, ms);
    return () => clearTimeout(t);
  }, [fx.id, onDismiss]);

  let body = null;

  if (fx.type === "levelup") {
    body = (
      <>
        <p className="hud-label mb-2 text-[#22d3ee]">SYSTEM NOTIFICATION</p>
        <h2 className="overlay-title">LEVEL UP!</h2>
        <p className="mt-3 font-display tracking-[0.18em] text-[#cfcbe8] text-sm sm:text-base">
          YOUR HARD WORK IS PAYING OFF.
        </p>
        <div className="mt-5 flex items-center justify-center gap-4">
          <div className="text-5xl font-display font-bold text-white text-glow num">{fx.from}</div>
          <div className="text-[#a78bfa] text-2xl">→</div>
          <div className="text-6xl font-display font-bold text-white text-glow num">{fx.to}</div>
        </div>
        <p className="mt-4 text-xs text-[#8f8ab5]">
          +{fx.xp} XP banked · new abilities unlock as your rank grows
        </p>
      </>
    );
  } else if (fx.type === "rankup") {
    body = (
      <>
        <p className="hud-label mb-2 text-[#fbbf24]">RANK EVOLUTION</p>
        <h2 className="overlay-title">RANK UP!</h2>
        <div className="mt-5 flex items-center justify-center gap-5">
          <RankBadge rank={fx.from} size={54} />
          <div className="text-[#a78bfa] text-2xl">→</div>
          <div className={motion ? "float" : ""}>
            <RankBadge rank={fx.to} size={84} />
          </div>
        </div>
        <p className="mt-4 font-display tracking-[0.2em] text-sm text-white">
          {fx.from}-CLASS → {fx.to}-CLASS HUNTER
        </p>
        <p className="mt-2 text-xs text-[#8f8ab5] max-w-[34ch] mx-auto leading-relaxed">
          The gate recognises your growth. New dungeons and titles are now within reach.
        </p>
      </>
    );
  } else if (fx.type === "achievement") {
    const a = getAchievement(fx.achievementId);
    body = a ? (
      <div className={motion ? "unlock-flash" : ""}>
        <div className="mx-auto w-16 h-16 grid place-items-center rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#0891b2] shadow-[0_0_34px_rgba(139,92,246,.7)] mb-3">
          <Trophy size={30} className="text-white" />
        </div>
        <p className="hud-label mb-1 text-[#fbbf24]">{a.rarity} UNLOCKED</p>
        <h2 className="font-display text-2xl tracking-[0.1em] text-white">{a.name}</h2>
        <p className="mt-1.5 text-xs text-[#8f8ab5]">{a.desc}</p>
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[rgba(167,139,250,.5)] bg-[rgba(139,92,246,.14)]">
          <Sparkles size={14} className="text-[#a78bfa]" />
          <span className="font-display text-xs tracking-[0.14em] text-[#d9d2ff]">
            {a.reward.type}: {a.reward.name}
          </span>
        </div>
      </div>
    ) : null;
  } else if (fx.type === "welcome") {
    body = (
      <>
        <div className="mx-auto mb-4 w-16 h-16 grid place-items-center rounded-2xl border border-[rgba(167,139,250,.6)] bg-[rgba(139,92,246,.14)] shadow-[0_0_30px_rgba(139,92,246,.5)]">
          <ShieldCheck size={30} className="text-[#a78bfa]" />
        </div>
        <h2 className="overlay-title">WELCOME, PLAYER.</h2>
        <p className="mt-3 font-display tracking-[0.22em] text-sm text-[#22d3ee] text-glow-cyan">
          YOUR JOURNEY STARTS NOW.
        </p>
        <p className="mt-4 text-xs text-[#8f8ab5]">
          {fx.name ? `${fx.name.toUpperCase()}, your first quest board is live.` : "Your first quest board is live."}
        </p>
      </>
    );
  } else if (fx.type === "boss") {
    body = (
      <>
        <p className="hud-label mb-2 text-[#f87171]">BOSS DEFEATED</p>
        <h2 className="overlay-title">GATE CLEARED</h2>
        <div className="mt-4 flex items-center justify-center gap-3">
          <Swords size={26} className="text-[#fbbf24]" />
          <span className="font-display text-xl text-white num">+{fx.xp} XP</span>
        </div>
        <p className="mt-3 text-xs text-[#8f8ab5]">
          {fx.mode === "easy" ? "Slayer route cleared — respect the pace." : "Full route cleared. The gatekeeper falls."}
        </p>
      </>
    );
  }

  if (!body) return null;

  return (
    <div className="overlay-backdrop" onClick={onDismiss} role="alertdialog" aria-live="assertive">
      <div className="glass hud overlay-card">
        {motion && <div className="burst" aria-hidden="true" />}
        <div className="relative z-10">{body}</div>
        <button type="button" onClick={onDismiss} className="mt-6 hud-label text-[#8f8ab5] hover:text-white">
          TAP TO CONTINUE
        </button>
      </div>
    </div>
  );
}

/* Transient toasts for quest / workout / dungeon / system feedback. */
function Toast({ fx, onDismiss }) {
  useEffect(() => {
    const ms = fx.type === "notice" ? 5200 : 3600;
    const t = setTimeout(onDismiss, ms);
    return () => clearTimeout(t);
  }, [fx.id, onDismiss]);

  const meta = (() => {
    switch (fx.type) {
      case "quest":
        return { icon: Zap, color: "#a78bfa", title: fx.title || "QUEST COMPLETE", detail: `+${fx.xp} XP${fx.bonus ? ` · board cleared +${fx.bonus}` : ""}` };
      case "workout":
        return {
          icon: fx.partial ? Info : Flame,
          color: fx.partial ? "#fbbf24" : "#34d399",
          title: fx.partial ? "SESSION LOGGED (PARTIAL)" : "WORKOUT COMPLETE",
          detail: `${fx.name} · ${fx.minutes} min · +${fx.xp} XP`,
        };
      case "dungeon":
        return { icon: Swords, color: "#22d3ee", title: "DUNGEON CLEAR", detail: `Bonus +${fx.xp} XP${fx.easy ? " · novice route" : ""}` };
      case "boss_ready":
        return { icon: Swords, color: "#f87171", title: "BOSS WEAKNESS DETECTED", detail: `${fx.count}/${fx.goal} sessions — claim in DUNGEONS` };
      case "notice":
        return { icon: Info, color: "#fbbf24", title: "SYSTEM", detail: fx.message };
      default:
        return { icon: Sparkles, color: "#a78bfa", title: "UPDATE", detail: "" };
    }
  })();

  const Icon = meta.icon;

  return (
    <div className="toast" role="status" onClick={onDismiss} style={{ borderColor: `${meta.color}80` }}>
      <div className="w-8 h-8 grid place-items-center rounded-lg flex-none" style={{ background: `${meta.color}1f`, color: meta.color }}>
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display text-[0.72rem] tracking-[0.14em] text-white uppercase">{meta.title}</div>
        {meta.detail && <div className="text-[0.72rem] text-[#a5a1c4] truncate">{meta.detail}</div>}
      </div>
      <span className="font-display text-xs num" style={{ color: meta.color }}>
        {fx.xp ? `+${fx.xp}` : ""}
      </span>
    </div>
  );
}

export function FxLayer() {
  const { state, dispatch } = useStore();
  const fx = state.fx || [];
  const big = pickOverlay(fx);
  const toasts = fx.filter((f) => !BIG_FX.includes(f.type)).slice(-3);

  return (
    <>
      {big && <BigOverlay fx={big} onDismiss={() => dispatch({ type: "fx/clear", id: big.id })} />}
      {toasts.length > 0 && (
        <div className="toast-stack">
          {toasts.map((t) => (
            <Toast key={t.id} fx={t} onDismiss={() => dispatch({ type: "fx/clear", id: t.id })} />
          ))}
        </div>
      )}
    </>
  );
}

export { Droplets };
