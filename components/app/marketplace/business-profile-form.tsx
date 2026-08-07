"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { Toast } from "@/components/ui/toast";
import {
  saveBusinessProfileAction,
} from "@/app/actions/marketplace-profiles";
import type { ActionResult } from "@/lib/actions/result";

const fieldClass =
  "h-11 w-full rounded-md border border-border bg-charcoal px-3 text-sm text-ink placeholder:text-ink-faint focus:border-violet-soft";
const areaClass =
  "w-full rounded-md border border-border bg-charcoal px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-violet-soft";
const labelClass = "mb-1.5 block text-sm text-ink-dim";

type Props = {
  defaults?: {
    name?: string;
    category?: string;
    location?: string;
    contactEmail?: string;
    contactPhone?: string;
    summary?: string;
  };
  chatHref?: string;
};

const initial: ActionResult<{ publicPath: string }> | null = null;

export function BusinessProfileForm({
  defaults,
  chatHref = "/connect/business",
}: Props) {
  const [state, formAction, pending] = useActionState(
    saveBusinessProfileAction,
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
    const name = String(fd.get("name") || "").trim();
    if (!name) {
      e.preventDefault();
      setClientError("Business name is required.");
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
          <label htmlFor="name" className={labelClass}>
            Business name <span className="text-danger">*</span>
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={defaults?.name}
            className={fieldClass}
            placeholder="Bright Print Co"
          />
          {fieldErrors?.name?.[0] ? (
            <p className="mt-1 text-xs text-danger">{fieldErrors.name[0]}</p>
          ) : null}
          {clientError ? (
            <p className="mt-1 text-xs text-danger">{clientError}</p>
          ) : null}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="category" className={labelClass}>
              Category
            </label>
            <input
              id="category"
              name="category"
              defaultValue={defaults?.category}
              className={fieldClass}
              placeholder="Printing & branding"
            />
          </div>
          <div>
            <label htmlFor="location" className={labelClass}>
              Location
            </label>
            <input
              id="location"
              name="location"
              defaultValue={defaults?.location}
              className={fieldClass}
              placeholder="Pune or remote"
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="contactEmail" className={labelClass}>
              Contact email
            </label>
            <input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={defaults?.contactEmail}
              className={fieldClass}
              placeholder="hello@example.com"
            />
            <p className="mt-1 text-xs text-ink-faint">
              Use your account email to verify and publish the public /b/ page.
            </p>
            {fieldErrors?.contactEmail?.[0] ? (
              <p className="mt-1 text-xs text-danger">
                {fieldErrors.contactEmail[0]}
              </p>
            ) : null}
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
              placeholder="+91 …"
            />
          </div>
        </div>

        <div>
          <label htmlFor="summary" className={labelClass}>
            Summary
          </label>
          <textarea
            id="summary"
            name="summary"
            rows={4}
            defaultValue={defaults?.summary}
            className={areaClass}
            placeholder="What you do, who you serve…"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href={chatHref} className="text-sm text-lilac hover:underline">
            Prefer to chat instead?
          </Link>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save listing"}
          </Button>
        </div>
      </form>
    </GlassCard>
  );
}
