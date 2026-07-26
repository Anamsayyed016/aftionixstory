-- AlterEnum
ALTER TYPE "GenerationAction" ADD VALUE 'GENERATE_CHAT_IMAGE';

-- DropForeignKey
ALTER TABLE "GenerationLog" DROP CONSTRAINT "GenerationLog_storyId_fkey";

-- AlterTable
ALTER TABLE "GenerationLog" ALTER COLUMN "storyId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "GenerationLog" ADD CONSTRAINT "GenerationLog_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE SET NULL ON UPDATE CASCADE;
