/**
 * Phase A collaborative turn handlers — offer resolution + open-concept brainstorm.
 * Keeps runStoryOperation free of Phase A policy bulk.
 */

import "server-only";

import { buildStoryContext } from "@/lib/ai/context/story-context-builder";
import { buildCollaborativeConversationPrompt } from "@/lib/ai/prompts/collaborative-conversation-prompt";
import { logAiEvent } from "@/lib/ai/logger";
import { generateViaBrain } from "@/lib/conversation-brain/provider-gateway";
import { extractJsonObject } from "@/lib/chat/create-story-extraction";
import { extractStoryConcept } from "@/lib/story-agent/concept-reply";
import {
  mergeConversationFlow,
  normalizeOffers,
  offersToSuggestions,
  type ConversationFlow,
  type ConversationFlowPatch,
  type ConversationOffer,
} from "@/lib/conversation-brain/collaboration-state";
import {
  COLLABORATIVE_FAILURE_USER_MESSAGE,
  looksLikeWizardChecklist,
  type OpenConceptDetection,
} from "@/lib/conversation-brain/open-concept";
import type { AwaitingResolution, OfferResolution } from "@/lib/conversation-brain/offer-resolver";
import type { NormalizedTurnResult } from "@/lib/story-agent/operation-result";
import { applyMemoryPatch, getMemoryV2 } from "@/lib/story-agent/memory-patch";
import type { StoryMemory } from "@/lib/story-agent/schema";
import { maybeDecorateChatReply, readStyleProfile } from "@/lib/story-agent/style-profile";
import {
  composeCreateChatPrompt,
  isPromptRegistryV2Enabled,
  promptResultToLegacyParts,
  resolveTemperature,
  resolveMaxOutputTokens,
  promptLogFieldsForAiEvent,
} from "@/lib/prompt-registry";
import { looksLikeHardcodedConceptTemplate, looksLikeOnboardingGreeting } from "@/lib/story-agent/concept-reply";

export type PhaseATurnExtras = {
  conversationFlow: ConversationFlow;
};

function titleCasePair(label: string): string {
  return label
    .split(/\s*[×x]\s*|\s+and\s+/i)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" × ");
}

function dynamicsOffers(): ConversationOffer[] {
  return normalizeOffers([
    { label: "Rivals", value: "rivals", prompt: "Rivals who slowly fall for each other" },
    {
      label: "Strangers",
      value: "strangers",
      prompt: "Two strangers thrown together by circumstance",
    },
    {
      label: "Childhood friends",
      value: "childhood_friends",
      prompt: "Childhood friends reconnecting as adults",
    },
    {
      label: "Boss and employee",
      value: "boss_employee",
      prompt: "Boss and employee with forbidden tension",
    },
  ]);
}

export function buildTwoCharactersReply(): {
  reply: string;
  offers: ConversationOffer[];
  flowPatch: ConversationFlowPatch;
} {
  const offers = dynamicsOffers();
  return {
    reply:
      "Perfect ❤️ Do characters se bhi amazing slow-burn story ban sakti hai.\n\nUnka vibe kya ho—rivals, strangers, childhood friends, ya boss and employee?",
    offers,
    flowPatch: {
      phase: "exploring",
      lastOfferType: "dynamics",
      lastOffers: offers,
      awaiting: { type: "choice", topic: "pairing" },
    },
  };
}

