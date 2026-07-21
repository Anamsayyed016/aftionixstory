import type { StoryAgentIntent, StoryAgentTurnResult } from "@/lib/story-agent/schema";
import { shouldAutoStartFromSetup } from "@/lib/story-agent/opening-rules";

export type ControlDecision = {
  generationBlocked?: boolean;
  clearGenerationBlock?: boolean;
  forceIntent?: StoryAgentIntent;
  forceActionType?: StoryAgentTurnResult["action"]["type"];
  forceReply?: string;
  preferSuggestOptions?: boolean;
};

const DO_NOT_START = [
  /\bstory\s+start\s+mat\b/i,
  /\bstart\s+mat\s+kar/i,
  /\babhi\s+start\s+nahi\b/i,
  /\bdon['’]?t\s+start\b/i,
  /\bdo\s+not\s+start\b/i,
  /\bonly\s+concept\b/i,
  /\bsirf\s+discuss\b/i,
  /\bonly\s+suggest\b/i,
  /\bwrite\s+mat\b/i,
  /\blikhna\s+mat\b/i,
  /\bgeneration\s+mat\b/i,
];

const ALLOW_START = [
  /\bstart\s+(the\s+)?story\b/i,
  /\bstory\s+shuru\b/i,
  /\bepisode\s*1\b/i,
  /\bstart\s+episode\b/i,
  /\bab\s+likho\b/i,
  /\bbegin\s+writing\b/i,
  /\bstart\s+now\b/i,
  /\bab\s+shuru\b/i,
  /\bchoose\s+everything\b.*\bstart\b/i,
  /\blikho\s+ab\b/i,
];

const CONTINUE = [
  /\bnext\s+episode\b/i,
  /\bagla\s+episode\b/i,
  /\baage\s+likho\b/i,
  /\bcontinue\s+from\b/i,
  /\bcontinue\b/i,
];

const REVISE = [
  /\brewrite\b/i,
  /\brevise\b/i,
  /\bslow\s+karo\b/i,
  /\btoo\s+fast\b/i,
  /\bromance\s+add\b/i,
  /\bmore\s+emotional\b/i,
  /\buppercase\b/i,
  /\bcomedy\b.*\bromance\b/i,
];

/** Deterministic safety/control routing — wins over probabilistic model intent. */
export function resolveControlDecision(userMessage: string): ControlDecision {
  const text = userMessage.trim();
  if (!text) return {};

  if (DO_NOT_START.some((re) => re.test(text))) {
    return {
      generationBlocked: true,
      forceIntent: "update_story",
      forceActionType: "none",
      forceReply:
        "Theek hai — abhi story start nahi karungi. Concept build karte rahenge. Jab ready ho, bas “start the story” bol dena.",
    };
  }

  if (shouldAutoStartFromSetup(text)) {
    return {
      clearGenerationBlock: true,
      forceIntent: "start_story",
      forceActionType: "generate_episode",
    };
  }

  if (ALLOW_START.some((re) => re.test(text))) {
    return {
      clearGenerationBlock: true,
      forceIntent: "start_story",
      forceActionType: "generate_episode",
    };
  }

  if (CONTINUE.some((re) => re.test(text))) {
    return {
      clearGenerationBlock: true,
      forceIntent: "generate_episode",
      forceActionType: "generate_episode",
    };
  }

  if (REVISE.some((re) => re.test(text))) {
    return {
      forceIntent: "revise_episode",
      forceActionType: "revise_draft",
    };
  }

  // Ultra-short vague prompts should brainstorm, never interrogate
  if (/^(storytelling|story|idea|concept|help|hi|hello|hey)$/i.test(text)) {
    return {
      forceIntent: "brainstorm",
      forceActionType: "suggest_options",
      preferSuggestOptions: true,
      forceReply:
        text.toLowerCase() === "storytelling" || text.toLowerCase() === "story"
          ? "Sure. Aap apna rough idea bata sakti ho—even one character, one scene, or just a feeling. Ya main aapke liye 3 unique story concepts suggest karun?"
          : undefined,
    };
  }

  return {};
}

export function shouldBlockGeneration(params: {
  intent: StoryAgentIntent;
  doNotStartYet?: boolean;
  userMessage: string;
}): boolean {
  const control = resolveControlDecision(params.userMessage);
  if (control.clearGenerationBlock) return false;
  if (control.generationBlocked) return true;

  if (!params.doNotStartYet) return false;

  if (
    params.intent === "start_story" ||
    params.intent === "generate_episode" ||
    params.intent === "revise_episode" ||
    params.intent === "continue_story"
  ) {
    return true;
  }
  return false;
}

export function hintIntentFromMessage(message: string): StoryAgentIntent {
  const control = resolveControlDecision(message);
  if (control.forceIntent) return control.forceIntent;

  const text = message.trim();
  if (/\bcreate (the )?story\b/i.test(text) || /\bsave (this )?setup\b/i.test(text)) {
    return "create_story";
  }
  if (/\bsuggest\b/i.test(text) || /\bbrainstorm\b/i.test(text) || /\bopening situations?\b/i.test(text)) {
    return "brainstorm";
  }
  if (/\bnext episode\b/i.test(text) || /\bcontinue\b/i.test(text)) {
    return "generate_episode";
  }
  return "chat";
}

/** Detect assistant replies that slipped into old form-collector mode. */
export function looksLikeFieldChecklist(reply: string): boolean {
  const lower = reply.toLowerCase();
  const markers = [
    "working title",
    "title,",
    "genre",
    "language",
    "logline",
    "main character",
    "target audience",
    "pov",
    "point of view",
    "pacing",
    "at least one",
    "provide",
    "tell me a",
    "missing",
  ];
  const hits = markers.filter((m) => lower.includes(m)).length;
  return hits >= 3;
}

export function naturalFallbackReply(userMessage: string): string {
  const text = userMessage.trim();
  if (/^(storytelling|story)$/i.test(text)) {
    return "Sure. Aap apna rough idea bata sakti ho—even one character, one scene, or just a feeling. Ya main aapke liye 3 unique story concepts suggest karun?";
  }
  if (/forbidden/i.test(text)) {
    return "Nice—forbidden love ka angle strong hota hai. Main ise slow-burn emotional direction me soch sakti hoon. Pehle characters batao, ya main 3 opening situations suggest karun?";
  }
  return "Got it. Thoda aur batao—character, scene, feeling, ya jo bhi dimaag me aa raha hai. Main usse build kar lungi.";
}

export function applyControlToDecision(
  decision: StoryAgentTurnResult,
  userMessage: string,
  memoryDoNotStartYet: boolean
): StoryAgentTurnResult {
  const control = resolveControlDecision(userMessage);
  const next: StoryAgentTurnResult = { ...decision };

  if (control.forceIntent) next.intent = control.forceIntent;
  if (control.forceActionType) {
    next.action = { type: control.forceActionType, payload: next.action.payload ?? {} };
  }

  if (control.generationBlocked) {
    next.memoryPatch = {
      ...next.memoryPatch,
      preferences: {
        ...(next.memoryPatch.preferences ?? {}),
        doNotStartYet: true,
      },
    };
    next.action = { type: "none", payload: {} };
    if (control.forceReply) next.assistantReply = control.forceReply;
  }

  if (control.clearGenerationBlock) {
    next.memoryPatch = {
      ...next.memoryPatch,
      preferences: {
        ...(next.memoryPatch.preferences ?? {}),
        doNotStartYet: false,
      },
    };
  }

  if (control.preferSuggestOptions && control.forceReply) {
    next.assistantReply = control.forceReply;
    next.suggestions =
      next.suggestions.length > 0
        ? next.suggestions
        : [
            {
              label: "Suggest 3 concepts",
              prompt: "Suggest three unique story concepts for me.",
            },
            {
              label: "I have a character",
              prompt: "I have a character idea to start with.",
            },
          ];
  }

  if (looksLikeFieldChecklist(next.assistantReply)) {
    next.assistantReply = control.forceReply || naturalFallbackReply(userMessage);
    if (next.action.type === "none") {
      next.intent = "brainstorm";
    }
  }

  const blocked = shouldBlockGeneration({
    intent: next.intent,
    doNotStartYet: memoryDoNotStartYet || Boolean(control.generationBlocked),
    userMessage,
  });
  if (
    blocked &&
    (next.action.type === "generate_episode" || next.action.type === "revise_draft")
  ) {
    next.action = { type: "none", payload: {} };
    next.assistantReply =
      control.forceReply ||
      "Understood — I won’t start writing yet. Tell me when you want to begin.";
  }

  return next;
}
