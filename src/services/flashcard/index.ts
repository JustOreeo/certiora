import { prisma, tenantScope } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { CardState } from "@prisma/client";
import { randomBytes } from "crypto";

const SHARE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O, 1/I
const SHARE_CODE_LENGTH = 8;

function generateShareCode(): string {
  let code = "";
  const bytes = randomBytes(SHARE_CODE_LENGTH);
  for (let i = 0; i < SHARE_CODE_LENGTH; i++) {
    code += SHARE_CODE_ALPHABET[bytes[i] % SHARE_CODE_ALPHABET.length];
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export type CreateDeckInput = {
  name: string;
  description?: string | null;
  isPublic?: boolean;
};

export type UpdateDeckInput = {
  name?: string;
  description?: string | null;
  isPublic?: boolean;
  retentionTarget?: number | null;
};

export type CreateCardInput = {
  front: string;
  back: string;
};

export type UpdateCardInput = {
  front?: string;
  back?: string;
};

async function assertDeckOwnership(tenantId: string, userId: string, deckId: string) {
  const deck = await prisma.flashcardDeck.findFirst({
    where: {
      id: deckId,
      ...tenantScope(tenantId),
      userId,
    },
  });
  if (!deck) return null;
  return deck;
}

/** Count due cards for a deck (nextReviewAt <= now) for the user. */
async function getDueCountForDeck(tenantId: string, userId: string, deckId: string): Promise<number> {
  const now = new Date();
  return prisma.flashcardCardSrsState.count({
    where: {
      ...tenantScope(tenantId),
      userId,
      card: { deckId },
      nextReviewAt: { lte: now },
    },
  });
}

export const flashcardService = {
  async listDecks(tenantId: string, userId: string) {
    const decks = await prisma.flashcardDeck.findMany({
      where: { ...tenantScope(tenantId), userId },
      include: {
        _count: { select: { cards: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    const now = new Date();
    const dueCounts = await Promise.all(
      decks.map((d) =>
        prisma.flashcardCardSrsState.count({
          where: {
            ...tenantScope(tenantId),
            userId,
            card: { deckId: d.id },
            nextReviewAt: { lte: now },
          },
        })
      )
    );
    return decks.map((d, i) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      source: d.source,
      status: d.status,
      isPublic: d.isPublic,
      version: d.version,
      sourceDeckId: d.sourceDeckId,
      importedAtVersion: d.importedAtVersion,
      shareCode: d.shareCode,
      shareCodeCreatedAt: d.shareCodeCreatedAt,
      retentionTarget: d.retentionTarget,
      suggestedRetentionTarget: d.suggestedRetentionTarget,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      cardCount: d._count.cards,
      dueToday: dueCounts[i],
    }));
  },

  async createDeck(tenantId: string, userId: string, input: CreateDeckInput) {
    const deck = await prisma.flashcardDeck.create({
      data: {
        tenantId,
        userId,
        name: input.name.trim().slice(0, 100),
        description: input.description?.trim().slice(0, 300) ?? null,
        isPublic: input.isPublic ?? false,
        source: "PERSONAL",
      },
    });
    return deck;
  },

  async getDeck(tenantId: string, userId: string, deckId: string) {
    const deck = await prisma.flashcardDeck.findFirst({
      where: { id: deckId, ...tenantScope(tenantId), userId },
      include: {
        cards: { orderBy: { order: "asc", createdAt: "asc" } },
        _count: { select: { cards: true } },
        sourceDeck: { select: { version: true } },
      },
    });
    if (!deck) return null;
    const dueToday = await getDueCountForDeck(tenantId, userId, deckId);
    const { _count, sourceDeck, ...rest } = deck;
    return {
      ...rest,
      cardCount: _count.cards,
      dueToday,
      sourceDeck: sourceDeck ? { version: sourceDeck.version } : null,
    };
  },

  async updateDeck(tenantId: string, userId: string, deckId: string, input: UpdateDeckInput) {
    const deck = await assertDeckOwnership(tenantId, userId, deckId);
    if (!deck) return null;
    // ADMIN_SEEDED: ignore isPublic (per PRD §12)
    const isPublic =
      deck.source === "ADMIN_SEEDED" ? deck.isPublic : (input.isPublic ?? deck.isPublic);
    const data: Parameters<typeof prisma.flashcardDeck.update>[0]["data"] = {
      ...(input.name !== undefined && { name: input.name.trim().slice(0, 100) }),
      ...(input.description !== undefined && {
        description: input.description?.trim().slice(0, 300) ?? null,
      }),
      isPublic,
    };
    if (input.retentionTarget !== undefined) {
      if (input.retentionTarget !== null) {
        const r = Math.max(0.7, Math.min(0.97, input.retentionTarget));
        data.retentionTarget = r;
      } else {
        data.retentionTarget = null;
      }
    }
    return prisma.flashcardDeck.update({
      where: { id: deckId },
      data,
    });
  },

  async deleteDeck(tenantId: string, userId: string, deckId: string) {
    const deck = await assertDeckOwnership(tenantId, userId, deckId);
    if (!deck) return null;
    if (deck.source === "EXAM_GENERATED") return "EXAM_GENERATED"; // cannot delete
    await prisma.flashcardDeck.delete({ where: { id: deckId } });
    return "deleted";
  },

  async addCard(tenantId: string, userId: string, deckId: string, input: CreateCardInput) {
    const deck = await assertDeckOwnership(tenantId, userId, deckId);
    if (!deck) return null;
    const front = input.front.trim();
    const back = input.back.trim();
    if (!front || !back) return "validation";
    const maxOrder = await prisma.flashcardCard
      .aggregate({ where: { deckId }, _max: { order: true } })
      .then((r) => r._max.order ?? -1);
    const card = await prisma.flashcardCard.create({
      data: {
        deckId,
        tenantId,
        front: front.slice(0, 1000),
        back: back.slice(0, 2000),
        order: maxOrder + 1,
      },
    });
    await prisma.flashcardDeck.update({
      where: { id: deckId },
      data: { version: { increment: 1 } },
    });
    const now = new Date();
    await prisma.flashcardCardSrsState.create({
      data: {
        tenantId,
        userId,
        cardId: card.id,
        state: CardState.NEW,
        nextReviewAt: now,
      },
    });
    return prisma.flashcardCard.findUnique({
      where: { id: card.id },
      include: { deck: { select: { id: true, name: true, version: true } } },
    });
  },

  async updateCard(
    tenantId: string,
    userId: string,
    deckId: string,
    cardId: string,
    input: UpdateCardInput
  ) {
    const deck = await assertDeckOwnership(tenantId, userId, deckId);
    if (!deck) return null;
    const card = await prisma.flashcardCard.findFirst({
      where: { id: cardId, deckId, ...tenantScope(tenantId) },
    });
    if (!card) return null;
    const data: { front?: string; back?: string } = {};
    if (input.front !== undefined) {
      const front = input.front.trim();
      if (!front) return "validation";
      data.front = front.slice(0, 1000);
    }
    if (input.back !== undefined) {
      const back = input.back.trim();
      if (!back) return "validation";
      data.back = back.slice(0, 2000);
    }
    if (Object.keys(data).length === 0) return card;
    const updated = await prisma.flashcardCard.update({
      where: { id: cardId },
      data,
    });
    await prisma.flashcardDeck.update({
      where: { id: deckId },
      data: { version: { increment: 1 } },
    });
    return updated;
  },

  async deleteCard(tenantId: string, userId: string, deckId: string, cardId: string) {
    const deck = await assertDeckOwnership(tenantId, userId, deckId);
    if (!deck) return null;
    const card = await prisma.flashcardCard.findFirst({
      where: { id: cardId, deckId, ...tenantScope(tenantId) },
    });
    if (!card) return null;
    await prisma.flashcardCard.delete({ where: { id: cardId } });
    await prisma.flashcardDeck.update({
      where: { id: deckId },
      data: { version: { increment: 1 } },
    });
    return "deleted";
  },

  async generateShareCode(tenantId: string, userId: string, deckId: string) {
    const deck = await assertDeckOwnership(tenantId, userId, deckId);
    if (!deck) return null;
    let code = generateShareCode();
    let attempts = 0;
    while (attempts < 20) {
      const existing = await prisma.flashcardDeck.findUnique({ where: { shareCode: code } });
      if (!existing) break;
      code = generateShareCode();
      attempts++;
    }
    const updated = await prisma.flashcardDeck.update({
      where: { id: deckId },
      data: { shareCode: code, shareCodeCreatedAt: new Date() },
    });
    return { shareCode: updated.shareCode, shareCodeCreatedAt: updated.shareCodeCreatedAt };
  },

  async revokeShareCode(tenantId: string, userId: string, deckId: string) {
    const deck = await assertDeckOwnership(tenantId, userId, deckId);
    if (!deck) return null;
    await prisma.flashcardDeck.update({
      where: { id: deckId },
      data: { shareCode: null, shareCodeCreatedAt: null },
    });
    return "revoked";
  },

  /**
   * Preview deck by share code. Same-tenant only.
   * Returns null for invalid/revoked/own deck; returns preview payload otherwise.
   */
  async previewByShareCode(tenantId: string, userId: string, shareCodeRaw: string) {
    const shareCode = shareCodeRaw.trim().toUpperCase().replace(/\s/g, "");
    if (!shareCode) return null;
    const deck = await prisma.flashcardDeck.findFirst({
      where: {
        shareCode,
        ...tenantScope(tenantId),
      },
      include: {
        user: { select: { name: true } },
        cards: { orderBy: { order: "asc", createdAt: "asc" }, take: 3, select: { front: true } },
        _count: { select: { cards: true } },
      },
    });
    if (!deck) return "invalid";
    if (deck.userId === userId) return "own";
    return {
      id: deck.id,
      name: deck.name,
      description: deck.description,
      cardCount: deck._count.cards,
      creatorName: deck.user.name ?? "Anonymous",
      sampleFronts: deck.cards.map((c) => c.front),
    };
  },

  /**
   * List public decks in the tenant for the library. Returns creator display name or tenant name for ADMIN_SEEDED.
   */
  async listLibrary(
    tenantId: string,
    userId: string,
    options: { search?: string; sort?: "newest" | "most_imported" | "az"; source?: "ADMIN_SEEDED" | "student" }
  ) {
    const { search = "", sort = "newest", source } = options;
    const term = search.trim();
    const where: Prisma.FlashcardDeckWhereInput = {
      ...tenantScope(tenantId),
      isPublic: true,
      ...(source === "ADMIN_SEEDED" && { source: "ADMIN_SEEDED" }),
      ...(source === "student" && { source: { not: "ADMIN_SEEDED" } }),
      ...(term && {
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { description: { contains: term, mode: "insensitive" } },
        ],
      }),
    };
    const orderBy =
      sort === "most_imported"
        ? [{ importCount: "desc" as const }, { createdAt: "desc" as const }]
        : sort === "az"
          ? [{ name: "asc" as const }]
          : [{ createdAt: "desc" as const }];

    const decks = await prisma.flashcardDeck.findMany({
      where,
      include: {
        _count: { select: { cards: true } },
        user: { select: { name: true } },
        tenant: { select: { name: true } },
      },
      orderBy,
    });

    const myImportedDeckIds = await prisma.flashcardDeck
      .findMany({
        where: { ...tenantScope(tenantId), userId, sourceDeckId: { not: null } },
        select: { sourceDeckId: true },
      })
      .then((rows) => new Set(rows.map((r) => r.sourceDeckId).filter(Boolean) as string[]));

    return decks.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      source: d.source,
      cardCount: d._count.cards,
      creatorName:
        d.source === "ADMIN_SEEDED"
          ? (d.tenant.name ?? "Review Center")
          : (d.user.name ?? "Anonymous"),
      importCount: d.importCount,
      isOwn: d.userId === userId,
      alreadyImported: myImportedDeckIds.has(d.id),
    }));
  },

  /**
   * Preview a public deck by id (for library import). Same shape as share-code preview.
   */
  async previewByDeckId(tenantId: string, userId: string, deckId: string) {
    const deck = await prisma.flashcardDeck.findFirst({
      where: { id: deckId, ...tenantScope(tenantId), isPublic: true },
      include: {
        user: { select: { name: true } },
        tenant: { select: { name: true } },
        cards: { orderBy: { order: "asc", createdAt: "asc" }, take: 3, select: { front: true } },
        _count: { select: { cards: true } },
      },
    });
    if (!deck) return "invalid";
    if (deck.userId === userId) return "own";
    return {
      id: deck.id,
      name: deck.name,
      description: deck.description,
      cardCount: deck._count.cards,
      creatorName:
        deck.source === "ADMIN_SEEDED"
          ? (deck.tenant.name ?? "Review Center")
          : (deck.user.name ?? "Anonymous"),
      sampleFronts: deck.cards.map((c) => c.front),
    };
  },

  /**
   * Import deck by library deck id. Creates copy with source SHARED, isPublic false; increments source importCount.
   */
  async importByDeckId(tenantId: string, userId: string, deckId: string) {
    const sourceDeck = await prisma.flashcardDeck.findFirst({
      where: { id: deckId, ...tenantScope(tenantId), isPublic: true },
      include: { cards: { orderBy: { order: "asc", createdAt: "asc" } } },
    });
    if (!sourceDeck) return { error: "invalid" as const };
    if (sourceDeck.userId === userId) return { error: "own" as const };

    const copy = await prisma.$transaction(async (tx) => {
      const deck = await tx.flashcardDeck.create({
        data: {
          tenantId,
          userId,
          name: sourceDeck.name,
          description: sourceDeck.description,
          source: "SHARED",
          isPublic: false,
          sourceDeckId: sourceDeck.id,
          importedAtVersion: sourceDeck.version,
        },
      });
      const now = new Date();
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
      await tx.flashcardDeck.update({
        where: { id: sourceDeck.id },
        data: { importCount: { increment: 1 } },
      });
      return tx.flashcardDeck.findUnique({
        where: { id: deck.id },
        include: { _count: { select: { cards: true } } },
      });
    });
    return { deck: copy! };
  },

  /**
   * Import deck by share code. Creates copy with source SHARED, copies cards, creates SRS state (due now).
   */
  async importByShareCode(tenantId: string, userId: string, shareCodeRaw: string) {
    const shareCode = shareCodeRaw.trim().toUpperCase().replace(/\s/g, "");
    if (!shareCode) return { error: "invalid" as const };
    const sourceDeck = await prisma.flashcardDeck.findFirst({
      where: { shareCode, ...tenantScope(tenantId) },
      include: { cards: { orderBy: { order: "asc", createdAt: "asc" } } },
    });
    if (!sourceDeck) return { error: "invalid" as const };
    if (sourceDeck.userId === userId) return { error: "own" as const };

    const copy = await prisma.$transaction(async (tx) => {
      const deck = await tx.flashcardDeck.create({
        data: {
          tenantId,
          userId,
          name: sourceDeck.name,
          description: sourceDeck.description,
          source: "SHARED",
          isPublic: false,
          sourceDeckId: sourceDeck.id,
          importedAtVersion: sourceDeck.version,
        },
      });
      const now = new Date();
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
      await tx.flashcardDeck.update({
        where: { id: sourceDeck.id },
        data: { importCount: { increment: 1 } },
      });
      return tx.flashcardDeck.findUnique({
        where: { id: deck.id },
        include: { _count: { select: { cards: true } } },
      });
    });
    return { deck: copy! };
  },

  /**
   * Compute diff between source deck and importer's copy. Returns null if deck has no sourceDeckId.
   */
  async getDiff(
    tenantId: string,
    userId: string,
    deckId: string
  ): Promise<{
    newCards: { id: string; front: string; back: string }[];
    updatedCards: { imported: { id: string; front: string; back: string }; source: { id: string; front: string; back: string } }[];
    removedCards: { id: string; front: string }[];
    sourceVersion: number;
  } | null> {
    const deck = await prisma.flashcardDeck.findFirst({
      where: { id: deckId, ...tenantScope(tenantId), userId },
      include: { cards: true },
    });
    if (!deck?.sourceDeckId) return null;

    const sourceDeck = await prisma.flashcardDeck.findFirst({
      where: { id: deck.sourceDeckId, ...tenantScope(tenantId) },
      include: { cards: { orderBy: { order: "asc", createdAt: "asc" } } },
    });
    if (!sourceDeck) return null;

    const importerBySourceId = new Map(
      deck.cards
        .filter((c) => c.sourceCardId != null)
        .map((c) => [c.sourceCardId!, c])
    );
    const sourceIds = new Set(sourceDeck.cards.map((c) => c.id));

    const newCards = sourceDeck.cards
      .filter((src) => !importerBySourceId.has(src.id))
      .map((c) => ({ id: c.id, front: c.front, back: c.back }));

    const updatedCards: { imported: { id: string; front: string; back: string }; source: { id: string; front: string; back: string } }[] = [];
    for (const src of sourceDeck.cards) {
      const imp = importerBySourceId.get(src.id);
      if (imp && (imp.front !== src.front || imp.back !== src.back)) {
        updatedCards.push({
          imported: { id: imp.id, front: imp.front, back: imp.back },
          source: { id: src.id, front: src.front, back: src.back },
        });
      }
    }

    const removedCards = deck.cards
      .filter((c) => c.sourceCardId != null && !sourceIds.has(c.sourceCardId))
      .map((c) => ({ id: c.id, front: c.front }));

    return {
      newCards,
      updatedCards,
      removedCards,
      sourceVersion: sourceDeck.version,
    };
  },

  /**
   * Apply deck update: add new cards, update changed cards (preserve SRS), mark removed as orphaned, set importedAtVersion.
   */
  async applyUpdate(tenantId: string, userId: string, deckId: string): Promise<"ok" | "no_update" | "not_found"> {
    const deck = await prisma.flashcardDeck.findFirst({
      where: { id: deckId, ...tenantScope(tenantId), userId },
      include: { cards: true },
    });
    if (!deck?.sourceDeckId) return "not_found";

    const sourceDeck = await prisma.flashcardDeck.findFirst({
      where: { id: deck.sourceDeckId, ...tenantScope(tenantId) },
      include: { cards: { orderBy: { order: "asc", createdAt: "asc" } } },
    });
    if (!sourceDeck) return "not_found";
    if (sourceDeck.version <= (deck.importedAtVersion ?? 0)) return "no_update";

    const now = new Date();
    const importerBySourceId = new Map(
      deck.cards
        .filter((c) => c.sourceCardId != null)
        .map((c) => [c.sourceCardId!, c])
    );
    const sourceIds = new Set(sourceDeck.cards.map((c) => c.id));
    const maxOrder = await prisma.flashcardCard
      .aggregate({ where: { deckId }, _max: { order: true } })
      .then((r) => r._max.order ?? -1);

    await prisma.$transaction(async (tx) => {
      let order = maxOrder + 1;
      for (const src of sourceDeck.cards) {
        const imp = importerBySourceId.get(src.id);
        if (!imp) {
          const card = await tx.flashcardCard.create({
            data: {
              deckId,
              tenantId,
              front: src.front,
              back: src.back,
              order: order++,
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
        } else if (imp.front !== src.front || imp.back !== src.back) {
          await tx.flashcardCard.update({
            where: { id: imp.id },
            data: { front: src.front, back: src.back },
          });
        }
      }
      for (const imp of deck.cards) {
        if (imp.sourceCardId != null && !sourceIds.has(imp.sourceCardId)) {
          await tx.flashcardCard.update({
            where: { id: imp.id },
            data: { isOrphaned: true },
          });
        }
      }
      await tx.flashcardDeck.update({
        where: { id: deckId },
        data: { importedAtVersion: sourceDeck.version },
      });
    });

    return "ok";
  },
};
