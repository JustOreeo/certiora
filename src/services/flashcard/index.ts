import { prisma, tenantScope } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { CardState } from "@prisma/client";
import { randomBytes } from "crypto";
import { rNow, defaultFsrsW } from "@/lib/fsrs";
import type { FsrsStateInput } from "@/lib/fsrs";
import { addFsrsOptimizeJob, addAdminDeckFanoutJob } from "@/lib/queue";

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
  async listDecks(
    tenantId: string,
    userId: string,
    opts: { page?: number; pageSize?: number } = {}
  ) {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;
    const where = { ...tenantScope(tenantId), userId };

    const [decks, total] = await Promise.all([
      prisma.flashcardDeck.findMany({
        where,
        include: { _count: { select: { cards: true } } },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.flashcardDeck.count({ where }),
    ]);

    const now = new Date();
    // Single groupBy for due counts instead of N+1
    const deckIds = decks.map((d) => d.id);
    const dueRows = deckIds.length > 0
      ? await prisma.flashcardCardSrsState.groupBy({
          by: ["cardId"],
          where: {
            ...tenantScope(tenantId),
            userId,
            card: { deckId: { in: deckIds } },
            nextReviewAt: { lte: now },
          },
          _count: true,
        }).then(async () => {
          // groupBy on cardId doesn't give us deckId, use raw aggregation
          const rows = await prisma.$queryRaw<{ deckId: string; count: bigint }[]>`
            SELECT fc."deckId", COUNT(*)::bigint as count
            FROM "FlashcardCardSrsState" s
            JOIN "FlashcardCard" fc ON fc.id = s."cardId"
            WHERE s."tenantId" = ${tenantId}
              AND s."userId" = ${userId}
              AND fc."deckId" = ANY(${deckIds})
              AND s."nextReviewAt" <= ${now}
            GROUP BY fc."deckId"
          `;
          return new Map(rows.map((r) => [r.deckId, Number(r.count)]));
        })
      : new Map<string, number>();

    // Fetch current version for source decks of imported decks (update check)
    const sourceDeckIds = decks
      .filter((d) => d.sourceDeckId)
      .map((d) => d.sourceDeckId!);
    const sourceDeckVersions =
      sourceDeckIds.length > 0
        ? await prisma.flashcardDeck
            .findMany({
              where: { id: { in: sourceDeckIds } },
              select: { id: true, version: true },
            })
            .then((rows) => new Map(rows.map((r) => [r.id, r.version])))
        : new Map<string, number>();

    const items = decks.map((d) => {
      const sourceVersion = d.sourceDeckId
        ? sourceDeckVersions.get(d.sourceDeckId) ?? null
        : null;
      return {
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
        dueToday: dueRows.get(d.id) ?? 0,
        hasUpdate:
          sourceVersion !== null &&
          d.importedAtVersion !== null &&
          sourceVersion > d.importedAtVersion,
      };
    });

    return { items, total, page, pageSize };
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
        _count: { select: { cards: true } },
        sourceDeck: { select: { version: true } },
        tags: { include: { tag: { select: { id: true, name: true } } } },
      },
    });
    if (!deck) return null;
    const dueToday = await getDueCountForDeck(tenantId, userId, deckId);
    const { _count, sourceDeck, tags, ...rest } = deck;
    return {
      ...rest,
      cardCount: _count.cards,
      dueToday,
      sourceDeck: sourceDeck ? { version: sourceDeck.version } : null,
      tags: tags.map((t) => ({ id: t.tag.id, name: t.tag.name })),
    };
  },

  async listCardsInDeck(
    tenantId: string,
    userId: string,
    deckId: string,
    opts: { page?: number; pageSize?: number; search?: string } = {}
  ) {
    const deck = await assertDeckOwnership(tenantId, userId, deckId);
    if (!deck) return null;

    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 20;
    const search = opts.search?.trim();

    const where: Prisma.FlashcardCardWhereInput = {
      deckId,
      ...tenantScope(tenantId),
      ...(search && {
        OR: [
          { front: { contains: search, mode: "insensitive" } },
          { back: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [cards, total] = await Promise.all([
      prisma.flashcardCard.findMany({
        where,
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.flashcardCard.count({ where }),
    ]);

    return { items: cards, total, page, pageSize };
  },

  async updateDeck(tenantId: string, userId: string, deckId: string, input: UpdateDeckInput) {
    const deck = await assertDeckOwnership(tenantId, userId, deckId);
    if (!deck) return null;
    // Imported decks stay private (original is already in library).
    // ADMIN_SEEDED: ignore isPublic (per PRD §12).
    const isPublic =
      deck.sourceDeckId || deck.source === "ADMIN_SEEDED"
        ? deck.isPublic
        : (input.isPublic ?? deck.isPublic);
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

  async addCardsBulk(
    tenantId: string,
    userId: string,
    deckId: string,
    cards: Array<{ front: string; back: string }>
  ) {
    const deck = await assertDeckOwnership(tenantId, userId, deckId);
    if (!deck) return null;
    if (cards.length === 0) return { created: 0, errors: [] };

    const maxOrder = await prisma.flashcardCard
      .aggregate({ where: { deckId }, _max: { order: true } })
      .then((r) => r._max.order ?? -1);

    const errors: Array<{ index: number; error: string }> = [];
    const validCards: Array<{ front: string; back: string; order: number }> = [];

    for (let i = 0; i < cards.length; i++) {
      const front = cards[i].front.trim().slice(0, 1000);
      const back = cards[i].back.trim().slice(0, 2000);
      if (!front || !back) {
        errors.push({ index: i, error: "Front and back are required" });
        continue;
      }
      validCards.push({ front, back, order: maxOrder + 1 + validCards.length });
    }

    if (validCards.length === 0) return { created: 0, errors };

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      for (const vc of validCards) {
        const card = await tx.flashcardCard.create({
          data: { deckId, tenantId, front: vc.front, back: vc.back, order: vc.order },
        });
        await tx.flashcardCardSrsState.create({
          data: { tenantId, userId, cardId: card.id, state: CardState.NEW, nextReviewAt: now },
        });
      }
      await tx.flashcardDeck.update({
        where: { id: deckId },
        data: { version: { increment: 1 } },
      });
    });

    return { created: validCards.length, errors };
  },

  async generateShareCode(tenantId: string, userId: string, deckId: string) {
    const deck = await assertDeckOwnership(tenantId, userId, deckId);
    if (!deck) return null;
    if (deck.sourceDeckId) return { error: "Imported decks cannot be shared." };
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
        cards: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], take: 3, select: { front: true } },
        _count: { select: { cards: true } },
      },
    });
    if (!deck) return "invalid";
    if (deck.userId === userId) return "own";
    const alreadyImported = await prisma.flashcardDeck
      .findFirst({
        where: { ...tenantScope(tenantId), userId, sourceDeckId: deck.id },
        select: { id: true },
      })
      .then((d) => !!d);
    return {
      id: deck.id,
      name: deck.name,
      description: deck.description,
      cardCount: deck._count.cards,
      creatorName: deck.user.name ?? "Anonymous",
      sampleFronts: deck.cards.map((c) => c.front),
      alreadyImported,
    };
  },

  /**
   * List public decks in the tenant for the library. Returns creator display name or tenant name for ADMIN_SEEDED.
   */
  async listLibrary(
    tenantId: string,
    userId: string,
    options: {
      search?: string;
      sort?: "newest" | "most_imported" | "az";
      source?: "ADMIN_SEEDED" | "student";
      page?: number;
      pageSize?: number;
    }
  ) {
    const { search = "", sort = "newest", source, page = 1, pageSize = 20 } = options;
    const term = search.trim();
    const where: Prisma.FlashcardDeckWhereInput = {
      ...tenantScope(tenantId),
      isPublic: true,
      sourceDeckId: null, // exclude imported copies — only originals belong in the library
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

    const [decks, total, myImportedDeckIds] = await Promise.all([
      prisma.flashcardDeck.findMany({
        where,
        include: {
          _count: { select: { cards: true } },
          user: { select: { name: true } },
          tenant: { select: { name: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.flashcardDeck.count({ where }),
      prisma.flashcardDeck
        .findMany({
          where: { ...tenantScope(tenantId), userId, sourceDeckId: { not: null } },
          select: { sourceDeckId: true },
        })
        .then((rows) => new Set(rows.map((r) => r.sourceDeckId).filter(Boolean) as string[])),
    ]);

    const items = decks.map((d) => ({
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

    return { items, total, page, pageSize };
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
        cards: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], take: 3, select: { front: true } },
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
      include: { cards: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
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
      include: { cards: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
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
      include: { cards: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
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
      if (!imp) continue;
      const contentDiffers = imp.front !== src.front || imp.back !== src.back;
      // Only flag as "updated" if the source card was modified after the
      // imported copy was last synced. This avoids false positives when the
      // importer edits their own copy without the source changing.
      const sourceChangedSinceSync = src.updatedAt > imp.updatedAt;
      if (contentDiffers && sourceChangedSinceSync) {
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
      include: { cards: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] } },
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

  /**
   * Flashcard analytics for the student. PRD §7.12.
   * Data from FlashcardCardSrsState and FlashcardReviewLog only (no legacy SrsCard).
   */
  async getFlashcardAnalytics(tenantId: string, userId: string) {
    const now = new Date();
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const in14Days = new Date(now);
    in14Days.setDate(in14Days.getDate() + 14);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const [states, reviewLogs, decks] = await Promise.all([
      prisma.flashcardCardSrsState.findMany({
        where: { ...tenantScope(tenantId), userId },
        select: {
          id: true,
          state: true,
          stability: true,
          lastReviewAt: true,
          scheduledDays: true,
          nextReviewAt: true,
          card: { select: { deckId: true } },
        },
      }),
      prisma.flashcardReviewLog.findMany({
        where: { ...tenantScope(tenantId), userId, reviewedAt: { gte: thirtyDaysAgo } },
        select: { grade: true, deckId: true, reviewedAt: true },
      }),
      prisma.flashcardDeck.findMany({
        where: { ...tenantScope(tenantId), userId },
        select: { id: true, name: true, source: true },
      }),
    ]);

    const deckMap = new Map(decks.map((d) => [d.id, d]));
    const stateList = states as Array<{
      state: CardState;
      stability: number | null;
      lastReviewAt: Date | null;
      scheduledDays: number;
      nextReviewAt: Date;
      card: { deckId: string };
    }>;

    // Overall counts
    let newCount = 0,
      learningCount = 0,
      reviewCount = 0,
      relearningCount = 0,
      matureCount = 0;
    let stabilitySum = 0;
    let stabilityDenom = 0;
    const rNowValues: number[] = [];
    let cardsAtRisk = 0;

    for (const s of stateList) {
      if (s.state === CardState.NEW) newCount++;
      else if (s.state === CardState.LEARNING) learningCount++;
      else if (s.state === CardState.REVIEW) {
        reviewCount++;
        if (s.scheduledDays >= 21) matureCount++;
        if (s.stability != null && s.stability > 0) {
          stabilitySum += s.stability;
          stabilityDenom++;
        }
      } else if (s.state === CardState.RELEARNING) relearningCount++;

      const input: FsrsStateInput = {
        state: s.state as "NEW" | "LEARNING" | "REVIEW" | "RELEARNING",
        stability: s.stability,
        difficulty: null,
        elapsedDays: 0,
        scheduledDays: s.scheduledDays,
        reps: 0,
        lapses: 0,
        lastReviewAt: s.lastReviewAt,
      };
      const r = rNow(input, now);
      if (r != null) {
        rNowValues.push(r);
        if (r < 0.7) cardsAtRisk++;
      }
    }

    const total = stateList.length;
    const avgStability = stabilityDenom > 0 ? stabilitySum / stabilityDenom : null;
    const avgRetrievability =
      rNowValues.length > 0 ? (rNowValues.reduce((a, b) => a + b, 0) / rNowValues.length) * 100 : null;

    // Retention from FlashcardReviewLog
    const totalReviews = reviewLogs.length;
    const correctReviews = reviewLogs.filter((l) => l.grade >= 3).length;
    const retentionRate = totalReviews > 0 ? (correctReviews / totalReviews) * 100 : null;

    // 14-day forecast: count by calendar day
    const forecast: { date: string; count: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);
      const count = stateList.filter(
        (s) => s.nextReviewAt >= dayStart && s.nextReviewAt <= dayEnd
      ).length;
      forecast.push({
        date: dayStart.toISOString().slice(0, 10),
        count,
      });
    }

    // Per-deck breakdown (only decks that have at least one SRS state)
    const byDeck = new Map<
      string,
      {
        total: number;
        new: number;
        learning: number;
        review: number;
        relearning: number;
        mature: number;
        stabilitySum: number;
        stabilityDenom: number;
        rNowSum: number;
        rNowDenom: number;
        dueToday: number;
        logGrades: number[];
      }
    >();

    for (const s of stateList) {
      const deckId = s.card.deckId;
      if (!byDeck.has(deckId)) {
        byDeck.set(deckId, {
          total: 0,
          new: 0,
          learning: 0,
          review: 0,
          relearning: 0,
          mature: 0,
          stabilitySum: 0,
          stabilityDenom: 0,
          rNowSum: 0,
          rNowDenom: 0,
          dueToday: 0,
          logGrades: [],
        });
      }
      const rec = byDeck.get(deckId)!;
      rec.total++;
      if (s.state === CardState.NEW) rec.new++;
      else if (s.state === CardState.LEARNING) rec.learning++;
      else if (s.state === CardState.REVIEW) {
        rec.review++;
        if (s.scheduledDays >= 21) rec.mature++;
        if (s.stability != null && s.stability > 0) {
          rec.stabilitySum += s.stability;
          rec.stabilityDenom++;
        }
      } else if (s.state === CardState.RELEARNING) rec.relearning++;

      const input: FsrsStateInput = {
        state: s.state as "NEW" | "LEARNING" | "REVIEW" | "RELEARNING",
        stability: s.stability,
        difficulty: null,
        elapsedDays: 0,
        scheduledDays: s.scheduledDays,
        reps: 0,
        lapses: 0,
        lastReviewAt: s.lastReviewAt,
      };
      const r = rNow(input, now);
      if (r != null) {
        rec.rNowSum += r;
        rec.rNowDenom++;
      }
      if (s.nextReviewAt <= todayEnd) rec.dueToday++;
    }

    for (const log of reviewLogs) {
      const rec = byDeck.get(log.deckId);
      if (rec) rec.logGrades.push(log.grade);
    }

    const deckList = Array.from(byDeck.entries())
      .map(([deckId, rec]) => {
        const deck = deckMap.get(deckId);
        const retention =
          rec.logGrades.length > 0
            ? (rec.logGrades.filter((g) => g >= 3).length / rec.logGrades.length) * 100
            : null;
        return {
          deckId,
          name: deck?.name ?? "Unknown",
          source: deck?.source ?? null,
          total: rec.total,
          new: rec.new,
          learning: rec.learning,
          review: rec.review,
          relearning: rec.relearning,
          mature: rec.mature,
          avgStability: rec.stabilityDenom > 0 ? rec.stabilitySum / rec.stabilityDenom : null,
          retentionRate: retention,
          avgRetrievability:
            rec.rNowDenom > 0 ? (rec.rNowSum / rec.rNowDenom) * 100 : null,
          dueToday: rec.dueToday,
        };
      })
      .sort((a, b) => b.dueToday - a.dueToday);

    // 30-day review history (last 30 calendar days including today)
    const historyByDay = new Map<string, { count: number; correctCount: number }>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      historyByDay.set(key, { count: 0, correctCount: 0 });
    }
    for (const log of reviewLogs) {
      const key = new Date(log.reviewedAt).toISOString().slice(0, 10);
      const rec = historyByDay.get(key);
      if (rec) {
        rec.count++;
        if (log.grade >= 3) rec.correctCount++;
      }
    }
    const reviewHistory = Array.from(historyByDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { count, correctCount }]) => ({ date, count, correctCount }));

    return {
      overall: {
        total,
        new: newCount,
        learning: learningCount,
        review: reviewCount,
        relearning: relearningCount,
        mature: matureCount,
        retentionRate,
        avgStability,
        avgRetrievability,
        cardsAtRisk,
      },
      forecast,
      decks: deckList,
      reviewHistory,
    };
  },

  /**
   * Get FSRS settings for the student. PRD §7.14.
   * Returns effective retention target (student or tenant), optimization status, review count.
   */
  async getSettings(tenantId: string, userId: string) {
    const [tenantParams, studentParams, reviewCount, customRetentionDecks] =
      await Promise.all([
        prisma.fsrsParams.findFirst({
          where: { tenantId, userId: null },
        }),
        prisma.fsrsParams.findUnique({
          where: { tenantId_userId: { tenantId, userId } },
        }),
        prisma.flashcardReviewLog.count({
          where: { ...tenantScope(tenantId), userId },
        }),
        this.listDecksWithCustomRetention(tenantId, userId),
      ]);
    const effectiveTarget =
      studentParams?.retentionTarget ?? tenantParams?.retentionTarget ?? 0.9;
    return {
      retentionTarget: effectiveTarget,
      isOptimized: studentParams?.isOptimized ?? false,
      optimizedAt: studentParams?.optimizedAt?.toISOString() ?? null,
      reviewCount,
      reviewCountAtOptimization: studentParams?.reviewCountAtOptimization ?? null,
      w: null as number[] | null, // Phase 8: expose if needed
      tenantDefault: {
        retentionTarget: tenantParams?.retentionTarget ?? 0.9,
      },
      customRetentionDecks,
    };
  },

  /**
   * Update student retention target. Creates student FsrsParams row if needed (copies tenant w).
   */
  async updateSettings(
    tenantId: string,
    userId: string,
    input: { retentionTarget: number }
  ) {
    const r = Math.max(0.7, Math.min(0.97, input.retentionTarget));
    const [tenantParams, existing] = await Promise.all([
      prisma.fsrsParams.findFirst({
        where: { tenantId, userId: null },
      }),
      prisma.fsrsParams.findUnique({
        where: { tenantId_userId: { tenantId, userId } },
      }),
    ]);
    const w = existing?.w ?? tenantParams?.w ?? defaultFsrsW();
    await prisma.fsrsParams.upsert({
      where: { tenantId_userId: { tenantId, userId } },
      create: {
        tenantId,
        userId,
        w,
        retentionTarget: r,
        isOptimized: false,
      },
      update: { retentionTarget: r },
    });
    return this.getSettings(tenantId, userId);
  },

  /**
   * Enqueue fsrs-optimize job if conditions met: count >= 1000 and (first time or +200 since last).
   * Call after grading a custom card. PRD §9.10 triggers.
   */
  async enqueueFsrsOptimizeIfNeeded(tenantId: string, userId: string): Promise<boolean> {
    try {
      const [reviewCount, studentParams] = await Promise.all([
        prisma.flashcardReviewLog.count({
          where: { ...tenantScope(tenantId), userId },
        }),
        prisma.fsrsParams.findUnique({
          where: { tenantId_userId: { tenantId, userId } },
          select: { reviewCountAtOptimization: true },
        }),
      ]);
      if (reviewCount < 1000) return false;
      const atOpt = studentParams?.reviewCountAtOptimization ?? 0;
      if (atOpt > 0 && reviewCount - atOpt < 200) return false;
      return addFsrsOptimizeJob({ userId, tenantId });
    } catch {
      return false;
    }
  },

  /**
   * Reset student FSRS params to tenant default (w only). Sets isOptimized = false. retentionTarget unchanged.
   */
  async resetFsrsParams(tenantId: string, userId: string) {
    const [tenantParams, studentParams] = await Promise.all([
      prisma.fsrsParams.findFirst({
        where: { tenantId, userId: null },
      }),
      prisma.fsrsParams.findUnique({
        where: { tenantId_userId: { tenantId, userId } },
      }),
    ]);
    const w = tenantParams?.w ?? defaultFsrsW();
    const retentionTarget = studentParams?.retentionTarget ?? tenantParams?.retentionTarget ?? 0.9;
    await prisma.fsrsParams.upsert({
      where: { tenantId_userId: { tenantId, userId } },
      create: {
        tenantId,
        userId,
        w,
        retentionTarget,
        isOptimized: false,
      },
      update: {
        w,
        isOptimized: false,
        optimizedAt: null,
        reviewCountAtOptimization: null,
      },
    });
  },

  /**
   * List decks that have a custom retention target (for Settings Panel 3).
   */
  // ——— Tags ———

  async listTags(tenantId: string) {
    const tags = await prisma.flashcardTag.findMany({
      where: { tenantId },
      include: { _count: { select: { decks: true } } },
      orderBy: { name: "asc" },
    });
    return tags.map((t) => ({ id: t.id, name: t.name, deckCount: t._count.decks }));
  },

  async addTagToDeck(tenantId: string, userId: string, deckId: string, tagName: string) {
    const deck = await assertDeckOwnership(tenantId, userId, deckId);
    if (!deck) return null;
    const name = tagName.trim().toLowerCase().slice(0, 50);
    if (!name) return "validation";

    // Find-or-create tag
    let tag = await prisma.flashcardTag.findFirst({
      where: { tenantId, name },
    });
    if (!tag) {
      tag = await prisma.flashcardTag.create({
        data: { tenantId, name },
      });
    }

    // Check if already linked
    const existing = await prisma.flashcardDeckTag.findFirst({
      where: { deckId, tagId: tag.id },
    });
    if (existing) return { id: tag.id, name: tag.name };

    await prisma.flashcardDeckTag.create({
      data: { deckId, tagId: tag.id },
    });
    return { id: tag.id, name: tag.name };
  },

  // ——— Card reordering ———

  async reorderCards(
    tenantId: string,
    userId: string,
    deckId: string,
    cardOrder: Array<{ cardId: string; order: number }>
  ) {
    const deck = await assertDeckOwnership(tenantId, userId, deckId);
    if (!deck) return null;

    await prisma.$transaction(
      cardOrder.map((co) =>
        prisma.flashcardCard.updateMany({
          where: { id: co.cardId, deckId, ...tenantScope(tenantId) },
          data: { order: co.order },
        })
      )
    );
    return "ok";
  },

  // ——— CSV export/import ———

  async exportDeckAsCsv(tenantId: string, userId: string, deckId: string) {
    const deck = await assertDeckOwnership(tenantId, userId, deckId);
    if (!deck) return null;

    const cards = await prisma.flashcardCard.findMany({
      where: { deckId, ...tenantScope(tenantId) },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { front: true, back: true, order: true },
    });

    const header = "front,back,order";
    const rows = cards.map((c) => {
      const front = `"${c.front.replace(/"/g, '""')}"`;
      const back = `"${c.back.replace(/"/g, '""')}"`;
      return `${front},${back},${c.order}`;
    });
    const csv = [header, ...rows].join("\n");

    return { csv, deckName: deck.name, cardCount: cards.length };
  },

  async removeTagFromDeck(tenantId: string, userId: string, deckId: string, tagId: string) {
    const deck = await assertDeckOwnership(tenantId, userId, deckId);
    if (!deck) return null;
    await prisma.flashcardDeckTag.deleteMany({
      where: { deckId, tagId },
    });
    return "removed";
  },

  async listDecksWithCustomRetention(tenantId: string, userId: string) {
    const decks = await prisma.flashcardDeck.findMany({
      where: {
        ...tenantScope(tenantId),
        userId,
        retentionTarget: { not: null },
      },
      select: {
        id: true,
        name: true,
        source: true,
        retentionTarget: true,
      },
      orderBy: { name: "asc" },
    });
    return decks;
  },
};

// ——— Admin-seeded decks (Phase 9) ———

/** Admin decks: sourceDeckId null and source ADMIN_SEEDED (and status set). */
function adminDeckScope(tenantId: string) {
  return {
    ...tenantScope(tenantId),
    sourceDeckId: null,
    source: "ADMIN_SEEDED" as const,
  };
}

export type AdminCreateDeckInput = { name: string; description?: string | null };
export type AdminUpdateDeckInput = {
  name?: string;
  description?: string | null;
  suggestedRetentionTarget?: number | null;
};

export const adminFlashcardService = {
  async listDecks(tenantId: string) {
    const decks = await prisma.flashcardDeck.findMany({
      where: adminDeckScope(tenantId),
      include: { _count: { select: { cards: true } } },
      orderBy: { updatedAt: "desc" },
    });
    const studentCounts = await Promise.all(
      decks.map((d) =>
        prisma.flashcardDeck.count({
          where: { ...tenantScope(tenantId), sourceDeckId: d.id },
        })
      )
    );
    return decks.map((d, i) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      status: d.status,
      version: d.version,
      suggestedRetentionTarget: d.suggestedRetentionTarget,
      cardCount: d._count.cards,
      studentCount: studentCounts[i],
      updatedAt: d.updatedAt,
    }));
  },

  async createDeck(tenantId: string, userId: string, input: AdminCreateDeckInput) {
    return prisma.flashcardDeck.create({
      data: {
        tenantId,
        userId,
        name: input.name.trim().slice(0, 100),
        description: input.description?.trim().slice(0, 300) ?? null,
        source: "ADMIN_SEEDED",
        status: "DRAFT",
        isPublic: false,
      },
    });
  },

  async getDeck(tenantId: string, deckId: string) {
    const deck = await prisma.flashcardDeck.findFirst({
      where: { id: deckId, ...adminDeckScope(tenantId) },
      include: {
        cards: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
        _count: { select: { cards: true } },
      },
    });
    if (!deck) return null;
    const studentsReached = await prisma.flashcardDeck.count({
      where: { ...tenantScope(tenantId), sourceDeckId: deckId },
    });
    const pendingUpdate = await prisma.flashcardDeck.count({
      where: {
        ...tenantScope(tenantId),
        sourceDeckId: deckId,
        importedAtVersion: { lt: deck.version },
      },
    });
    const { _count, ...rest } = deck;
    return {
      ...rest,
      cardCount: _count.cards,
      studentsReached,
      pendingUpdate,
    };
  },

  async updateDeck(tenantId: string, deckId: string, input: AdminUpdateDeckInput) {
    const deck = await prisma.flashcardDeck.findFirst({
      where: { id: deckId, ...adminDeckScope(tenantId) },
    });
    if (!deck) return null;
    if (deck.status === "ARCHIVED") return "ARCHIVED";
    const data: Parameters<typeof prisma.flashcardDeck.update>[0]["data"] = {
      ...(input.name !== undefined && { name: input.name.trim().slice(0, 100) }),
      ...(input.description !== undefined && {
        description: input.description?.trim().slice(0, 300) ?? null,
      }),
      ...(input.suggestedRetentionTarget !== undefined && {
        suggestedRetentionTarget:
          input.suggestedRetentionTarget === null
            ? null
            : Math.max(0.7, Math.min(0.97, input.suggestedRetentionTarget)),
      }),
    };
    return prisma.flashcardDeck.update({
      where: { id: deckId },
      data,
    });
  },

  async deleteDeck(tenantId: string, deckId: string) {
    const deck = await prisma.flashcardDeck.findFirst({
      where: { id: deckId, ...adminDeckScope(tenantId) },
    });
    if (!deck) return null;
    if (deck.status !== "DRAFT") return "NOT_DRAFT";
    await prisma.flashcardDeck.delete({ where: { id: deckId } });
    return "deleted";
  },

  async addCard(tenantId: string, deckId: string, input: CreateCardInput) {
    const deck = await prisma.flashcardDeck.findFirst({
      where: { id: deckId, ...adminDeckScope(tenantId) },
    });
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
    if (deck.status === "ACTIVE") {
      await prisma.flashcardDeck.update({
        where: { id: deckId },
        data: { version: { increment: 1 } },
      });
    }
    return prisma.flashcardCard.findUnique({
      where: { id: card.id },
    });
  },

  async updateCard(
    tenantId: string,
    deckId: string,
    cardId: string,
    input: UpdateCardInput
  ) {
    const deck = await prisma.flashcardDeck.findFirst({
      where: { id: deckId, ...adminDeckScope(tenantId) },
    });
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
    if (deck.status === "ACTIVE") {
      await prisma.flashcardDeck.update({
        where: { id: deckId },
        data: { version: { increment: 1 } },
      });
    }
    return updated;
  },

  async deleteCard(tenantId: string, deckId: string, cardId: string) {
    const deck = await prisma.flashcardDeck.findFirst({
      where: { id: deckId, ...adminDeckScope(tenantId) },
    });
    if (!deck) return null;
    const card = await prisma.flashcardCard.findFirst({
      where: { id: cardId, deckId, ...tenantScope(tenantId) },
    });
    if (!card) return null;
    await prisma.flashcardCard.delete({ where: { id: cardId } });
    if (deck.status === "ACTIVE") {
      await prisma.flashcardDeck.update({
        where: { id: deckId },
        data: { version: { increment: 1 } },
      });
    }
    return "deleted";
  },

  async publish(tenantId: string, deckId: string) {
    const deck = await prisma.flashcardDeck.findFirst({
      where: { id: deckId, ...adminDeckScope(tenantId) },
      include: { _count: { select: { cards: true } } },
    });
    if (!deck) return null;
    if (deck.status !== "DRAFT") return "NOT_DRAFT";
    if (deck._count.cards === 0) return "NO_CARDS";
    await prisma.flashcardDeck.update({
      where: { id: deckId },
      data: { status: "ACTIVE", isPublic: true },
    });
    addAdminDeckFanoutJob({ tenantId, deckId, mode: "publish" });
    return prisma.flashcardDeck.findUnique({
      where: { id: deckId },
      include: { _count: { select: { cards: true } } },
    });
  },

  async archive(tenantId: string, deckId: string) {
    const deck = await prisma.flashcardDeck.findFirst({
      where: { id: deckId, ...adminDeckScope(tenantId) },
    });
    if (!deck) return null;
    if (deck.status !== "ACTIVE") return "NOT_ACTIVE";
    return prisma.flashcardDeck.update({
      where: { id: deckId },
      data: { status: "ARCHIVED" },
    });
  },

  async reactivate(tenantId: string, deckId: string) {
    const deck = await prisma.flashcardDeck.findFirst({
      where: { id: deckId, ...adminDeckScope(tenantId) },
    });
    if (!deck) return null;
    if (deck.status !== "ARCHIVED") return "NOT_ARCHIVED";
    await prisma.flashcardDeck.update({
      where: { id: deckId },
      data: { status: "ACTIVE" },
    });
    addAdminDeckFanoutJob({ tenantId, deckId, mode: "reactivate" });
    return prisma.flashcardDeck.findUnique({
      where: { id: deckId },
      include: { _count: { select: { cards: true } } },
    });
  },

  /**
   * Admin analytics: overview + per-deck + per-student flashcard usage stats.
   */
  async getStudentFlashcardAnalytics(tenantId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Overview stats
    const [totalStudents, reviewsLast30d, activeStudents7d] = await Promise.all([
      prisma.user.count({
        where: { tenantId, role: "STUDENT" },
      }),
      prisma.flashcardReviewLog.count({
        where: { tenantId, reviewedAt: { gte: thirtyDaysAgo } },
      }),
      prisma.flashcardReviewLog
        .findMany({
          where: { tenantId, reviewedAt: { gte: sevenDaysAgo } },
          select: { userId: true },
          distinct: ["userId"],
        })
        .then((r) => r.length),
    ]);

    // Average retention across all reviews in last 30d
    const retentionAgg = await prisma.flashcardReviewLog.aggregate({
      where: {
        tenantId,
        reviewedAt: { gte: thirtyDaysAgo },
        grade: { gte: 1 },
      },
      _avg: { grade: true },
      _count: true,
    });
    // Approximate retention: grades 3+4 are "correct"
    const correctReviews = await prisma.flashcardReviewLog.count({
      where: {
        tenantId,
        reviewedAt: { gte: thirtyDaysAgo },
        grade: { gte: 3 },
      },
    });
    const avgRetention =
      retentionAgg._count > 0 ? correctReviews / retentionAgg._count : 0;

    // Per-deck stats (admin-seeded decks)
    const adminDecks = await prisma.flashcardDeck.findMany({
      where: adminDeckScope(tenantId),
      select: { id: true, name: true, status: true },
    });

    const perDeck = await Promise.all(
      adminDecks.map(async (deck) => {
        const [studentsReached, totalReviews, correctCount, activeStudentsInDeck] =
          await Promise.all([
            prisma.flashcardDeck.count({
              where: { ...tenantScope(tenantId), sourceDeckId: deck.id },
            }),
            prisma.flashcardReviewLog.count({
              where: {
                tenantId,
                deck: { sourceDeckId: deck.id },
                reviewedAt: { gte: thirtyDaysAgo },
              },
            }),
            prisma.flashcardReviewLog.count({
              where: {
                tenantId,
                deck: { sourceDeckId: deck.id },
                reviewedAt: { gte: thirtyDaysAgo },
                grade: { gte: 3 },
              },
            }),
            prisma.flashcardReviewLog
              .findMany({
                where: {
                  tenantId,
                  deck: { sourceDeckId: deck.id },
                  reviewedAt: { gte: sevenDaysAgo },
                },
                select: { userId: true },
                distinct: ["userId"],
              })
              .then((r) => r.length),
          ]);
        return {
          deckId: deck.id,
          deckName: deck.name,
          status: deck.status,
          studentsReached,
          totalReviews,
          retention: totalReviews > 0 ? correctCount / totalReviews : 0,
          activeStudents7d: activeStudentsInDeck,
        };
      })
    );

    // Per-student stats (top 50 by review count)
    const studentReviewCounts: Array<{ userId: string; cnt: bigint }> =
      await prisma.$queryRaw`
        SELECT "userId", COUNT(*) as cnt
        FROM "FlashcardReviewLog"
        WHERE "tenantId" = ${tenantId}
          AND "reviewedAt" >= ${thirtyDaysAgo}
        GROUP BY "userId"
        ORDER BY cnt DESC
        LIMIT 50
      `;

    const studentIds = studentReviewCounts.map((s) => s.userId);
    const students =
      studentIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: studentIds }, tenantId },
            select: { id: true, name: true, email: true },
          })
        : [];
    const studentMap = new Map(students.map((s) => [s.id, s]));

    // Get correct counts and deck counts per student
    const studentCorrectCounts: Array<{ userId: string; cnt: bigint }> =
      studentIds.length > 0
        ? await prisma.$queryRaw`
            SELECT "userId", COUNT(*) as cnt
            FROM "FlashcardReviewLog"
            WHERE "tenantId" = ${tenantId}
              AND "reviewedAt" >= ${thirtyDaysAgo}
              AND "grade" >= 3
              AND "userId" = ANY(${studentIds})
            GROUP BY "userId"
          `
        : [];
    const correctMap = new Map(
      studentCorrectCounts.map((s) => [s.userId, Number(s.cnt)])
    );

    const studentDeckCounts: Array<{ userId: string; cnt: bigint }> =
      studentIds.length > 0
        ? await prisma.$queryRaw`
            SELECT "userId", COUNT(*) as cnt
            FROM "FlashcardDeck"
            WHERE "tenantId" = ${tenantId}
              AND "userId" = ANY(${studentIds})
            GROUP BY "userId"
          `
        : [];
    const deckCountMap = new Map(
      studentDeckCounts.map((s) => [s.userId, Number(s.cnt)])
    );

    const lastReviewed: Array<{ userId: string; last: Date }> =
      studentIds.length > 0
        ? await prisma.$queryRaw`
            SELECT "userId", MAX("reviewedAt") as last
            FROM "FlashcardReviewLog"
            WHERE "tenantId" = ${tenantId}
              AND "userId" = ANY(${studentIds})
            GROUP BY "userId"
          `
        : [];
    const lastReviewedMap = new Map(
      lastReviewed.map((s) => [s.userId, s.last])
    );

    const perStudent = studentReviewCounts.map((s) => {
      const user = studentMap.get(s.userId);
      const reviews = Number(s.cnt);
      const correct = correctMap.get(s.userId) ?? 0;
      return {
        userId: s.userId,
        name: user?.name ?? "Unknown",
        email: user?.email ?? "",
        decksCount: deckCountMap.get(s.userId) ?? 0,
        reviews,
        retention: reviews > 0 ? correct / reviews : 0,
        lastReviewed: lastReviewedMap.get(s.userId) ?? null,
      };
    });

    return {
      overview: {
        totalStudents,
        reviewsLast30d,
        avgRetention,
        activeStudents7d,
      },
      perDeck,
      perStudent,
    };
  },
};
