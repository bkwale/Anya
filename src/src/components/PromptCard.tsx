import { useState, useRef, useCallback } from "react";
import { type Prompt } from "../lib/data";
import { createRecorder, playBlob, type Recording } from "../lib/audio";
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
  index: number;
  total: number;
}

type Phase = "ready" | "listening" | "recording" | "recorded" | "playing";

export default function PromptCard({ prompt, moduleId, stream, onComplete, index, total }: PromptCardProps) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [recording, setRecording] = useState<Recording | null>(null);
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const recorderRef = useRef<ReturnType<typeof createRecorder> | null>(null);
  const recognitionRef = useRef<ReturnType<typeof startListening> | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const handleListen = useCallback(async () => {
    setPhase("listening");
    try {
      const cleanText = prompt.text.replace(/\s*—\s*/g, " ... ");
      await speak(cleanText);
    } catch {
      // TTS not available
    }
    setPhase("ready");
  }, [prompt.text]);

  const handleRecord = useCallback(() => {
    // Clean up previous playback
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    const rec = createRecorder(stream);
    recorderRef.current = rec;
    rec.start();

    // Start speech recognition alongside recording
    if (isSpeechRecognitionSupported()) {
      recognitionRef.current = startListening();
    }

    setPhase("recording");
    setRecording(null);
    setGradeResult(null);
  }, [stream]);

  const handleStopRecording = useCallback(async () => {
    if (!recorderRef.current) return;

    // Stop recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const result = await recorderRef.current.stop();
    setRecording(result);
    recorderRef.current = null;

    // Get grade
    if (recognitionRef.current) {
      const transcript = await recognitionRef.current.getResult();
      recognitionRef.current = null;
      if (transcript) {
        const gradeResult = grade(transcript, prompt.text);
        setGradeResult(gradeResult);
      }
    }

    setPhase("recorded");
  }, [prompt.text]);

  const handlePlayback = useCallback(() => {
    if (!recording) return;

    // Stop any current playback
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    setPhase("playing");

    // Use the shared playBlob for iOS compatibility
    const cleanup = playBlob(
      recording.blob,
      () => setPhase("recorded"),  // onEnded
      () => setPhase("recorded"),  // onError
    );
    cleanupRef.current = cleanup;
  }, [recording]);

  const handleTryAgain = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    setRecording(null);
    setGradeResult(null);
    setPhase("ready");
  }, []);

  const handleComplete = useCallback(async () => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
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

      {/* Grade result — shown after recording */}
      {gradeResult && (phase === "recorded" || phase === "playing") && (
        <div className="grade-result" aria-live="polite">
          <div className="grade-stars">
            {[1, 2, 3].map((s) => (
              <span key={s} className={`grade-star ${s <= gradeResult.stars ? "filled" : ""}`}>
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
