-- Phase A: Business Directory + Phase B: Freelancer Connect

CREATE TYPE "GigStatus" AS ENUM ('OPEN', 'MATCHED', 'CLOSED');
CREATE TYPE "GigMatchStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');
CREATE TYPE "GigMatchInitiator" AS ENUM ('BUSINESS', 'FREELANCER');

CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "category" TEXT,
    "location" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FreelancerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "location" TEXT,
    "portfolioLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "availability" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreelancerProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GigRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "postedByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "skillNeeded" TEXT,
    "category" TEXT,
    "location" TEXT,
    "budget" TEXT,
    "status" "GigStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GigRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GigMatch" (
    "id" TEXT NOT NULL,
    "gigId" TEXT NOT NULL,
    "freelancerProfileId" TEXT NOT NULL,
    "initiatedBy" "GigMatchInitiator" NOT NULL,
    "initiatedByUserId" TEXT NOT NULL,
    "status" "GigMatchStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GigMatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Business_slug_key" ON "Business"("slug");
CREATE INDEX "Business_ownerUserId_idx" ON "Business"("ownerUserId");
CREATE INDEX "Business_category_idx" ON "Business"("category");
CREATE INDEX "Business_createdAt_idx" ON "Business"("createdAt");

CREATE UNIQUE INDEX "FreelancerProfile_userId_key" ON "FreelancerProfile"("userId");
CREATE UNIQUE INDEX "FreelancerProfile_slug_key" ON "FreelancerProfile"("slug");
CREATE INDEX "FreelancerProfile_location_idx" ON "FreelancerProfile"("location");
CREATE INDEX "FreelancerProfile_createdAt_idx" ON "FreelancerProfile"("createdAt");

CREATE INDEX "GigRequest_businessId_idx" ON "GigRequest"("businessId");
CREATE INDEX "GigRequest_postedByUserId_idx" ON "GigRequest"("postedByUserId");
CREATE INDEX "GigRequest_status_idx" ON "GigRequest"("status");
CREATE INDEX "GigRequest_createdAt_idx" ON "GigRequest"("createdAt");

CREATE UNIQUE INDEX "GigMatch_gigId_freelancerProfileId_key" ON "GigMatch"("gigId", "freelancerProfileId");
CREATE INDEX "GigMatch_gigId_idx" ON "GigMatch"("gigId");
CREATE INDEX "GigMatch_freelancerProfileId_idx" ON "GigMatch"("freelancerProfileId");
CREATE INDEX "GigMatch_status_idx" ON "GigMatch"("status");
CREATE INDEX "GigMatch_createdAt_idx" ON "GigMatch"("createdAt");

ALTER TABLE "Business" ADD CONSTRAINT "Business_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FreelancerProfile" ADD CONSTRAINT "FreelancerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GigRequest" ADD CONSTRAINT "GigRequest_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GigRequest" ADD CONSTRAINT "GigRequest_postedByUserId_fkey" FOREIGN KEY ("postedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GigMatch" ADD CONSTRAINT "GigMatch_gigId_fkey" FOREIGN KEY ("gigId") REFERENCES "GigRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GigMatch" ADD CONSTRAINT "GigMatch_freelancerProfileId_fkey" FOREIGN KEY ("freelancerProfileId") REFERENCES "FreelancerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GigMatch" ADD CONSTRAINT "GigMatch_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
