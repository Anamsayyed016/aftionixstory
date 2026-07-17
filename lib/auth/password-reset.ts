import "server-only";

/**
 * Future-ready password reset boundary.
 * Phase A does not send email and does not create reset tokens.
 * When an email provider is configured, implement token creation
 * against VerificationToken and outbound delivery here.
 */
export type PasswordResetRequestResult = {
  /** Always the same user-facing copy (no account enumeration). */
  message: string;
};

export async function requestPasswordReset(
  email: string
): Promise<PasswordResetRequestResult> {
  // Phase A: validate caller already checked email format.
  // Intentionally no DB write and no email send.
  void email;
  return {
    message:
      "If an account exists for this email, password reset instructions will be sent once email delivery is configured.",
  };
}
