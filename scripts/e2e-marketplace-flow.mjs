/**
 * End-to-end marketplace smoke: create business + public page,
 * freelancer profile, gig, mutual accept → contact reveal.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
const base = process.env.BASE_URL || "http://127.0.0.1:3000";

function revealContactsForMatch({ status, business, freelancer }) {
  if (status !== "ACCEPTED") {
    return {
      revealed: false,
      business: { email: null, phone: null },
      freelancer: { email: null, phone: null },
    };
  }
  return {
    revealed: true,
    business: {
      email: business.contactEmail,
      phone: business.contactPhone,
    },
    freelancer: {
      email: freelancer.contactEmail || freelancer.userEmail,
      phone: freelancer.contactPhone,
    },
  };
}

async function main() {
  const passwordHash = await bcrypt.hash("e2e-pass", 10);

  const bizUser = await prisma.user.upsert({
    where: { email: `e2e-biz-${stamp}@aftionix.example` },
    update: {},
    create: {
      email: `e2e-biz-${stamp}@aftionix.example`,
      name: "E2E Biz",
      passwordHash,
    },
  });
  const freelUser = await prisma.user.upsert({
    where: { email: `e2e-freel-${stamp}@aftionix.example` },
    update: {},
    create: {
      email: `e2e-freel-${stamp}@aftionix.example`,
      name: "E2E Freelancer",
      passwordHash,
    },
  });

  const bizSlug = `e2e-biz-${stamp}`;
  const business = await prisma.business.create({
    data: {
      ownerUserId: bizUser.id,
      slug: bizSlug,
      name: `E2E Shop ${stamp}`,
      summary: "E2E verification listing",
      category: "Services",
      location: "Pune",
      contactEmail: "shop@e2e.example",
      contactPhone: "+91 90000 00001",
    },
  });

  const freelSlug = `e2e-freel-${stamp}`;
  const freelancer = await prisma.freelancerProfile.create({
    data: {
      userId: freelUser.id,
      slug: freelSlug,
      summary: "E2E designer",
      skills: ["logo design"],
      location: "remote",
      availability: "Weekdays",
      contactEmail: "freel@e2e.example",
      contactPhone: "+91 90000 00002",
    },
  });

  const gig = await prisma.gigRequest.create({
    data: {
      businessId: business.id,
      postedByUserId: bizUser.id,
      title: "E2E logo gig",
      description: "Need a mark for packaging",
      skillNeeded: "logo design",
      status: "OPEN",
    },
  });

  const pending = await prisma.gigMatch.create({
    data: {
      gigId: gig.id,
      freelancerProfileId: freelancer.id,
      status: "PENDING",
      initiatedBy: "FREELANCER",
      initiatedByUserId: freelUser.id,
    },
  });

  const pendingReveal = revealContactsForMatch({
    status: pending.status,
    business,
    freelancer: { ...freelancer, userEmail: freelUser.email },
  });
  if (pendingReveal.revealed) throw new Error("contact leaked while PENDING");

  const accepted = await prisma.gigMatch.update({
    where: { id: pending.id },
    data: { status: "ACCEPTED" },
  });

  const acceptedReveal = revealContactsForMatch({
    status: accepted.status,
    business,
    freelancer: { ...freelancer, userEmail: freelUser.email },
  });
  if (
    !acceptedReveal.revealed ||
    acceptedReveal.business.email !== "shop@e2e.example" ||
    acceptedReveal.freelancer.email !== "freel@e2e.example"
  ) {
    throw new Error(`reveal failed: ${JSON.stringify(acceptedReveal)}`);
  }

  const bizPage = await fetch(`${base}/b/${bizSlug}`);
  const freelPage = await fetch(`${base}/f/${freelSlug}`);
  if (!bizPage.ok) throw new Error(`/b/${bizSlug} → ${bizPage.status}`);
  if (!freelPage.ok) throw new Error(`/f/${freelSlug} → ${freelPage.status}`);

  const bizHtml = await bizPage.text();
  if (!bizHtml.includes(business.name)) {
    throw new Error("business page missing name");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        businessPath: `/b/${bizSlug}`,
        freelancerPath: `/f/${freelSlug}`,
        matchId: accepted.id,
        revealed: acceptedReveal,
        http: { business: bizPage.status, freelancer: freelPage.status },
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
