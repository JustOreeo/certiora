-- CreateEnum
CREATE TYPE "DeckSource" AS ENUM ('PERSONAL', 'SHARED', 'ADMIN_SEEDED', 'EXAM_GENERATED');

-- CreateEnum
CREATE TYPE "DeckStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CardState" AS ENUM ('NEW', 'LEARNING', 'REVIEW', 'RELEARNING');

-- CreateTable
CREATE TABLE "FlashcardDeck" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source" "DeckSource",
    "status" "DeckStatus",
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "importCount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "sourceDeckId" TEXT,
    "importedAtVersion" INTEGER,
    "shareCode" TEXT,
    "shareCodeCreatedAt" TIMESTAMP(3),
    "retentionTarget" DOUBLE PRECISION,
    "suggestedRetentionTarget" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashcardDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashcardCard" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "sourceCardId" TEXT,
    "isOrphaned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashcardCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashcardCardSrsState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "state" "CardState" NOT NULL DEFAULT 'NEW',
    "stability" DOUBLE PRECISION,
    "difficulty" DOUBLE PRECISION,
    "elapsedDays" INTEGER NOT NULL DEFAULT 0,
    "scheduledDays" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "nextReviewAt" TIMESTAMP(3) NOT NULL,
    "lastReviewAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashcardCardSrsState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashcardReviewLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "grade" INTEGER NOT NULL,
    "state" "CardState" NOT NULL,
    "stabilityBefore" DOUBLE PRECISION,
    "stabilityAfter" DOUBLE PRECISION NOT NULL,
    "difficultyBefore" DOUBLE PRECISION,
    "difficultyAfter" DOUBLE PRECISION NOT NULL,
    "retrievability" DOUBLE PRECISION,
    "elapsedDays" INTEGER NOT NULL,
    "scheduledDays" INTEGER NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlashcardReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FsrsParams" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "w" DOUBLE PRECISION[] NOT NULL,
    "retentionTarget" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "isOptimized" BOOLEAN NOT NULL DEFAULT false,
    "optimizedAt" TIMESTAMP(3),
    "reviewCountAtOptimization" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FsrsParams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FlashcardDeck_tenantId_userId_idx" ON "FlashcardDeck"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "FlashcardDeck_shareCode_key" ON "FlashcardDeck"("shareCode");

-- CreateIndex
CREATE INDEX "FlashcardDeck_tenantId_source_idx" ON "FlashcardDeck"("tenantId", "source");

-- CreateIndex
CREATE INDEX "FlashcardDeck_tenantId_isPublic_idx" ON "FlashcardDeck"("tenantId", "isPublic");

-- CreateIndex
CREATE INDEX "FlashcardDeck_tenantId_isPublic_importCount_idx" ON "FlashcardDeck"("tenantId", "isPublic", "importCount");

-- CreateIndex
CREATE INDEX "FlashcardDeck_sourceDeckId_idx" ON "FlashcardDeck"("sourceDeckId");

-- CreateIndex
CREATE INDEX "FlashcardCard_deckId_idx" ON "FlashcardCard"("deckId");

-- CreateIndex
CREATE INDEX "FlashcardCard_tenantId_idx" ON "FlashcardCard"("tenantId");

-- CreateIndex
CREATE INDEX "FlashcardCard_sourceCardId_idx" ON "FlashcardCard"("sourceCardId");

-- CreateIndex
CREATE UNIQUE INDEX "FlashcardCardSrsState_userId_cardId_key" ON "FlashcardCardSrsState"("userId", "cardId");

-- CreateIndex
CREATE INDEX "FlashcardCardSrsState_tenantId_userId_idx" ON "FlashcardCardSrsState"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "FlashcardCardSrsState_userId_nextReviewAt_idx" ON "FlashcardCardSrsState"("userId", "nextReviewAt");

-- CreateIndex
CREATE INDEX "FlashcardCardSrsState_userId_state_idx" ON "FlashcardCardSrsState"("userId", "state");

-- CreateIndex
CREATE INDEX "FlashcardReviewLog_tenantId_userId_idx" ON "FlashcardReviewLog"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "FlashcardReviewLog_userId_reviewedAt_idx" ON "FlashcardReviewLog"("userId", "reviewedAt");

-- CreateIndex
CREATE INDEX "FlashcardReviewLog_userId_deckId_idx" ON "FlashcardReviewLog"("userId", "deckId");

-- CreateIndex
CREATE INDEX "FlashcardReviewLog_userId_cardId_idx" ON "FlashcardReviewLog"("userId", "cardId");

-- CreateIndex
CREATE UNIQUE INDEX "FsrsParams_tenantId_userId_key" ON "FsrsParams"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "FsrsParams_tenantId_idx" ON "FsrsParams"("tenantId");

-- AddForeignKey
ALTER TABLE "FlashcardDeck" ADD CONSTRAINT "FlashcardDeck_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardDeck" ADD CONSTRAINT "FlashcardDeck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardDeck" ADD CONSTRAINT "FlashcardDeck_sourceDeckId_fkey" FOREIGN KEY ("sourceDeckId") REFERENCES "FlashcardDeck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardCard" ADD CONSTRAINT "FlashcardCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "FlashcardDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardCard" ADD CONSTRAINT "FlashcardCard_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardCard" ADD CONSTRAINT "FlashcardCard_sourceCardId_fkey" FOREIGN KEY ("sourceCardId") REFERENCES "FlashcardCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardCardSrsState" ADD CONSTRAINT "FlashcardCardSrsState_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardCardSrsState" ADD CONSTRAINT "FlashcardCardSrsState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardCardSrsState" ADD CONSTRAINT "FlashcardCardSrsState_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "FlashcardCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardReviewLog" ADD CONSTRAINT "FlashcardReviewLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardReviewLog" ADD CONSTRAINT "FlashcardReviewLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardReviewLog" ADD CONSTRAINT "FlashcardReviewLog_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "FlashcardCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashcardReviewLog" ADD CONSTRAINT "FlashcardReviewLog_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "FlashcardDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FsrsParams" ADD CONSTRAINT "FsrsParams_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FsrsParams" ADD CONSTRAINT "FsrsParams_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
