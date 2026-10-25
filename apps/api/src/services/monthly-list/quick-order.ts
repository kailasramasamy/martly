import { lineTotal } from "@martly/shared/offers";
import type { MonthlyListQuoteInput } from "@martly/shared/schemas";
import type { MonthlyListQuote } from "@martly/shared/types";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { deliveryFeeTo, expressOutsideHours } from "../delivery/fee.js";
import { upcomingSlots } from "../delivery/slot-availability.js";
import { decorateStoreProducts, storeProductInclude } from "../store-product-view.js";

type Delivery = Extract<MonthlyListQuote, { ready: true }>["delivery"];

// The shopper's default address, else their newest
function addressFor(prisma: PrismaClient, userId: string) {
  return prisma.userAddress.findFirst({ where: { userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
}

// Express when the store runs it now (as checkout picks), else the soonest slot with room
async function deliveryFor(prisma: PrismaClient, storeId: string): Promise<Delivery | null> {
  const express = await prisma.expressDeliveryConfig.findUnique({ where: { storeId } });
  if (!express || (express.isEnabled && !expressOutsideHours(express))) return { kind: "EXPRESS", etaMinutes: express?.etaMinutes ?? null };
  const slot = (await upcomingSlots(prisma, [storeId], 1)).get(storeId)?.[0];
  return slot ? { kind: "SLOT", slotId: slot.id, date: slot.date, startTime: slot.startTime, endTime: slot.endTime } : null;
}

async function isMemberWithFreeDelivery(prisma: PrismaClient, userId: string, organizationId: string) {
  const membership = await prisma.userMembership.findFirst({
    where: { userId, organizationId, status: "ACTIVE", endDate: { gt: new Date() } },
    select: { plan: { select: { freeDelivery: true } } },
  });
  return { member: !!membership, freeDelivery: membership?.plan.freeDelivery === true };
}

// The lines the store can fill now: its active listings with stock for the quantity
async function fillable(prisma: PrismaClient, storeId: string, lines: MonthlyListQuoteInput["lines"]) {
  const rows = await prisma.storeProduct.findMany({
    where: { id: { in: lines.map((l) => l.storeProductId) }, storeId, isActive: true, product: { isActive: true } },
    include: storeProductInclude,
  });
  const byId = new Map((await decorateStoreProducts(prisma, rows)).map((sp) => [sp.id, sp]));
  return lines.flatMap((l) => {
    const sp = byId.get(l.storeProductId);
    return sp && sp.availableStock >= l.quantity ? [{ sp, quantity: l.quantity }] : [];
  });
}

/** What a one-tap order of these lines would be placed with, priced the way the order prices them; null when the list isn't the shopper's */
export async function quickOrderQuote(
  prisma: PrismaClient, userId: string, listId: string, input: MonthlyListQuoteInput,
): Promise<MonthlyListQuote | null> {
  const list = await prisma.monthlyList.findFirst({ where: { id: listId, userId }, select: { storeId: true } });
  if (!list) return null;
  const stocked = await fillable(prisma, list.storeId, input.lines);
  if (stocked.length === 0) return { ready: false, reason: "NOTHING_IN_STOCK" };
  const store = await prisma.store.findUniqueOrThrow({ where: { id: list.storeId } });
  const [address, delivery, membership] = await Promise.all([
    addressFor(prisma, userId), deliveryFor(prisma, list.storeId), isMemberWithFreeDelivery(prisma, userId, store.organizationId),
  ]);
  if (!address) return { ready: false, reason: "NO_ADDRESS" };
  if (!delivery) return { ready: false, reason: "NO_DELIVERY" };
  const itemsTotal = stocked.reduce((sum, { sp, quantity }) => {
    const { effectivePrice, memberPrice, offer } = sp.pricing;
    const unit = membership.member && memberPrice != null ? Math.min(memberPrice, effectivePrice) : effectivePrice;
    return sum + lineTotal(unit, quantity, offer);
  }, 0);
  if (store.minOrderAmount && itemsTotal < Number(store.minOrderAmount)) return { ready: false, reason: "BELOW_MINIMUM" };
  const point = address.latitude != null && address.longitude != null ? { lat: address.latitude, lng: address.longitude } : null;
  const fee = await deliveryFeeTo(prisma, list.storeId, store, point);
  if (fee.outOfRange) return { ready: false, reason: "NOT_SERVICEABLE" };
  const waived = membership.freeDelivery || (store.freeDeliveryThreshold != null && itemsTotal >= Number(store.freeDeliveryThreshold));
  const deliveryFee = waived ? 0 : fee.fee;
  return {
    ready: true,
    address: { id: address.id, label: address.label, address: address.address },
    delivery,
    lines: stocked.map(({ sp, quantity }) => ({ storeProductId: sp.id, quantity })),
    itemsTotal: Math.round(itemsTotal),
    deliveryFee,
    toPay: Math.round(itemsTotal + deliveryFee),
  };
}
