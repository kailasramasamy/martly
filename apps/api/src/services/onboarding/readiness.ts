import type { PrismaClient } from "../../../generated/prisma/client.js";
import type { ReadinessCheck } from "@martly/shared/types";

// Wizard steps, for sending each failing check back to the step that fixes it
const STEP = { owner: 0, store: 1, size: 2, catalog: 3, storefront: 4 } as const;

/** Distance bands start at the door and run unbroken to the delivery radius, so checkout prices every address */
function tiersCoverRadius(tiers: { minDistance: number; maxDistance: number }[], radius: number) {
  let reach = 0;
  for (const t of [...tiers].sort((a, b) => a.minDistance - b.minDistance)) {
    if (t.minDistance > reach) return false;
    reach = Math.max(reach, t.maxDistance);
  }
  return reach >= radius;
}

async function emptyEssentialAisles(prisma: PrismaClient, storeId: string) {
  const rows = await prisma.$queryRaw<{ name: string }[]>`
    SELECT s.name FROM subcategories s
    WHERE s.tier = 'ESSENTIAL'
      AND EXISTS (SELECT 1 FROM products p WHERE p.subcategory_id = s.id AND p.is_active AND p.organization_id IS NULL)
      AND NOT EXISTS (
        SELECT 1 FROM store_products sp JOIN products p ON p.id = sp.product_id
        WHERE sp.store_id = ${storeId} AND p.subcategory_id = s.id AND sp.is_active AND sp.stock > 0)
    ORDER BY s.name`;
  return rows.map((r) => r.name);
}

/** What stands between the store and launch; required checks block it, the rest are worth a look */
export async function readiness(prisma: PrismaClient, storeId: string): Promise<ReadinessCheck[]> {
  const store = await prisma.store.findUniqueOrThrow({
    where: { id: storeId },
    include: { deliveryTiers: { where: { isActive: true } }, expressDeliveryConfig: true, userStores: { where: { role: "ORG_ADMIN" }, include: { user: true } } },
  });
  const [stocked, slots, sections, empty, team] = await Promise.all([
    prisma.storeProduct.count({ where: { storeId, isActive: true, stock: { gt: 0 } } }),
    prisma.deliverySlot.count({ where: { storeId, isActive: true } }),
    prisma.homeSection.count({ where: { organizationId: store.organizationId, isActive: true } }),
    emptyEssentialAisles(prisma, storeId),
    prisma.userStore.count({ where: { storeId, role: { in: ["STORE_MANAGER", "STAFF", "RIDER"] }, user: { deletedAt: null } } }),
  ]);
  const owner = store.userStores.find((u) => u.user.phone && !u.user.deletedAt);
  return [
    { key: "owner", label: "Owner can sign in by OTP", ok: !!owner, required: true, step: STEP.owner, detail: owner ? `${owner.user.name}, ${owner.user.phone}` : undefined },
    { key: "team", label: "Staff can sign in", ok: team > 0, required: false, step: STEP.owner, detail: team ? `${team} on the team` : "Only the owner runs the store for now" },
    { key: "location", label: "Map pin set", ok: store.latitude !== null && store.longitude !== null, required: true, step: STEP.store },
    { key: "tiers", label: `Delivery fees cover the ${store.deliveryRadius} km radius`, ok: tiersCoverRadius(store.deliveryTiers, store.deliveryRadius), required: true, step: STEP.store },
    { key: "delivery", label: "Express delivery or delivery slots", ok: !!store.expressDeliveryConfig?.isEnabled || slots > 0, required: true, step: STEP.store, detail: `${slots} slots a week` },
    { key: "size", label: "Store size chosen", ok: store.size !== null, required: true, step: STEP.size },
    { key: "catalog", label: "Products in stock", ok: stocked > 0, required: true, step: STEP.catalog, detail: `${stocked.toLocaleString("en-IN")} listings` },
    { key: "essentials", label: "Every essential aisle stocked", ok: empty.length === 0, required: false, step: STEP.catalog, detail: empty.length ? `Empty: ${empty.slice(0, 8).join(", ")}${empty.length > 8 ? ` +${empty.length - 8} more` : ""}` : undefined },
    { key: "logo", label: "Store logo", ok: !!store.logoUrl, required: false, step: STEP.store },
    { key: "storefront", label: "Home layout copied from a template", ok: sections > 0, required: false, step: STEP.storefront, detail: sections ? `${sections} sections` : "Shoppers see the default Home" },
  ];
}
