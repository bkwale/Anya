#!/usr/bin/env node
/**
 * generate-voice.mjs
 *
 * Clones Wale's voice on ElevenLabs and generates MP3 audio
 * for every phrase in the Anya app.
 *
 * Usage:
 *   cd ~/WORK\ RELATED/anya
 *   node scripts/generate-voice.mjs <ELEVENLABS_API_KEY> [voice_sample_path]
 *
 * If voice_sample_path is omitted, it looks for voice_sample.m4a in the scripts/ folder.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "public", "audio");

// ─── All phrases from the app ──────────────────────────────

const PHRASES = [
  // Warm-Up
  { id: "wu-1", text: "Pa. Pa. Pa." },
  { id: "wu-2", text: "Ta. Ta. Ta." },
  { id: "wu-3", text: "Ka. Ka. Ka." },
  { id: "wu-4", text: "Ma. Ma. Ma." },
  { id: "wu-5", text: "Ba. Ba. Ba." },

  // Greetings
  { id: "gr-1", text: "Hi." },
  { id: "gr-2", text: "Hello." },
  { id: "gr-3", text: "Good morning." },
  { id: "gr-4", text: "Good afternoon." },
  { id: "gr-5", text: "Good night." },
  { id: "gr-6", text: "How are you?" },
  { id: "gr-7", text: "I'm fine." },
  { id: "gr-8", text: "Thank you." },
  { id: "gr-9", text: "Please." },
  { id: "gr-10", text: "Sorry." },
  { id: "gr-11", text: "Excuse me." },
  { id: "gr-12", text: "Goodbye." },
  { id: "gr-13", text: "See you later." },
  { id: "gr-14", text: "I love you." },
  { id: "gr-15", text: "God bless you." },

  // Everyday Phrases
  { id: "ph-1", text: "I'm hungry." },
  { id: "ph-2", text: "I'm thirsty." },
  { id: "ph-3", text: "I need water." },
  { id: "ph-4", text: "I need the toilet." },
  { id: "ph-5", text: "Please help me." },
  { id: "ph-6", text: "I'm tired." },
  { id: "ph-7", text: "I'm in pain." },
  { id: "ph-8", text: "Call my son." },
  { id: "ph-9", text: "Call my daughter." },
  { id: "ph-10", text: "Yes." },
  { id: "ph-11", text: "No." },
  { id: "ph-12", text: "Wait." },

  // Pidgin English
  { id: "pi-1", text: "How you dey?" },
  { id: "pi-2", text: "I dey fine." },
  { id: "pi-3", text: "Abeg, help me." },
  { id: "pi-4", text: "I wan chop." },
  { id: "pi-5", text: "I wan drink water." },
  { id: "pi-6", text: "No wahala." },
  { id: "pi-7", text: "E go better." },
  { id: "pi-8", text: "God dey." },
  { id: "pi-9", text: "Wetin happen?" },
  { id: "pi-10", text: "I dey come." },
  { id: "pi-11", text: "Oya, make we go." },
  { id: "pi-12", text: "Thank God." },
  { id: "pi-13", text: "I no well." },
  { id: "pi-14", text: "Na so." },
  { id: "pi-15", text: "Well done." },
];

// ─── ElevenLabs API helpers ────────────────────────────────

const BASE = "https://api.elevenlabs.io/v1";

async function apiRequest(endpoint, options = {}) {
  const url = `${BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "xi-api-key": API_KEY,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res;
}

async function cloneVoice(samplePath) {
  console.log("📎 Uploading voice sample for cloning...");

  const formData = new FormData();
  formData.append("name", "Wale - Anya Voice");
  formData.append(
    "description",
    "Deep baritone voice in the register of James Earl Jones and Ving Rhames. " +
    "Nigerian-inflected English with natural authority and gravitas. " +
    "Fundamental frequency around 83Hz — a true Voice of God quality. " +
    "Unhurried, warm, and commanding. Rich low-mid resonance with a dark, " +
    "velvety timbre. Speaks with calm deliberation and paternal reassurance. " +
    "Each word carries weight — never rushed, never thin."
  );

  const audioBytes = fs.readFileSync(samplePath);
  const blob = new Blob([audioBytes], { type: "audio/mp4" });
  formData.append("files", blob, "voice_sample.m4a");

  const res = await apiRequest("/voices/add", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  console.log(`✅ Voice cloned! ID: ${data.voice_id}`);
  return data.voice_id;
}

/**
 * Prepare text with delivery cues for ElevenLabs.
 * The model interprets SSML-like pauses and phrasing to shape delivery.
 */