export function buildOfferSelectionReply(
  offer: ConversationOffer,
  memory: StoryMemory
): {
  reply: string;
  memory: StoryMemory;
  flowPatch: ConversationFlowPatch;
  suggestions: Array<{ label: string; prompt: string }>;
} {
  const pairing = titleCasePair(offer.label);
  const parts = pairing.split(/\s*×\s*/);
  let next = memory;
  if (parts.length >= 2) {
    next = applyMemoryPatch(memory, {
      story: {
        concept: memory.storyMemory.concept || `${pairing} story`,
      },
      characters: [
        {
          name: parts[0],
          role: parts[0],
          personality: [],
          goals: [],
          conflicts: [],
          notes: ["setup role"],
          avoid: [],
        },
        {
          name: parts[1],
          role: parts[1],
          personality: [],
          goals: [],
          conflicts: [],
          notes: ["setup role"],
          avoid: [],
        },
      ],
      relationships: [
        {
          from: parts[0],
          to: parts[1],
          type: "romantic tension",
          notes: offer.value,
        },
      ],
      writingRules: [],
      preferences: {},
      remove: [],
    });
  } else {
    next = applyMemoryPatch(memory, {
      story: {
        concept: memory.storyMemory.concept || offer.label,
      },
      characters: [],
      relationships: [],
      writingRules: [],
      preferences: {},
      remove: [],
    });
  }

  const whoFirst =
    parts.length >= 2
      ? `Who falls first—the ${parts[0].toLowerCase()}, or the ${parts[1].toLowerCase()}?`
      : "What tension should pull them together first?";

  const reply = `Perfect 😄 ${pairing} note kar liya.\n\n${whoFirst}`;

  return {
    reply,
    memory: next,
    flowPatch: {
      phase: "shaping",
      lastOfferType: "none",
      lastOffers: [],
      awaiting: { type: "choice", topic: "who_falls_first" },
      lastIntent: "offer_selection",
    },
    suggestions: parts.length >= 2
      ? [
          { label: parts[0], prompt: `The ${parts[0].toLowerCase()}.` },
          { label: parts[1], prompt: `The ${parts[1].toLowerCase()}.` },
        ]
      : [],
  };
}

export function buildAwaitingAnswerReply(
  resolution: AwaitingResolution,
  memory: StoryMemory
): {
  reply: string;
  memory: StoryMemory;
  flowPatch: ConversationFlowPatch;
} {
  const value = resolution.value;
  const next = applyMemoryPatch(memory, {
    story: {},
    characters: [],
    relationships: [],
    writingRules: [],
    preferences: {},
    remove: [],
  });

  // Annotate concept with who-falls-first when applicable
  let mem = next;
  if (resolution.topic === "who_falls_first") {
    const note = `Who falls first: ${value}`;
    mem = {
      ...next,
      storyMemory: {
        ...next.storyMemory,
        plot: [next.storyMemory.plot, note].filter(Boolean).join(" · "),
      },
      updatedAt: new Date().toISOString(),
    };
    return {
      reply: `Got it ✨ ${value.charAt(0).toUpperCase() + value.slice(1)} falls first—that softens the power imbalance nicely.\n\nEk beat aur: pehla spark office/college me hona chahiye, ya kisi unexpected place pe?`,
      memory: mem,
      flowPatch: {
        phase: "shaping",
        lastOffers: [],
        lastOfferType: "none",
        awaiting: { type: "clarification", topic: "setting" },
        lastIntent: "awaiting_answer",
      },
    };
  }

  return {
    reply: `Got it ✨ “${value}” lock kar diya. Agla useful detail: unka strongest conflict kya hai—secret, rivalry, ya family pressure?`,
    memory: mem,
    flowPatch: {
      phase: "shaping",
      lastOffers: [],
      lastOfferType: "none",
      awaiting: { type: "clarification", topic: "conflict" },
      lastIntent: "awaiting_answer",
    },
  };
}

type CollaborativeParsed = {
  assistantReply: string;
  offers: ConversationOffer[];
  conversationPatch: ConversationFlowPatch;
};

