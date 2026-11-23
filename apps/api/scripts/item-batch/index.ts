/**
 * Turns a batch-capture zip from the phone into CatalogDrafts: re-measures every item on the Mac, prints phone vs Mac sizes
 * with flags, then (unless --dry-run) uploads the photos and queues one ITEM draft per item for the catalog-agent worker.
 * Re-running skips items already in <batch>/processed.json. Uses DATABASE_URL unless --prod is passed.
 *
 *   npx tsx scripts/item-batch/index.ts <zip or folder> [--prod] [--dry-run] [--user <email>]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "../../generated/prisma/client.js";
import { loadBatch, openBatch, remeasure } from "./batch.js";
import { flagsOf, sizeText, type Batch, type Reading, type Remeasured } from "./reading.js";

dotenv.config({ override: true });

const argv = process.argv.slice(2);
const input = argv.find((arg, i) => !arg.startsWith("--") && argv[i - 1] !== "--user");
if (!input) throw new Error("Usage: index.ts <zip or folder> [--prod] [--dry-run] [--user <email>]");
const dryRun = argv.includes("--dry-run");
const userEmail = argv.includes("--user") ? argv[argv.indexOf("--user") + 1] : undefined;

interface Row { itemId: string; groupId: string; price: number; phone: Reading | null; mac: Reading | null; flags: string[]; draftId: string | null }

function buildRows(batch: Batch, folder: string, measured: Remeasured[]) {
  const byId = new Map(measured.map((row) => [row.itemId, row]));
  for (const row of measured) {
    if (!batch.items.some((item) => item.itemId === row.itemId)) console.warn(`Skipping ${row.itemId}: not in batch.json`);
  }
  return batch.items.map((item): Row => {
    const row = byId.get(item.itemId) ?? { itemId: item.itemId, phone: item.reading, mac: null, error: `no capture folder in ${folder}` };
    return { itemId: item.itemId, groupId: item.groupId, price: item.price, phone: row.phone ?? item.reading, mac: row.mac ?? null, flags: flagsOf(row), draftId: null };
  });
}

function printTable(rows: Row[]) {
  console.table(rows.map((row, i) => ({
    "#": i + 1, group: row.groupId.slice(0, 8), shape: (row.mac ?? row.phone)?.shape, "phone cm": sizeText(row.phone), "mac cm": sizeText(row.mac),
    price: `₹${row.price}`, flags: row.flags.join("; "),
  })));
}

async function createDrafts(prisma: PrismaClient, batch: Batch, folder: string, rows: Row[]) {
  const { createItemDraft } = await import("./draft.js");
  const store = await prisma.store.findUnique({ where: { id: batch.storeId }, select: { organizationId: true } });
  if (!store) throw new Error(`Store ${batch.storeId} not found in this database`);
  const user = userEmail ? await prisma.user.findUnique({ where: { email: userEmail } }) : await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } });
  if (!user) throw new Error(userEmail ? `No user ${userEmail}` : "No SUPER_ADMIN user found");
  const processedPath = join(folder, "processed.json");
  const processed: Record<string, string> = existsSync(processedPath) ? JSON.parse(readFileSync(processedPath, "utf8")) : {};
  for (const row of rows) {
    const item = batch.items.find((i) => i.itemId === row.itemId)!;
    const reading = row.mac ?? row.phone;
    if (!processed[row.itemId] && reading) {
      processed[row.itemId] = await createItemDraft(prisma, {
        storeId: batch.storeId, organizationId: store.organizationId, userId: user.id, itemFolder: join(folder, row.itemId),
        photoCount: item.photoCount, price: row.price, reading,
      });
      writeFileSync(processedPath, JSON.stringify(processed, null, 2));
      console.log(`Draft ${processed[row.itemId]} for item ${row.itemId}`);
    }
    row.draftId = processed[row.itemId] ?? null;
  }
}

const folder = openBatch(input);
const batch = loadBatch(folder);
const rows = buildRows(batch, folder, remeasure(folder));
printTable(rows);

if (!dryRun) {
  const prisma = new PrismaClient({ datasourceUrl: argv.includes("--prod") ? process.env.PROD_DATABASE_URL : undefined });
  try {
    await createDrafts(prisma, batch, folder, rows);
  } finally {
    await prisma.$disconnect();
  }
}
writeFileSync(join(folder, "report.json"), JSON.stringify(rows, null, 2));
console.log(`Report: ${join(folder, "report.json")}`);
