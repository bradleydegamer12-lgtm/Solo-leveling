import React, { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../state/store.jsx";
import { X } from "lucide-react";

/* ── Motion preference: settings.motion (auto|on|off) + OS reduced-motion ── */
export function useMotion() {
  const { state } = useStore();
  const [systemReduce, setSystemReduce] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e) => setSystemReduce(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const pref = state.settings.motion;
  if (pref === "off") return false;
  if (pref === "on") return true;
  return !systemReduce;
}

export function Panel({ children, className = "", hud = false, glow = false, as: Tag = "div", ...rest }) {
  return (
    <Tag className={`glass ${hud ? "hud" : ""} ${glow ? "glow-ring" : ""} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function Btn({ variant = "primary", size, block, className = "", children, ...rest }) {
  const cls = [
    "btn",
    `btn-${variant}`,
    size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "",
    block ? "btn-block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}

export function Chip({ active, className = "", children, ...rest }) {
  return (
    <button type="button" className={`chip ${active ? "chip-active" : ""} ${className}`} aria-pressed={Boolean(active)} {...rest}>
      {children}
    </button>
  );
}

export function SectionTitle({ children, right, sub }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div>
        <h2 className="text-[0.78rem] tracking-[0.28em] text-[#a8a3cc] font-display uppercase">{children}</h2>
        {sub && <p className="text-xs text-[#7d79a3] mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

const RANK_COLORS = {
  E: "#9ca3af",
  D: "#10b981",
  C: "#22d3ee",
  B: "#3b82f6",
  A: "#a78bfa",
  S: "#f59e0b",
};

export function RankBadge({ rank = "E", size = 56, className = "" }) {
  return (
    <div
      className={`rank-badge rank-${rank} ${className}`}
      style={{ width: size, height: Math.round(size * 1.08), fontSize: size * 0.42 }}
      aria-label={`Rank ${rank}`}
      role="img"
    >
      {rank}
    </div>
  );
}

export function rankColor(rank) {
  return RANK_COLORS[rank] || RANK_COLORS.E;
}

export function XpBar({ pct = 0, showShimmer = true, height = 12 }) {
  const motion = useMotion();
  return (
    <div className="xp-track" style={{ height }} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className="xp-fill"
        style={{ width: `${Math.max(2, Math.min(100, pct))}%`, animationPlayState: motion && showShimmer ? "running" : "paused" }}
      />
    </div>
  );
}

const STAT_COLORS = {
  strength: "linear-gradient(90deg,#f472b6,#a78bfa)",
  endurance: "linear-gradient(90deg,#38bdf8,#22d3ee)",
  mobility: "linear-gradient(90deg,#34d399,#22d3ee)",
  discipline: "linear-gradient(90deg,#fbbf24,#f472b6)",
};

export function StatBar({ label, value, max = 99, kind = "strength", hint }) {
  const pct = Math.max(3, Math.min(100, (value / max) * 100));
  return (
    <div title={hint}>
      <div className="flex items-baseline justify-between mb-1">
        <span className="hud-label">{label}</span>
        <span className="num font-display text-sm text-white" style={{ textShadow: "0 0 10px rgba(167,139,250,.5)" }}>
          {value}
        </span>
      </div>
      <div className="stat-track">
        <div className="stat-fill" style={{ width: `${pct}%`, background: STAT_COLORS[kind] || STAT_COLORS.strength }} />
      </div>
    </div>
  );
}

export function Segmented({ options, value, onChange, className = "" }) {
  return (
    <div className={`inline-flex p-1 rounded-xl bg-[rgba(6,6,14,.8)] border border-[rgba(139,92,246,.25)] gap-1 ${className}`} role="tablist">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-[0.72rem] font-display tracking-[0.12em] uppercase transition-all min-h-[34px] ${
              active
                ? "text-white bg-gradient-to-r from-[#7c3aed] to-[#0891b2] shadow-[0_0_14px_rgba(139,92,246,.45)]"
                : "text-[#8f8ab5] hover:text-white"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <div className="text-sm text-[#e9e7f7]">{label}</div>
        {hint && <div className="text-xs text-[#7d79a3] leading-snug mt-0.5">{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={Boolean(checked)}
        aria-label={label}
        className="switch"
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}

export function Modal({ open, onClose, title, sub, children, footer, labelledBy }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus first control for keyboard users
    const t = setTimeout(() => {
      const focusable = ref.current?.querySelector("button, input, textarea, select, [tabindex]");
      focusable?.focus?.();
    }, 60);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="presentation"
    >
      <div className="modal-sheet" role="dialog" aria-modal="true" aria-label={title || labelledBy} ref={ref}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="font-display text-lg tracking-[0.1em] text-white uppercase">{title}</h3>
            {sub && <p className="text-xs text-[#8f8ab5] mt-0.5">{sub}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 -mr-1 rounded-lg text-[#8f8ab5] hover:text-white hover:bg-white/5 min-h-[40px] min-w-[40px]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="hairline mb-3" />
        {children}
        {footer && <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-end">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="glass-soft text-center py-8 px-4">
      {Icon && (
        <div className="mx-auto mb-2 w-10 h-10 grid place-items-center rounded-xl bg-[rgba(139,92,246,.12)] border border-[rgba(139,92,246,.3)] text-[#a78bfa]">
          <Icon size={20} />
        </div>
      )}
      <p className="font-display text-sm tracking-[0.14em] text-[#cfcbe8] uppercase">{title}</p>
      {hint && <p className="text-xs text-[#7d79a3] mt-1 max-w-[38ch] mx-auto leading-relaxed">{hint}</p>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

export function LoadingBar({ label = "LOADING" }) {
  return (
    <div className="flex items-center gap-3 justify-center py-10 text-[#8f8ab5]">
      <div className="w-40 h-1.5 rounded-full bg-[rgba(6,6,14,.9)] border border-[rgba(139,92,246,.3)] overflow-hidden">
        <div className="h-full w-1/3 bg-gradient-to-r from-[#7c3aed] to-[#22d3ee] animate-pulse" />
      </div>
      <span className="hud-label">{label}…</span>
    </div>
  );
}

/** Ambient particles — only when enabled, motion allowed, and on hero surfaces. */
export function Particles({ count = 10 }) {
  const { state } = useStore();
  const motion = useMotion();
  const enabled = state.settings.particles && motion;
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: (i * 97) % 100,
        delay: (i * 1.7) % 9,
        duration: 7 + ((i * 3) % 7),
        size: 2 + (i % 3),
      })),
    [count],
  );

  if (!enabled) return null;
  return (
    <div className="particles" aria-hidden="true">
      {bits.map((b) => (
        <span
          key={b.id}
          className="particle"
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.size,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = "CONFIRM", cancelLabel = "CANCEL", danger, onConfirm, onCancel }) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-[#b9b5d6] leading-relaxed">{message}</p>
      <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
        <Btn variant="quiet" onClick={onCancel}>
          {cancelLabel}
        </Btn>
        <Btn variant={danger ? "danger" : "primary"} onClick={onConfirm}>
          {confirmLabel}
        </Btn>
      </div>
    </Modal>
  );
}

export function ProgressBar({ pct = 0, tone = "violet", height = 8 }) {
  const gradients = {
    violet: "linear-gradient(90deg, var(--accent-deep), var(--accent-2))",
    cyan: "linear-gradient(90deg,#0891b2,#22d3ee)",
    green: "linear-gradient(90deg,#059669,#34d399)",
    gold: "linear-gradient(90deg,#d97706,#fbbf24)",
  };
  return (
    <div className="stat-track" style={{ height }} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="stat-fill" style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: gradients[tone] || gradients.violet, boxShadow: "0 0 10px rgba(139,92,246,.5)" }} />
    </div>
  );
}
