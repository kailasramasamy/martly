import { test } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { deliveryFeeAfterWaivers, priceLine, type PricedListing } from "../line-pricing.js";
import { catchUpDate, fitToWallet, type BasketLine, type DueSubscription } from "./basket.js";
import { claimDate } from "./place.js";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const noDiscount = { discountType: null, discountValue: null, discountStart: null, discountEnd: null };
const listing = (price: number, extra: Partial<PricedListing> = {}) =>
  ({ ...noDiscount, price, memberPrice: null, variant: noDiscount, ...extra }) as PricedListing;

test("a daily subscription left behind by a missed run resumes tomorrow, not on a past day", () => {
  assert.deepEqual(catchUpDate(day("2026-10-20"), "DAILY", [], day("2026-10-30")), day("2026-10-30"));
});

test("an alternate-day subscription resumed after a pause keeps its rhythm", () => {
  // 20th, 22nd ... 28th, 30th: tomorrow (the 30th) is a delivery day
  assert.deepEqual(catchUpDate(day("2026-10-20"), "ALTERNATE_DAYS", [], day("2026-10-30")), day("2026-10-30"));
  // From the 21st the next one on or after the 30th is the 31st
  assert.deepEqual(catchUpDate(day("2026-10-21"), "ALTERNATE_DAYS", [], day("2026-10-30")), day("2026-10-31"));
});

test("subscription lines get the member price for members only", () => {
  const sp = listing(60, { memberPrice: 50 });
  assert.equal(priceLine(sp, 2, true).totalPrice, 100);
  assert.equal(priceLine(sp, 2, false).totalPrice, 120);
});

test("subscription lines get buy X get Y free units", () => {
  const sp = listing(40, { offerBuyQty: 1, offerGetQty: 1 });
  const line = priceLine(sp, 2, false);
  assert.equal(line.freeQuantity, 1);
  assert.equal(line.totalPrice, 40);
});

test("free delivery: over the store's threshold, or for a member whose plan includes it", () => {
  assert.equal(deliveryFeeAfterWaivers(30, 500, 299, false), 0);
  assert.equal(deliveryFeeAfterWaivers(30, 200, 299, false), 30);
  assert.equal(deliveryFeeAfterWaivers(30, 200, 299, true), 0);
  assert.equal(deliveryFeeAfterWaivers(30, 200, null, false), 30);
});

const basketLine = (name: string, price: number, quantity: number) => {
  const sp = { ...listing(price), id: name, productId: name, variantId: name, product: { name } };
  return { ...priceLine(sp, quantity, false), storeProductId: name, productId: name, variantId: name, name, listing: sp } as unknown as BasketLine;
};

test("a short wallet keeps whole lines in order, then as many units of the next as it covers", () => {
  const { kept, short } = fitToWallet([basketLine("milk", 30, 2), basketLine("curd", 20, 3)], 10, 110, false);
  assert.deepEqual(kept.map((l) => [l.name, l.quantity]), [["milk", 2], ["curd", 2]]);
  assert.deepEqual(short, ["curd"]);
});

test("only one run can claim a subscription's delivery day", async () => {
  let claimed = false;
  const db = {
    subscription: {
      updateMany: async () => {
        const count = claimed ? 0 : 1;
        claimed = true;
        return { count };
      },
    },
  } as unknown as FastifyInstance["prisma"];
  const sub = { id: "s1", nextDeliveryDate: day("2026-10-30") } as DueSubscription;
  const [a, b] = await Promise.all([claimDate(db, sub, day("2026-10-31")), claimDate(db, sub, day("2026-10-31"))]);
  assert.deepEqual([a, b].sort(), [false, true]);
});
