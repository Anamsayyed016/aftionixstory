-- Phase B: Story foundation (additive only)

-- CreateEnum
CREATE TYPE "StoryVisibility" AS ENUM ('PRIVATE', 'UNLISTED', 'PUBLIC');

-- CreateEnum
CREATE TYPE "StoryStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CharacterStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "genre" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "storyType" TEXT,
    "visibility" "StoryVisibility" NOT NULL DEFAULT 'PRIVATE',
    "writingStyle" TEXT,
    "dialogueStyle" TEXT,
    "pointOfView" TEXT,
    "episodeLength" TEXT,
    "tone" TEXT,
    "romanceLevel" TEXT,
    "pacing" TEXT,
    "customInstructions" TEXT,
    "setting" TEXT,
    "timePeriod" TEXT,
    "mainConflict" TEXT,
    "initialPlot" TEXT,
    "worldRules" TEXT,
    "contentBoundaries" TEXT,
    "currentSummary" TEXT,
    "status" "StoryStatus" NOT NULL DEFAULT 'DRAFT',
    "totalEpisodes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER,
    "gender" TEXT,
    "role" TEXT NOT NULL,
    "appearance" TEXT,
    "personality" TEXT NOT NULL,
    "background" TEXT,
    "speakingStyle" TEXT,
    "secrets" TEXT,
    "emotionalState" TEXT,
    "status" "CharacterStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterRelationship" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "sourceCharacterId" TEXT NOT NULL,
    "targetCharacterId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "description" TEXT,
    "currentStatus" TEXT,
    "emotionalDynamic" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingRule" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "category" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WritingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Story_userId_idx" ON "Story"("userId");

-- CreateIndex
CREATE INDEX "Story_status_idx" ON "Story"("status");

-- CreateIndex
CREATE INDEX "Story_updatedAt_idx" ON "Story"("updatedAt");

-- CreateIndex
CREATE INDEX "Story_visibility_idx" ON "Story"("visibility");

-- CreateIndex
CREATE UNIQUE INDEX "Story_userId_slug_key" ON "Story"("userId", "slug");

-- CreateIndex
CREATE INDEX "Character_storyId_idx" ON "Character"("storyId");

-- CreateIndex
CREATE INDEX "Character_status_idx" ON "Character"("status");

-- CreateIndex
CREATE INDEX "Character_role_idx" ON "Character"("role");

-- CreateIndex
CREATE INDEX "Character_name_idx" ON "Character"("name");

-- CreateIndex
CREATE INDEX "CharacterRelationship_storyId_idx" ON "CharacterRelationship"("storyId");

-- CreateIndex
CREATE INDEX "CharacterRelationship_sourceCharacterId_idx" ON "CharacterRelationship"("sourceCharacterId");

-- CreateIndex
CREATE INDEX "CharacterRelationship_targetCharacterId_idx" ON "CharacterRelationship"("targetCharacterId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterRelationship_storyId_sourceCharacterId_targetCharacterId_relationshipType_key" ON "CharacterRelationship"("storyId", "sourceCharacterId", "targetCharacterId", "relationshipType");

-- CreateIndex
CREATE INDEX "WritingRule_storyId_idx" ON "WritingRule"("storyId");

-- CreateIndex
CREATE INDEX "WritingRule_isActive_idx" ON "WritingRule"("isActive");

-- CreateIndex
CREATE INDEX "WritingRule_priority_idx" ON "WritingRule"("priority");

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterRelationship" ADD CONSTRAINT "CharacterRelationship_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterRelationship" ADD CONSTRAINT "CharacterRelationship_sourceCharacterId_fkey" FOREIGN KEY ("sourceCharacterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterRelationship" ADD CONSTRAINT "CharacterRelationship_targetCharacterId_fkey" FOREIGN KEY ("targetCharacterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingRule" ADD CONSTRAINT "WritingRule_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