function parseCollaborativeResponse(raw: string): CollaborativeParsed | null {
  try {
    const json = extractJsonObject(raw) as Record<string, unknown>;
    const reply =
      (typeof json.assistantReply === "string" && json.assistantReply.trim()) ||
      (typeof json.reply === "string" && json.reply.trim()) ||
      "";
    if (!reply) return null;

    const offersRaw = Array.isArray(json.offers) ? json.offers : [];
    const offers = normalizeOffers(
      offersRaw.map((o) => {
        const rec = o as Record<string, unknown>;
        return {
          id: typeof rec.id === "string" ? rec.id : undefined,
          label: typeof rec.label === "string" ? rec.label : "",
          value: typeof rec.value === "string" ? rec.value : undefined,
          prompt:
            typeof rec.prompt === "string"
              ? rec.prompt
              : typeof rec.label === "string"
                ? rec.label
                : "",
        };
      })
    );

    const patchRaw =
      json.conversationPatch && typeof json.conversationPatch === "object"
        ? (json.conversationPatch as Record<string, unknown>)
        : {};
    const awaitingRaw =
      patchRaw.awaiting && typeof patchRaw.awaiting === "object"
        ? (patchRaw.awaiting as Record<string, unknown>)
        : {};

    const conversationPatch: ConversationFlowPatch = {
      phase:
        patchRaw.phase === "exploring" ||
        patchRaw.phase === "shaping" ||
        patchRaw.phase === "ready_to_write" ||
        patchRaw.phase === "open" ||
        patchRaw.phase === "writing"
          ? patchRaw.phase
          : "exploring",
      lastOfferType:
        patchRaw.lastOfferType === "pairings" ||
        patchRaw.lastOfferType === "dynamics" ||
        patchRaw.lastOfferType === "openings" ||
        patchRaw.lastOfferType === "tones" ||
        patchRaw.lastOfferType === "conflicts" ||
        patchRaw.lastOfferType === "twists" ||
        patchRaw.lastOfferType === "none"
          ? patchRaw.lastOfferType
          : offers.length
            ? "openings"
            : "none",
      lastOffers: offers,
      awaiting: {
        type:
          awaitingRaw.type === "choice" ||
          awaitingRaw.type === "clarification" ||
          awaitingRaw.type === "confirmation" ||
          awaitingRaw.type === "none"
            ? awaitingRaw.type
            : offers.length
              ? "choice"
              : "none",
        topic:
          awaitingRaw.topic === "pairing" ||
          awaitingRaw.topic === "conflict" ||
          awaitingRaw.topic === "tone" ||
          awaitingRaw.topic === "setting" ||
          awaitingRaw.topic === "character" ||
          awaitingRaw.topic === "who_falls_first" ||
          awaitingRaw.topic === "none"
            ? awaitingRaw.topic
            : offers.length
              ? "pairing"
              : "none",
      },
    };

    return { assistantReply: reply, offers, conversationPatch };
  } catch {
    return null;
  }
}

function isUsableCollaborativeReply(reply: string): boolean {
  const t = reply.trim();
  if (!t || t.length < 20) return false;
  if (looksLikeOnboardingGreeting(t)) return false;
  if (looksLikeHardcodedConceptTemplate(t)) return false;
  if (looksLikeWizardChecklist(t)) return false;
  return true;
}

