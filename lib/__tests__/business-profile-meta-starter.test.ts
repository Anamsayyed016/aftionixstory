import { afterAll, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import { runBusinessProfileTurn } from "@/lib/business-agent";
import { withBusinessDraftInState } from "@/lib/business-agent/extract";

describe("runBusinessProfileTurn — meta starter must not create junk businesses", () => {
  let userId: string | null = null;

  afterAll(async () => {
    if (!userId) return;
    await prisma.business.deleteMany({ where: { ownerUserId: userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
  });

  it("asks for details instead of saving the studio starter prompt", async () => {
    const email = `biz-meta-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: {
        email,
        name: "Meta Tester",
        passwordHash: await bcrypt.hash("x", 4),
      },
    });
    userId = user.id;

    const t0 = await runBusinessProfileTurn({
      userId: user.id,
      message:
        "List my business on the directory. I'll share the name, what we do, location, and contact email.",
      userEmail: email,
      conversationState: {},
    });

    expect(t0.assistantReply.toLowerCase()).toMatch(
      /business name|tell me|what you do|where you're based/
    );
    expect(t0.assistantReply).not.toMatch(/Saved \*\*/);
    expect(t0.assistantReply).not.toMatch(/is live at/);
    expect(t0.publicPath).toBeUndefined();

    const rows = await prisma.business.findMany({
      where: { ownerUserId: user.id },
    });
    expect(rows).toHaveLength(0);

    // Follow-up with real details should still work
    const state = withBusinessDraftInState({}, t0.nextDraft);
    const t1 = await runBusinessProfileTurn({
      userId: user.id,
      message:
        "name - Bright Print Co, category - printing, location - Pune, email - " +
        email,
      userEmail: email,
      conversationState: state,
    });
    expect(t1.nextDraft.name?.toLowerCase()).toContain("bright print");
    expect(t1.nextDraft.location?.toLowerCase()).toBe("pune");
    expect(t1.nextDraft.summary?.toLowerCase()).not.toContain(
      "list my business on the directory"
    );
  }, 30000);
});
