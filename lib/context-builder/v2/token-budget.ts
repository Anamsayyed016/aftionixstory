/**
 * Approximate token estimation and deterministic pruning (Phase D).
 */

import type { DynamicContext } from "@/lib/context-builder/v2/schema";

/** Rough chars→tokens (~4 chars/token). */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export function estimateContextTokens(ctx: DynamicContext): {
  total: number;
  sections: Record<string, number>;
} {
  const sections: Record<string, number> = {};
  const add = (key: string, value: unknown) => {
    const n = estimateTokens(
      typeof value === "string" ? value : JSON.stringify(value ?? "")
    );
    sections[key] = (sections[key] || 0) + n;
  };

  add("story", ctx.story);
  add("characters", ctx.characters);
  add("relationships", ctx.relationships);
  add("locations", ctx.locations);
  add("objects", ctx.objects);
  add("events", ctx.events);
  add("timeline", ctx.timeline);
  add("openThreads", ctx.openThreads);
  add("secrets", ctx.secrets);
  add("promises", ctx.promises);
  add("worldRules", ctx.worldRules);
  add("writingRules", ctx.writingRules);
  add("preferences", ctx.preferences);
  add("continuity", ctx.continuity);
  add("recentConversation", ctx.recentConversation);
  add("latestDraft", ctx.latestDraft);
  add("recentSummary", ctx.recentSummary);
  add("knowledge", ctx.knowledge);

  const total = Object.values(sections).reduce((a, b) => a + b, 0);
  return { total, sections };
}

/**
 * Prune low-value sections until under budget.
 * Never removes: preferences continuity high-priority writing rules, latest user msg, draft ending when present.
 */
export function pruneToBudget(
  ctx: DynamicContext,
  maxTokens: number,
  protectedRuleIds: Set<string>
): DynamicContext {
  let current = { ...ctx, retrieval: { ...ctx.retrieval } };
  let { total, sections } = estimateContextTokens(current);
  current.retrieval.sectionTokens = sections;
  current.retrieval.estimatedTokens = total;

  if (total <= maxTokens) return current;

  const steps: Array<() => void> = [
    () => {
      current = { ...current, objects: [] };
    },
    () => {
      current = {
        ...current,
        locations: current.locations.slice(0, 1),
      };
    },
    () => {
      current = {
        ...current,
        events: current.events.slice(0, Math.max(1, Math.floor(current.events.length / 2))),
      };
    },
    () => {
      current = {
        ...current,
        openThreads: current.openThreads.filter(
          (t) => t.priority === "high" || t.priority === "critical"
        ),
      };
    },
    () => {
      current = {
        ...current,
        writingRules: current.writingRules.filter(
          (r) =>
            protectedRuleIds.has(r.id) ||
            r.priority === "critical" ||
            r.priority === "high" ||
            r.priority === "important"
        ),
      };
    },
    () => {
      const keep = current.recentConversation.filter(
        (m) =>
          m.reason === "latest user message" ||
          m.reason === "awaiting question"
      );
      current = {
        ...current,
        recentConversation: keep.length
          ? keep
          : current.recentConversation.slice(0, 2),
      };
    },
    () => {
      current = {
        ...current,
        relationships: current.relationships.slice(0, 4),
      };
    },
    () => {
      if (current.characters.length > 2) {
        current = {
          ...current,
          characters: current.characters.slice(0, 2),
        };
      }
    },
    () => {
      // Shrink draft aggressively while keeping ending
      if (current.latestDraft?.content && current.latestDraft.content.length > 800) {
        const c = current.latestDraft.content;
        current = {
          ...current,
          latestDraft: {
            ...current.latestDraft,
            content: `…[truncated]…\n\n${c.slice(-600)}`,
            truncated: true,
            strategy: "ending",
          },
          retrieval: {
            ...current.retrieval,
            truncatedDraft: true,
          },
        };
      }
    },
    () => {
      if (current.latestDraft?.content && current.latestDraft.content.length > 400) {
        const c = current.latestDraft.content;
        current = {
          ...current,
          latestDraft: {
            ...current.latestDraft,
            content: c.slice(-300),
            truncated: true,
            strategy: "ending",
          },
        };
      }
    },
  ];

  for (const step of steps) {
    step();
    ({ total, sections } = estimateContextTokens(current));
    current.retrieval = {
      ...current.retrieval,
      sectionTokens: sections,
      estimatedTokens: total,
      truncated: true,
    };
    if (total <= maxTokens) break;
  }

  return current;
}
