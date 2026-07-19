# Local / self-hosted model readiness (StoryVerse)

This is a readiness report — not a training run. OpenAI and Gemini remain supported.

## Current prompt tasks

| Operation | Output | Model profile |
|-----------|--------|---------------|
| conversational_chat / brainstorm / memory_update | structured JSON or fixed reply | agent |
| write_scene / revise_draft / start_story | plain-text prose | creative |
| generate_episode / continue_episode | prose via Phase C or conversational draft | creative |
| summarize | short text | summary |

## Structured schemas

- `StoryAgentTurnResult` (intent, memoryPatch, action, suggestions)
- Language prefs: narration / dialogue / script
- Style prefs: formality, emojiStyle, pacing, avoidFormalHindi

## Context & output sizes (approx)

- Agent turns: ~1–2k input tokens, ≤1.6k output
- Creative scenes: ~2–6k input (with draft), target 300–800 words (~1–2k tokens); maxOutputTokens raised to 8192 to reduce truncation
- Episodes: larger continuity context via Phase C loader

## Languages & genres

- English, Hindi, Hinglish (Latin / Devanagari)
- Any genre via dynamic memory — no hardcoded characters/genres

## Concurrency & latency targets

- Soft per-user rate limit (env `AI_RATE_LIMIT_*`)
- Greeting/fixed-reply path: no provider call (sub-100ms)
- Creative: 5–30s depending on provider

## Recommended local split

- Small local model: intent assist (optional), preference extraction, summaries
- Larger local model: scenes, episodes, revisions
- Keep deterministic routing in code even with local models

## Config

```
AI_PROVIDER=local
LOCAL_AI_BASE_URL=http://127.0.0.1:8000/v1
LOCAL_AI_API_KEY=
LOCAL_AI_AGENT_MODEL=...
LOCAL_AI_CREATIVE_MODEL=...
LOCAL_AI_SUMMARY_MODEL=...
```

OpenAI-compatible `/chat/completions` expected (vLLM, Ollama gateway, llama.cpp server, etc.).

## Before removing cloud APIs

1. Stable local creative quality on Hinglish + multi-genre eval set
2. Consent-based approved dataset (`.data/feedback-examples.jsonl`) sized for fine-tune
3. Capacity planning (GPU VRAM, concurrent users)
4. Health checks + failover policy
5. Privacy review of any exported training examples

## Training clarification

Runtime memory ≠ model training. Feedback examples are opt-in only and do not retrain OpenAI/Gemini.
