import React from "react";
import { Home, Dumbbell, Swords, BarChart3, User } from "lucide-react";

const TABS = [
  { id: "home", label: "HOME", icon: Home },
  { id: "train", label: "TRAIN", icon: Dumbbell },
  { id: "dungeons", label: "DUNGEONS", icon: Swords },
  { id: "progress", label: "PROGRESS", icon: BarChart3 },
  { id: "profile", label: "PROFILE", icon: User },
];

export default function Nav({ tab, onTab }) {
  const index = Math.max(0, TABS.findIndex((t) => t.id === tab));

  return (
    <nav className="nav-shell" aria-label="Primary">
      <div className="relative flex max-w-2xl mx-auto">
        <span
          className="nav-indicator"
          style={{ width: `${100 / TABS.length}%`, transform: `translateX(${index * 100}%)` }}
          aria-hidden="true"
        />
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              className="nav-item"
              aria-current={active ? "page" : undefined}
              onClick={() => onTab(t.id)}
            >
              <t.icon size={19} className="nav-icon" strokeWidth={active ? 2.3 : 1.8} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
