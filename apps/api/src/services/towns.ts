import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";

export const townSelect = { id: true, name: true, slug: true, district: true, state: true } satisfies Prisma.TownSelect;

/** The store columns a town decides: the town itself, and the state and district brand campaigns target */
export async function townFields(prisma: PrismaClient | Prisma.TransactionClient, townId: string) {
  const town = await prisma.town.findUnique({ where: { id: townId }, select: { id: true, state: true, district: true } });
  if (!town) throw Object.assign(new Error("Pick a town from the list"), { statusCode: 400 });
  return { townId: town.id, state: town.state, district: town.district };
}

/** Runs a store write; a slug another store in the same town already uses becomes a 409 */
export async function storeWrite<T>(run: () => Promise<T>) {
  try {
    return await run();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw Object.assign(new Error("Another store in this town already uses that address"), { statusCode: 409 });
    }
    throw err;
  }
}
