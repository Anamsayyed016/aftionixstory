"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  googleSignInAction,
  loginAction,
  type ActionResult,
} from "@/app/actions/auth";

const initial: ActionResult | null = null;

export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const errorParam = searchParams.get("error");

  const [state, formAction, pending] = useActionState(loginAction, initial);

  return (
    <div className="space-y-5">
      {googleEnabled && (
        <>
          <form action={googleSignInAction}>
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
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

      {(errorParam || (state && !state.success)) && (
        <p
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {state && !state.success
            ? state.error
            : "Unable to sign in. Please try again."}
        </p>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
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
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm text-ink-dim">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-lilac hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="h-11 w-full rounded-md border border-border bg-charcoal px-3 text-sm text-ink placeholder:text-ink-faint focus:border-violet-soft"
            placeholder="••••••••"
          />
          {state && !state.success && state.fieldErrors?.password?.[0] && (
            <p className="text-xs text-danger">
              {state.fieldErrors.password[0]}
            </p>
          )}
        </div>
        <Button type="submit" className="w-full" loading={pending}>
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-ink-dim">
        New to StoryVerse?{" "}
        <Link href="/sign-up" className="text-lilac hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
