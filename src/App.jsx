import React, { useEffect, useState } from "react";
import { StoreProvider, useStore } from "./state/store.jsx";
import Nav from "./components/Nav.jsx";
import Onboarding from "./components/Onboarding.jsx";
import { FxLayer } from "./components/Overlays.jsx";
import Home from "./screens/Home.jsx";
import Train from "./screens/Train.jsx";
import Dungeons from "./screens/Dungeons.jsx";
import Progress from "./screens/Progress.jsx";
import Profile from "./screens/Profile.jsx";
import ActiveWorkout from "./screens/ActiveWorkout.jsx";
import { resolveTheme } from "./state/themes.js";
import { AlertTriangle, RotateCw } from "lucide-react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // Surfaced through the fallback UI; no telemetry in this local-only demo.
    console.error("SHADOW SYSTEM error:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen grid place-items-center px-6 text-center">
          <div className="glass hud p-6 max-w-md">
            <AlertTriangle size={30} className="mx-auto text-[#fbbf24] mb-3" />
            <h1 className="font-display text-xl text-white tracking-[0.1em]">SYSTEM INTERRUPTED</h1>
            <p className="text-sm text-[#a5a1c4] mt-2 leading-relaxed">
              The interface hit an unexpected error. Your saved progress is stored separately and should be safe —
              reload to continue.
            </p>
            <button type="button" className="btn btn-primary mt-5" onClick={() => window.location.reload()}>
              <RotateCw size={16} /> RELOAD SYSTEM
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Shell() {
  const { state, storageOk } = useStore();
  const [tab, setTab] = useState("home");
  const [workoutVisible, setWorkoutVisible] = useState(false);
  const sessionId = state.activeWorkout?.session?.id || null;

  // A started session opens the engine; closing/abandoning returns to the tab.
  useEffect(() => {
    setWorkoutVisible(Boolean(sessionId));
  }, [sessionId]);

  // Body-level accessibility attributes + unlockable accent theme.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-motion", state.settings.motion === "off" ? "off" : "on");
    root.setAttribute("data-text-scale", state.settings.textScale || "normal");
    root.setAttribute("data-theme", resolveTheme(state.settings.theme, state));
  }, [state.settings.motion, state.settings.textScale, state.settings.theme, state]);

  if (!state.profile.onboardingComplete) {
    return (
      <div className="min-h-screen">
        <Onboarding />
        <FxLayer />
      </div>
    );
  }

  const navigate = (target) => {
    if (target === "resume-workout") {
      setWorkoutVisible(true);
      return;
    }
    setTab(target);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const screen =
    tab === "train" ? <Train onNavigate={navigate} /> :
    tab === "dungeons" ? <Dungeons onNavigate={navigate} /> :
    tab === "progress" ? <Progress onNavigate={navigate} /> :
    tab === "profile" ? <Profile onNavigate={navigate} /> :
    <Home onNavigate={navigate} />;

  return (
    <div className="min-h-screen">
      {!storageOk && (
        <div className="bg-[rgba(248,113,113,.12)] border-b border-[rgba(248,113,113,.4)] px-4 py-2 text-center text-xs text-[#fca5a5]">
          Storage unavailable — progress will not be saved on this device.
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 pt-5 safe-bottom">
        <div key={tab} className="rise">
          {screen}
        </div>
      </main>

      <Nav tab={tab} onTab={navigate} />
      <FxLayer />

      {workoutVisible && state.activeWorkout && (
        <ActiveWorkout onMinimize={() => setWorkoutVisible(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <ErrorBoundary>
        <Shell />
      </ErrorBoundary>
    </StoreProvider>
  );
}
