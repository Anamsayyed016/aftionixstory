/**
 * Serialize DynamicContext for prompts (Phase D).
 * Concise structured text — not raw Conversation.state JSON.
 */

import type { DynamicContext } from "@/lib/context-builder/v2/schema";

function section(title: string, body: string | null | undefined): string {
  if (!body || !body.trim()) return "";
  return `${title}\n${body.trim()}\n`;
}

export function serializeDynamicContextForPrompt(
  ctx: DynamicContext
): string {
  const parts: string[] = [];

  parts.push(
    section(
      "STORY",
      [
        ctx.story.title ? `title: ${ctx.story.title}` : "",
        ctx.story.concept ? `concept: ${ctx.story.concept}` : "",
        ctx.story.genre?.length ? `genre: ${ctx.story.genre.join(", ")}` : "",
        ctx.story.tone?.length ? `tone: ${ctx.story.tone.join(", ")}` : "",
        ctx.story.themes?.length ? `themes: ${ctx.story.themes.join(", ")}` : "",
        ctx.story.setting ? `setting: ${ctx.story.setting}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    )
  );

  if (ctx.characters.length) {
    parts.push(
      section(
        "CHARACTERS",
        ctx.characters
          .map((c) => {
            const bits = [
              c.name,
              c.role ? `(${c.role})` : "",
              c.personalityTraits.length
                ? `traits: ${c.personalityTraits.join(", ")}`
                : "",
              c.currentState ? `state: ${c.currentState}` : "",
              c.avoid.length ? `avoid: ${c.avoid.join(", ")}` : "",
            ].filter(Boolean);
            return `- ${bits.join(" | ")}`;
          })
          .join("\n")
      )
    );
  }

  if (ctx.relationships.length) {
    parts.push(
      section(
        "RELATIONSHIPS",
        ctx.relationships
          .map(
            (r) =>
              `- ${r.fromName || r.fromCharacterId} → ${r.toName || r.toCharacterId}: ${r.type}${r.status ? ` [${r.status}]` : ""}`
          )
          .join("\n")
      )
    );
  }

  if (ctx.continuity && Object.keys(ctx.continuity).length) {
    const lines = Object.entries(ctx.continuity)
      .filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && !v.length))
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
    parts.push(section("CURRENT CONTINUITY", lines.join("\n")));
  }

  if (ctx.locations.length) {
    parts.push(
      section(
        "LOCATIONS",
        ctx.locations
          .map((l) => `- ${l.name}${l.mood ? ` (${l.mood})` : ""}`)
          .join("\n")
      )
    );
  }

  if (ctx.events.length) {
    parts.push(
      section(
        "RELEVANT EVENTS",
        ctx.events
          .map(
            (e) =>
              `- ${e.title}${e.episodeNumber != null ? ` [ep ${e.episodeNumber}]` : ""}`
          )
          .join("\n")
      )
    );
  }

  if (ctx.openThreads.length) {
    parts.push(
      section(
        "OPEN THREADS",
        ctx.openThreads
          .map((t) => `- ${t.title}${t.priority ? ` (${t.priority})` : ""}`)
          .join("\n")
      )
    );
  }

  if (ctx.knowledge?.authorKnowledge?.length) {
    parts.push(
      section(
        "AUTHOR KNOWLEDGE (do not leak as character POV)",
        ctx.knowledge.authorKnowledge.map((s) => `- ${s}`).join("\n")
      )
    );
  }

  if (ctx.knowledge?.characterKnowledge) {
    const lines = Object.entries(ctx.knowledge.characterKnowledge)
      .filter(([, v]) => v.length)
      .map(([id, secrets]) => `- ${id}: ${secrets.join("; ")}`);
    if (lines.length) {
      parts.push(section("CHARACTER KNOWLEDGE", lines.join("\n")));
    }
  }

  if (ctx.writingRules.length) {
    parts.push(
      section(
        "WRITING RULES",
        ctx.writingRules.map((r) => `- [${r.priority || "normal"}] ${r.rule}`).join("\n")
      )
    );
  }

  if (ctx.preferences && Object.keys(ctx.preferences).length) {
    const lines = Object.entries(ctx.preferences)
      .filter(([, v]) => v != null && v !== "" && !(Array.isArray(v) && !(v as unknown[]).length))
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
    parts.push(section("USER PREFERENCES", lines.join("\n")));
  }

  if (ctx.recentConversation.length) {
    parts.push(
      section(
        "RECENT CONVERSATION",
        ctx.recentConversation
          .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
          .join("\n")
      )
    );
  }

  if (ctx.latestDraft?.content) {
    parts.push(
      section(
        `LATEST DRAFT${ctx.latestDraft.truncated ? " (truncated)" : ""}`,
        ctx.latestDraft.content
      )
    );
  }

  if (ctx.recentSummary) {
    parts.push(section("RECENT SUMMARY", ctx.recentSummary));
  }

  return parts.filter(Boolean).join("\n").trim();
}

type SerializeOpts = {
  includeDraft?: boolean;
  includeEvents?: boolean;
  includeThreads?: boolean;
  includeRules?: boolean;
  includeRecent?: boolean;
  includeKnowledge?: boolean;
  includeLocations?: boolean;
  includeRelationships?: boolean;
  includeCharacters?: boolean;
  includeStory?: boolean;
  includeContinuity?: boolean;
  includePreferences?: boolean;
};

/**
 * Filtered serializers compose from the canonical serializer by
 * projecting a slim DynamicContext (no re-selection).
 */
function projectContext(
  ctx: DynamicContext,
  opts: SerializeOpts
): DynamicContext {
  return {
    ...ctx,
    story: opts.includeStory === false ? { genre: [], tone: [], themes: [] } : ctx.story,
    characters: opts.includeCharacters === false ? [] : ctx.characters,
    relationships:
      opts.includeRelationships === false ? [] : ctx.relationships,
    locations: opts.includeLocations === false ? [] : ctx.locations,
    events: opts.includeEvents === false ? [] : ctx.events,
    openThreads: opts.includeThreads === false ? [] : ctx.openThreads,
    writingRules: opts.includeRules === false ? [] : ctx.writingRules,
    preferences:
      opts.includePreferences === false ? {} : ctx.preferences,
    continuity: opts.includeContinuity === false ? {} : ctx.continuity,
    recentConversation:
      opts.includeRecent === false ? [] : ctx.recentConversation,
    latestDraft: opts.includeDraft === false ? null : ctx.latestDraft,
    knowledge:
      opts.includeKnowledge === false
        ? { authorKnowledge: [], characterKnowledge: {} }
        : ctx.knowledge,
    secrets: opts.includeKnowledge === false ? [] : ctx.secrets,
  };
}

export function serializeCreativeContext(ctx: DynamicContext): string {
  return serializeDynamicContextForPrompt(
    projectContext(ctx, {
      includeDraft: false,
      includeKnowledge: true,
    })
  );
}

export function serializeRevisionContext(ctx: DynamicContext): string {
  return serializeDynamicContextForPrompt(
    projectContext(ctx, {
      includeDraft: true,
      includeEvents: true,
      includeThreads: false,
      includeKnowledge: false,
    })
  );
}

export function serializeCharacterQuestionContext(
  ctx: DynamicContext
): string {
  return serializeDynamicContextForPrompt(
    projectContext(ctx, {
      includeDraft: false,
      includeRecent: false,
      includeKnowledge: true,
      includeLocations: false,
    })
  );
}

export function serializeKnowledgeContext(ctx: DynamicContext): string {
  return serializeDynamicContextForPrompt(
    projectContext(ctx, {
      includeDraft: false,
      includeKnowledge: true,
      includeRecent: true,
    })
  );
}

export function serializePreferenceContext(ctx: DynamicContext): string {
  return serializeDynamicContextForPrompt(
    projectContext(ctx, {
      includeStory: false,
      includeCharacters: false,
      includeRelationships: false,
      includeLocations: false,
      includeEvents: false,
      includeThreads: false,
      includeDraft: false,
      includeKnowledge: false,
      includeContinuity: false,
      includeRules: true,
      includePreferences: true,
      includeRecent: true,
    })
  );
}
