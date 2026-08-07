"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Toast } from "@/components/ui/toast";
import { createGigAction } from "@/app/actions/marketplace-profiles";
import type { ActionResult } from "@/lib/actions/result";

const fieldClass =
  "h-11 w-full rounded-md border border-border bg-charcoal px-3 text-sm text-ink placeholder:text-ink-faint focus:border-violet-soft";
const areaClass =
  "w-full rounded-md border border-border bg-charcoal px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-violet-soft";
const labelClass = "mb-1.5 block text-sm text-ink-dim";

type Props = {
  hasBusiness: boolean;
  chatHref?: string;
};

const initial: ActionResult<{ gigId: string }> | null = null;

export function GigPostingForm({
  hasBusiness,
  chatHref = "/connect/gig",
}: Props) {
  const [state, formAction, pending] = useActionState(createGigAction, initial);
  const [clientError, setClientError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      router.push("/connect");
    }
  }, [state, router]);

  const toastMessage =
    state && !state.success ? state.error.message : null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") || "").trim();
    if (!title) {
      e.preventDefault();
      setClientError("Gig title is required.");
      return;
    }
    setClientError(null);
  }

  const fieldErrors =
    state && !state.success ? state.error.fieldErrors : undefined;

  if (!hasBusiness) {
    return (
      <GlassCard className="p-6 sm:p-8">
        <p className="text-sm text-ink-dim">
          You need a Business Directory listing before posting a gig.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/connect/business">
            <Button type="button">List my business</Button>
          </Link>
          <Link href={chatHref} className="text-sm text-lilac hover:underline self-center">
            Or chat instead
          </Link>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-6 sm:p-8">
      <Toast
        message={toastMessage}
        variant="error"
        onDismiss={() => undefined}
      />
      <form action={formAction} onSubmit={onSubmit} className="space-y-5">
        <div>
          <label htmlFor="title" className={labelClass}>
            Title <span className="text-danger">*</span>
          </label>
          <input
            id="title"
            name="title"
            required
            className={fieldClass}
            placeholder="Logo design"
          />
          {fieldErrors?.title?.[0] ? (
            <p className="mt-1 text-xs text-danger">{fieldErrors.title[0]}</p>
          ) : null}
          {clientError ? (
            <p className="mt-1 text-xs text-danger">{clientError}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="description" className={labelClass}>
            Description <span className="text-danger">*</span>
          </label>
          <textarea
            id="description"
            name="description"
            required
            rows={4}
            className={areaClass}
            placeholder="What you need done, timeline, constraints…"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="skillNeeded" className={labelClass}>
              Skill needed
            </label>
            <input
              id="skillNeeded"
              name="skillNeeded"
              className={fieldClass}
              placeholder="logo design"
            />
          </div>
          <div>
            <label htmlFor="category" className={labelClass}>
              Category
            </label>
            <input
              id="category"
              name="category"
              className={fieldClass}
              placeholder="design"
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="location" className={labelClass}>
              Location / remote
            </label>
            <input
              id="location"
              name="location"
              className={fieldClass}
              placeholder="remote"
            />
          </div>
          <div>
            <label htmlFor="budget" className={labelClass}>
              Budget (freeform)
            </label>
            <input
              id="budget"
              name="budget"
              className={fieldClass}
              placeholder="₹8,000–12,000"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href={chatHref} className="text-sm text-lilac hover:underline">
            Prefer to chat instead?
          </Link>
          <Button type="submit" disabled={pending}>
            {pending ? "Posting…" : "Post gig"}
          </Button>
        </div>
      </form>
    </GlassCard>
  );
}
