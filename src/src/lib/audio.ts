/**
 * audio.ts — Bulletproof audio recording & playback for iOS Safari,
 * Chrome, and all modern browsers.
 *
 * Key design decisions:
 *  1. Recording: state-guarded stop() with 3s timeout fallback,
 *     requestData() flush on iOS before stop, stream health checks.
 *  2. Playback: data URIs instead of blob URLs (iOS Safari drops blob URLs),
 *     canplaythrough gate before play(), synchronous cleanup return
 *     with internal async pipeline guarded by a cancelled flag.
 *  3. Audio priming: silent WAV played on first user gesture to unlock
 *     iOS audio context. No play()/pause() race.
 */

export interface Recording {
  blob: Blob;
  duration: number;
}

// ─── Platform detection ────────────────────────────────────

export function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isSafari(): boolean {
  return (
    /^((?!chrome|android).)*safari/i.test(navigator.userAgent) || isIOS()
  );
}

// ─── Microphone ────────────────────────────────────────────

export async function requestMic(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

export function releaseMic(stream: MediaStream): void {
  stream.getTracks().forEach((t) => t.stop());
}

/** Check if a mic stream is still alive. */
export function isStreamActive(stream: MediaStream): boolean {
  const tracks = stream.getAudioTracks();
  return tracks.length > 0 && tracks[0].readyState === "live";
}

// ─── MIME type detection ───────────────────────────────────

function getSupportedMimeType(): string {
  const types = [
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const t of types) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch {
      /* isTypeSupported may throw on some browsers */
    }
  }
  return "";
}

// ─── Recording ─────────────────────────────────────────────

export function createRecorder(stream: MediaStream): {
  start: () => void;
  stop: () => Promise<Recording>;
  cancel: () => void;
  isRecording: () => boolean;
} {
  const chunks: Blob[] = [];
  const mimeType = getSupportedMimeType();
  const recorder = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);
  let startTime = 0;
  let stopped = false;

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  // Surface errors instead of swallowing them silently
  recorder.onerror = () => {
    stopped = true;
  };

  function buildBlob(): Blob {
    const type = recorder.mimeType || mimeType || "audio/mp4";
    return new Blob(chunks, { type });
  }

  return {
    start() {
      // Verify stream health before starting
      if (!isStreamActive(stream)) {
        throw new Error("MIC_DEAD");
      }

      chunks.length = 0;
      stopped = false;
      startTime = Date.now();

      // iOS Safari doesn't handle timeslice — use plain start()
      if (isIOS() || isSafari()) {
        recorder.start();
      } else {
        recorder.start(200);
      }
    },

    stop(): Promise<Recording> {
      // Guard: already stopped or never started
      if (stopped || recorder.state !== "recording") {
        stopped = true;
        const blob = buildBlob();
        const duration = startTime ? (Date.now() - startTime) / 1000 : 0;
        return Promise.resolve({ blob, duration });
      }

      stopped = true;

      return new Promise<Recording>((resolve) => {
        // Safety net: if onstop never fires (iOS edge case), resolve after 3s
        const timeout = setTimeout(() => {
          resolve({ blob: buildBlob(), duration: (Date.now() - startTime) / 1000 });
        }, 3000);

        recorder.onstop = () => {
          clearTimeout(timeout);
          resolve({ blob: buildBlob(), duration: (Date.now() - startTime) / 1000 });
        };

        try {
          // On iOS/Safari, flush any buffered data before stopping
          if (isIOS() || isSafari()) {
            try {
              recorder.requestData();
            } catch {
              /* requestData may not be supported everywhere */
            }
          }
          recorder.stop();
        } catch {
          // stop() can throw if state is already inactive
          clearTimeout(timeout);
          resolve({ blob: buildBlob(), duration: (Date.now() - startTime) / 1000 });
        }
      });
    },

    /** Hard cancel — discard everything, no waiting. */
    cancel() {
      stopped = true;
      try {
        if (recorder.state === "recording") recorder.stop();
      } catch {
        /* swallow */
      }
    },

    isRecording() {
      return !stopped && recorder.state === "recording";
    },
  };
}

// ─── Playback ──────────────────────────────────────────────

/**
 * Convert a Blob to a data URI.
 * Data URIs are more reliable than blob URLs on iOS Safari,
 * which can silently revoke blob URLs.
 */
function blobToDataURI(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

/** Single audio element, reused across the app lifetime. */
let sharedAudio: HTMLAudioElement | null = null;
let audioPrimed = false;

function getAudio(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = document.createElement("audio");
    sharedAudio.setAttribute("playsinline", "");
    sharedAudio.preload = "auto";
  }
  return sharedAudio;
}

/**
 * Prime the audio context — call this from a direct user tap/click handler
 * BEFORE you need to play anything. On iOS, the first play() must originate
 * from a user gesture or all subsequent plays silently fail.
 *
 * Uses a 44-byte silent WAV. No play/pause race.
 */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

export function primeAudio(): void {
  if (audioPrimed) return;
  const a = getAudio();
  a.src = SILENT_WAV;
  const p = a.play();
  if (p && typeof p.then === "function") {
    p.then(() => {
      audioPrimed = true;
    }).catch(() => {
      // Will be primed on next user gesture
    });
  }
}

/**
 * Play a Blob reliably on all platforms.
 *
 * Returns a cleanup/stop function synchronously so the caller can store it
 * immediately. The actual async work (data URI conversion → load → play)
 * happens internally, guarded by a `cancelled` flag so stale callbacks
 * never fire.
 */
export function playBlob(
  blob: Blob,
  onEnded: () => void,
  onError: () => void,
): () => void {
  const audio = getAudio();
  let cancelled = false;

  // Immediately halt any in-flight playback
  audio.pause();
  audio.removeAttribute("src");
  audio.onended = null;
  audio.onerror = null;

  // Async pipeline — runs inside, returns synchronous cleanup handle above
  (async () => {
    if (cancelled) return;

    try {
      // Convert blob → data URI (avoids iOS blob URL issues)
      const dataUri = await blobToDataURI(blob);
      if (cancelled) return;

      audio.src = dataUri;

      audio.onended = () => {
        if (!cancelled) onEnded();
      };
      audio.onerror = () => {
        if (!cancelled) onError();
      };

      // Wait for enough data to play — with a 3s safety timeout
      await new Promise<void>((resolve, reject) => {
        if (audio.readyState >= 3) {
          resolve();
          return;
        }

        let settled = false;
        const settle = (fn: () => void) => {
          if (settled) return;
          settled = true;
          audio.removeEventListener("canplaythrough", onReady);
          audio.removeEventListener("error", onErr);
          clearTimeout(t);
          fn();
        };

        const onReady = () => settle(resolve);
        const onErr = () => settle(reject);
        const t = setTimeout(() => settle(resolve), 3000); // force play after 3s

        audio.addEventListener("canplaythrough", onReady);
        audio.addEventListener("error", onErr);
        audio.load();
      });

      if (cancelled) return;

      await audio.play();
    } catch {
      if (!cancelled) onError();
    }
  })();

  // Synchronous cleanup — caller stores this immediately
  return () => {
    cancelled = true;
    audio.pause();
    audio.onended = null;
    audio.onerror = null;
  };
}
