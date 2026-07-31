import { describe, expect, it } from "vitest";

import { classifyUniversalIntentDeterministic } from "@/lib/universal-router";
import { DEFAULT_CONVERSATION_FLOW } from "@/lib/conversation-brain/collaboration-state";

describe("marketplace intent disambiguation", () => {
  it("routes business listing to business_profile_request", () => {
    const hit = classifyUniversalIntentDeterministic({
      userMessage: "List my business on the directory. My business is called Bright Print Co.",
      conversationFlow: DEFAULT_CONVERSATION_FLOW,
    });
    expect(hit!.intent).toBe("business_profile_request");
  });

  it("routes task hiring to gig_posting_request (not image gen)", () => {
    const hit = classifyUniversalIntentDeterministic({
      userMessage: "I need a logo designed for my shop",
      conversationFlow: DEFAULT_CONVERSATION_FLOW,
    });
    expect(hit!.intent).toBe("gig_posting_request");
  });

  it("routes delivery gig to gig_posting_request", () => {
    const hit = classifyUniversalIntentDeterministic({
      userMessage: "need someone for a day of deliveries in Pune",
      conversationFlow: DEFAULT_CONVERSATION_FLOW,
    });
    expect(hit!.intent).toBe("gig_posting_request");
  });

  it("routes freelancer self-description to freelancer_profile_request", () => {
    const hit = classifyUniversalIntentDeterministic({
      userMessage:
        "I'm a designer looking for gig work. Skills: logo design, branding. Available weekdays.",
      conversationFlow: DEFAULT_CONVERSATION_FLOW,
    });
    expect(hit!.intent).toBe("freelancer_profile_request");
  });

  it("does not treat business listing as a gig", () => {
    const hit = classifyUniversalIntentDeterministic({
      userMessage: "My business is called Cafe Nova and we sell coffee in Mumbai",
      conversationFlow: DEFAULT_CONVERSATION_FLOW,
    });
    expect(hit!.intent).toBe("business_profile_request");
  });

  it("keeps generate-an-image as image_generation_request", () => {
    const hit = classifyUniversalIntentDeterministic({
      userMessage: "Generate an image of a mountain at sunrise",
      conversationFlow: DEFAULT_CONVERSATION_FLOW,
    });
    expect(hit!.intent).toBe("image_generation_request");
  });

  it("keeps general questions off marketplace", () => {
    const hit = classifyUniversalIntentDeterministic({
      userMessage: "What is photosynthesis?",
      conversationFlow: DEFAULT_CONVERSATION_FLOW,
    });
    expect(hit!.intent).toBe("general_question");
  });
});
