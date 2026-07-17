import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { isGoogleOAuthConfigured } from "@/lib/env";

export const metadata = {
  title: "Sign in — StoryVerse AI",
  description: "Sign in to continue your stories.",
};

export default function SignInPage() {
  const googleEnabled = isGoogleOAuthConfigured();

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue writing where you left off."
    >
      <Suspense
        fallback={
          <div className="h-40 animate-pulse rounded-md bg-panel-raised" />
        }
      >
        <SignInForm googleEnabled={googleEnabled} />
      </Suspense>
    </AuthShell>
  );
}
