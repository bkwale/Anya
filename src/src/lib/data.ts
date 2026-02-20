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

export const greetingsModule: Module = {
  id: "greetings",
  title: "Greetings & Everyday Words",
  description: "Simple words you use every day with the people around you",
  icon: "👋",
  prompts: [
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

export const pidginModule: Module = {
  id: "pidgin",
  title: "Pidgin English",
  description: "Everyday Nigerian Pidgin phrases to practise",
  icon: "🇳🇬",
  prompts: [
    { id: "pi-1", text: "How you dey?", hint: "How are you?" },
    { id: "pi-2", text: "I dey fine.", hint: "I'm fine" },
    { id: "pi-3", text: "Abeg, help me.", hint: "Please, help me" },
    { id: "pi-4", text: "I wan chop.", hint: "I want to eat" },
    { id: "pi-5", text: "I wan drink water.", hint: "I want to drink water" },
    { id: "pi-6", text: "No wahala.", hint: "No problem" },
    { id: "pi-7", text: "E go better.", hint: "It will get better" },
    { id: "pi-8", text: "God dey.", hint: "God is in control" },
    { id: "pi-9", text: "Wetin happen?", hint: "What happened?" },
    { id: "pi-10", text: "I dey come.", hint: "I'm coming" },
    { id: "pi-11", text: "Oya, make we go.", hint: "Come on, let's go" },
    { id: "pi-12", text: "Thank God.", hint: "Thank God" },
    { id: "pi-13", text: "I no well.", hint: "I'm not feeling well" },
    { id: "pi-14", text: "Na so.", hint: "That's how it is" },
    { id: "pi-15", text: "Well done.", hint: "Well done / Good job" },
  ],
};

export const allModules: Module[] = [warmUpModule, greetingsModule, phrasesModule, pidginModule];

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
  "E go better — one word at a time.",
  "No wahala. You're doing well.",
];

export function getRandomEncouragement(): string {
  return encouragements[Math.floor(Math.random() * encouragements.length)];
}
