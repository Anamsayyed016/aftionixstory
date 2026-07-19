import type { StoryAgentIntent } from "@/lib/story-agent/schema";

/** Soft keyword hints — model intent remains authoritative. */
const INTENT_HINTS: Array<{ intent: StoryAgentIntent; patterns: RegExp[] }> = [
  {
    intent: "create_story",
    patterns: [
      /\bcreate (the )?story\b/i,
      /\bsave (this )?setup\b/i,
      /\bbana\s*do\b/i,
      /\bstory create\b/i,
    ],
  },
  {
    intent: "start_story",
    patterns: [
      /\bstart (the )?story\b/i,
      /\bstart episode\b/i,
      /\bepisode\s*1\b/i,
      /\bshuru\b/i,
    ],
  },
  {
    intent: "generate_episode",
    patterns: [
      /\bnext episode\b/i,
      /\bcontinue\b/i,
      /\bgenerate episode\b/i,
      /\bagla episode\b/i,
    ],
  },
  {
    intent: "revise_episode",
    patterns: [
      /\brewrite\b/i,
      /\brevise\b/i,
      /\btoo fast\b/i,
      /\bmake (it )?slower\b/i,
      /\badd comedy\b/i,
      /\bmore emotional\b/i,
    ],
  },
  {
    intent: "brainstorm",
    patterns: [
      /\bsuggest\b/i,
      /\bbrainstorm\b/i,
      /\bideas?\b/i,
      /\bopening situations?\b/i,
      /\boptions?\b/i,
    ],
  },
  {
    intent: "inspect_memory",
    patterns: [
      /\bwhat (have we|do you) (decided|know)\b/i,
      /\bshow (the )?(full )?setup\b/i,
      /\bsummarize\b/i,
      /\bremember(ed)?\b/i,
    ],
  },
  {
    intent: "manage_character",
    patterns: [
      /\bremove .+\b/i,
      /\bshould have\b/i,
      /\bpersonality\b/i,
      /\bfather nahi\b/i,
      /\buncle\b/i,
    ],
  },
];

export function hintIntentFromMessage(message: string): StoryAgentIntent {
  const text = message.trim();
  if (!text) return "unknown";

  if (
    /\b(do not|don't|mat)\b.*\b(start|shuru)\b/i.test(text) ||
    /\bstory start mat\b/i.test(text) ||
    /\bonly suggest\b/i.test(text)
  ) {
    return "update_story";
  }

  for (const hint of INTENT_HINTS) {
    if (hint.patterns.some((re) => re.test(text))) return hint.intent;
  }

  return "chat";
}

export function shouldBlockGeneration(params: {
  intent: StoryAgentIntent;
  doNotStartYet?: boolean;
  userMessage: string;
}): boolean {
  if (params.doNotStartYet) {
    if (
      params.intent === "start_story" ||
      params.intent === "generate_episode" ||
      params.intent === "revise_episode" ||
      params.intent === "continue_story"
    ) {
      // Explicit override phrases can clear the block in the model patch;
      // until preferences update, still block unless user clearly says start now.
      if (/\b(start now|ab shuru|start the story now)\b/i.test(params.userMessage)) {
        return false;
      }
      return true;
    }
  }
  return false;
}
