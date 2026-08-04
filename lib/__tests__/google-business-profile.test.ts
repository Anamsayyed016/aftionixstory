import { describe, expect, it } from "vitest";

import {
  formatBusinessDetailsForClipboard,
  isGbpAssistPrompt,
} from "@/lib/marketplace/google-business-profile";

describe("google business profile assist helpers", () => {
  it("formats a clipboard block from business fields", () => {
    expect(
      formatBusinessDetailsForClipboard({
        name: "Bright Print Co",
        category: "Printing & branding",
        location: "Pune",
        contactPhone: "+91 98765 43210",
        contactEmail: "demo@example.com",
      })
    ).toBe(
      [
        "Name: Bright Print Co",
        "Category: Printing & branding",
        "Location: Pune",
        "Phone: +91 98765 43210",
        "Email: demo@example.com",
      ].join("\n")
    );
  });

  it("omits blank optional fields", () => {
    expect(
      formatBusinessDetailsForClipboard({
        name: "Cafe Nova",
        category: null,
        location: "Mumbai",
        contactPhone: "  ",
        contactEmail: undefined,
      })
    ).toBe("Name: Cafe Nova\nLocation: Mumbai");
  });

  it("detects the chat assist prompt", () => {
    expect(isGbpAssistPrompt("Help me list on Google Maps")).toBe(true);
    expect(isGbpAssistPrompt("list my business")).toBe(false);
  });
});
