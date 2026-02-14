import { useEffect, useState } from "react";
import { allModules, type Module } from "../lib/data";
import { getStats, getSessionsByDate, todayStr, type SessionRecord } from "../lib/db";

interface HomeProps {
  onStartModule: (module: Module) => void;
}

export default function Home({ onStartModule }: HomeProps) {
  const [stats, setStats] = useState({ totalSessions: 0, totalPrompts: 0, streakDays: 0 });
  const [todaySessions, setTodaySessions] = useState<SessionRecord[]>([]);

  useEffect(() => {
    getStats().then(setStats);
    getSessionsByDate(todayStr()).then(setTodaySessions);
  }, []);

  const todayPrompts = todaySessions.reduce((s, r) => s + r.promptsCompleted, 0);

  return (
    <div className="home">
      <header className="home-header">
        <h1 className="app-name">Anya</h1>
        <p className="app-tagline">Your speech practice companion</p>
      </header>

      {stats.totalSessions > 0 && (
        <div className="stats-bar">
          <div className="stat">
            <span className="stat-value">{stats.streakDays}</span>
            <span className="stat-label">{stats.streakDays === 1 ? "day" : "days"} streak</span>
          </div>
          <div className="stat">
            <span className="stat-value">{todayPrompts}</span>
            <span className="stat-label">practised today</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.totalSessions}</span>
            <span className="stat-label">total sessions</span>
          </div>
        </div>
      )}

      <div className="module-list">
        {allModules.map((mod) => {
          const done = todaySessions.find((s) => s.moduleId === mod.id);
          return (
            <button
              key={mod.id}
              className={`module-card ${done ? "module-done" : ""}`}
              onClick={() => onStartModule(mod)}
              aria-label={`Start ${mod.title} practice`}
            >
              <span className="module-icon">{mod.icon}</span>
              <div className="module-info">
                <span className="module-title">{mod.title}</span>
                <span className="module-desc">{mod.description}</span>
              </div>
              {done && <span className="module-check" aria-label="Completed today">✓</span>}
            </button>
          );
        })}
      </div>

      <footer className="home-footer">
        <p>Take it one word at a time.</p>
      </footer>
    </div>
  );
}
