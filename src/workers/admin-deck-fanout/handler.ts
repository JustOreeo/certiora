/**
 * Admin-seeded deck fan-out worker (Phase 9).
 * Publish: create ADMIN_SEEDED copy for every student in tenant.
 * Reactivate: create copy only for students who don't have one.
 * Onboard: for a new student, create copy of every ACTIVE admin deck.
 */
import type { Job } from "bullmq";
import type { AdminDeckFanoutPayload, AdminDeckOnboardPayload } from "@/lib/queue";
import { prisma, tenantScope } from "@/lib/db";
import { CardState } from "@prisma/client";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function createDeckCopyForUser(
  tx: Tx,
  sourceDeck: {
    id: string;
    name: string;
    description: string | null;
    version: number;
    suggestedRetentionTarget: number | null;
    cards: Array<{ id: string; front: string; back: string; order: number }>;
  },
  tenantId: string,
  userId: string
): Promise<string> {
  const now = new Date();
  const deck = await tx.flashcardDeck.create({
    data: {
      tenantId,
      userId,
      name: sourceDeck.name,
      description: sourceDeck.description,
      source: "ADMIN_SEEDED",
      isPublic: true,
      sourceDeckId: sourceDeck.id,
      importedAtVersion: sourceDeck.version,
      retentionTarget: sourceDeck.suggestedRetentionTarget,
    },
  });
  for (let i = 0; i < sourceDeck.cards.length; i++) {
    const src = sourceDeck.cards[i];
    const card = await tx.flashcardCard.create({
      data: {
        deckId: deck.id,
        tenantId,
        front: src.front,
        back: src.back,
        order: i,
        sourceCardId: src.id,
      },
    });
    await tx.flashcardCardSrsState.create({
      data: {
        tenantId,
        userId,
        cardId: card.id,
        state: CardState.NEW,
        nextReviewAt: now,
      },
    });
  }
  return deck.id;
}

export async function handleAdminDeckFanout(
  job: Job<AdminDeckFanoutPayload>
): Promise<void> {
  const { tenantId, deckId, mode } = job.data;

  const sourceDeck = await prisma.flashcardDeck.findFirst({
    where: {
      id: deckId,
      ...tenantScope(tenantId),
      sourceDeckId: null,
    },
    include: {
      cards: { orderBy: { order: "asc", createdAt: "asc" } },
    },
  });

  if (!sourceDeck) {
    throw new Error(`Admin deck not found or wrong status: ${deckId}`);
  }

  const students =
    mode === "publish"
      ? await prisma.user.findMany({
          where: { ...tenantScope(tenantId), role: "STUDENT" },
          select: { id: true },
        })
      : await prisma.user.findMany({
          where: {
            ...tenantScope(tenantId),
            role: "STUDENT",
            id: {
              notIn: await prisma.flashcardDeck
                .findMany({
                  where: { sourceDeckId: deckId, ...tenantScope(tenantId) },
                  select: { userId: true },
                })
                .then((decks) => decks.map((d) => d.userId)),
            },
          },
          select: { id: true },
        });

  const payload = {
    id: sourceDeck.id,
    name: sourceDeck.name,
    description: sourceDeck.description,
    version: sourceDeck.version,
    suggestedRetentionTarget: sourceDeck.suggestedRetentionTarget,
    cards: sourceDeck.cards.map((c) => ({
      id: c.id,
      front: c.front,
      back: c.back,
      order: c.order,
    })),
  };

  for (const student of students) {
    await prisma.$transaction(async (tx) => {
      await createDeckCopyForUser(tx, payload, tenantId, student.id);
    });
  }
}

export async function handleAdminDeckOnboard(
  job: Job<AdminDeckOnboardPayload>
): Promise<void> {
  const { tenantId, userId } = job.data;

  const activeDecks = await prisma.flashcardDeck.findMany({
    where: {
      ...tenantScope(tenantId),
      sourceDeckId: null,
      status: "ACTIVE",
    },
    include: {
      cards: { orderBy: { order: "asc", createdAt: "asc" } },
    },
  });

  const existingCopyDeckIds = await prisma.flashcardDeck
    .findMany({
      where: { ...tenantScope(tenantId), userId, sourceDeckId: { not: null } },
      select: { sourceDeckId: true },
    })
    .then((decks) => new Set(decks.map((d) => d.sourceDeckId).filter(Boolean) as string[]));

  for (const sourceDeck of activeDecks) {
    if (existingCopyDeckIds.has(sourceDeck.id)) continue;

    const payload = {
      id: sourceDeck.id,
      name: sourceDeck.name,
      description: sourceDeck.description,
      version: sourceDeck.version,
      suggestedRetentionTarget: sourceDeck.suggestedRetentionTarget,
      cards: sourceDeck.cards.map((c) => ({
        id: c.id,
        front: c.front,
        back: c.back,
        order: c.order,
      })),
    };

    await prisma.$transaction(async (tx) => {
      await createDeckCopyForUser(tx, payload, tenantId, userId);
    });
  }
}
