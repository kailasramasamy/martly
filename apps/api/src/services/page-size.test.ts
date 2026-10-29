import { test } from "node:test";
import assert from "node:assert/strict";
import { clampPageSize, MAX_PAGE_SIZE } from "./page-size.js";

test("an oversized or non-numeric page size is brought down to the cap", () => {
  for (const pageSize of ["1000000000", "Infinity", "abc"]) {
    const query = { pageSize };
    clampPageSize(query);
    assert.equal(query.pageSize, String(MAX_PAGE_SIZE));
  }
});

test("page sizes within the cap and queries without one are left alone", () => {
  const query = { pageSize: "200" };
  clampPageSize(query);
  assert.equal(query.pageSize, "200");
  const none: Record<string, string> = { q: "rice" };
  clampPageSize(none);
  assert.deepEqual(none, { q: "rice" });
});
