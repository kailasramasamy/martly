import { test } from "node:test";
import assert from "node:assert/strict";
import { packSize, pickPack, type PackOption } from "./variant-pick.js";

const rice: PackOption[] = [
  { size: packSize("kg", 1), price: 70 },
  { size: packSize("kg", 5), price: 330 },
  { size: packSize("kg", 10), price: 640 },
];
const chilli: PackOption[] = [
  { size: packSize("g", 50), price: 20 },
  { size: packSize("g", 100), price: 38 },
  { size: packSize("g", 500), price: 170 },
];
const eggs: PackOption[] = [
  { size: packSize("pcs", 6), price: 42 },
  { size: packSize("doz", 1), price: 80 },
];

test("packSize converts formatted labels to base units", () => {
  assert.deepEqual(packSize("kg", 0.25), { unit: "g", amount: 250 });
  assert.deepEqual(packSize("L", 1), { unit: "ml", amount: 1000 });
  assert.deepEqual(packSize("doz", 1), { unit: "pcs", amount: 12 });
});

test("an amount the store sells exactly takes the largest dividing pack", () => {
  assert.deepEqual(pickPack(rice, { amount: 2000, unit: "g", rupees: null }, -1), { index: 0, quantity: 2 });
  assert.deepEqual(pickPack(rice, { amount: 10000, unit: "g", rupees: null }, -1), { index: 2, quantity: 1 });
  assert.deepEqual(pickPack(eggs, { amount: 12, unit: "pcs", rupees: null }, -1), { index: 1, quantity: 1 });
});

test("an amount between sizes takes the smallest pack that covers it, not many tiny packs", () => {
  assert.deepEqual(pickPack(chilli, { amount: 250, unit: "g", rupees: null }, -1), { index: 2, quantity: 1 });
  assert.deepEqual(pickPack(rice, { amount: 3000, unit: "g", rupees: null }, -1), { index: 0, quantity: 3 });
  assert.deepEqual(pickPack(rice, { amount: 4500, unit: "g", rupees: null }, -1), { index: 1, quantity: 1 });
});

test("more than the largest pack: exact in up to ten packs, else the least over", () => {
  const dal: PackOption[] = [{ size: packSize("kg", 1), price: 130 }, { size: packSize("kg", 2), price: 255 }];
  assert.deepEqual(pickPack(dal, { amount: 5000, unit: "g", rupees: null }, -1), { index: 0, quantity: 5 });
  assert.deepEqual(pickPack(dal, { amount: 3500, unit: "g", rupees: null }, -1), { index: 1, quantity: 2 });
  assert.deepEqual(pickPack(chilli, { amount: 1200, unit: "g", rupees: null }, -1), { index: 2, quantity: 3 });
  assert.deepEqual(pickPack(rice, { amount: 25000, unit: "g", rupees: null }, -1), { index: 1, quantity: 5 });
});

test("no amount takes the pack bought before, else the cheapest", () => {
  assert.deepEqual(pickPack(rice, { amount: null, unit: null, rupees: null }, 1), { index: 1, quantity: 1 });
  assert.deepEqual(pickPack(rice, { amount: null, unit: null, rupees: null }, -1), { index: 0, quantity: 1 });
});

test("a money's worth buys that much of the cheapest pack, at least one", () => {
  assert.deepEqual(pickPack(chilli, { amount: null, unit: null, rupees: 40 }, 2), { index: 0, quantity: 2 });
  assert.deepEqual(pickPack(chilli, { amount: null, unit: null, rupees: 10 }, 2), { index: 0, quantity: 1 });
});

test("packs and counts of things sized by weight take that many of the usual pack", () => {
  assert.deepEqual(pickPack(chilli, { amount: 2, unit: "pack", rupees: null }, 1), { index: 1, quantity: 2 });
  assert.deepEqual(pickPack(rice, { amount: 3, unit: "pcs", rupees: null }, -1), { index: 0, quantity: 3 });
  assert.deepEqual(pickPack(rice, { amount: 500, unit: "ml", rupees: null }, -1), { index: 0, quantity: 1 });
});
