-- AlterTable
ALTER TABLE "FlashcardCard" ADD COLUMN "questionId" TEXT;

-- CreateIndex
CREATE INDEX "FlashcardCard_deckId_questionId_idx" ON "FlashcardCard"("deckId", "questionId");

-- AddForeignKey
ALTER TABLE "FlashcardCard" ADD CONSTRAINT "FlashcardCard_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;
