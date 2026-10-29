import { test } from "node:test";
import assert from "node:assert/strict";
import { ttlCache } from "./ttl-cache.js";

function clock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

test("a value is built once per key until the TTL passes", async () => {
  const c = clock();
  const cache = ttlCache<number>(1000, c.now);
  let builds = 0;
  const build = async () => ++builds;
  assert.equal(await cache.get("a", build), 1);
  c.advance(999);
  assert.equal(await cache.get("a", build), 1);
  assert.equal(await cache.get("b", build), 2);
  c.advance(1);
  assert.equal(await cache.get("a", build), 3);
});

test("callers during a build share it", async () => {
  const cache = ttlCache<string>(1000, clock().now);
  let builds = 0;
  let finish!: (v: string) => void;
  const build = () => (builds++, new Promise<string>((resolve) => (finish = resolve)));
  const first = cache.get("k", build);
  const second = cache.get("k", build);
  finish("done");
  assert.deepEqual(await Promise.all([first, second]), ["done", "done"]);
  assert.equal(builds, 1);
});

test("a failed build is not kept", async () => {
  const cache = ttlCache<string>(1000, clock().now);
  await assert.rejects(cache.get("k", async () => { throw new Error("db down"); }), /db down/);
  assert.equal(await cache.get("k", async () => "ok"), "ok");
});

test("delete drops a key so the next get rebuilds it", async () => {
  const cache = ttlCache<number>(1000, clock().now);
  let builds = 0;
  const build = async () => ++builds;
  await cache.get("k", build);
  cache.delete("k");
  assert.equal(await cache.get("k", build), 2);
});
