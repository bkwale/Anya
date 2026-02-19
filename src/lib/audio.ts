export interface Recording {
  blob: Blob;
  url: string;
  duration: number;
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
 * Safari doesn't support webm; Android Chrome does.
 */
function getSupportedMimeType(): string {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "",
  ];
  for (const t of types) {
    if (t === "" || MediaRecorder.isTypeSupported(t)) return t;
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
      // Use timeslice to ensure data is pushed in chunks during recording
      recorder.start(200);
    },

    stop(): Promise<Recording> {
      return new Promise((resolve) => {
        recorder.onstop = () => {
          // Use the actual mimeType from the recorder
          const actualType = recorder.mimeType || mimeType || "audio/webm";
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
