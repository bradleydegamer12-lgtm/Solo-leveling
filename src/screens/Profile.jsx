import React, { useRef, useState } from "react";
import { useStore } from "../state/store.jsx";
import { derive } from "../state/selectors.js";
import { labelFor } from "../state/dates.js";
import { exportPayload, parseImport, clearState } from "../state/storage.js";
import { THEMES, isThemeUnlocked } from "../state/themes.js";
import { Panel, Btn, Chip, SectionTitle, Toggle, Segmented, Modal, ConfirmDialog, RankBadge, StatBar } from "../components/ui.jsx";
import {
  EXPERIENCE_OPTIONS, GOAL_OPTIONS, MultiEquipment, DaysPicker, OptionGrid, DAY_LABELS, MINUTE_OPTIONS, HeroSigil,
} from "../components/Onboarding.jsx";
import { playCue } from "../lib/audio.js";
import { Volume2, Waves, Sparkles, Type, Download, Upload, RotateCcw, ShieldCheck, Info, Pencil, Check, Database, LogOut } from "lucide-react";

function Row({ label, children }) {
  return (
    <div className="py-3 border-b border-[rgba(139,92,246,.14)] last:border-0">
      {children}
    </div>
  );
}

export default function Profile() {
  const { state, dispatch, storageOk } = useStore();
  const derived = derive(state);
  const profile = state.profile;
  const settings = state.settings;

  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState(profile);
  const [nameError, setNameError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState("");
  const [aboutOpen, setAboutOpen] = useState(false);
  const fileRef = useRef(null);

  const openEdit = () => {
    setDraft(profile);
    setEditOpen(true);
    setNameError("");
  };

  const saveProfile = () => {
    if (!draft.name.trim()) {
      setNameError("A player name is required.");
      return;
    }
    dispatch({
      type: "profile/update",
      profile: {
        ...draft,
        name: draft.name.trim().slice(0, 16),
        preferredDays: draft.preferredDays.length ? draft.preferredDays : [1, 3, 5],
        sessionMinutes: Number(draft.sessionMinutes) || 30,
        avoid: String(draft.avoid || "").trim(),
        equipment: draft.equipment?.length ? draft.equipment : ["none"],
      },
    });
    setEditOpen(false);
    setNotice("Profile updated — today's quest board was recalculated.");
    playCue("quest");
    setTimeout(() => setNotice(""), 4000);
  };

  const doExport = () => {
    const blob = new Blob([exportPayload(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shadow-system-save-${labelFor(new Date().toISOString().slice(0, 10))}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Save file exported.");
    setTimeout(() => setNotice(""), 3000);
  };

  const doImport = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseImport(String(reader.result || ""));
      if (!parsed) {
        setNotice("Import failed — that file isn't a valid SHADOW SYSTEM save.");
        setTimeout(() => setNotice(""), 5000);
        return;
      }
      dispatch({ type: "data/import", state: parsed });
      setNotice("Save imported successfully.");
      setTimeout(() => setNotice(""), 4000);
    };
    reader.onerror = () => {
      setNotice("Import failed — the file could not be read.");
      setTimeout(() => setNotice(""), 5000);
    };
    reader.readAsText(file);
  };

  const totalXp = state.player.xpTotal || 0;

  return (
    <div className="space-y-6">
      <header>
        <p className="hud-label">PROFILE</p>
        <h1 className="text-2xl font-display text-white tracking-[0.08em]">HUNTER DOSSIER</h1>
      </header>

      {/* Identity card */}
      <Panel hud glow className="p-4 sm:p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 grid place-items-center rounded-2xl bg-[rgba(139,92,246,.12)] border border-[rgba(139,92,246,.4)] flex-none">
            <HeroSigil size={42} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-display text-white tracking-[0.06em] truncate">{profile.name}</h2>
              <button type="button" className="btn btn-quiet btn-sm" onClick={openEdit} aria-label="Edit player profile">
                <Pencil size={13} />
              </button>
            </div>
            <p className="text-[0.7rem] text-[#8f8ab5] tracking-[0.12em] font-display">
              LEVEL {String(state.player.level).padStart(2, "0")} · {state.player.rank}-CLASS · JOINED{" "}
              {labelFor(state.createdAt.slice(0, 10), { withYear: true })}
            </p>
            <p className="text-[0.7rem] text-[#6b6790]">
              {totalXp.toLocaleString()} XP lifetime · {(state.achievements ? Object.keys(state.achievements.unlocked).length : 0)} collectibles
            </p>
          </div>
          <RankBadge rank={state.player.rank} size={54} />
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="rounded-xl bg-[rgba(6,6,14,.55)] border border-[rgba(139,92,246,.18)] px-2 py-2 text-center">
            <div className="font-display text-lg text-white num leading-none">{state.player.totalWorkouts}</div>
            <div className="hud-label text-[0.55rem] mt-1">WORKOUTS</div>
          </div>
          <div className="rounded-xl bg-[rgba(6,6,14,.55)] border border-[rgba(139,92,246,.18)] px-2 py-2 text-center">
            <div className="font-display text-lg text-white num leading-none">{derived.streak}d</div>
            <div className="hud-label text-[0.55rem] mt-1">STREAK</div>
          </div>
          <div className="rounded-xl bg-[rgba(6,6,14,.55)] border border-[rgba(139,92,246,.18)] px-2 py-2 text-center">
            <div className="font-display text-lg text-white num leading-none">{derived.thisWeekCount}/{derived.weeklyGoal}</div>
            <div className="hud-label text-[0.55rem] mt-1">THIS WEEK</div>
          </div>
        </div>
      </Panel>

      {/* Training preferences */}
      <section>
        <SectionTitle right={<Btn size="sm" variant="ghost" onClick={openEdit}>EDIT</Btn>}>
          TRAINING PARAMETERS
        </SectionTitle>
        <Panel className="p-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {[
              { label: "EXPERIENCE", value: profile.experience.toUpperCase() },
              { label: "PRIMARY GOAL", value: (GOAL_OPTIONS.find((g) => g.value === profile.goal) || {}).label || profile.goal.toUpperCase() },
              { label: "EQUIPMENT", value: (profile.equipment || []).map((e) => e.toUpperCase()).join(" · ") },
              { label: "SESSION LENGTH", value: `${profile.sessionMinutes} MIN` },
              { label: "TRAINING DAYS", value: (profile.preferredDays || []).map((d) => DAY_LABELS[d]).join(" · ") || "—" },
              { label: "AVOID LIST", value: profile.avoid || "Nothing declared" },
            ].map((row) => (
              <div key={row.label}>
                <dt className="hud-label">{row.label}</dt>
                <dd className="text-sm text-white font-display tracking-[0.05em] mt-0.5">{row.value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </section>

      {/* Settings */}
      <section>
        <SectionTitle>SYSTEM SETTINGS</SectionTitle>
        <Panel className="px-4 py-1">
          <Row label="sound">
            <Toggle
              checked={settings.sound}
              onChange={(v) => {
                dispatch({ type: "settings/update", settings: { sound: v } });
                if (v) setTimeout(() => playCue("quest"), 60);
              }}
              label="Sound effects"
              hint="Short synthesized cues for quests, XP, level-ups and unlocks."
            />
          </Row>

          <div className="py-3 border-b border-[rgba(139,92,246,.14)]">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm text-[#e9e7f7]">Animations</div>
                <div className="text-xs text-[#7d79a3] leading-snug mt-0.5">
                  “Auto” respects your device's reduced-motion setting.
                </div>
              </div>
              <Segmented
                value={settings.motion}
                onChange={(v) => dispatch({ type: "settings/update", settings: { motion: v } })}
                options={[
                  { value: "auto", label: "Auto" },
                  { value: "on", label: "On" },
                  { value: "off", label: "Off" },
                ]}
              />
            </div>
          </div>

          <Row>
            <Toggle
              checked={settings.particles}
              onChange={(v) => dispatch({ type: "settings/update", settings: { particles: v } })}
              label="Particle effects"
              hint="Ambient drifting motes on status panels. Off saves battery on low-end devices."
            />
          </Row>

          <div className="py-3 border-b border-[rgba(139,92,246,.14)]">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm text-[#e9e7f7]">Text size</div>
                <div className="text-xs text-[#7d79a3] leading-snug mt-0.5">Accessibility: larger interface text.</div>
              </div>
              <Segmented
                value={settings.textScale}
                onChange={(v) => dispatch({ type: "settings/update", settings: { textScale: v } })}
                options={[
                  { value: "normal", label: "Normal" },
                  { value: "large", label: "Large" },
                ]}
              />
            </div>
          </div>
        </Panel>
      </section>

      {/* Unlockable themes */}
      <section>
        <SectionTitle sub="Earned through progression — rank colours always stay fixed.">
          DISPLAY THEME
        </SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {THEMES.map((t) => {
            const unlocked = isThemeUnlocked(t, state);
            const active = settings.theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                className="option-card items-center text-center"
                aria-pressed={active}
                disabled={!unlocked}
                title={unlocked ? t.desc : `Locked — ${t.hint}`}
                onClick={() => {
                  dispatch({ type: "settings/update", settings: { theme: t.id } });
                  playCue("quest");
                }}
              >
                <span
                  className={`w-full h-7 rounded-md mb-1.5 ${unlocked ? "" : "locked-item"}`}
                  style={{
                    background: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})`,
                    boxShadow: unlocked ? `0 0 12px ${t.swatch[0]}66` : "none",
                    border: `1px solid ${active ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.14)"}`,
                  }}
                  aria-hidden="true"
                />
                <span className="font-display text-[0.7rem] tracking-[0.08em] text-white">{t.name}</span>
                <span className={`text-[0.62rem] ${active ? "text-[#34d399]" : unlocked ? "text-[#8f8ab5]" : "text-[#6b6790]"}`}>
                  {active ? "EQUIPPED" : unlocked ? "TAP TO EQUIP" : `🔒 ${t.hint}`}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[0.7rem] text-[#6b6790] mt-2 leading-relaxed">
          Themes recolour the interface chrome only — ranks, attributes and category colours keep their meaning.
        </p>
      </section>

      {/* Data & storage */}
      <section>
        <SectionTitle>Data & Storage</SectionTitle>
        <Panel className="p-4">
          <div className={`flex items-start gap-2.5 p-2.5 rounded-lg border mb-3 ${storageOk ? "bg-[rgba(52,211,153,.07)] border-[rgba(52,211,153,.3)]" : "bg-[rgba(248,113,113,.08)] border-[rgba(248,113,113,.4)]"}`}>
            <Database size={16} className={storageOk ? "text-[#34d399] flex-none mt-0.5" : "text-[#f87171] flex-none mt-0.5"} />
            <p className="text-xs text-[#a5a1c4] leading-relaxed">
              {storageOk ? (
                <>
                  <span className="text-[#34d399]">Local storage active.</span> Your profile, XP, quests and workout
                  history are saved <strong>on this device only</strong>. There is no account, no login and no cloud
                  sync in this demo — clearing browser data, using private browsing or switching devices will lose
                  progress unless you export a save file.
                </>
              ) : (
                <>
                  <span className="text-[#f87171]">Storage unavailable.</span> Progress will not persist after you close
                  this tab — private browsing modes often block storage.
                </>
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Btn variant="ghost" onClick={doExport}>
              <Download size={15} /> EXPORT SAVE
            </Btn>
            <Btn variant="ghost" onClick={() => fileRef.current?.click()}>
              <Upload size={15} /> IMPORT SAVE
            </Btn>
            <Btn variant="danger" onClick={() => setConfirmReset(true)}>
              <RotateCcw size={15} /> RESET DATA
            </Btn>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={doImport} />

          {notice && (
            <p className="mt-3 text-xs text-[#22d3ee] flex items-center gap-1.5">
              <Check size={13} /> {notice}
            </p>
          )}
        </Panel>
      </section>

      {/* About */}
      <section>
        <SectionTitle>ABOUT</SectionTitle>
        <Panel className="p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="text-[#a78bfa] flex-none mt-0.5" />
            <div className="text-xs text-[#a5a1c4] leading-relaxed">
              <p className="text-white font-display tracking-[0.08em] mb-1">SHADOW SYSTEM v1.0</p>
              <p>
                An original dark-fantasy fitness RPG inspired by the hunter-rank genre. All names, artwork, shadows and
                branding are original creations — no official logos, characters or copyrighted assets are used.
              </p>
              <p className="mt-2">
                This app is for general fitness motivation and is <strong>not medical advice</strong>. Train within
                your ability, stop if something hurts, and consult a professional about medical conditions.
              </p>
            </div>
          </div>
          <Btn variant="quiet" size="sm" className="mt-3" onClick={() => setAboutOpen(true)}>
            <Info size={14} /> HOW PROGRESSION WORKS
          </Btn>
        </Panel>
      </section>

      {/* Edit profile modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="EDIT PLAYER PROFILE"
        sub="Changes update your plan and quest board immediately."
        footer={
          <>
            <Btn variant="quiet" onClick={() => setEditOpen(false)}>CANCEL</Btn>
            <Btn onClick={saveProfile}><Check size={15} /> SAVE CHANGES</Btn>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <span className="hud-label">PLAYER NAME</span>
            <input
              className="field mt-1.5"
              value={draft.name}
              maxLength={16}
              onChange={(e) => {
                setDraft({ ...draft, name: e.target.value });
                setNameError("");
              }}
            />
            {nameError && <p className="text-xs text-[#f87171] mt-1">{nameError}</p>}
          </div>

          <div>
            <span className="hud-label">EXPERIENCE</span>
            <div className="mt-1.5">
              <OptionGrid options={EXPERIENCE_OPTIONS} value={draft.experience} onSelect={(experience) => setDraft({ ...draft, experience })} />
            </div>
          </div>

          <div>
            <span className="hud-label">PRIMARY GOAL</span>
            <div className="mt-1.5">
              <OptionGrid options={GOAL_OPTIONS} value={draft.goal} onSelect={(goal) => setDraft({ ...draft, goal })} />
            </div>
          </div>

          <div>
            <span className="hud-label">EQUIPMENT</span>
            <div className="mt-1.5">
              <MultiEquipment value={draft.equipment} onChange={(equipment) => setDraft({ ...draft, equipment })} />
            </div>
          </div>

          <div>
            <span className="hud-label">SESSION LENGTH</span>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {MINUTE_OPTIONS.map((m) => (
                <Chip key={m} active={Number(draft.sessionMinutes) === m} onClick={() => setDraft({ ...draft, sessionMinutes: m })}>
                  {m}′
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <span className="hud-label">TRAINING DAYS</span>
            <div className="mt-1.5">
              <DaysPicker value={draft.preferredDays} onChange={(preferredDays) => setDraft({ ...draft, preferredDays })} />
            </div>
          </div>

          <div>
            <span className="hud-label">MOVEMENTS TO AVOID</span>
            <textarea
              className="field mt-1.5 min-h-[80px] resize-y"
              placeholder="e.g. jumping, knee pain…"
              maxLength={200}
              value={draft.avoid || ""}
              onChange={(e) => setDraft({ ...draft, avoid: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* How progression works */}
      <Modal open={aboutOpen} onClose={() => setAboutOpen(false)} title="HOW PROGRESSION WORKS">
        <div className="space-y-3 text-sm text-[#b9b5d6] leading-relaxed">
          <p><span className="text-white font-display">XP</span> comes from completed workouts, daily quests, mobility, dungeons and weekly consistency — never from body weight or appearance.</p>
          <p><span className="text-white font-display">LEVELS</span> need rising XP (300 at level 1, +50 each level).</p>
          <p><span className="text-white font-display">RANKS</span> unlock at levels 4 (D), 8 (C), 13 (B), 19 (A) and 26 (S).</p>
          <p><span className="text-white font-display">ATTRIBUTES</span> grow only from what you log: strength from strength sessions, endurance from conditioning, mobility from flows, discipline from streaks and weekly goals.</p>
          <p><span className="text-white font-display">STREAKS</span> count consecutive active days; one missed day resets to 1. Rest days you log keep the streak alive.</p>
          <p><span className="text-white font-display">SAFETY</span> — the system never rewards training through pain, skipping meals, dehydration or sleep loss. Recovery quests exist on purpose.</p>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmReset}
        title="RESET ALL DATA?"
        message="This permanently deletes your player, XP, quests, workout history and collectibles from this device. Export a save first if you want to keep it."
        confirmLabel="DELETE EVERYTHING"
        danger
        onConfirm={() => {
          dispatch({ type: "data/reset" });
          clearState();
          setConfirmReset(false);
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
