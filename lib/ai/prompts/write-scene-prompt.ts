import type { CompactStoryContext } from "@/lib/ai/context/story-context-builder";

export function buildWriteScenePrompt(ctx: CompactStoryContext): {
  system: string;
  prompt: string;
} {
  const wordLine = ctx.wordTarget
    ? `Target length: about ${ctx.wordTarget.min ?? "?"}–${ctx.wordTarget.max ?? "?"} words.`
    : "Target length: a short scene (roughly 300–600 words) unless the user specified otherwise.";

  const chars = ctx.characters
    .map((c) => {
      const bits = [
        c.name,
        c.role ? `(${c.role})` : "",
        c.personality.length ? `personality: ${c.personality.join(", ")}` : "",
        c.avoid.length ? `avoid: ${c.avoid.join(", ")}` : "",
        c.notes.length ? `notes: ${c.notes.join("; ")}` : "",
      ].filter(Boolean);
      return `- ${bits.join(" — ")}`;
    })
    .join("\n");

  const rels = ctx.relationships
    .map(
      (r) =>
        `- ${r.from} → ${r.to}: ${r.type}${r.notes ? ` (${r.notes})` : ""}`
    )
    .join("\n");

  const rules = ctx.writingRules.map((r) => `- ${r}`).join("\n");
  const avoid = [
    ...ctx.preferences.avoid,
    ...ctx.characters.flatMap((c) => c.avoid.map((a) => `${c.name}: ${a}`)),
  ];

  const system = `You are StoryVerse’s fiction writer.
Write only the requested scene as plain prose.
Follow all established story facts.
Do not ask metadata questions (title, genre, POV, audience, etc.).
Do not explain your process.
Do not return JSON, markdown fences, or tool output.
Do not add major characters who are not in context unless the scene truly requires a brief unnamed extra.
Respect negative constraints.
Mirror the requested language / dialogue style.
This is an unsaved sample scene / draft, not a claim that a Story DB record was created.`;

  const prompt = `STORY CONTEXT
Title/concept: ${ctx.title || ctx.concept || "Untitled (temporary)"}
Genre: ${ctx.genre.join(", ") || "unspecified"}
Tone: ${ctx.tone.join(", ") || "derive from request"}
Setting: ${ctx.setting || "derive carefully from request"}
Plot notes: ${ctx.plot || "none"}
Language: ${ctx.languageHint}
POV: ${ctx.pov || "third person (unless request says otherwise)"}
Pacing: ${ctx.pacing || (ctx.preferences.slowBurn ? "slow burn" : "balanced")}
Writing style: ${ctx.writingStyle || "natural serialized fiction"}

Characters:
${chars || "- (use only names/roles implied by the user request)"}

Relationships:
${rels || "- none stored; infer carefully from the request only"}

Writing rules:
${rules || "- none stored"}

Negative constraints / avoid:
${avoid.length ? avoid.map((a) => `- ${a}`).join("\n") : "- none"}

Preferences:
- dialogue language: ${ctx.preferences.dialogueLanguage || ctx.languageHint}
- uppercase for loud dialogue: ${ctx.preferences.uppercaseForLoudDialogue ? "yes" : "no"}

${wordLine}

USER REQUEST:
${ctx.userInstruction}

OUTPUT REQUIREMENTS:
- Prose only
- ${wordLine}
- Stay faithful to named characters and roles
- No JSON
- Optional first line format: TITLE: <short scene title> then a line with --- then the body
Write the scene now.`;

  return { system, prompt };
}
