export interface Prompt {
  id: string;
  text: string;
  hint?: string;
}

export interface Module {
  id: string;
  title: string;
  description: string;
  icon: string;
  prompts: Prompt[];
}

export const warmUpModule: Module = {
  id: "warm-up",
  title: "Warm-Up",
  description: "Gentle mouth exercises to wake up your speech muscles",
  icon: "🌅",
  prompts: [
    { id: "wu-1", text: "Pa — Pa — Pa", hint: "Press your lips together, then release with a puff of air" },
    { id: "wu-2", text: "Ta — Ta — Ta", hint: "Touch the tip of your tongue behind your top teeth" },
    { id: "wu-3", text: "Ka — Ka — Ka", hint: "Use the back of your tongue against the roof of your mouth" },
    { id: "wu-4", text: "Ma — Ma — Ma", hint: "Hum with your lips together, then open" },
    { id: "wu-5", text: "Ba — Ba — Ba", hint: "Like Pa, but with your voice buzzing" },
  ],
};

export const phrasesModule: Module = {
  id: "phrases",
  title: "Everyday Phrases",
  description: "Practise saying the words that matter most in your day",
  icon: "💬",
  prompts: [
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
  ],
};

export const allModules: Module[] = [warmUpModule, phrasesModule];

export const encouragements = [
  "You're doing great — keep going!",
  "Every practice makes a difference.",
  "Well done — that took real effort.",
  "Your voice is getting stronger.",
  "Take your time. There's no rush.",
  "That was wonderful. One more?",
  "You should be proud of yourself.",
  "Nice work! Rest if you need to.",
  "Every word you say is a victory.",
  "Brilliant. Let's try the next one.",
];

export function getRandomEncouragement(): string {
  return encouragements[Math.floor(Math.random() * encouragements.length)];
}
