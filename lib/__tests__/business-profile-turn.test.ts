import { afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import { runBusinessProfileTurn } from "@/lib/business-agent";
import { withBusinessDraftInState } from "@/lib/business-agent/extract";

describe("runBusinessProfileTurn — reported loop regression", () => {
  let userId: string | null = null;

  afterAll(async () => {
    if (!userId) return;
    await prisma.business.deleteMany({ where: { ownerUserId: userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  });

  it("completes the exact informal multi-turn flow without re-asking name", async () => {
    const email = `biz-loop-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: {
        email,
        name: "Loop Tester",
        passwordHash: await bcrypt.hash("x", 4),
      },
    });
    userId = user.id;

    let state: unknown = {};

    const t0 = await runBusinessProfileTurn({
      userId: user.id,
      message: "List my business on the directory",
      userEmail: email,
      conversationState: state,
    });
    expect(t0.assistantReply.toLowerCase()).toMatch(/business name|tell me/);
    expect(t0.assistantReply).not.toMatch(/Saved \*\*/);
    state = withBusinessDraftInState(state, t0.nextDraft);

    const t1 = await runBusinessProfileTurn({
      userId: user.id,
      message: "software developer, hoor, anamsayyed58@gmail.com",
      userEmail: email,
      conversationState: state,
    });
    // Must NOT blindly re-ask the original full question with no acknowledgment
    expect(t1.assistantReply).not.toBe(
      "What's the business name? You can also include category, location, and contact email."
    );
    expect(t1.assistantReply.toLowerCase()).toMatch(/hoor|saved/);
    expect(t1.nextDraft.name?.toLowerCase()).toBe("hoor");
    expect(t1.nextDraft.contactEmail).toBe("anamsayyed58@gmail.com");
    state = withBusinessDraftInState(state, t1.nextDraft);

    const t2 = await runBusinessProfileTurn({
      userId: user.id,
      message: "name - hoor, location- banswara",
      userEmail: email,
      conversationState: state,
    });
    expect(t2.assistantReply).not.toBe(
      "What's the business name? You can also include category, location, and contact email."
    );
    expect(t2.nextDraft.location?.toLowerCase()).toBe("banswara");
    expect(t2.publicPath).toMatch(/^\/b\//);
    expect(t2.assistantReply.toLowerCase()).toMatch(/live|saved|\/b\//);

    const row = await prisma.business.findFirst({
      where: { ownerUserId: user.id },
    });
    expect(row?.name.toLowerCase()).toBe("hoor");
    expect(row?.location?.toLowerCase()).toBe("banswara");
    expect(row?.contactEmail).toBe("anamsayyed58@gmail.com");
  }, 30000);
});
