import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata = {
  title: "Forgot password — StoryVerse AI",
  description: "Request a password reset for your StoryVerse account.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset password"
      subtitle="Enter your email. We’ll help you regain access when email delivery is configured."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
