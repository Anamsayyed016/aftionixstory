"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import {
  createStoryAction,
  replaceStoryGraphAction,
  saveDraftStoryAction,
} from "@/app/actions/stories";
import {
  DEFAULT_WRITING_RULES,
  EPISODE_LENGTH_OPTIONS,
  GENRE_OPTIONS,
  LANGUAGE_OPTIONS,
  PACING_OPTIONS,
  POV_OPTIONS,
  RELATIONSHIP_TYPE_SUGGESTIONS,
  WRITING_STYLE_OPTIONS,
} from "@/lib/story-options";

export type WizardCharacter = {
  clientId: string;
  name: string;
  age: string;
  gender: string;
  role: string;
  personality: string;
  appearance: string;
  background: string;
  speakingStyle: string;
  secrets: string;
  emotionalState: string;
};

export type WizardRelationship = {
  clientId: string;
  sourceClientId: string;
  targetClientId: string;
  relationshipType: string;
  description: string;
  currentStatus: string;
  emotionalDynamic: string;
};

export type WizardRule = {
  clientId: string;
  rule: string;
  category: string;
  priority: number;
  isActive: boolean;
};

export type WizardState = {
  title: string;
  description: string;
  genre: string;
  language: string;
  storyType: string;
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  writingStyle: string;
  dialogueStyle: string;
  pointOfView: string;
  episodeLength: string;
  tone: string;
  romanceLevel: string;
  pacing: string;
  customInstructions: string;
  setting: string;
  timePeriod: string;
  mainConflict: string;
  initialPlot: string;
  worldRules: string;
  contentBoundaries: string;
  characters: WizardCharacter[];
  relationships: WizardRelationship[];
  writingRules: WizardRule[];
};

function uid() {
  return `tmp_${Math.random().toString(36).slice(2, 10)}`;
}

function emptyCharacter(): WizardCharacter {
  return {
    clientId: uid(),
    name: "",
    age: "",
    gender: "",
    role: "Protagonist",
    personality: "",
    appearance: "",
    background: "",
    speakingStyle: "",
    secrets: "",
    emotionalState: "",
  };
}

const STEPS = [
  "Basics",
  "Writing",
  "World",
  "Characters",
  "Links & Rules",
  "Review",
] as const;

const fieldClass =
  "h-11 w-full rounded-md border border-border bg-charcoal px-3 text-sm text-ink placeholder:text-ink-faint focus:border-violet-soft";
const areaClass =
  "w-full rounded-md border border-border bg-charcoal px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-violet-soft";
const labelClass = "mb-1.5 block text-sm text-ink-dim";

export function createInitialWizardState(
  partial?: Partial<WizardState>
): WizardState {
  return {
    title: "",
    description: "",
    genre: "Romance",
    language: "Hinglish",
    storyType: "Episodic",
    visibility: "PRIVATE",
    writingStyle: "Cinematic",
    dialogueStyle: "Natural",
    pointOfView: "Third person limited",
    episodeLength: "Medium",
    tone: "Emotional",
    romanceLevel: "Slow burn",
    pacing: "Slow burn",
    customInstructions: "",
    setting: "",
    timePeriod: "",
    mainConflict: "",
    initialPlot: "",
    worldRules: "",
    contentBoundaries: "",
    characters: [emptyCharacter()],
    relationships: [],
    writingRules: DEFAULT_WRITING_RULES.map((rule) => ({
      clientId: uid(),
      rule,
      category: "Style",
      priority: 5,
      isActive: true,
    })),
    ...partial,
  };
}

