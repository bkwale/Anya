import { useState, useRef, useCallback } from "react";
import { type Prompt } from "../lib/data";
import {
  createRecorder,
  playBlob,
  primeAudio,
  isStreamActive,
  type Recording,
} from "../lib/audio";
import { speak } from "../lib/speech";
import { saveRecording, todayStr } from "../lib/db";
import {
  startListening,
  grade,
  isSpeechRecognitionSupported,
  type GradeResult,
} from "../lib/grading";

interface PromptCardProps {
  prompt: Prompt;
  moduleId: string;
  stream: MediaStream;
  onComplete: () => void;
  onMicDead: () => void; // called when we detect the mic stream has died
  index: number;
  total: number;
}

type Phase =
  | "ready"
  | "listening"
  | "recording"
  | "stopping"   // NEW: visible "stopping" state so UI never freezes
  | "recorded"
  | "playing";

export default function PromptCard({
  prompt,
  moduleId,
  stream,
  onComplete,
  onMicDead,
  index,
  total,
}: PromptCardProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [recording, setRecording] = useState<Recording | null>(null);
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const recorderRef = useRef<ReturnType<typeof createRecorder> | null>(null);
  const recognitionRef = useRef<ReturnType<typeof startListening> | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  /* ── Listen (TTS) ─────────────────────────────────── */

  const handleListen = useCallback(async () => {
    // Prime audio on the first user gesture (iOS requirement)
    primeAudio();
    setPhase("listening");
    try {
      const cleanText = prompt.text.replace(/\s*—\s*/g, " ... ");
      await speak(cleanText);
    } catch {
      // TTS not available — fail silently
    }
    setPhase("ready");
  }, [prompt.text]);

  /* ── Record ───────────────────────────────────────── */

  const handleRecord = useCallback(() => {
    // Prime audio on user gesture
    primeAudio();

    // Clean up any previous playback
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    // Check stream health before recording
    if (!isStreamActive(stream)) {
      onMicDead();
      return;
    }

    try {
      const rec = createRecorder(stream);
      recorderRef.current = rec;
      rec.start();
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "MIC_DEAD") {
        onMicDead();
        return;
      }
      // Other errors — stay on ready
      return;
    }

    // Start speech recognition alongside recording
    if (isSpeechRecognitionSupported()) {
      recognitionRef.current = startListening();
    }

    setPhase("recording");
    setRecording(null);
    setGradeResult(null);
  }, [stream, onMicDead]);

  /* ── Stop recording ───────────────────────────────── */

  const handleStopRecording = useCallback(async () => {
    if (!recorderRef.current) {
      // Shouldn't happen, but recover gracefully
      setPhase("ready");
      return;
    }

    // Immediately show "stopping" so the user sees feedback
    setPhase("stopping");

    // Stop speech recognition first
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    // Stop recorder — has 3s timeout built in
    const result = await recorderRef.current.stop();
    recorderRef.current = null;

    setRecording(result);

    // Get grade from speech recognition
    if (recognitionRef.current) {
      try {
        const transcript = await recognitionRef.current.getResult();
        recognitionRef.current = null;
        if (transcript) {
          setGradeResult(grade(transcript, prompt.text));
        }
      } catch {
        recognitionRef.current = null;
      }
    }

    setPhase("recorded");
  }, [prompt.text]);

  /* ── Playback ─────────────────────────────────────── */

  const handlePlayback = useCallback(() => {
    if (!recording) return;

    // Stop any current playback
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    setPhase("playing");

    const cleanup = playBlob(
      recording.blob,
      () => setPhase("recorded"), // onEnded
      () => setPhase("recorded"), // onError — recover to recorded state
    );
    cleanupRef.current = cleanup;
  }, [recording]);

  /* ── Try again ────────────────────────────────────── */

  const handleTryAgain = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    setRecording(null);
    setGradeResult(null);
    setPhase("ready");
  }, []);

  /* ── Complete (save + next) ───────────────────────── */

  const handleComplete = useCallback(async () => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    if (recording?.blob && recording.blob.size > 0) {
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

  /* ── Render ───────────────────────────────────────── */

  return (
    <div className="prompt-card">
      <div className="prompt-progress">
        {index + 1} of {total}
      </div>

      <div className="prompt-text" aria-live="polite">
        {prompt.text}
      </div>

      {prompt.hint && <div className="prompt-hint">{prompt.hint}</div>}

      {/* Grade result */}
      {gradeResult && (phase === "recorded" || phase === "playing") && (
        <div className="grade-result" aria-live="polite">
          <div className="grade-stars">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={`grade-star ${s <= gradeResult.stars ? "filled" : ""}`}
              >
                ★
              </span>
            ))}
          </div>
          <p className="grade-feedback">{gradeResult.feedback}</p>
          {gradeResult.transcript && (
            <p className="grade-transcript">
              I heard: <em>"{gradeResult.transcript}"</em>
            </p>
          )}
        </div>
      )}

      <div className="prompt-actions">
        {/* Listen button — hidden during recording/stopping */}
        {phase !== "recording" && phase !== "stopping" && (
          <button
            className={`btn btn-listen ${phase === "listening" ? "btn-active" : ""}`}
            onClick={handleListen}
            disabled={phase === "listening"}
            aria-label="Hear the phrase"
          >
            {phase === "listening" ? "🔊 Speaking..." : "🔊 Listen"}
          </button>
        )}

        {/* Record button */}
        {(phase === "ready" || phase === "listening") && (
          <button
            className="btn btn-record"
            onClick={handleRecord}
            aria-label="Record yourself"
          >
            🎙️ Record
          </button>
        )}

        {/* Stop button — visible during recording AND stopping */}
        {phase === "recording" && (
          <button
            className="btn btn-stop-record recording-pulse"
            onClick={handleStopRecording}
            aria-label="Stop recording"
          >
            ⏹ Stop
          </button>
        )}

        {/* Stopping indicator */}
        {phase === "stopping" && (
          <button className="btn btn-stop-record" disabled aria-label="Saving recording">
            ⏳ Saving...
          </button>
        )}

        {/* Playback + Try Again */}
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
            <button
              className="btn btn-tryagain"
              onClick={handleTryAgain}
              aria-label="Try again"
            >
              🔄 Try Again
            </button>
          </>
        )}
      </div>

      {/* Next / Finish */}
      {(phase === "recorded" || phase === "playing") && (
        <button
          className="btn btn-next"
          onClick={handleComplete}
          aria-label={index < total - 1 ? "Next phrase" : "Finish"}
        >
          {index < total - 1 ? "Next →" : "Finish ✓"}
        </button>
      )}

      {/* Skip */}
      {(phase === "ready" || phase === "listening") && (
        <button
          className="btn-skip"
          onClick={onComplete}
          aria-label="Skip this phrase"
        >
          Skip for now →
        </button>
      )}
    </div>
  );
}
