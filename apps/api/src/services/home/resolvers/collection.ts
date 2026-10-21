import { liveWindow } from "../../store-feed.js";
import type { ResolveContext } from "../types.js";

/** A live collection this organisation may show (its own or global), or null once it ended or is out of reach. */
export function liveCollection(ctx: ResolveContext, collectionId: string | null) {
  if (!collectionId) return Promise.resolve(null);
  return ctx.prisma.collection.findFirst({
    where: {
      id: collectionId, isActive: true, AND: liveWindow(ctx.now),
      OR: [{ organizationId: ctx.store.organizationId }, { organizationId: null }],
    },
    select: { id: true, title: true, subtitle: true, imageUrl: true, textInImage: true, endsAt: true, translations: true },
  });
}