export async function runCollaborativeBrainstormTurn(params: {
  userId: string;
  conversationId: string;
  storyId: string | null;
  memory: StoryMemory;
  userMessage: string;
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>;
  turnRequestId: string;
  flow: ConversationFlow;
  openConcept: OpenConceptDetection;
}): Promise<NormalizedTurnResult & PhaseATurnExtras> {
  const started = Date.now();
  const conceptMeta = extractStoryConcept(params.userMessage);
  const memory: StoryMemory = {
    ...params.memory,
    storyMemory: {
      ...params.memory.storyMemory,
      concept: params.memory.storyMemory.concept || conceptMeta.topicLabel,
      genre:
        params.memory.storyMemory.genre.length > 0
          ? params.memory.storyMemory.genre
          : conceptMeta.genreHints.slice(0, 2),
    },
    userPreferences: {
      ...params.memory.userPreferences,
      doNotStartYet:
        params.flow.generationBlocked ||
        params.memory.userPreferences.doNotStartYet,
    },
    updatedAt: new Date().toISOString(),
  };

  // Deterministic two-character path — no provider required
  if (params.openConcept.kind === "two_characters") {
    const built = buildTwoCharactersReply();
    const style = readStyleProfile({
      emojiStyle: memory.userPreferences.emojiStyle,
    });
    const flow = mergeConversationFlow(params.flow, {
      ...built.flowPatch,
      lastIntent: "brainstorm",
      generationBlocked: params.flow.generationBlocked,
    });
    return {
      resultType: "conversation",
      operation: "brainstorm",
      assistantReply: maybeDecorateChatReply(built.reply, style.emojiStyle),
      suggestions: offersToSuggestions(built.offers),
      memory,
      storyId: params.storyId,
      draft: null,
      showReview: false,
      actionType: "suggest_options",
      actionOk: true,
      requiresConfirmation: false,
      outputMode: "structured",
      durationMs: Date.now() - started,
      retryCount: 0,
      conversationFlow: flow,
    };
  }

  let system: string;
  let prompt: string;
  let temperature = 0.85;
  let maxOutputTokens = 1400;
  let promptId: string | undefined;
  let promptVersion: string | undefined;

  if (isPromptRegistryV2Enabled()) {
    const built = composeCreateChatPrompt({
      intent: "brainstorm",
      operation: "brainstorm",
      userMessage: params.userMessage,
      memory: getMemoryV2(memory),
      recentMessages: params.recentMessages,
      conversationFlow: params.flow,
      collaborationMode: true,
      conversationId: params.conversationId,
      storyId: params.storyId,
      metadata: {
        turnRequestId: params.turnRequestId,
        preferOfferType: params.openConcept.preferOfferType,
        openConceptKind: params.openConcept.kind,
      },
      promptIdOverride: "conversation.collaborative_brainstorm",
    });
    const parts = promptResultToLegacyParts(built);
    system = parts.system;
    prompt = parts.prompt;
    promptId = built.promptId;
    promptVersion = built.promptVersion;
    temperature = resolveTemperature(built.providerHints.temperatureProfile);
    maxOutputTokens = resolveMaxOutputTokens(
      built.providerHints.maxOutputTokensProfile
    );
    logAiEvent("info", "prompt_registry.build", {
      ...promptLogFieldsForAiEvent(built),
      conversationId: params.conversationId,
      turnRequestId: params.turnRequestId,
    });
  } else {
    const ctx = buildStoryContext({
      operation: "brainstorm",
      memory,
      userMessage: params.userMessage,
      recentMessages: params.recentMessages,
      conversationId: params.conversationId,
      storyId: params.storyId,
      intent: "brainstorm",
    });
    ({ system, prompt } = buildCollaborativeConversationPrompt({
      ctx,
      flow: params.flow,
      preferOfferType: params.openConcept.preferOfferType,
      openConceptKind: params.openConcept.kind,
    }));
  }

  let parsed: CollaborativeParsed | null = null;
  let provider: string | undefined;
  let model: string | undefined;
  let retryCount = 0;

  try {
    let result = await generateViaBrain({
      turnRequestId: params.turnRequestId,
      modelKind: "agent",
      input: {
        systemInstruction: system,
        prompt,
        temperature,
        maxOutputTokens,
        operation: "phase_a_collaborative",
        outputMode: "json",
        reasoningEffort: "minimal",
      },
    });
    provider = result.provider;
    model = result.model;
    parsed = parseCollaborativeResponse(result.text);

    if (!parsed || !isUsableCollaborativeReply(parsed.assistantReply)) {
      retryCount = 1;
      result = await generateViaBrain({
        turnRequestId: params.turnRequestId,
        modelKind: "agent",
        input: {
          systemInstruction: system,
          prompt: `${prompt}

STRICT REPAIR: Reply naturally to the user message. Offer 3–4 distinct options if helpful. No checklists. No story prose. Valid JSON with assistantReply + offers.`,
          temperature: Math.min(temperature, 0.7),
          maxOutputTokens,
          operation: "phase_a_collaborative_repair",
          outputMode: "json",
          reasoningEffort: "minimal",
        },
      });
      provider = result.provider;
      model = result.model;
      parsed = parseCollaborativeResponse(result.text);
    }
  } catch {
    parsed = null;
  }

  if (!parsed || !isUsableCollaborativeReply(parsed.assistantReply)) {
    return {
      resultType: "error",
      operation: "brainstorm",
      assistantReply: COLLABORATIVE_FAILURE_USER_MESSAGE,
      suggestions: [],
      memory,
      storyId: params.storyId,
      draft: null,
      showReview: false,
      actionType: "none",
      actionOk: false,
      requiresConfirmation: false,
      provider,
      model,
      outputMode: "structured",
      durationMs: Date.now() - started,
      retryCount,
      errorCode: "AGENT_RESPONSE_INVALID",
      retryable: true,
      conversationFlow: params.flow,
    };
  }

  const style = readStyleProfile({
    emojiStyle: memory.userPreferences.emojiStyle,
  });
  const assistantReply = maybeDecorateChatReply(
    parsed.assistantReply,
    style.emojiStyle
  );

  const flow = mergeConversationFlow(params.flow, {
    ...parsed.conversationPatch,
    lastIntent: "brainstorm",
    lastOffers: parsed.offers,
    generationBlocked: params.flow.generationBlocked,
  });

  return {
    resultType: "conversation",
    operation: "brainstorm",
    assistantReply,
    suggestions: offersToSuggestions(parsed.offers),
    memory,
    storyId: params.storyId,
    draft: null,
    showReview: false,
    actionType: "suggest_options",
    actionOk: true,
    requiresConfirmation: false,
    provider,
    model,
    outputMode: "structured",
    durationMs: Date.now() - started,
    retryCount,
    conversationFlow: flow,
    promptId,
    promptVersion,
  };
}

