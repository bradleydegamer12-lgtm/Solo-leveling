// Store provider: hydrates from localStorage, persists every change, rolls the
// day over, and turns reducer "fx" events into sounds + overlay animations.

import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, useCallback } from "react";
import { reducer, initialState } from "./reducer.js";
import { readRaw, writeState, hydrate } from "./storage.js";
import { setSoundEnabled, playCue } from "../lib/audio.js";

const StoreCtx = createContext(null);

const CUE_BY_FX = {
  quest: "quest",
  workout: "xp",
  levelup: "levelup",
  rankup: "rankup",
  achievement: "achievement",
  dungeon: "achievement",
  boss: "achievement",
};

function bootState() {
  const raw = readRaw();
  const hydrated = raw ? hydrate(raw) : null;
  if (!hydrated) return initialState();
  // Keep the original creation date of a brand-new save.
  return { ...initialState(), ...hydrated, createdAt: hydrated.createdAt || new Date().toISOString() };
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, bootState);
  const [storageOk, setStorageOk] = useState(true);
  const seenFx = useRef(new Set());

  // Persist every state change.
  useEffect(() => {
    const res = writeState(state);
    setStorageOk(res.ok);
  }, [state]);

  // Day rollover: on mount and every minute while the app is open.
  useEffect(() => {
    dispatch({ type: "quests/roll" });
    const id = setInterval(() => dispatch({ type: "quests/roll" }), 60000);
    const onVisible = () => {
      if (document.visibilityState === "visible") dispatch({ type: "quests/roll" });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Sound follows settings.
  useEffect(() => {
    setSoundEnabled(state.settings.sound);
  }, [state.settings.sound]);

  // Play a cue the first time we see each fx entry (UI clears it afterwards).
  useEffect(() => {
    for (const fx of state.fx || []) {
      if (seenFx.current.has(fx.id)) continue;
      seenFx.current.add(fx.id);
      const cue = CUE_BY_FX[fx.type];
      if (cue && state.settings.sound) playCue(cue);
    }
    if ((state.fx || []).length === 0) seenFx.current.clear();
  }, [state.fx, state.settings.sound]);

  const dispatchCb = useCallback((action) => dispatch(action), []);

  const value = useMemo(() => ({ state, dispatch: dispatchCb, storageOk }), [state, dispatchCb, storageOk]);
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
