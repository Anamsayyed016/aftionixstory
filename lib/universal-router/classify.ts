/**
 * Hybrid universal intent classification — runs every user turn.
 *
 * Priority:
 * 1. Clear off-topic / general / coding / current-info / platform (wins over slot-fill)
 * 2. Clear story request / continuation
 * 3. Plausible awaiting-slot answer → story_continuation
 * 4. Optional fast LLM JSON classify when still ambiguous
 * 5. Fallback: unclear (clarify) vs story_continuation when mid-setup
 */

import { z } from "zod";

import { extractJsonObject } from "@/lib/chat/create-story-extraction";
import type { ConversationFlow } from "@/lib/conversation-brain/collaboration-state";
import { generateTextCompat } from "@/lib/provider-router/v2/legacy-generate";
import {
  isStoryUniversalIntent,
  type UniversalIntent,
  type UniversalRouteDecision,
  UNIVERSAL_INTENTS,
} from "@/lib/universal-router/intents";

const universalIntentSchema = z.enum(UNIVERSAL_INTENTS);

const llmClassifySchema = z.object({
  intent: universalIntentSchema,
  confidence: z.number().min(0).max(1),
  reason: z.string().max(240).optional().default(""),
});

export type ClassifyUniversalInput = {
  userMessage: string;
  conversationFlow?: ConversationFlow | null;
  recentAssistantQuestion?: string | null;
  /** When false, skip LLM and use deterministic/fallback only (tests). */
  allowLlm?: boolean;
};