export function runOfferResolutionTurn(params: {
  resolution: OfferResolution;
  memory: StoryMemory;
  flow: ConversationFlow;
  storyId: string | null;
}): NormalizedTurnResult & PhaseATurnExtras {
  const built = buildOfferSelectionReply(params.resolution.offer, params.memory);
  const style = readStyleProfile({
    emojiStyle: built.memory.userPreferences.emojiStyle,
  });
  const flow = mergeConversationFlow(params.flow, {
    ...built.flowPatch,
    generationBlocked: params.flow.generationBlocked,
  });
  return {
    resultType: "conversation",
    operation: "memory_update",
    assistantReply: maybeDecorateChatReply(built.reply, style.emojiStyle),
    suggestions: built.suggestions,
    memory: built.memory,
    storyId: params.storyId,
    draft: null,
    showReview: false,
    actionType: "none",
    actionOk: true,
    requiresConfirmation: false,
    outputMode: "structured",
    durationMs: 0,
    retryCount: 0,
    conversationFlow: flow,
  };
}

export function runAwaitingResolutionTurn(params: {
  resolution: AwaitingResolution;
  memory: StoryMemory;
  flow: ConversationFlow;
  storyId: string | null;
}): NormalizedTurnResult & PhaseATurnExtras {
  const built = buildAwaitingAnswerReply(params.resolution, params.memory);
  const style = readStyleProfile({
    emojiStyle: built.memory.userPreferences.emojiStyle,
  });
  const flow = mergeConversationFlow(params.flow, {
    ...built.flowPatch,
    generationBlocked: params.flow.generationBlocked,
  });
  return {
    resultType: "conversation",
    operation: "memory_update",
    assistantReply: maybeDecorateChatReply(built.reply, style.emojiStyle),
    suggestions: [],
    memory: built.memory,
    storyId: params.storyId,
    draft: null,
    showReview: false,
    actionType: "none",
    actionOk: true,
    requiresConfirmation: false,
    outputMode: "structured",
    durationMs: 0,
    retryCount: 0,
    conversationFlow: flow,
  };
}
