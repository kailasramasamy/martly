import { test } from "node:test";
import assert from "node:assert/strict";
import { areaLabel, balancedChunks, planTrips, routeOrder, suggestRiders, type PlanStop } from "./planner.js";

const STORE = { lat: 12.244, lng: 78.269 };
const at = (id: string, dLat: number, dLng: number, pincode = "636903"): PlanStop =>
  ({ id, lat: STORE.lat + dLat, lng: STORE.lng + dLng, pincode, address: `${id}, Temple Road, Harur` });
const noCoords = (id: string, pincode: string): PlanStop => ({ id, lat: null, lng: null, pincode, address: `${id}, Main St, Harur` });

test("balances trips instead of filling them: 17 orders, 8 per trip → 6, 6, 5", () => {
  const sizes = balancedChunks(Array.from({ length: 17 }, (_, i) => i), 3).map((c) => c.length);
  assert.deepEqual(sizes, [6, 6, 5]);
});

test("keeps each neighbourhood on one trip", () => {
  const north = ["n1", "n2", "n3"].map((id, i) => at(id, 0.02 + i * 0.001, 0.001));
  const south = ["s1", "s2", "s3"].map((id, i) => at(id, -0.02 - i * 0.001, -0.001));
  const { groups, overflow } = planTrips([north[0], south[0], north[1], south[1], north[2], south[2]], STORE, { maxPerTrip: 3, maxTrips: 4 });
  assert.equal(overflow.length, 0);
  assert.equal(groups.length, 2);
  for (const g of groups) {
    const prefixes = new Set(g.stops.map((s) => s.id[0]));
    assert.equal(prefixes.size, 1, `trip mixes areas: ${g.stops.map((s) => s.id)}`);
  }
});

test("a cluster straddling due west isn't split at the angle wrap-around", () => {
  // Bearings just above and below ±180° belong together
  const west = [at("w1", 0.001, -0.02), at("w2", -0.001, -0.02), at("w3", 0.0005, -0.021)];
  const east = [at("e1", 0, 0.02), at("e2", 0.001, 0.021), at("e3", -0.001, 0.02)];
  const { groups } = planTrips([...west, ...east], STORE, { maxPerTrip: 3, maxTrips: 2 });
  for (const g of groups) assert.equal(new Set(g.stops.map((s) => s.id[0])).size, 1);
});

test("without coordinates, groups by pincode", () => {
  const stops = [noCoords("a", "636903"), noCoords("b", "636905"), noCoords("c", "636903"), noCoords("d", "636905")];
  const { groups } = planTrips(stops, STORE, { maxPerTrip: 2, maxTrips: 2 });
  for (const g of groups) assert.equal(new Set(g.stops.map((s) => s.pincode)).size, 1);
});

test("orders beyond the fleet's capacity overflow instead of overloading trips", () => {
  const stops = Array.from({ length: 10 }, (_, i) => at(`o${i}`, 0.001 * i, 0.001));
  const { groups, overflow } = planTrips(stops, STORE, { maxPerTrip: 4, maxTrips: 2 });
  assert.equal(groups.reduce((n, g) => n + g.stops.length, 0), 8);
  assert.equal(overflow.length, 2);
  assert.ok(groups.every((g) => g.stops.length <= 4));
});

test("stops run nearest-first from the store", () => {
  const ordered = routeOrder([at("far", 0.03, 0), at("near", 0.01, 0), at("mid", 0.02, 0)], STORE).map((s) => s.id);
  assert.deepEqual(ordered, ["near", "mid", "far"]);
});

test("area label names the common street and pincode", () => {
  assert.equal(areaLabel([at("12", 0, 0), at("14", 0, 0)]), "Temple Road · 636903");
});

test("rider suggestions spread load and respect the per-rider limit", () => {
  const picks = suggestRiders(5, ["a", "b"], new Map([["a", 1]]), 2);
  assert.deepEqual(picks, ["b", "a", "b", null, null]);
});