export function StoryWizard({
  mode,
  storyId,
  initialState,
}: {
  mode: "create" | "edit";
  storyId?: string;
  initialState?: WizardState;
}) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [state, setState] = React.useState<WizardState>(
    () => initialState ?? createInitialWizardState()
  );
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>(
    {}
  );
  const [pending, setPending] = React.useState<"create" | "draft" | null>(null);

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function toPayload(status: "ACTIVE" | "DRAFT") {
    return {
      ...state,
      status,
      characters: state.characters.map((c, i) => ({
        clientId: c.clientId,
        name: c.name,
        age: c.age ? Number(c.age) : null,
        gender: c.gender || undefined,
        role: c.role,
        personality: c.personality,
        appearance: c.appearance || undefined,
        background: c.background || undefined,
        speakingStyle: c.speakingStyle || undefined,
        secrets: c.secrets || undefined,
        emotionalState: c.emotionalState || undefined,
        sortOrder: i,
      })),
      relationships: state.relationships.map((r) => ({
        clientId: r.clientId,
        sourceClientId: r.sourceClientId,
        targetClientId: r.targetClientId,
        relationshipType: r.relationshipType,
        description: r.description || undefined,
        currentStatus: r.currentStatus || undefined,
        emotionalDynamic: r.emotionalDynamic || undefined,
      })),
      writingRules: state.writingRules.map((r) => ({
        clientId: r.clientId,
        rule: r.rule,
        category: r.category || undefined,
        priority: r.priority,
        isActive: r.isActive,
      })),
    };
  }

  async function submit(kind: "create" | "draft") {
    setPending(kind);
    setError(null);
    setFieldErrors({});
    try {
      const payload = toPayload(kind === "draft" ? "DRAFT" : "ACTIVE");
      const result =
        mode === "edit" && storyId
          ? await replaceStoryGraphAction(storyId, payload)
          : kind === "draft"
            ? await saveDraftStoryAction(payload)
            : await createStoryAction(payload);

      if (!result.success) {
        setError(result.error.message);
        if (result.error.fieldErrors) setFieldErrors(result.error.fieldErrors);
        return;
      }
      router.push(`/stories/${result.data.storyId}`);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-wider ${
              i === step
                ? "bg-violet/20 text-lilac"
                : i < step
                  ? "bg-panel-raised text-ink-dim"
                  : "text-ink-faint"
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      <GlassCard className="space-y-5 p-6">
        {step === 0 && (
          <>
            <Field label="Story title" error={fieldErrors.title?.[0]}>
              <input
                className={fieldClass}
                value={state.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="Forbidden Hearts"
              />
            </Field>
            <Field label="Description" error={fieldErrors.description?.[0]}>
              <textarea
                className={areaClass}
                rows={3}
                value={state.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Genre">
                <select
                  className={fieldClass}
                  value={state.genre}
                  onChange={(e) => update("genre", e.target.value)}
                >
                  {GENRE_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Language">
                <select
                  className={fieldClass}
                  value={state.language}
                  onChange={(e) => update("language", e.target.value)}
                >
                  {LANGUAGE_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Story type">
                <input
                  className={fieldClass}
                  value={state.storyType}
                  onChange={(e) => update("storyType", e.target.value)}
                />
              </Field>
              <Field label="Visibility">
                <select
                  className={fieldClass}
                  value={state.visibility}
                  onChange={(e) =>
                    update(
                      "visibility",
                      e.target.value as WizardState["visibility"]
                    )
                  }
                >
                  <option value="PRIVATE">Private</option>
                  <option value="UNLISTED">Unlisted</option>
                  <option value="PUBLIC">Public</option>
                </select>
              </Field>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <p className="text-xs text-ink-faint">
              Preferences for future writing — AI generation is not connected yet.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Writing style">
                <select
                  className={fieldClass}
                  value={state.writingStyle}
                  onChange={(e) => update("writingStyle", e.target.value)}
                >
                  {WRITING_STYLE_OPTIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label="Dialogue style">
                <input
                  className={fieldClass}
                  value={state.dialogueStyle}
                  onChange={(e) => update("dialogueStyle", e.target.value)}
                />
              </Field>
              <Field label="Point of view">
                <select
                  className={fieldClass}
                  value={state.pointOfView}
                  onChange={(e) => update("pointOfView", e.target.value)}
                >
                  {POV_OPTIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label="Episode length">
                <select
                  className={fieldClass}
                  value={state.episodeLength}
                  onChange={(e) => update("episodeLength", e.target.value)}
                >
                  {EPISODE_LENGTH_OPTIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
              <Field label="Tone">
                <input
                  className={fieldClass}
                  value={state.tone}
                  onChange={(e) => update("tone", e.target.value)}
                />
              </Field>
              <Field label="Romance level">
                <input
                  className={fieldClass}
                  value={state.romanceLevel}
                  onChange={(e) => update("romanceLevel", e.target.value)}
                />
              </Field>
              <Field label="Pacing">
                <select
                  className={fieldClass}
                  value={state.pacing}
                  onChange={(e) => update("pacing", e.target.value)}
                >
                  {PACING_OPTIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Custom writing instructions">
              <textarea
                className={areaClass}
                rows={4}
                value={state.customInstructions}
                onChange={(e) => update("customInstructions", e.target.value)}
              />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <Field label="Setting">
              <textarea
                className={areaClass}
                rows={3}
                value={state.setting}
                onChange={(e) => update("setting", e.target.value)}
              />
            </Field>
            <Field label="Time period">
              <input
                className={fieldClass}
                value={state.timePeriod}
                onChange={(e) => update("timePeriod", e.target.value)}
              />
            </Field>
            <Field label="Main conflict">
              <textarea
                className={areaClass}
                rows={3}
                value={state.mainConflict}
                onChange={(e) => update("mainConflict", e.target.value)}
              />
            </Field>
            <Field label="Initial plot">
              <textarea
                className={areaClass}
                rows={4}
                value={state.initialPlot}
                onChange={(e) => update("initialPlot", e.target.value)}
              />
            </Field>
            <Field label="World rules">
              <textarea
                className={areaClass}
                rows={3}
                value={state.worldRules}
                onChange={(e) => update("worldRules", e.target.value)}
              />
            </Field>
            <Field label="Content boundaries">
              <textarea
                className={areaClass}
                rows={3}
                value={state.contentBoundaries}
                onChange={(e) => update("contentBoundaries", e.target.value)}
              />
            </Field>
          </>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {state.characters.map((c, index) => (
              <div
                key={c.clientId}
                className="rounded-lg border border-border bg-charcoal/50 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-mono text-xs uppercase tracking-wider text-violet-soft">
                    Character {index + 1}
                  </p>
                  {state.characters.length > 1 && (
                    <button
                      type="button"
                      className="text-ink-faint hover:text-danger"
                      onClick={() =>
                        update(
                          "characters",
                          state.characters.filter((x) => x.clientId !== c.clientId)
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name">
                    <input
                      className={fieldClass}
                      value={c.name}
                      onChange={(e) => {
                        const next = [...state.characters];
                        next[index] = { ...c, name: e.target.value };
                        update("characters", next);
                      }}
                    />
                  </Field>
                  <Field label="Role">
                    <input
                      className={fieldClass}
                      value={c.role}
                      onChange={(e) => {
                        const next = [...state.characters];
                        next[index] = { ...c, role: e.target.value };
                        update("characters", next);
                      }}
                    />
                  </Field>
                  <Field label="Age">
                    <input
                      className={fieldClass}
                      value={c.age}
                      onChange={(e) => {
                        const next = [...state.characters];
                        next[index] = { ...c, age: e.target.value };
                        update("characters", next);
                      }}
                    />
                  </Field>
                  <Field label="Gender">
                    <input
                      className={fieldClass}
                      value={c.gender}
                      onChange={(e) => {
                        const next = [...state.characters];
                        next[index] = { ...c, gender: e.target.value };
                        update("characters", next);
                      }}
                    />
                  </Field>
                </div>
                <Field label="Personality">
                  <textarea
                    className={`${areaClass} mt-3`}
                    rows={2}
                    value={c.personality}
                    onChange={(e) => {
                      const next = [...state.characters];
                      next[index] = { ...c, personality: e.target.value };
                      update("characters", next);
                    }}
                  />
                </Field>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Appearance">
                    <textarea
                      className={areaClass}
                      rows={2}
                      value={c.appearance}
                      onChange={(e) => {
                        const next = [...state.characters];
                        next[index] = { ...c, appearance: e.target.value };
                        update("characters", next);
                      }}
                    />
                  </Field>
                  <Field label="Background">
                    <textarea
                      className={areaClass}
                      rows={2}
                      value={c.background}
                      onChange={(e) => {
                        const next = [...state.characters];
                        next[index] = { ...c, background: e.target.value };
                        update("characters", next);
                      }}
                    />
                  </Field>
                  <Field label="Speaking style">
                    <input
                      className={fieldClass}
                      value={c.speakingStyle}
                      onChange={(e) => {
                        const next = [...state.characters];
                        next[index] = { ...c, speakingStyle: e.target.value };
                        update("characters", next);
                      }}
                    />
                  </Field>
                  <Field label="Emotional state">
                    <input
                      className={fieldClass}
                      value={c.emotionalState}
                      onChange={(e) => {
                        const next = [...state.characters];
                        next[index] = { ...c, emotionalState: e.target.value };
                        update("characters", next);
                      }}
                    />
                  </Field>
                </div>
                <Field label="Secrets">
                  <textarea
                    className={`${areaClass} mt-3`}
                    rows={2}
                    value={c.secrets}
                    onChange={(e) => {
                      const next = [...state.characters];
                      next[index] = { ...c, secrets: e.target.value };
                      update("characters", next);
                    }}
                  />
                </Field>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() => update("characters", [...state.characters, emptyCharacter()])}
            >
              <Plus className="h-4 w-4" />
              Add character
            </Button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="font-display text-lg text-ink">Relationships</h3>
              {state.relationships.map((r, index) => (
                <div
                  key={r.clientId}
                  className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2"
                >
                  <Field label="Source">
                    <select
                      className={fieldClass}
                      value={r.sourceClientId}
                      onChange={(e) => {
                        const next = [...state.relationships];
                        next[index] = { ...r, sourceClientId: e.target.value };
                        update("relationships", next);
                      }}
                    >
                      <option value="">Select</option>
                      {state.characters.map((c) => (
                        <option key={c.clientId} value={c.clientId}>
                          {c.name || "Unnamed"}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Target">
                    <select
                      className={fieldClass}
                      value={r.targetClientId}
                      onChange={(e) => {
                        const next = [...state.relationships];
                        next[index] = { ...r, targetClientId: e.target.value };
                        update("relationships", next);
                      }}
                    >
                      <option value="">Select</option>
                      {state.characters.map((c) => (
                        <option key={c.clientId} value={c.clientId}>
                          {c.name || "Unnamed"}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Type">
                    <input
                      className={fieldClass}
                      list="rel-types"
                      value={r.relationshipType}
                      onChange={(e) => {
                        const next = [...state.relationships];
                        next[index] = { ...r, relationshipType: e.target.value };
                        update("relationships", next);
                      }}
                    />
                    <datalist id="rel-types">
                      {RELATIONSHIP_TYPE_SUGGESTIONS.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </Field>
                  <Field label="Status">
                    <input
                      className={fieldClass}
                      value={r.currentStatus}
                      onChange={(e) => {
                        const next = [...state.relationships];
                        next[index] = { ...r, currentStatus: e.target.value };
                        update("relationships", next);
                      }}
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        update(
                          "relationships",
                          state.relationships.filter((x) => x.clientId !== r.clientId)
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  update("relationships", [
                    ...state.relationships,
                    {
                      clientId: uid(),
                      sourceClientId: state.characters[0]?.clientId || "",
                      targetClientId: state.characters[1]?.clientId || "",
                      relationshipType: "",
                      description: "",
                      currentStatus: "",
                      emotionalDynamic: "",
                    },
                  ])
                }
              >
                <Plus className="h-4 w-4" />
                Add relationship
              </Button>
            </div>

            <div className="space-y-3">
              <h3 className="font-display text-lg text-ink">Writing rules</h3>
              {state.writingRules.map((r, index) => (
                <div key={r.clientId} className="flex gap-2">
                  <input
                    className={fieldClass}
                    value={r.rule}
                    onChange={(e) => {
                      const next = [...state.writingRules];
                      next[index] = { ...r, rule: e.target.value };
                      update("writingRules", next);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      update(
                        "writingRules",
                        state.writingRules.filter((x) => x.clientId !== r.clientId)
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  update("writingRules", [
                    ...state.writingRules,
                    {
                      clientId: uid(),
                      rule: "",
                      category: "Style",
                      priority: 5,
                      isActive: true,
                    },
                  ])
                }
              >
                <Plus className="h-4 w-4" />
                Add rule
              </Button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4 text-sm text-ink-dim">
            <ReviewRow label="Title" value={state.title} />
            <ReviewRow label="Genre / Language" value={`${state.genre} · ${state.language}`} />
            <ReviewRow label="Visibility" value={state.visibility} />
            <ReviewRow label="Setting" value={state.setting || "—"} />
            <ReviewRow label="Main conflict" value={state.mainConflict || "—"} />
            <ReviewRow
              label="Characters"
              value={state.characters.map((c) => c.name || "Unnamed").join(", ")}
            />
            <ReviewRow
              label="Relationships"
              value={String(state.relationships.length)}
            />
            <ReviewRow label="Writing rules" value={String(state.writingRules.length)} />
            <p className="rounded-md border border-border bg-charcoal/40 px-3 py-2 text-xs text-ink-faint">
              Creating a story saves your setup only. AI episode generation arrives in Phase C.
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 0 || !!pending}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            Previous
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              loading={pending === "draft"}
              disabled={!!pending}
              onClick={() => submit("draft")}
            >
              Save as Draft
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={() => setStep((s) => s + 1)}>
                Next
              </Button>
            ) : (
              <Button
                type="button"
                loading={pending === "create"}
                disabled={!!pending}
                onClick={() => submit("create")}
              >
                {mode === "edit" ? "Save story" : "Create Story"}
              </Button>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 border-b border-border/60 pb-2">
      <dt className="w-36 shrink-0 font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
