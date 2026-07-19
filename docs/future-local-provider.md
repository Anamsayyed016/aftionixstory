# Future local / self-hosted provider (NOT runtime)

StoryVerse production currently supports **only**:

- `AI_PROVIDER=openai`
- `AI_PROVIDER=gemini`

A local/OpenAI-compatible provider was scaffolded earlier and **removed from runtime**.
Do not set `AI_PROVIDER=local` — startup/env validation will fail.

## Why it was deferred

- Local creative quality (especially Hinglish + multi-genre) is not production-ready
- No capacity / failover policy yet
- Risk of silent template fallbacks when local inference fails

## Future design notes (when revisiting)

Recommended split if reintroduced behind an explicit feature flag:

| Profile | Role |
|---------|------|
| Small local model | Optional intent assist, preference extraction, summaries |
| Larger local model | Scenes, episodes, revisions |
| Deterministic routers | Keep in code even with local models |

Expected OpenAI-compatible surface:

```
LOCAL_AI_BASE_URL=http://127.0.0.1:8000/v1
LOCAL_AI_API_KEY=
LOCAL_AI_AGENT_MODEL=...
LOCAL_AI_CREATIVE_MODEL=...
LOCAL_AI_SUMMARY_MODEL=...
```

Before enabling in production:

1. Stable local creative quality on Hinglish + multi-genre eval set
2. Consent-based approved dataset sized for fine-tune (optional)
3. GPU capacity planning
4. Health checks + explicit failover policy (never silent fake answers)
5. Privacy review of any exported training examples

## Training clarification

Runtime memory ≠ model training. Feedback examples are opt-in only and do not retrain OpenAI/Gemini.
