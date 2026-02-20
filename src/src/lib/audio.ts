export interface Recording {
  blob: Blob;
  url: string;
  duration: number;
}

/**
 * Detect if we're on iOS (iPhone/iPad).
 */
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * Request microphone access. Call once at session start.
 */
export async function requestMic(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

/**
 * Release all tracks on a stream to free the mic.
 */
export function releaseMic(stream: MediaStream): void {
  stream.getTracks().forEach((t) => t.stop());
}

/**
 * Detect a supported MIME type for MediaRecorder.
 * Safari doesn't support webm; it uses audio/mp4.
 */
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
      // isTypeSupported may throw on some browsers
    }
  }
  return "";
}

/**
 * Create a fresh recorder for a single recording.
 * Each call returns a new recorder (MediaRecorder can't be restarted after stop).
 */
export function createRecorder(stream: MediaStream): {
  start: () => void;
  stop: () => Promise<Recording>;
  isRecording: () => boolean;
} {
  const chunks: Blob[] = [];
  const mimeType = getSupportedMimeType();
  const recorder = mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);
  let startTime = 0;

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return {
    start() {
      chunks.length = 0;
      startTime = Date.now();
      // iOS Safari doesn't handle timeslice well — use plain start()
      // On other browsers, timeslice ensures data is captured in chunks
      if (isIOS()) {
        recorder.start();
      } else {
        recorder.start(200);
      }
    },

    stop(): Promise<Recording> {
      return new Promise((resolve) => {
        recorder.onstop = () => {
          const actualType = recorder.mimeType || mimeType || "audio/mp4";
          const blob = new Blob(chunks, { type: actualType });
          const url = URL.createObjectURL(blob);
          const duration = (Date.now() - startTime) / 1000;
          resolve({ blob, url, duration });
        };
        recorder.stop();
      });
    },

    isRecording() {
      return recorder.state === "recording";
    },
  };
}

/**
 * Shared audio element for playback — iOS Safari requires a single
 * <audio> element that was first activated by a user gesture.
 * We create it once and reuse it for all playback.
 */
let sharedAudio: HTMLAudioElement | null = null;

/**
 * Get (or create) the shared audio element.
 * MUST be called from a direct user tap handler on iOS.
 */
export function getSharedAudio(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = new Audio();
    // Unlock iOS audio context on first creation
    sharedAudio.play().catch(() => {});
    sharedAudio.pause();
  }
  return sharedAudio;
}

/**
 * Play a blob reliably across all platforms including iOS Safari.
 * Returns a cleanup function.
 */
export function playBlob(
  blob: Blob,
  onEnded: () => void,
  onError: () => void
): () => void {
  const audio = getSharedAudio();
  const url = URL.createObjectURL(blob);

  // Clean up any previous playback
  audio.pause();
  audio.currentTime = 0;

  // Remove old listeners
  audio.onended = null;
  audio.onerror = null;

  audio.src = url;
  audio.onended = () => {
    URL.revokeObjectURL(url);
    onEnded();
  };
  audio.onerror = () => {
    URL.revokeObjectURL(url);
    onError();
  };

  // Load then play — needed on iOS
  audio.load();
  audio.play().catch(() => {
    URL.revokeObjectURL(url);
    onError();
  });

  // Return cleanup function
  return () => {
    audio.pause();
    audio.currentTime = 0;
    audio.onended = null;
    audio.onerror = null;
    URL.revokeObjectURL(url);
  };
}
