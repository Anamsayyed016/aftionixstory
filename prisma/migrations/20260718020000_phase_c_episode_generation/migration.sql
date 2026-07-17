-- Phase C: Episode generation (additive only)

-- CreateEnum
CREATE TYPE "GenerationAction" AS ENUM ('NEW_EPISODE', 'CONTINUE', 'REGENERATE', 'IMPROVE_WRITING', 'MORE_ROMANTIC', 'MORE_EMOTIONAL', 'ADD_COMEDY');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('DRAFT', 'SAVED', 'FAILED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "generationPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "userInstruction" TEXT,
    "generationAction" "GenerationAction",
    "generationStatus" "GenerationStatus" NOT NULL DEFAULT 'SAVED',
    "wordCount" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EpisodeVersion" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "changeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EpisodeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "episodeId" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "action" "GenerationAction" NOT NULL,
    "inputCharacters" INTEGER,
    "outputCharacters" INTEGER,
    "estimatedInputTokens" INTEGER,
    "estimatedOutputTokens" INTEGER,
    "durationMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GenerationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Episode_storyId_idx" ON "Episode"("storyId");

-- CreateIndex
CREATE INDEX "Episode_storyId_createdAt_idx" ON "Episode"("storyId", "createdAt");

-- CreateIndex
CREATE INDEX "Episode_generationStatus_idx" ON "Episode"("generationStatus");

-- CreateIndex
CREATE INDEX "Episode_updatedAt_idx" ON "Episode"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_storyId_episodeNumber_key" ON "Episode"("storyId", "episodeNumber");

-- CreateIndex
CREATE INDEX "EpisodeVersion_episodeId_idx" ON "EpisodeVersion"("episodeId");

-- CreateIndex
CREATE INDEX "EpisodeVersion_createdAt_idx" ON "EpisodeVersion"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EpisodeVersion_episodeId_versionNumber_key" ON "EpisodeVersion"("episodeId", "versionNumber");

-- CreateIndex
CREATE INDEX "GenerationLog_userId_idx" ON "GenerationLog"("userId");

-- CreateIndex
CREATE INDEX "GenerationLog_storyId_idx" ON "GenerationLog"("storyId");

-- CreateIndex
CREATE INDEX "GenerationLog_episodeId_idx" ON "GenerationLog"("episodeId");

-- CreateIndex
CREATE INDEX "GenerationLog_createdAt_idx" ON "GenerationLog"("createdAt");

-- CreateIndex
CREATE INDEX "GenerationLog_success_idx" ON "GenerationLog"("success");

-- CreateIndex
CREATE INDEX "GenerationLog_requestId_idx" ON "GenerationLog"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationLog_userId_requestId_key" ON "GenerationLog"("userId", "requestId");

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EpisodeVersion" ADD CONSTRAINT "EpisodeVersion_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationLog" ADD CONSTRAINT "GenerationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationLog" ADD CONSTRAINT "GenerationLog_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationLog" ADD CONSTRAINT "GenerationLog_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
