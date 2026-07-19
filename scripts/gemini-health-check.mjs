#!/usr/bin/env node
/**
 * Explicit AI provider health probe (CLI).
 * Never prints API keys.
 *
 * Usage:
 *   node scripts/gemini-health-check.mjs
 *   AI_PROVIDER=openai node scripts/gemini-health-check.mjs
 *   node scripts/gemini-health-check.mjs gpt-5-mini
 */

const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
const geminiKey = process.env.GEMINI_API_KEY || "";
const openaiKey = process.env.OPENAI_API_KEY || "";
const storyModel =
  provider === "openai"
    ? process.env.OPENAI_STORY_MODEL || "gpt-5-mini"
    : process.env.GEMINI_STORY_MODEL || "gemini-3.1-flash-lite";
const summaryModel =
  provider === "openai"
    ? process.env.OPENAI_SUMMARY_MODEL || "gpt-5-nano"
    : process.env.GEMINI_SUMMARY_MODEL || storyModel;
const model = process.argv[2] || storyModel;
const key = provider === "openai" ? openaiKey : geminiKey;

function classify(status, body) {
  const lower = String(body || "").toLowerCase();
  if (status === 200) return "ok";
  if (
    lower.includes("api key") ||
    lower.includes("invalid_api_key") ||
    status === 401
  ) {
    return "auth_failed";
  }
  if (
    status === 404 ||
    lower.includes("model_not_found") ||
    lower.includes("model not found")
  ) {
    return "model_not_found";
  }
  if (
    lower.includes("quota") ||
    lower.includes("insufficient_quota") ||
    /limit:\s*0\b/.test(lower) ||
    lower.includes("billing")
  ) {
    return "quota_exceeded";
  }
  if (
    status === 429 ||
    lower.includes("rate limit") ||
    lower.includes("rate_limit") ||
    lower.includes("too many requests")
  ) {
    return "rate_limited";
  }
  if (status === 408 || lower.includes("timeout")) return "timeout";
  if (lower.includes("fetch failed") || lower.includes("econnreset")) {
    return "network_error";
  }
  return "provider_error";
}

async function probeGemini() {
  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) +
    ":generateContent?key=" +
    encodeURIComponent(key);
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: "Reply with OK only." }] }],
      generationConfig: { maxOutputTokens: 8, temperature: 0 },
    }),
  });
}

async function probeOpenAI() {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with OK only." }],
      max_completion_tokens: 16,
      temperature: 0,
    }),
  });
}

async function main() {
  const started = Date.now();
  const base = {
    provider,
    storyModel,
    summaryModel,
    probedModel: model,
    keyPresent: Boolean(key.trim()),
    timestamp: new Date().toISOString(),
  };

  if (provider === "mock") {
    console.log(
      JSON.stringify({
        ok: true,
        status: "ok",
        ...base,
        durationMs: Date.now() - started,
        message: "Mock provider; probe skipped.",
      })
    );
    return;
  }

  if (provider !== "gemini" && provider !== "openai") {
    console.log(
      JSON.stringify({
        ok: false,
        status: "provider_error",
        ...base,
        durationMs: Date.now() - started,
        message: `Unsupported AI_PROVIDER: ${provider}`,
      })
    );
    process.exitCode = 1;
    return;
  }

  if (!key.trim()) {
    console.log(
      JSON.stringify({
        ok: false,
        status: "not_configured",
        ...base,
        durationMs: Date.now() - started,
        message:
          provider === "openai"
            ? "OPENAI_API_KEY is missing."
            : "GEMINI_API_KEY is missing.",
      })
    );
    process.exitCode = 1;
    return;
  }

  try {
    const response =
      provider === "openai" ? await probeOpenAI() : await probeGemini();
    const body = await response.text();
    const status = classify(response.status, body);
    const ok = response.ok && status === "ok";
    console.log(
      JSON.stringify({
        ok,
        status,
        httpStatus: response.status,
        durationMs: Date.now() - started,
        ...base,
        message: ok
          ? `${provider} health check succeeded.`
          : `${provider} health check failed.`,
      })
    );
    if (!ok) process.exitCode = 1;
  } catch (error) {
    console.log(
      JSON.stringify({
        ok: false,
        status: "network_error",
        durationMs: Date.now() - started,
        ...base,
        message: String(error && error.message ? error.message : error).slice(
          0,
          200
        ),
      })
    );
    process.exitCode = 1;
  }
}

main();
