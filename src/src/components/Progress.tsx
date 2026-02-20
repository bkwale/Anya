import { useEffect, useState, useRef, useCallback } from "react";
import {
  getRecordingDates,
  getRecordingsByDate,
  type RecordingRecord,
} from "../lib/db";
import { playBlob } from "../lib/audio";

interface ProgressProps {
  onBack: () => void;
}

function formatDate(dateStr: string): string {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";

  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function Progress({ onBack }: ProgressProps) {
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<RecordingRecord[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Load dates on mount
  useEffect(() => {
    getRecordingDates().then((d) => {
      setDates(d);
      if (d.length > 0) {
        setSelectedDate(d[0]); // default to most recent
      }
    });
  }, []);

  // Load recordings when date changes
  useEffect(() => {
    if (!selectedDate) return;
    getRecordingsByDate(selectedDate).then(setRecordings);
  }, [selectedDate]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  const handlePlay = useCallback((rec: RecordingRecord) => {
    // Stop any currently playing audio
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (playingId === rec.id) {
      setPlayingId(null);
      return;
    }

    setPlayingId(rec.id);

    const cleanup = playBlob(
      rec.blob,
      () => { setPlayingId(null); cleanupRef.current = null; },
      () => { setPlayingId(null); cleanupRef.current = null; },
    );
    cleanupRef.current = cleanup;
  }, [playingId]);

  // Empty state
  if (dates.length === 0) {
    return (
      <div className="progress-screen">
        <header className="progress-header">
          <button className="btn-back" onClick={onBack}>← Back</button>
          <h2 className="progress-title">My Recordings</h2>
        </header>
        <div className="progress-empty">
          <p className="progress-empty-icon">🎙️</p>
          <p className="progress-empty-text">No recordings yet.</p>
          <p className="progress-empty-sub">
            Complete a practice session and your recordings will appear here so you can listen back and hear your progress.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="progress-screen">
      <header className="progress-header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <h2 className="progress-title">My Recordings</h2>
      </header>

      {/* Date tabs */}
      <div className="date-tabs">
        {dates.map((d) => (
          <button
            key={d}
            className={`date-tab ${d === selectedDate ? "date-tab-active" : ""}`}
            onClick={() => setSelectedDate(d)}
          >
            {formatDate(d)}
          </button>
        ))}
      </div>

      {/* Recording list */}
      <div className="recording-list">
        {recordings.map((rec) => (
          <button
            key={rec.id}
            className={`recording-card ${playingId === rec.id ? "recording-playing" : ""}`}
            onClick={() => handlePlay(rec)}
            aria-label={`Play recording of ${rec.promptText}`}
          >
            <div className="recording-play-icon">
              {playingId === rec.id ? "⏸" : "▶"}
            </div>
            <div className="recording-info">
              <span className="recording-phrase">{rec.promptText}</span>
              <span className="recording-meta">
                {formatTime(rec.createdAt)} · {Math.round(rec.durationSeconds)}s
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
