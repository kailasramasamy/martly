/**
 * Queues sample products for the catalog agent, as if a store manager had photographed them in the app.
 * Each folder under prisma/data/catalog-agent-sample/ is one product; its photos are uploaded in name order.
 *
 *   cd apps/api && npx tsx prisma/seed-catalog-drafts.ts [store name]
 *
 * Needs manager@martly.in (seed-manage-users.ts) and a running API for the worker to pick the drafts up.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { PrismaClient } from "../generated/prisma/index.js";
import { putObject } from "../src/services/media.js";

const prisma = new PrismaClient();
const SAMPLE_DIR = path.join(import.meta.dirname, "data/catalog-agent-sample");
// MRP, selling price and stock a manager would type for each sample
const PRICES: Record<string, { mrp: number; sellingPrice: number; stock: number }> = {
  "pumpkin-seeds": { mrp: 199, sellingPrice: 179, stock: 12 },
};

async function main() {
  const storeName = process.argv[2] ?? "Template Store";
  const store = await prisma.store.findFirstOrThrow({ where: { name: storeName } });
  const manager = await prisma.user.findUniqueOrThrow({ where: { email: "manager@martly.in" } });
  for (const product of fs.readdirSync(SAMPLE_DIR).sort()) {
    const dir = path.join(SAMPLE_DIR, product);
    const files = fs.readdirSync(dir).filter((f) => /\.jpe?g$/i.test(f)).sort();
    const photos: string[] = [];
    for (const file of files) {
      const { url } = await putObject(`catalog-drafts/uploads/${randomUUID()}.jpg`, fs.readFileSync(path.join(dir, file)), "image/jpeg");
      photos.push(url);
    }
    const prices = PRICES[product] ?? { mrp: 100, sellingPrice: 95, stock: 10 };
    const draft = await prisma.catalogDraft.create({
      data: { organizationId: store.organizationId, storeId: store.id, createdById: manager.id, photos, ...prices },
    });
    console.log(`Queued ${product} (${photos.length} photos) → draft ${draft.id}`);
  }
}

main().finally(() => prisma.$disconnect());
