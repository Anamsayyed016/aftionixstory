-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "GenerationAction" ADD VALUE 'GENERATE_AVATAR';
ALTER TYPE "GenerationAction" ADD VALUE 'GENERATE_COVER';

-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "avatarUrl" TEXT;

-- AlterTable
ALTER TABLE "GenerationLog" ADD COLUMN     "characterId" TEXT;

-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "coverImageUrl" TEXT;

-- CreateIndex
CREATE INDEX "GenerationLog_characterId_idx" ON "GenerationLog"("characterId");

-- AddForeignKey
ALTER TABLE "GenerationLog" ADD CONSTRAINT "GenerationLog_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "CharacterRelationship_storyId_sourceCharacterId_targetCharacter" RENAME TO "CharacterRelationship_storyId_sourceCharacterId_targetChara_key";
