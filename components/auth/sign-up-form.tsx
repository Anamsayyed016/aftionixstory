"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  googleSignInAction,
  registerAction,
  type ActionResult,
} from "@/app/actions/auth";

const initial: ActionResult | null = null;

export function SignUpForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(registerAction, initial);

  return (
    <div className="space-y-5">
      {googleEnabled && (
        <>
          <form action={googleSignInAction}>
            <input type="hidden" name="callbackUrl" value="/dashboard" />
            <Button type="submit" variant="secondary" className="w-full">
              Continue with Google
            </Button>
          </form>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wider">
              <span className="bg-panel px-2 font-mono text-ink-faint">
                or email
              </span>
            </div>
          </div>
        </>
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
          <label htmlFor="name" className="text-sm text-ink-dim">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            className="h-11 w-full rounded-md border border-border bg-charcoal px-3 text-sm text-ink placeholder:text-ink-faint focus:border-violet-soft"
            placeholder="Your name"
          />
          {state && !state.success && state.fieldErrors?.name?.[0] && (
            <p className="text-xs text-danger">{state.fieldErrors.name[0]}</p>
          )}
        </div>
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
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm text-ink-dim">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            className="h-11 w-full rounded-md border border-border bg-charcoal px-3 text-sm text-ink placeholder:text-ink-faint focus:border-violet-soft"
            placeholder="At least 8 characters"
          />
          <p className="text-xs text-ink-faint">
            Use 8+ characters with upper, lower, and a number.
          </p>
          {state && !state.success && state.fieldErrors?.password?.[0] && (
            <p className="text-xs text-danger">
              {state.fieldErrors.password[0]}
            </p>
          )}
        </div>
        <Button type="submit" className="w-full" loading={pending}>
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-ink-dim">
        Already writing?{" "}
        <Link href="/sign-in" className="text-lilac hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
