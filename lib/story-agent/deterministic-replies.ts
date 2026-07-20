/**
 * Natural confirmation / control replies for deterministic turns (no AI).
 */

import type { DeterministicParseResult } from "@/lib/story-agent/deterministic-memory-parser";
import { confirmReplyFromParse } from "@/lib/story-agent/deterministic-memory-parser";

const GREETING_REPLIES: Record<string, string> = {
  hey: "Hey! 😊 Apna rough story idea batao—ek character, scene, ya sirf ek feeling bhi chalegi.",
  hi: "Hi! ✨ Kya likhna hai aaj—nayi story, scene, ya pehle se idea polish karna?",
  hello: "Hello! 🤍 Story idea share karo, ya main 3 unique concepts suggest karun?",
  salam: "Salam! ✨ Story idea, characters, ya scene—batao kahan se start karein?",
  "assalamualaikum": "Walaikum Assalam! 🤍 Aapki story ka rough idea sunna chahti hoon.",
  help: "Bilkul! 😊 Aap idea bata sakte ho, characters add kar sakte ho, ya “write a scene” bol ke draft maang sakte ho.",
  hola: "Hola! ✨ Apna story vibe batao—romance, thriller, fantasy, kuch bhi.",
  namaste: "Namaste! 🤍 Aapki story ka rough idea sunna chahti hoon.",
  "kaise ho": "Main theek hoon! 😊 Aap batao—aaj kya create karna hai?",
  "kya haal": "Sab theek! ✨ Story pe kaam karein? Idea ya scene se start kar sakte hain.",
  "good morning": "Good morning! ✨ Aaj kaunsi story pe focus karna hai?",
  "good evening": "Good evening! 🤍 Idea, scene, ya revise—batao kya chahiye.",
};

export function greetingReply(normalized: string): string | null {
  return GREETING_REPLIES[normalized] ?? null;
}

export function doNotStartReply(wantsOptions: boolean): string {
  return wantsOptions
    ? "Done—abhi hum sirf concept aur characters build karenge. Story tabhi start hogi jab aap clearly kahogi. Options explore karte hain—romance, thriller, ya drama?"
    : "Done—abhi hum sirf concept aur characters build karenge. Story tabhi start hogi jab aap clearly kahogi. ✨";
}

export function languagePreferenceReply(description: string): string {
  return `Theek hai — ab se writing ${description} me rakhungi. Jab scene ya episode likhne bolo, isi language me likhungi.`;
}

export function memoryConfirmReply(parsed: DeterministicParseResult): string {
  return confirmReplyFromParse(parsed);
}

export function preferenceConfirmReply(label: string): string {
  return `Got it ✨ ${label} note kar liya. Ab characters, conflict, ya scene batao—main uske hisaab se likhungi.`;
}