function norm(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function isAwaitingSlot(flow?: ConversationFlow | null): boolean {
  return Boolean(flow && flow.awaiting.type !== "none");
}

/** Question-shaped messages that are unlikely to be slot answers. */
function looksLikeStandaloneQuestion(text: string): boolean {
  const t = text.trim();
  if (t.length < 3) return false;
  if (/[?？]$/.test(t)) return true;
  return /^(what|what's|whats|who|who's|when|where|why|how|which|is|are|can|does|do|did|will|should|could|explain|tell me|define)\b/i.test(
    t
  );
}

function decision(
  intent: UniversalIntent,
  confidence: number,
  source: UniversalRouteDecision["source"],
  reason: string,
  matchedSignals: string[] = []
): UniversalRouteDecision {
  return {
    intent,
    confidence,
    source,
    enableWebSearch: intent === "current_information",
    reason,
    matchedSignals,
  };
}

/**
 * Pure deterministic classification (exported for unit tests).
 */
export function classifyUniversalIntentDeterministic(
  input: ClassifyUniversalInput
): UniversalRouteDecision | null {
  const text = norm(input.userMessage);
  if (!text) {
    return decision("unclear", 0.9, "deterministic", "empty_message", [
      "empty",
    ]);
  }
  const lower = text.toLowerCase();
  const awaiting = isAwaitingSlot(input.conversationFlow);

  // ---- Current information (web search) ----
  if (
    /\b(weather|temperature|forecast|humidity|air quality)\b/i.test(text) ||
    (/\b(today|tonight|right now|this morning|this evening)\b/i.test(text) &&
      /\b(weather|news|score|stock|price|election|match|headline)\b/i.test(
        text
      )) ||
    /\b(latest|breaking|current|live)\b.+\b(news|score|price|results?)\b/i.test(
      text
    ) ||
    /\bwhat's the weather\b|\bweather in\b|\bnews about\b/i.test(lower)
  ) {
    return decision(
      "current_information",
      0.95,
      "deterministic",
      "current_info_signals",
      ["current_information"]
    );
  }

  // ---- Platform / product help ----
  if (
    /\b(aftionix|storyverse|this (app|platform|site|product)|how do (credits|tokens) work|how does (this|the) (chat|studio|assistant) work)\b/i.test(
      text
    ) ||
    /\b(knowledge base|rag|prompt registry|provider router)\b/i.test(lower)
  ) {
    return decision(
      "platform_question",
      0.92,
      "deterministic",
      "platform_signals",
      ["platform_question"]
    );
  }

  // ---- Coding / technical ----
  if (
    /\b(python|javascript|typescript|java\b|golang|rust|sql|html|css|react|node\.?js|npm|pip |git |docker|kubernetes|api endpoint|stack trace|regex|algorithm|function|variable|loop|class |compile|debug|vscode|ide)\b/i.test(
      text
    ) ||
    /\b(how (do|to) (i |you )?(code|program|write (a |an )?(function|script|query)))\b/i.test(
      lower
    ) ||
    /\bwhat is (a |an )?(programming language|framework|library|sdk)\b/i.test(
      lower
    ) ||
    /^what is python\b/i.test(lower) ||
    /\b(coding|programming|software engineering)\b/i.test(lower)
  ) {
    // Story craft that mentions "character class" etc. is rare; prefer coding when clear.
    if (
      !/\b(write|scene|episode|chapter|protagonist|antagonist|romance|story)\b/i.test(
        text
      )
    ) {
      return decision("coding_help", 0.94, "deterministic", "coding_signals", [
        "coding_help",
      ]);
    }
  }

  // ---- Strong story signals ----
  if (
    /\b(write|draft|generate|create)\b.+\b(scene|episode|chapter|story|synopsis)\b/i.test(
      text
    ) ||
    /\b(continue|revise|rewrite|expand|shorten)\b.+\b(scene|episode|draft|story)\b/i.test(
      text
    ) ||
    /\b(my (story|character|protagonist)|new story concept|forbidden romance|help me (create|build) (a |an )?(story|romance))\b/i.test(
      lower
    ) ||
    /\b(episode\s*\d+|start (the )?story|save (this )?episode)\b/i.test(lower)
  ) {
    const continuation =
      awaiting ||
      /\b(continue|revise|rewrite|expand|shorten|next episode)\b/i.test(lower);
    return decision(
      continuation ? "story_continuation" : "story_request",
      0.93,
      "deterministic",
      "story_signals",
      ["story"]
    );
  }

  // ---- General knowledge / explain (off-topic vs story slot) ----
  const generalKnowledge =
    /^(what|who's|who is|what's|whats|define|explain|tell me (about|what))\b/i.test(
      text
    ) ||
    /\bwhat (is|are|does|do)\b/i.test(lower);
  const storyCraftTopic =
    /\b(foreshadowing|protagonist|antagonist|plot twist|worldbuilding|point of view|pov|inciting incident|character arc|theme|genre)\b/i.test(
      lower
    );

  if (generalKnowledge && !storyCraftTopic) {
    // During setup, "what is romance" could be craft — still safer as general if not slot-shaped.
    if (
      awaiting &&
      !looksLikeStandaloneQuestion(text) &&
      text.split(/\s+/).length <= 4
    ) {
      // Short non-question during awaiting may still be a slot answer — don't steal yet.
    } else {
      return decision(
        "general_question",
        awaiting ? 0.9 : 0.88,
        "deterministic",
        awaiting ? "off_topic_over_slot" : "general_question",
        ["general_question", awaiting ? "slot_override" : ""]
      );
    }
  }

  // ---- Plausible slot answer while awaiting ----
  if (awaiting) {
    const topic = input.conversationFlow!.awaiting.topic;
    const short = text.split(/\s+/).length <= 12;
    const question = looksLikeStandaloneQuestion(text);

    if (question && generalKnowledge && !storyCraftTopic) {
      return decision(
        "general_question",
        0.91,
        "deterministic",
        "question_over_slot",
        ["slot_override", "general_question"]
      );
    }

    // Short answers / choices / conflict blurbs → story continuation
    if (!question || short) {
      const signals = [`awaiting_${topic}`, "plausible_slot"];
      return decision(
        "story_continuation",
        0.86,
        "deterministic",
        "awaiting_slot_answer",
        signals
      );
    }
  }

  // ---- Very short ambiguous ----
  if (/^(ok|okay|hmm+|idk|maybe|sure|yes|no|yep|nah|k)$/i.test(text)) {
    if (awaiting) {
      return decision(
        "story_continuation",
        0.8,
        "deterministic",
        "short_awaiting_ack",
        ["awaiting"]
      );
    }
    return decision("unclear", 0.75, "deterministic", "short_ambiguous", [
      "unclear",
    ]);
  }

  return null;
}

async function classifyWithLlm(
  input: ClassifyUniversalInput
): Promise<UniversalRouteDecision | null> {
  if (input.allowLlm === false) return null;

  const awaiting = input.conversationFlow?.awaiting;
  const system = `You classify a single chat message for AFTIONIX Studio.
Return ONLY JSON: {"intent":"...","confidence":0-1,"reason":"..."}.
intents: ${UNIVERSAL_INTENTS.join(", ")}.
Rules:
- story_request: user wants to start/create a story or write new story content.
- story_continuation: user is answering a story setup question, refining story, or continuing writing.
- general_question: general knowledge / explanation not about writing their story.
- coding_help: programming, languages, debugging, software.
- current_information: needs live/current facts (weather, news, scores, prices today).
- platform_question: how this app/product works.
- unclear: too ambiguous to route safely.
If the assistant was awaiting a story slot answer BUT the user asks something clearly unrelated (e.g. "what is python"), choose general_question or coding_help — do NOT force-fit into the slot.`;

  const prompt = [
    `awaiting: ${awaiting ? `${awaiting.type}/${awaiting.topic}` : "none"}`,
    `recentAssistantQuestion: ${input.recentAssistantQuestion || "none"}`,
    `userMessage: ${input.userMessage.trim()}`,
  ].join("\n");

  try {
    const result = await generateTextCompat({
      modelKind: "agent",
      input: {
        systemInstruction: system,
        prompt,
        temperature: 0,
        maxOutputTokens: 180,
        outputMode: "json",
        operation: "universal_intent_classify",
      },
    });
    const parsed = extractJsonObject(result.text);
    const validated = llmClassifySchema.safeParse(parsed);
    if (!validated.success) return null;
    return decision(
      validated.data.intent,
      validated.data.confidence,
      "llm",
      validated.data.reason || "llm_classify",
      ["llm"]
    );
  } catch {
    return null;
  }
}

/**
 * Classify every user turn. Prefer deterministic off-topic over story slot-fill.
 */
export async function classifyUniversalIntent(
  input: ClassifyUniversalInput
): Promise<UniversalRouteDecision> {
  const deterministic = classifyUniversalIntentDeterministic(input);
  if (deterministic && deterministic.confidence >= 0.85) {
    return deterministic;
  }

  const llm = await classifyWithLlm(input);
  if (llm && llm.confidence >= 0.55) {
    // Prefer deterministic off-topic if LLM tried to force story while we had a weaker det hit
    if (
      deterministic &&
      !isStoryUniversalIntent(deterministic.intent) &&
      isStoryUniversalIntent(llm.intent)
    ) {
      return deterministic;
    }
    return llm;
  }

  if (deterministic) return deterministic;

  if (isAwaitingSlot(input.conversationFlow)) {
    return decision(
      "story_continuation",
      0.55,
      "fallback",
      "awaiting_default_story",
      ["fallback_awaiting"]
    );
  }

  return decision("unclear", 0.5, "fallback", "ambiguous_fallback", [
    "fallback",
  ]);
}
