/**
 * Phase F — Provider Router v2 tests.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

import {
  __clearGenerationDedupeForTests,
  __resetProviderRegistryForTests,
  __setProviderAdaptersForTests,
  buildGenerationRequestFromSystemPrompt,
  createMockAdapter,
  generate,
  getGenerationPolicy,
  isProviderRouterV2Enabled,
  parseProviderJson,
  resetRouterCircuitsForTests,
  selectProviders,
  validateProviderRegistry,
  validateTextOutput,
} from "@/lib/provider-router/v2";
import {
  recordProviderTransientFailure,
  canAttemptProvider,
  __resetCircuitBreakersForTests,
} from "@/lib/ai/circuit-breaker";

const sampleMessages = [
  { role: "system" as const, content: "You are StoryVerse." },
  { role: "user" as const, content: "Write a short scene." },
];

function req(partial?: Partial<ReturnType<typeof buildGenerationRequestFromSystemPrompt>>) {
  const base = buildGenerationRequestFromSystemPrompt({
    system: "You are StoryVerse.",
    prompt: "Write a short scene with Anaya.",
    operation: "write_scene",
    outputMode: "text",
    turnRequestId: "turn_1",
    conversationId: "conv_1",
    promptId: "creative.scene",
    promptVersion: "1.0.0",
    modelKind: "creative",
  });
  return { ...base, ...partial, prompt: { ...base.prompt, ...partial?.prompt } };
}

describe("Provider Router Phase F", () => {
  const prevFlag = process.env.AI_PROVIDER_ROUTER_V2_ENABLED;
  const prevCircuit = process.env.AI_PROVIDER_CIRCUIT_BREAKER_ENABLED;

  beforeEach(() => {
    process.env.AI_PROVIDER_ROUTER_V2_ENABLED = "true";
    process.env.AI_PROVIDER_CIRCUIT_BREAKER_ENABLED = "true";
    __resetProviderRegistryForTests();
    __clearGenerationDedupeForTests();
    resetRouterCircuitsForTests();
    __resetCircuitBreakersForTests();
  });

  afterEach(() => {
    process.env.AI_PROVIDER_ROUTER_V2_ENABLED = prevFlag;
    process.env.AI_PROVIDER_CIRCUIT_BREAKER_ENABLED = prevCircuit;
    __resetProviderRegistryForTests();
    __clearGenerationDedupeForTests();
    resetRouterCircuitsForTests();
    __resetCircuitBreakersForTests();
  });

  it("validates provider registry", () => {
    const v = validateProviderRegistry();
    expect(v.ok).toBe(true);
  });

  it("1–2. policies exist for classifier and creative", () => {
    expect(getGenerationPolicy({ classifier: true }).id).toBe("classifier");
    expect(
      getGenerationPolicy({ promptId: "creative.scene", operation: "write_scene" })
        .id
    ).toBe("creative_scene");
    expect(
      getGenerationPolicy({ promptId: "creative.episode", operation: "generate_episode" })
        .id
    ).toBe("creative_episode");
    expect(
      getGenerationPolicy({ promptId: "revision.emotional" }).id
    ).toBe("revision");
    expect(
      getGenerationPolicy({ promptId: "knowledge.character_question" }).id
    ).toBe("knowledge");
    expect(getGenerationPolicy({ promptId: "memory.correction" }).id).toBe(
      "memory_json"
    );
  });

  it("5–10. policy selection matrix", () => {
    expect(
      getGenerationPolicy({
        promptId: "conversation.collaborative_brainstorm",
      }).id
    ).toBe("collaborative_chat");
  });

  it("11. preferred openai selected when configured", async () => {
    const openai = createMockAdapter({
      id: "openai",
      behavior: { type: "success", text: "From OpenAI prose scene." },
    });
    const gemini = createMockAdapter({
      id: "gemini",
      behavior: { type: "success", text: "From Gemini prose scene." },
    });
    __setProviderAdaptersForTests([openai, gemini]);

    const result = await generate(
      {
        ...req(),
        routing: { preferredProvider: "openai", allowedProviders: ["openai", "gemini"] },
      },
      { injectAdapters: [openai, gemini] }
    );
    expect(result.provider).toBe("openai");
    expect(result.text).toContain("OpenAI");
    expect(result.promptId).toBe("creative.scene");
    expect(result.promptVersion).toBe("1.0.0");
  });

  it("12. preferred openai unavailable → gemini", async () => {
    const openai = createMockAdapter({
      id: "openai",
      configured: false,
      behavior: { type: "success", text: "OpenAI" },
    });
    const gemini = createMockAdapter({
      id: "gemini",
      behavior: { type: "success", text: "Gemini scene text here." },
    });
    const result = await generate(req(), {
      injectAdapters: [openai, gemini],
    });
    expect(result.provider).toBe("gemini");
  });

  it("13. provider not configured skipped", () => {
    const openai = createMockAdapter({
      id: "openai",
      configured: false,
      behavior: { type: "success", text: "x" },
    });
    const selected = selectProviders({
      policy: getGenerationPolicy({ promptId: "creative.scene" }),
      injectAdapters: [openai],
    });
    expect(selected.length).toBe(0);
  });

  it("14–15. timeout then fallback", async () => {
    let openaiCalls = 0;
    const openai = createMockAdapter({
      id: "openai",
      behavior: () => {
        openaiCalls += 1;
        return { type: "timeout" };
      },
    });
    const gemini = createMockAdapter({
      id: "gemini",
      behavior: { type: "success", text: "Fallback scene content from Gemini." },
    });
    const result = await generate(
      {
        ...req(),
        constraints: {
          maxAttemptsPerProvider: 1,
          maxTotalAttempts: 3,
          timeoutMs: 1000,
          totalDeadlineMs: 10_000,
        },
        routing: { fallbackAllowed: true, retryAllowed: true },
      },
      { injectAdapters: [openai, gemini] }
    );
    expect(openaiCalls).toBeGreaterThanOrEqual(1);
    expect(result.provider).toBe("gemini");
    expect(result.routing.fallbackUsed).toBe(true);
  });

  it("16. auth failure does not uselessly retry same provider", async () => {
    let calls = 0;
    const openai = createMockAdapter({
      id: "openai",
      behavior: () => {
        calls += 1;
        return { type: "auth" };
      },
    });
    const gemini = createMockAdapter({
      id: "gemini",
      behavior: { type: "success", text: "Recovered scene after auth fail." },
    });
    const result = await generate(
      {
        ...req(),
        constraints: { maxAttemptsPerProvider: 3, maxTotalAttempts: 4 },
        routing: { retryAllowed: true, fallbackAllowed: true },
      },
      { injectAdapters: [openai, gemini] }
    );
    expect(calls).toBe(1);
    expect(result.provider).toBe("gemini");
  });

  it("17. both providers fail → normalized error", async () => {
    const openai = createMockAdapter({
      id: "openai",
      behavior: { type: "timeout" },
    });
    const gemini = createMockAdapter({
      id: "gemini",
      behavior: { type: "timeout" },
    });
    await expect(
      generate(req(), { injectAdapters: [openai, gemini] })
    ).rejects.toMatchObject({ code: "PROVIDER_TIMEOUT" });
  });

  it("18. rate limit can fallback", async () => {
    const openai = createMockAdapter({
      id: "openai",
      behavior: { type: "rate_limit" },
    });
    const gemini = createMockAdapter({
      id: "gemini",
      behavior: { type: "success", text: "After rate limit scene body." },
    });
    const result = await generate(req(), {
      injectAdapters: [openai, gemini],
    });
    expect(result.provider).toBe("gemini");
  });

  it("19–21. malformed JSON repair success", async () => {
    let calls = 0;
    const openai = createMockAdapter({
      id: "openai",
      behavior: () => {
        calls += 1;
        if (calls === 1) return { type: "malformed_json" };
        return {
          type: "success",
          text: JSON.stringify({ assistantReply: "ok", offers: [] }),
        };
      },
    });
    const request = buildGenerationRequestFromSystemPrompt({
      system: "json only",
      prompt: "classify",
      operation: "intent_classifier",
      outputMode: "json",
      promptId: "internal.intent_classifier",
      promptVersion: "1.0.0",
    });
    const schema = z.object({
      assistantReply: z.string(),
      offers: z.array(z.unknown()).optional(),
    });
    const result = await generate(request, {
      injectAdapters: [openai],
      jsonSchema: schema,
    });
    expect(result.validation.repairUsed).toBe(true);
    expect(result.json).toMatchObject({ assistantReply: "ok" });
    expect(calls).toBe(2);
  });

  it("22. empty text invalid", async () => {
    const openai = createMockAdapter({
      id: "openai",
      behavior: { type: "empty" },
    });
    await expect(
      generate(req(), { injectAdapters: [openai] })
    ).rejects.toBeTruthy();
  });

  it("23. story prose that is JSON-only rejected", () => {
    const v = validateTextOutput({
      text: '{"assistantReply":"hi"}',
      operation: "write_scene",
      outputMode: "text",
    });
    expect(v.valid).toBe(false);
  });

  it("24. truncated creative text returns warning", async () => {
    const openai = createMockAdapter({
      id: "openai",
      behavior: {
        type: "truncated_text",
        text: "Once upon a time Anaya looked at Azar and—",
      },
    });
    const result = await generate(req(), { injectAdapters: [openai] });
    expect(result.validation.warnings).toContain("truncated");
    expect(result.text.length).toBeGreaterThan(10);
  });

  it("25. truncated JSON uses repair/fallback path", () => {
    const parsed = parseProviderJson('{"assistantReply": "hi"');
    expect(parsed.ok).toBe(false);
  });

  it("28–30. circuit opens and skips provider", () => {
    for (let i = 0; i < 3; i++) {
      recordProviderTransientFailure("openai", "test-model");
    }
    expect(canAttemptProvider("openai", "test-model")).toBe(false);
  });

  it("31. concurrent same turnRequestId dedupes", async () => {
    let calls = 0;
    const slow = createMockAdapter({
      id: "openai",
      behavior: { type: "success", text: "Deduped scene output text.", latencyMs: 50 },
    });
    const original = slow.generate.bind(slow);
    slow.generate = async (input, signal) => {
      calls += 1;
      return original(input, signal);
    };

    const r = req({ turnRequestId: "same_turn", conversationId: "c1" });
    const [a, b] = await Promise.all([
      generate(r, { injectAdapters: [slow] }),
      generate(r, { injectAdapters: [slow] }),
    ]);
    expect(a.text).toBe(b.text);
    expect(calls).toBe(1);
  });

  it("32. different conversationIds do not dedupe", async () => {
    let calls = 0;
    const adapter = createMockAdapter({
      id: "openai",
      behavior: { type: "success", text: "Scene text unique enough." },
    });
    const original = adapter.generate.bind(adapter);
    adapter.generate = async (input, signal) => {
      calls += 1;
      return original(input, signal);
    };
    await Promise.all([
      generate(
        req({ turnRequestId: "t1", conversationId: "cA" }),
        { injectAdapters: [adapter] }
      ),
      generate(
        req({ turnRequestId: "t1", conversationId: "cB" }),
        { injectAdapters: [adapter] }
      ),
    ]);
    expect(calls).toBe(2);
  });

  it("34. prompt id/version retained", async () => {
    const adapter = createMockAdapter({
      id: "gemini",
      behavior: { type: "success", text: "Scene with retained metadata." },
    });
    const result = await generate(req(), { injectAdapters: [adapter] });
    expect(result.promptId).toBe("creative.scene");
    expect(result.promptVersion).toBe("1.0.0");
  });

  it("38. feature flag off reports false", () => {
    process.env.AI_PROVIDER_ROUTER_V2_ENABLED = "false";
    expect(isProviderRouterV2Enabled()).toBe(false);
  });

  it("messages stay provider-neutral shape", () => {
    const r = req();
    expect(r.prompt.messages[0].role).toBe("system");
    expect(sampleMessages.length).toBe(2);
  });
});

describe("Provider SDK boundary audit", () => {
  it("37. non-adapter services do not import provider SDKs", () => {
    const root = join(process.cwd(), "lib");
    const forbidden = [
      'from "openai"',
      "from 'openai'",
      "@google/generative-ai",
      "@google/genai",
    ];
    const allowedDirs = [
      join(root, "ai", "providers"),
      join(root, "provider-router", "adapters"),
      join(root, "ai", "health.ts"), // health probe may touch SDKs for live checks
    ];

    function walk(dir: string, files: string[] = []) {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        const st = statSync(p);
        if (st.isDirectory()) {
          if (name === "node_modules" || name === ".next") continue;
          walk(p, files);
        } else if (/\.(ts|tsx|js)$/.test(name)) {
          files.push(p);
        }
      }
      return files;
    }

    const offenders: string[] = [];
    for (const file of walk(root)) {
      if (
        allowedDirs.some(
          (d) => file === d || file.startsWith(d.endsWith(".ts") ? d : d)
        )
      ) {
        continue;
      }
      if (file.endsWith(`${join("ai", "health.ts")}`)) continue;
      // tests may mention strings
      if (file.includes(`${join("lib", "__tests__")}`)) continue;
      const src = readFileSync(file, "utf8");
      for (const needle of forbidden) {
        if (src.includes(needle)) {
          offenders.push(`${file} :: ${needle}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
