/**
 * Speak a phrase using the Web Speech API.
 * Works offline on Android Chrome (uses on-device TTS).
 * Returns a promise that resolves when speech finishes.
 */
export function speak(text: string, rate = 0.85): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!("speechSynthesis" in window)) {
      reject(new Error("Speech synthesis not supported"));
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = rate; // slightly slower for clarity
    utterance.pitch = 1;
    utterance.lang = "en-GB";

    // Try to pick a clear English voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("female")
    ) ?? voices.find((v) => v.lang.startsWith("en-GB"))
      ?? voices.find((v) => v.lang.startsWith("en"));

    if (preferred) utterance.voice = preferred;

    utterance.onend = () => resolve();
    utterance.onerror = (e) => {
      // "interrupted" is not a real error — just means we cancelled
      if (e.error === "interrupted") resolve();
      else reject(e);
    };

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Preload voices (some browsers load them async).
 */
export function preloadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    window.speechSynthesis.onvoiceschanged = () => {
      resolve(window.speechSynthesis.getVoices());
    };
  });
}
