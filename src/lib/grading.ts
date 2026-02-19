/**
 * Speech recognition grading.
 * Uses the Web Speech API (SpeechRecognition) to transcribe what was said,
 * then compares it to the target phrase.
 *
 * Works on Android Chrome and most desktop browsers.
 * Falls back gracefully if not supported.
 */

export interface GradeResult {
  transcript: string; // what was recognised
  target: string; // what was expected
  score: number; // 0 to 1
  matchedWords: boolean[]; // which words matched
  stars: number; // 1 to 3 stars
  feedback: string; // encouraging message
}

// Check if SpeechRecognition is available
const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export function isSpeechRecognitionSupported(): boolean {
  return !!SpeechRecognition;
}

/**
 * Start listening and return the best transcript when stopped.
 * Returns a controller with stop() to end recognition.
 */
export function startListening(): {
  stop: () => void;
  getResult: () => Promise<string>;
} | null {
  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = "en-GB";
  recognition.maxAlternatives = 3;

  let transcript = "";
  let resolvePromise: ((value: string) => void) | null = null;

  const resultPromise = new Promise<string>((resolve) => {
    resolvePromise = resolve;
  });

  recognition.onresult = (event: any) => {
    // Collect all results
    const parts: string[] = [];
    for (let i = 0; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        parts.push(event.results[i][0].transcript);
      }
    }
    transcript = parts.join(" ").trim();
  };

  recognition.onerror = () => {
    // Silently fail — we'll just return empty transcript
  };

  recognition.onend = () => {
    if (resolvePromise) resolvePromise(transcript);
  };

  recognition.start();

  return {
    stop() {
      try {
        recognition.stop();
      } catch {
        // Already stopped
        if (resolvePromise) resolvePromise(transcript);
      }
    },
    getResult: () => resultPromise,
  };
}

/**
 * Normalise text for comparison: lowercase, strip punctuation, collapse spaces.
 */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[—–\-]/g, " ")
    .replace(/[^\w\s']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Grade a transcript against a target phrase.
 */
export function grade(transcript: string, target: string): GradeResult {
  const normTranscript = normalise(transcript);
  const normTarget = normalise(target);

  const targetWords = normTarget.split(" ").filter(Boolean);
  const spokenWords = normTranscript.split(" ").filter(Boolean);

  // Check which target words appear in the spoken words
  const matchedWords = targetWords.map((tw) => {
    return spokenWords.some((sw) => {
      // Exact match or close enough (first 3 chars match for short words)
      if (sw === tw) return true;
      if (tw.length >= 3 && sw.length >= 3 && sw.substring(0, 3) === tw.substring(0, 3)) return true;
      return false;
    });
  });

  const matchCount = matchedWords.filter(Boolean).length;
  const score = targetWords.length > 0 ? matchCount / targetWords.length : 0;

  // Convert to 1-3 stars
  let stars: number;
  if (score >= 0.8) stars = 3;
  else if (score >= 0.4) stars = 2;
  else stars = 1;

  // Pick encouraging feedback
  const feedback = getFeedback(stars, score);

  return {
    transcript,
    target,
    score,
    matchedWords,
    stars,
    feedback,
  };
}

function getFeedback(stars: number, score: number): string {
  if (stars === 3) {
    const options = [
      "Wonderful! That was clear!",
      "Brilliant — spot on!",
      "Excellent! You nailed it!",
      "Perfect! Your speech is strong!",
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  if (stars === 2) {
    const options = [
      "Good effort! Getting closer!",
      "Nearly there — great progress!",
      "Well done — try once more?",
      "Good! Each try makes it stronger.",
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  // 1 star — still encouraging
  if (score > 0) {
    const options = [
      "A good start! Keep practising.",
      "I heard you trying — that's what matters!",
      "You're building strength. Try again?",
    ];
    return options[Math.floor(Math.random() * options.length)];
  }
  return "Take your time. Every attempt counts!";
}
