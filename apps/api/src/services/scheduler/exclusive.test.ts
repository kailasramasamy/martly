import { test } from "node:test";
import assert from "node:assert/strict";
import { createJobRunner, type JobLocks } from "./exclusive.js";

/** An in-memory lock table shared by "instances", the way Postgres would be */
function fakeLocks(held = new Set<string>()) {
  const calls: string[] = [];
  const locks: JobLocks = {
    async tryLock(name) {
      calls.push(`lock:${name}`);
      if (held.has(name)) return false;
      held.add(name);
      return true;
    },
    async unlock(name) {
      calls.push(`unlock:${name}`);
      held.delete(name);
    },
  };
  return { locks, held, calls };
}

const errors: unknown[] = [];
const log = { error: (err: unknown) => errors.push(err) };

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

test("a tick while the previous run is still going is skipped", async () => {
  const { locks, calls } = fakeLocks();
  const gate = deferred();
  let runs = 0;
  const tick = createJobRunner(locks, log).wrap("job", async () => {
    runs++;
    await gate.promise;
  });
  const first = tick();
  const second = tick();
  gate.resolve();
  await Promise.all([first, second]);
  assert.equal(runs, 1);
  assert.deepEqual(calls, ["lock:job", "unlock:job"]);
  await tick();
  assert.equal(runs, 2);
});

test("a job another instance holds the lock for does not run", async () => {
  const { locks } = fakeLocks(new Set(["job"]));
  let runs = 0;
  await createJobRunner(locks, log).wrap("job", async () => { runs++; })();
  assert.equal(runs, 0);
});

test("two instances never run the same job at once", async () => {
  const shared = fakeLocks();
  const gate = deferred();
  let runs = 0;
  const job = async () => { runs++; await gate.promise; };
  const a = createJobRunner(shared.locks, log).wrap("job", job)();
  const b = createJobRunner(shared.locks, log).wrap("job", job)();
  gate.resolve();
  await Promise.all([a, b]);
  assert.equal(runs, 1);
});

test("a job that throws releases its lock, is logged, and runs again next tick", async () => {
  const { locks, held } = fakeLocks();
  errors.length = 0;
  let runs = 0;
  const tick = createJobRunner(locks, log).wrap("job", async () => {
    runs++;
    throw new Error("boom");
  });
  await tick();
  assert.equal(held.size, 0);
  assert.equal(errors.length, 1);
  await tick();
  assert.equal(runs, 2);
});

test("drain waits for a run in flight and stops new ones", async () => {
  const { locks } = fakeLocks();
  const gate = deferred();
  let finished = false;
  let runs = 0;
  const runner = createJobRunner(locks, log);
  const tick = runner.wrap("job", async () => {
    runs++;
    await gate.promise;
    finished = true;
  });
  void tick();
  const drained = runner.drain();
  gate.resolve();
  await drained;
  assert.ok(finished);
  await tick();
  assert.equal(runs, 1);
});
