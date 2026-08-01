/**
 * Seed marketplace demo data for screenshots / local QA.
 * Usage: npx tsx scripts/seed-marketplace-demo.mjs
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("demo-pass-123", 10);

  const bizUser = await prisma.user.upsert({
    where: { email: "demo-business@aftionix.example" },
    update: {},
    create: {
      email: "demo-business@aftionix.example",
      name: "Demo Business Owner",
      passwordHash,
    },
  });

  const freelUser = await prisma.user.upsert({
    where: { email: "demo-freelancer@aftionix.example" },
    update: {},
    create: {
      email: "demo-freelancer@aftionix.example",
      name: "Demo Freelancer",
      passwordHash,
    },
  });

  const business = await prisma.business.upsert({
    where: { slug: "bright-print-co" },
    update: {
      name: "Bright Print Co",
      summary:
        "Local printing and branding studio for shops and startups across Pune.",
      category: "Printing & branding",
      location: "Pune",
      // Must match owner email for public /b/[slug] verification.
      contactEmail: "demo-business@aftionix.example",
      contactPhone: "+91 98765 43210",
      verifiedAt: new Date(),
    },
    create: {
      ownerUserId: bizUser.id,
      slug: "bright-print-co",
      name: "Bright Print Co",
      summary:
        "Local printing and branding studio for shops and startups across Pune.",
      category: "Printing & branding",
      location: "Pune",
      contactEmail: "demo-business@aftionix.example",
      contactPhone: "+91 98765 43210",
      verifiedAt: new Date(),
    },
  });

  const freelancer = await prisma.freelancerProfile.upsert({
    where: { slug: "maya-designer" },
    update: {
      summary:
        "Brand and logo designer. Clean marks for cafés, shops, and small products.",
      skills: ["logo design", "branding", "illustration"],
      location: "remote",
      availability: "Weekdays, 10am–6pm IST",
      portfolioLinks: ["https://portfolio.example/maya"],
      contactEmail: "maya@designer.example",
      contactPhone: "+91 91234 56789",
    },
    create: {
      userId: freelUser.id,
      slug: "maya-designer",
      summary:
        "Brand and logo designer. Clean marks for cafés, shops, and small products.",
      skills: ["logo design", "branding", "illustration"],
      location: "remote",
      availability: "Weekdays, 10am–6pm IST",
      portfolioLinks: ["https://portfolio.example/maya"],
      contactEmail: "maya@designer.example",
      contactPhone: "+91 91234 56789",
    },
  });

  await prisma.gigMatch.deleteMany({
    where: {
      OR: [
        { gig: { businessId: business.id } },
        { freelancerProfileId: freelancer.id },
      ],
    },
  });
  await prisma.gigRequest.deleteMany({ where: { businessId: business.id } });

  const gig = await prisma.gigRequest.create({
    data: {
      businessId: business.id,
      postedByUserId: bizUser.id,
      title: "Logo design",
      description:
        "I need a logo designed for our packaging refresh — simple mark that works on kraft bags.",
      skillNeeded: "logo design",
      category: "design",
      location: "remote",
      budget: "₹8,000–12,000",
      status: "OPEN",
    },
  });

  const pending = await prisma.gigMatch.create({
    data: {
      gigId: gig.id,
      freelancerProfileId: freelancer.id,
      initiatedBy: "BUSINESS",
      initiatedByUserId: bizUser.id,
      status: "PENDING",
    },
  });

  const gig2 = await prisma.gigRequest.create({
    data: {
      businessId: business.id,
      postedByUserId: bizUser.id,
      title: "Packaging icons",
      description: "Small icon set for labels.",
      skillNeeded: "illustration",
      category: "design",
      location: "remote",
      budget: "₹5,000",
      status: "MATCHED",
    },
  });

  const accepted = await prisma.gigMatch.create({
    data: {
      gigId: gig2.id,
      freelancerProfileId: freelancer.id,
      initiatedBy: "FREELANCER",
      initiatedByUserId: freelUser.id,
      status: "ACCEPTED",
    },
  });

  console.log(
    JSON.stringify(
      {
        businessPath: `/b/${business.slug}`,
        freelancerPath: `/f/${freelancer.slug}`,
        gigId: gig.id,
        pendingMatchId: pending.id,
        acceptedMatchId: accepted.id,
        note: "Public /f never shows contact; ACCEPTED match reveals in Connect UI.",
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
