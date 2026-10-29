import { test } from "node:test";
import assert from "node:assert/strict";
import { keptShare, refusedValue, unitsValue } from "@martly/shared/order-flow";
import { platformShareBack } from "./order.js";

// Items ₹280: two ₹70 packs and one ₹140 tin; ₹80 of welcome credit, so the customer paid ₹200
const order = {
  couponDiscount: 0,
  creditDiscount: 80,
  items: [
    { id: "packs", quantity: 2, totalPrice: 140 },
    { id: "tin", quantity: 1, totalPrice: 140 },
  ],
};

test("units are valued at their line's price per unit", () => {
  assert.equal(unitsValue(order.items, [{ orderItemId: "packs", quantity: 1 }, { orderItemId: "tin", quantity: 1 }]), 210);
});

test("handing back half the items by price keeps half of Martly's coupon and credit", () => {
  const refused = [{ orderItemId: "tin", quantity: 1 }];
  assert.equal(keptShare(order, refused), 0.5);
  // The customer gets back what they paid for the tin: ₹140 less its share of the credit
  assert.equal(refusedValue(order, refused), 100);
});

test("nothing handed back keeps all of it", () => {
  assert.equal(keptShare(order, []), 1);
});

test("a return takes back the returned units' share of what delivery posted", () => {
  const entries = [{ id: "e1", type: "PLATFORM_CREDIT", amount: 50, sourceType: "ORDER" }];
  const back = platformShareBack(entries, new Set(), 0.5);
  assert.deepEqual(back, [{ type: "PLATFORM_COUPON", amount: 0 }, { type: "PLATFORM_CREDIT", amount: 25 }]);
});

test("later returns never take back more than is left", () => {
  const entries = [
    { id: "e1", type: "PLATFORM_COUPON", amount: 40, sourceType: "ORDER" },
    { id: "r1", type: "PLATFORM_COUPON", amount: -30, sourceType: "RETURN" },
  ];
  assert.equal(platformShareBack(entries, new Set(), 0.5)[0].amount, 10);
});

test("entries an undone delivery reversed don't count; the redelivery's do", () => {
  const entries = [
    { id: "first", type: "PLATFORM_CREDIT", amount: 50, sourceType: "ORDER" },
    { id: "again", type: "PLATFORM_CREDIT", amount: 50, sourceType: "ORDER" },
  ];
  assert.equal(platformShareBack(entries, new Set(["first"]), 1)[1].amount, 50);
});
