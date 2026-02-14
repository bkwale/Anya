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
 * Create a fresh recorder for a single recording.
 * Each call returns a new recorder (MediaRecorder can't be restarted after stop).
 */
export function createRecorder(stream: MediaStream): {
  start: () => void;
  stop: () => Promise<Recording>;
  isRecording: () => boolean;
} {
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream);
  let startTime = 0;

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return {
    start() {
      chunks.length = 0; // clear any prior data
      startTime = Date.now();
      recorder.start();
    },

    stop(): Promise<Recording> {
      return new Promise((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: "audio/webm" });
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
