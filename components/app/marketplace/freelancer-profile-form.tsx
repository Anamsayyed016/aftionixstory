"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Toast } from "@/components/ui/toast";
import { saveFreelancerProfileAction } from "@/app/actions/marketplace-profiles";
import type { ActionResult } from "@/lib/actions/result";

const fieldClass =
  "h-11 w-full rounded-md border border-border bg-charcoal px-3 text-sm text-ink placeholder:text-ink-faint focus:border-violet-soft";
const areaClass =
  "w-full rounded-md border border-border bg-charcoal px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-violet-soft";
const labelClass = "mb-1.5 block text-sm text-ink-dim";

type Props = {
  defaults?: {
    summary?: string;
    skills?: string[];
    location?: string;
    availability?: string;
    portfolioLinks?: string[];
    contactEmail?: string;
    contactPhone?: string;
  };
  chatHref?: string;
};

const initial: ActionResult<{ publicPath: string }> | null = null;

export function FreelancerProfileForm({
  defaults,
  chatHref = "/connect/freelancer",
}: Props) {
  const [state, formAction, pending] = useActionState(
    saveFreelancerProfileAction,
    initial
  );
  const [clientError, setClientError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      router.push(state.data.publicPath);
    }
  }, [state, router]);

  const toastMessage =
    state && !state.success ? state.error.message : null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const summary = String(fd.get("summary") || "").trim();
    const skills = String(fd.get("skills") || "").trim();
    if (!summary) {
      e.preventDefault();
      setClientError("Summary is required.");
      return;
    }
    if (!skills) {
      e.preventDefault();
      setClientError("Add at least one skill.");
      return;
    }
    setClientError(null);
  }

  const fieldErrors =
    state && !state.success ? state.error.fieldErrors : undefined;

  return (
    <GlassCard className="p-6 sm:p-8">
      <Toast
        message={toastMessage}
        variant="error"
        onDismiss={() => undefined}
      />
      <form action={formAction} onSubmit={onSubmit} className="space-y-5">
        <div>
          <label htmlFor="summary" className={labelClass}>
            Summary <span className="text-danger">*</span>
          </label>
          <textarea
            id="summary"
            name="summary"
            required
            rows={4}
            defaultValue={defaults?.summary}
            className={areaClass}
            placeholder="What you do, your experience, the gigs you want…"
          />
          {fieldErrors?.summary?.[0] ? (
            <p className="mt-1 text-xs text-danger">{fieldErrors.summary[0]}</p>
          ) : null}
        </div>

        <div>
          <label htmlFor="skills" className={labelClass}>
            Skills <span className="text-danger">*</span>
          </label>
          <input
            id="skills"
            name="skills"
            required
            defaultValue={defaults?.skills?.join(", ")}
            className={fieldClass}
            placeholder="logo design, branding, illustration"
          />
          <p className="mt-1 text-xs text-ink-faint">Comma-separated</p>
          {fieldErrors?.skills?.[0] ? (
            <p className="mt-1 text-xs text-danger">{fieldErrors.skills[0]}</p>
          ) : null}
          {clientError ? (
            <p className="mt-1 text-xs text-danger">{clientError}</p>
          ) : null}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="location" className={labelClass}>
              Location
            </label>
            <input
              id="location"
              name="location"
              defaultValue={defaults?.location}
              className={fieldClass}
              placeholder="remote or city"
            />
          </div>
          <div>
            <label htmlFor="availability" className={labelClass}>
              Availability
            </label>
            <input
              id="availability"
              name="availability"
              defaultValue={defaults?.availability}
              className={fieldClass}
              placeholder="Weekdays, evenings…"
            />
          </div>
        </div>

        <div>
          <label htmlFor="portfolioLinks" className={labelClass}>
            Portfolio links
          </label>
          <textarea
            id="portfolioLinks"
            name="portfolioLinks"
            rows={3}
            defaultValue={defaults?.portfolioLinks?.join("\n")}
            className={areaClass}
            placeholder="https://… (one per line)"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="contactEmail" className={labelClass}>
              Contact email override (optional)
            </label>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={defaults?.contactEmail}
              className={fieldClass}
              placeholder="Falls back to account email"
            />
          </div>
          <div>
            <label htmlFor="contactPhone" className={labelClass}>
              Contact phone (optional)
            </label>
            <input
              id="contactPhone"
              name="contactPhone"
              defaultValue={defaults?.contactPhone}
              className={fieldClass}
            />
          </div>
        </div>
        <p className="text-xs text-ink-faint">
          Contact stays private on your public page until a mutual match.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href={chatHref} className="text-sm text-lilac hover:underline">
            Prefer to chat instead?
          </Link>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>
    </GlassCard>
  );
}
