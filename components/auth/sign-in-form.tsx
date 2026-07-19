"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { GoogleSignInButton } from "@/components/auth/google-signin-button";
import { loginAction, type ActionResult } from "@/app/actions/auth";

const initial: ActionResult | null = null;

const inputClassName =
  "h-11 w-full rounded-xl border border-border bg-charcoal/80 px-3.5 text-sm text-ink placeholder:text-ink-faint transition-[border-color,box-shadow] focus:border-violet-soft focus:outline-none focus:ring-2 focus:ring-lilac/30";

function oauthErrorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "OAuthAccountNotLinked":
      return "This email is already registered. Sign in with email and password, then link Google from settings.";
    case "OAuthCallback":
    case "OAuthSignin":
    case "Callback":
      return "Google sign-in failed. Please try again.";
    case "AccessDenied":
      return "Google sign-in was cancelled.";
    case "Configuration":
      return "Google sign-in is not configured correctly.";
    default:
      return "Unable to sign in. Please try again.";
  }
}

export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const errorParam = searchParams.get("error");

  const [state, formAction, pending] = useActionState(loginAction, initial);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const fromOauth = oauthErrorMessage(errorParam);
    if (fromOauth) {
      setToastMessage(fromOauth);
      return;
    }
    if (state && !state.success) {
      setToastMessage(state.error);
    }
  }, [errorParam, state]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-5"
    >
      <Toast
        message={toastMessage}
        variant="error"
        onDismiss={() => setToastMessage(null)}
      />

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
            aria-invalid={
              state && !state.success && !!state.fieldErrors?.email
                ? true
                : undefined
            }
            className={inputClassName}
            placeholder="you@example.com"
          />
          {state && !state.success && state.fieldErrors?.email?.[0] && (
            <p className="text-xs text-danger">{state.fieldErrors.email[0]}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="password" className="text-sm text-ink-dim">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-lilac transition-colors hover:text-violet-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
            >
              Forgot Password
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={
              state && !state.success && !!state.fieldErrors?.password
                ? true
                : undefined
            }
            className={inputClassName}
            placeholder="••••••••"
          />
          {state && !state.success && state.fieldErrors?.password?.[0] && (
            <p className="text-xs text-danger">
              {state.fieldErrors.password[0]}
            </p>
          )}
        </div>
        <Button type="submit" className="h-12 w-full rounded-xl" loading={pending}>
          Sign In
        </Button>
      </form>

      {googleEnabled ? (
        <>
          <div className="relative py-1" role="separator" aria-label="or">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-[0.18em]">
              <span className="bg-panel/90 px-3 font-mono text-ink-faint backdrop-blur-sm">
                OR
              </span>
            </div>
          </div>

          <GoogleSignInButton
            callbackUrl={callbackUrl}
            onError={(message) => setToastMessage(message)}
          />
        </>
      ) : null}

      <p className="pt-1 text-center text-sm text-ink-dim">
        Don&apos;t have an account?{" "}
        <Link
          href="/sign-up"
          className="font-medium text-lilac transition-colors hover:text-violet-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lilac focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
        >
          Create Account
        </Link>
      </p>
    </motion.div>
  );
}
