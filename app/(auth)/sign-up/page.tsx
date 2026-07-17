import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { isGoogleOAuthConfigured } from "@/lib/env";

export const metadata = {
  title: "Create account — StoryVerse AI",
  description: "Start writing episodic stories with persistent memory.",
};

export default function SignUpPage() {
  const googleEnabled = isGoogleOAuthConfigured();

  return (
    <AuthShell
      title="Start writing"
      subtitle="Create a free account. No credit card required."
    >
      <SignUpForm googleEnabled={googleEnabled} />
    </AuthShell>
  );
}
