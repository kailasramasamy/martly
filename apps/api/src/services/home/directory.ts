import type { CategoryDirectoryPage, TileGridSection } from "@martly/shared/types";
import { loadLayout } from "./layout.js";
import { directoryGroups } from "./resolvers/category-directory.js";
import { tileGrid } from "./resolvers/tile-grid.js";
import type { ResolveContext, StoreRef } from "./types.js";

/** The Categories tab: every department the store stocks as uniform category tiles, closed by the org's Shop by store grid */
export async function categoryDirectoryPage(prisma: ResolveContext["prisma"], store: StoreRef, userId: string): Promise<CategoryDirectoryPage> {
  const ctx: ResolveContext = { prisma, store, userId, now: new Date() };
  const storeGrid = (await loadLayout(ctx)).find((entry) => entry.type === "STORE_GRID");
  const [groups, stores] = await Promise.all([
    directoryGroups(ctx, [], 0),
    storeGrid ? tileGrid(ctx, storeGrid) : null,
  ]);
  return { groups, stores: stores as TileGridSection | null };
}
