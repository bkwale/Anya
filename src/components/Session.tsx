import { useState, useEffect, useRef, useCallback } from "react";
import { type Module, getRandomEncouragement } from "../lib/data";
import { requestMic, releaseMic } from "../lib/audio";
import { saveSession, todayStr } from "../lib/db";
import { preloadVoices } from "../lib/speech";
import PromptCard from "./PromptCard";

interface SessionProps {
  module: Module;
  onFinish: () => void;
}

type SessionPhase = "mic-request" | "active" | "encouragement" | "summary";

export default function Session({ module, onFinish }: SessionProps) {
  const [phase, setPhase] = useState<SessionPhase>("mic-request");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [encouragement, setEncouragement] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [micError, setMicError] = useState(false);
  const startTimeRef = useRef(Date.now());

  // Request mic on mount
  useEffect(() => {
    let cancelled = false;
    preloadVoices();

    requestMic()
      .then((s) => {
        if (!cancelled) {
          setStream(s);
          setPhase("active");
          startTimeRef.current = Date.now();
        }
      })
      .catch(() => {
        if (!cancelled) setMicError(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Release mic on unmount
  useEffect(() => {
    return () => {
      if (stream) releaseMic(stream);
    };
  }, [stream]);

  const handlePromptComplete = useCallback(() => {
    const nextIndex = currentIndex + 1;
    const newCompleted = completedCount + 1;
    setCompletedCount(newCompleted);

    if (nextIndex >= module.prompts.length) {
      // Session complete — save and show summary
      const duration = (Date.now() - startTimeRef.current) / 1000;
      saveSession({
        id: `${todayStr()}-${module.id}-${Date.now()}`,
        date: todayStr(),
        moduleId: module.id,
        moduleTitle: module.title,
        promptsCompleted: newCompleted,
        promptsTotal: module.prompts.length,
        durationSeconds: Math.round(duration),
        completedAt: new Date().toISOString(),
      });
      if (stream) releaseMic(stream);
      setPhase("summary");
    } else {
      // Show encouragement every 3 prompts
      if (newCompleted > 0 && newCompleted % 3 === 0) {
        setEncouragement(getRandomEncouragement());
        setPhase("encouragement");
        setTimeout(() => {
          setCurrentIndex(nextIndex);
          setPhase("active");
        }, 2200);
      } else {
        setCurrentIndex(nextIndex);
      }
    }
  }, [currentIndex, completedCount, module, stream]);

  const handleQuit = useCallback(() => {
    if (stream) releaseMic(stream);
    // Save partial session if any prompts were done
    if (completedCount > 0) {
      const duration = (Date.now() - startTimeRef.current) / 1000;
      saveSession({
        id: `${todayStr()}-${module.id}-${Date.now()}`,
        date: todayStr(),
        moduleId: module.id,
        moduleTitle: module.title,
        promptsCompleted: completedCount,
        promptsTotal: module.prompts.length,
        durationSeconds: Math.round(duration),
        completedAt: new Date().toISOString(),
      });
    }
    onFinish();
  }, [stream, completedCount, module, onFinish]);

  // --- Mic request phase ---
  if (phase === "mic-request") {
    return (
      <div className="session-screen">
        <div className="session-center">
          {micError ? (
            <>
              <p className="session-message">Anya needs microphone access to record your practice.</p>
              <p className="session-submessage">
                Please allow microphone access in your browser settings, then try again.
              </p>
              <button className="btn btn-primary" onClick={onFinish}>
                Go Back
              </button>
            </>
          ) : (
            <>
              <div className="loading-spinner" />
              <p className="session-message">Getting your microphone ready...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // --- Encouragement interlude ---
  if (phase === "encouragement") {
    return (
      <div className="session-screen">
        <div className="session-center encouragement-screen">
          <p className="encouragement-text">{encouragement}</p>
        </div>
      </div>
    );
  }

  // --- Summary ---
  if (phase === "summary") {
    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;

    return (
      <div className="session-screen">
        <div className="session-center summary-screen">
          <div className="summary-icon">🎉</div>
          <h2 className="summary-title">Session Complete</h2>
          <p className="summary-detail">
            You practised <strong>{completedCount}</strong> {completedCount === 1 ? "phrase" : "phrases"} in{" "}
            {mins > 0 ? `${mins}m ` : ""}
            {secs}s
          </p>
          <p className="summary-encouragement">{getRandomEncouragement()}</p>
          <button className="btn btn-primary" onClick={onFinish}>
            Done
          </button>
        </div>
      </div>
    );
  }

  // --- Active practice ---
  return (
    <div className="session-screen">
      <header className="session-header">
        <button className="btn-back" onClick={handleQuit} aria-label="End session early">
          ← Back
        </button>
        <span className="session-title">{module.icon} {module.title}</span>
        <div className="session-progress-bar">
          <div
            className="session-progress-fill"
            style={{ width: `${((currentIndex) / module.prompts.length) * 100}%` }}
          />
        </div>
      </header>

      {stream && (
        <PromptCard
          key={module.prompts[currentIndex].id}
          prompt={module.prompts[currentIndex]}
          moduleId={module.id}
          stream={stream}
          onComplete={handlePromptComplete}
          index={currentIndex}
          total={module.prompts.length}
        />
      )}
    </div>
  );
}
