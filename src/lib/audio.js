// Lightweight synthesized sound cues — no audio files, no network.
// Everything is created on demand and torn down immediately.

let ctx = null;
let enabled = true;

export function setSoundEnabled(value) {
  enabled = Boolean(value);
}

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, { start = 0, duration = 0.12, type = "sine", gain = 0.05, slideTo = null } = {}) {
  const ac = getCtx();
  if (!ac) return;
  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.03);
}

const CUES = {
  click: () => tone(660, { duration: 0.05, type: "square", gain: 0.03 }),
  quest: () => {
    tone(523, { duration: 0.1, type: "triangle", gain: 0.05 });
    tone(784, { start: 0.08, duration: 0.14, type: "triangle", gain: 0.05 });
  },
  xp: () => tone(880, { duration: 0.08, type: "sine", gain: 0.04, slideTo: 1320 }),
  levelup: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, { start: i * 0.09, duration: 0.16, type: "triangle", gain: 0.06 }));
  },
  rankup: () => {
    [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, { start: i * 0.1, duration: 0.22, type: "sawtooth", gain: 0.035 }));
  },
  achievement: () => {
    tone(740, { duration: 0.12, type: "sine", gain: 0.05 });
    tone(1109, { start: 0.1, duration: 0.2, type: "sine", gain: 0.05 });
  },
  rest: () => tone(440, { duration: 0.25, type: "sine", gain: 0.04, slideTo: 300 }),
};

export function playCue(name) {
  if (!enabled) return;
  try {
    CUES[name]?.();
  } catch {
    /* audio must never break the app */
  }
}

/** Haptic tick where supported (Android Chrome). */
export function buzz(pattern = 12) {
  try {
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}
