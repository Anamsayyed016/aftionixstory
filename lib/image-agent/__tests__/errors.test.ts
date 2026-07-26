import { describe, expect, it, vi } from "vitest";

const { AuthzError } = vi.hoisted(() => ({
  AuthzError: class AuthzError extends Error {
    code: "UNAUTHORIZED" | "NOT_FOUND" | "FORBIDDEN";
    constructor(code: "UNAUTHORIZED" | "NOT_FOUND" | "FORBIDDEN", message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("@/lib/auth/authorization", () => ({ AuthzError }));

import { mapImageAgentError } from "@/lib/image-agent/errors";

describe("mapImageAgentError", () => {
  it("never leaks the raw provider error message", () => {
    const providerError = Object.assign(
      new Error("api_key sk-super-secret-value-should-never-appear is invalid"),
      { status: 401 }
    );
    const mapped = mapImageAgentError(providerError);

    expect(mapped.message).not.toContain("sk-super-secret-value-should-never-appear");
    expect(mapped.status).toBe(503);
  });

  it("maps AuthzError to the correct status and its own safe message", () => {
    const mapped = mapImageAgentError(new AuthzError("NOT_FOUND", "Character not found."));
    expect(mapped.status).toBe(404);
    expect(mapped.message).toBe("Character not found.");
  });

  it("maps rate limiting to 429 with a friendly message", () => {
    const err = Object.assign(new Error("rate limit exceeded"), { status: 429 });
    const mapped = mapImageAgentError(err);
    expect(mapped.status).toBe(429);
    expect(mapped.message).toMatch(/busy/i);
  });
});
