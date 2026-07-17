"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import {
  archiveCharacterAction,
  createCharacterAction,
  deleteCharacterAction,
  updateCharacterAction,
} from "@/app/actions/characters";
import {
  createRelationshipAction,
  deleteRelationshipAction,
} from "@/app/actions/relationships";

type CharacterRow = {
  id: string;
  name: string;
  age: number | null;
  gender: string | null;
  role: string;
  personality: string;
  appearance: string | null;
  background: string | null;
  speakingStyle: string | null;
  secrets: string | null;
  emotionalState: string | null;
  status: string;
  _count: { outgoingRelationships: number; incomingRelationships: number };
};

type RelRow = {
  id: string;
  relationshipType: string;
  sourceCharacterId: string;
  targetCharacterId: string;
  sourceCharacter: { id: string; name: string; status: string };
  targetCharacter: { id: string; name: string; status: string };
};

const fieldClass =
  "h-10 w-full rounded-md border border-border bg-charcoal px-3 text-sm text-ink";

export function CharactersManager({
  storyId,
  initialCharacters,
  initialRelationships,
}: {
  storyId: string;
  initialCharacters: CharacterRow[];
  initialRelationships: RelRow[];
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<"ALL" | "ACTIVE" | "ARCHIVED">("ACTIVE");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [editing, setEditing] = React.useState<CharacterRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    name: "",
    age: "",
    gender: "",
    role: "Supporting",
    personality: "",
    appearance: "",
    background: "",
    speakingStyle: "",
    secrets: "",
    emotionalState: "",
  });
  const [relForm, setRelForm] = React.useState({
    sourceCharacterId: "",
    targetCharacterId: "",
    relationshipType: "",
  });

  const filtered = initialCharacters.filter((c) => {
    if (status !== "ALL" && c.status !== status) return false;
    if (q && !c.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  function openCreate() {
    setEditing(null);
    setCreating(true);
    setForm({
      name: "",
      age: "",
      gender: "",
      role: "Supporting",
      personality: "",
      appearance: "",
      background: "",
      speakingStyle: "",
      secrets: "",
      emotionalState: "",
    });
  }

  function openEdit(c: CharacterRow) {
    setCreating(false);
    setEditing(c);
    setForm({
      name: c.name,
      age: c.age != null ? String(c.age) : "",
      gender: c.gender || "",
      role: c.role,
      personality: c.personality,
      appearance: c.appearance || "",
      background: c.background || "",
      speakingStyle: c.speakingStyle || "",
      secrets: c.secrets || "",
      emotionalState: c.emotionalState || "",
    });
  }

  async function saveCharacter() {
    setPending(true);
    setError(null);
    const payload = {
      ...form,
      age: form.age ? Number(form.age) : null,
    };
    const result = editing
      ? await updateCharacterAction(editing.id, payload)
      : await createCharacterAction(storyId, payload);
    setPending(false);
    if (!result.success) {
      setError(result.error.message);
      return;
    }
    setEditing(null);
    setCreating(false);
    router.refresh();
  }

  async function archive(id: string) {
    setPending(true);
    const result = await archiveCharacterAction(id);
    setPending(false);
    if (!result.success) setError(result.error.message);
    router.refresh();
  }

  async function remove(id: string) {
    setPending(true);
    const result = await deleteCharacterAction(id);
    setPending(false);
    setConfirmDelete(null);
    if (!result.success) setError(result.error.message);
    router.refresh();
  }

  async function addRelationship() {
    setPending(true);
    setError(null);
    const result = await createRelationshipAction(storyId, relForm);
    setPending(false);
    if (!result.success) {
      setError(result.error.message);
      return;
    }
    setRelForm({ sourceCharacterId: "", targetCharacterId: "", relationshipType: "" });
    router.refresh();
  }

  async function removeRelationship(id: string) {
    setPending(true);
    const result = await deleteRelationshipAction(id);
    setPending(false);
    if (!result.success) setError(result.error.message);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <input
            className={fieldClass}
            placeholder="Search characters…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className={fieldClass}
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
            <option value="ALL">All</option>
          </select>
        </div>
        <Button type="button" onClick={openCreate}>
          Add character
        </Button>
      </div>

      {error && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {(creating || editing) && (
        <GlassCard className="space-y-3 p-5">
          <h3 className="font-display text-lg text-ink">
            {editing ? "Edit character" : "New character"}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["name", "Name"],
                ["role", "Role"],
                ["age", "Age"],
                ["gender", "Gender"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="text-sm text-ink-dim">
                {label}
                <input
                  className={`${fieldClass} mt-1`}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <label className="block text-sm text-ink-dim">
            Personality
            <textarea
              className={`${fieldClass} mt-1 h-20 py-2`}
              value={form.personality}
              onChange={(e) => setForm((f) => ({ ...f, personality: e.target.value }))}
            />
          </label>
          <div className="flex gap-2">
            <Button type="button" loading={pending} onClick={saveCharacter}>
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </GlassCard>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((c) => (
          <GlassCard key={c.id} className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-xl text-ink">{c.name}</h3>
                <p className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
                  {c.role}
                </p>
              </div>
              <Badge variant={c.status === "ACTIVE" ? "success" : "outline"}>
                {c.status}
              </Badge>
            </div>
            <p className="mt-3 line-clamp-3 text-sm text-ink-dim">{c.personality}</p>
            <p className="mt-2 font-mono text-[10px] text-ink-faint">
              {c._count.outgoingRelationships + c._count.incomingRelationships}{" "}
              relationships
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => openEdit(c)}>
                Edit
              </Button>
              {c.status === "ACTIVE" && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => archive(c.id)}
                >
                  Archive
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={() => setConfirmDelete(c.id)}
              >
                Delete
              </Button>
            </div>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="space-y-4 p-5">
        <h3 className="font-display text-lg text-ink">Relationships</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <select
            className={fieldClass}
            value={relForm.sourceCharacterId}
            onChange={(e) =>
              setRelForm((f) => ({ ...f, sourceCharacterId: e.target.value }))
            }
          >
            <option value="">Source</option>
            {initialCharacters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className={fieldClass}
            value={relForm.targetCharacterId}
            onChange={(e) =>
              setRelForm((f) => ({ ...f, targetCharacterId: e.target.value }))
            }
          >
            <option value="">Target</option>
            {initialCharacters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            className={fieldClass}
            placeholder="Relationship type"
            value={relForm.relationshipType}
            onChange={(e) =>
              setRelForm((f) => ({ ...f, relationshipType: e.target.value }))
            }
          />
        </div>
        <Button type="button" variant="secondary" loading={pending} onClick={addRelationship}>
          Add relationship
        </Button>
        <ul className="space-y-2 text-sm text-ink-dim">
          {initialRelationships.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-md bg-charcoal/40 px-3 py-2"
            >
              <span>
                {r.sourceCharacter.name} → {r.targetCharacter.name}
                <span className="ml-2 font-mono text-[10px] text-ink-faint">
                  {r.relationshipType}
                  {(r.sourceCharacter.status === "ARCHIVED" ||
                    r.targetCharacter.status === "ARCHIVED") &&
                    " · archived char"}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => removeRelationship(r.id)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </GlassCard>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete character?"
        description="Hard delete is only allowed when the character has no relationships. Otherwise archive instead."
        confirmLabel="Delete"
        danger
        loading={pending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove(confirmDelete)}
      />
    </div>
  );
}