function prepareText(text, phraseId) {
  // Warm-up syllables: slow, deliberate, with clear pauses
  if (phraseId.startsWith("wu-")) {
    // Add longer pauses between syllables for warm-up exercises
    return text
      .replace(/\.\s*/g, "... ")
      .trim();
  }

  // Short phrases (1-2 words): let them breathe
  const wordCount = text.split(/\s+/).length;
  if (wordCount <= 2) {
    return text;
  }

  return text;
}

async function generateAudio(voiceId, text, outputPath, phraseId) {
  const preparedText = prepareText(text, phraseId);

  const res = await apiRequest(`/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: preparedText,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.55,        // Lower for that natural James Earl Jones gravitas
        similarity_boost: 0.90, // Very high — stay true to Wale's voice
        style: 0.45,            // More expressiveness — warm, paternal, commanding
        use_speaker_boost: true,
      },
    }),
  });

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
}

// ─── Main ──────────────────────────────────────────────────

const API_KEY = process.argv[2];
if (!API_KEY) {
  console.error("Usage: node scripts/generate-voice.mjs <API_KEY> [voice_sample.m4a]");
  process.exit(1);
}

// Find voice sample
let samplePath = process.argv[3];
if (!samplePath) {
  // Look in common locations
  const candidates = [
    path.join(__dirname, "voice_sample.m4a"),
    path.join(__dirname, "..", "New Recording 12.m4a"),
    path.join(process.env.HOME, "Downloads", "New Recording 12.m4a"),
  ];
  samplePath = candidates.find((p) => fs.existsSync(p));
}

if (!samplePath || !fs.existsSync(samplePath)) {
  console.error("❌ Voice sample not found. Provide the path as the second argument:");
  console.error("   node scripts/generate-voice.mjs <API_KEY> /path/to/voice.m4a");
  process.exit(1);
}

console.log(`🎙️  Voice sample: ${samplePath}`);
console.log(`📂 Output: ${OUTPUT_DIR}`);
console.log(`📝 Phrases: ${PHRASES.length}`);
console.log("");

// Create output directory
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Step 1: Clone voice
let voiceId;

// Check if we already have a voice ID saved
const voiceIdFile = path.join(__dirname, ".voice-id");
if (fs.existsSync(voiceIdFile)) {
  voiceId = fs.readFileSync(voiceIdFile, "utf-8").trim();
  console.log(`♻️  Using existing voice: ${voiceId}`);
} else {
  voiceId = await cloneVoice(samplePath);
  fs.writeFileSync(voiceIdFile, voiceId);
}

// Step 2: Generate audio for each phrase
console.log("");
console.log("🔊 Generating phrase audio...");
console.log("");

let completed = 0;
const failed = [];

for (const phrase of PHRASES) {
  const outputPath = path.join(OUTPUT_DIR, `${phrase.id}.mp3`);

  // Skip if already generated
  if (fs.existsSync(outputPath)) {
    completed++;
    console.log(`  ⏭️  [${completed}/${PHRASES.length}] ${phrase.id} — already exists`);
    continue;
  }

  try {
    await generateAudio(voiceId, phrase.text, outputPath, phrase.id);
    completed++;
    console.log(`  ✅ [${completed}/${PHRASES.length}] ${phrase.id} — "${phrase.text}"`);

    // Small delay to respect rate limits
    await new Promise((r) => setTimeout(r, 500));
  } catch (err) {
    failed.push({ id: phrase.id, text: phrase.text, error: err.message });
    console.error(`  ❌ [${completed + 1}/${PHRASES.length}] ${phrase.id} — ${err.message}`);
  }
}

console.log("");
console.log("─".repeat(50));
console.log(`✅ Generated: ${completed}/${PHRASES.length}`);
if (failed.length > 0) {
  console.log(`❌ Failed: ${failed.length}`);
  failed.forEach((f) => console.log(`   - ${f.id}: ${f.error}`));
  console.log("\nRe-run the script to retry failed phrases (existing files are skipped).");
}
console.log(`\n📂 Audio files saved to: ${OUTPUT_DIR}`);
console.log("\nNext step: run 'npm run build' then 'git add -A && git commit && git push'");
