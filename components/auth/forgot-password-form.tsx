"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  forgotPasswordAction,
  type ActionResult,
} from "@/app/actions/auth";

const initial: ActionResult | null = null;

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    forgotPasswordAction,
    initial
  );

  return (
    <div className="space-y-5">
      {state?.success && state.message && (
        <p
          role="status"
          className="rounded-md border border-border bg-panel-raised px-3 py-3 text-sm text-ink-dim"
        >
          {state.message}
        </p>
      )}

      {state && !state.success && (
        <p
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {state.error}
        </p>
      )}

      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm text-ink-dim">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="h-11 w-full rounded-md border border-border bg-charcoal px-3 text-sm text-ink placeholder:text-ink-faint focus:border-violet-soft"
            placeholder="you@example.com"
          />
          {state && !state.success && state.fieldErrors?.email?.[0] && (
            <p className="text-xs text-danger">{state.fieldErrors.email[0]}</p>
          )}
        </div>
        <Button type="submit" className="w-full" loading={pending}>
          Request reset link
        </Button>
      </form>

      <p className="text-center text-sm text-ink-dim">
        Remembered it?{" "}
        <Link href="/sign-in" className="text-lilac hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
