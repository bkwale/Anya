import { useState, useRef, useCallback, useEffect } from "react";
import { type Prompt } from "../lib/data";
import { createRecorder, type Recording } from "../lib/audio";
import { speak } from "../lib/speech";
import { saveRecording, todayStr } from "../lib/db";

interface PromptCardProps {
  prompt: Prompt;
  moduleId: string;
  stream: MediaStream;
  onComplete: () => void;
  index: number;
  total: number;
}

type Phase = "ready" | "listening" | "recording" | "recorded" | "playing";

export default function PromptCard({ prompt, moduleId, stream, onComplete, index, total }: PromptCardProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [recording, setRecording] = useState<Recording | null>(null);
  const recorderRef = useRef<ReturnType<typeof createRecorder> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Clean up audio URL on unmount
  useEffect(() => {
    return () => {
      if (recording?.url) URL.revokeObjectURL(recording.url);
    };
  }, [recording]);

  const handleListen = useCallback(async () => {
    setPhase("listening");
    try {
      const cleanText = prompt.text.replace(/\s*—\s*/g, " ... ");
      await speak(cleanText);
    } catch {
      // TTS not available — that's okay
    }
    setPhase("ready");
  }, [prompt.text]);

  const handleRecord = useCallback(() => {
    const rec = createRecorder(stream);
    recorderRef.current = rec;
    rec.start();
    setPhase("recording");
    setRecording(null);
  }, [stream]);

  const handleStopRecording = useCallback(async () => {
    if (!recorderRef.current) return;
    const result = await recorderRef.current.stop();
    setRecording(result);
    setPhase("recorded");
    recorderRef.current = null;
  }, []);

  const handlePlayback = useCallback(() => {
    if (!recording?.url) return;
    const audio = new Audio(recording.url);
    audioRef.current = audio;
    setPhase("playing");
    audio.onended = () => setPhase("recorded");
    audio.play();
  }, [recording]);

  const handleTryAgain = useCallback(() => {
    if (recording?.url) URL.revokeObjectURL(recording.url);
    setRecording(null);
    setPhase("ready");
  }, [recording]);

  // Save recording to IndexedDB and move on
  const handleComplete = useCallback(async () => {
    if (recording?.blob) {
      const now = new Date();
      await saveRecording({
        id: `${todayStr()}-${moduleId}-${prompt.id}-${now.getTime()}`,
        date: todayStr(),
        moduleId,
        promptId: prompt.id,
        promptText: prompt.text,
        blob: recording.blob,
        durationSeconds: recording.duration,
        createdAt: now.toISOString(),
      });
    }
    onComplete();
  }, [recording, moduleId, prompt, onComplete]);

  return (
    <div className="prompt-card">
      <div className="prompt-progress">
        {index + 1} of {total}
      </div>

      <div className="prompt-text" aria-live="polite">
        {prompt.text}
      </div>

      {prompt.hint && (
        <div className="prompt-hint">{prompt.hint}</div>
      )}

      <div className="prompt-actions">
        {phase !== "recording" && (
          <button
            className={`btn btn-listen ${phase === "listening" ? "btn-active" : ""}`}
            onClick={handleListen}
            disabled={phase === "listening"}
            aria-label="Hear the phrase"
          >
            {phase === "listening" ? "🔊 Speaking..." : "🔊 Listen"}
          </button>
        )}

        {(phase === "ready" || phase === "listening") && (
          <button className="btn btn-record" onClick={handleRecord} aria-label="Record yourself">
            🎙️ Record
          </button>
        )}

        {phase === "recording" && (
          <button
            className="btn btn-stop-record recording-pulse"
            onClick={handleStopRecording}
            aria-label="Stop recording"
          >
            ⏹ Stop
          </button>
        )}

        {(phase === "recorded" || phase === "playing") && (
          <>
            <button
              className={`btn btn-playback ${phase === "playing" ? "btn-active" : ""}`}
              onClick={handlePlayback}
              disabled={phase === "playing"}
              aria-label="Play back your recording"
            >
              {phase === "playing" ? "▶ Playing..." : "▶ Play Back"}
            </button>
            <button className="btn btn-tryagain" onClick={handleTryAgain} aria-label="Try again">
              🔄 Try Again
            </button>
          </>
        )}
      </div>

      {(phase === "recorded" || phase === "playing") && (
        <button className="btn btn-next" onClick={handleComplete} aria-label={index < total - 1 ? "Next phrase" : "Finish"}>
          {index < total - 1 ? "Next →" : "Finish ✓"}
        </button>
      )}

      {phase !== "recording" && (phase === "ready" || phase === "listening") && (
        <button className="btn-skip" onClick={onComplete} aria-label="Skip this phrase">
          Skip for now →
        </button>
      )}
    </div>
  );
}
