import { test } from "node:test";
import assert from "node:assert/strict";
import { authSecret, checkSecrets } from "./secrets.js";

const quiet = { warn: () => {} };

test("production refuses to boot without a real JWT_SECRET", () => {
  assert.throws(() => authSecret({ NODE_ENV: "production" }), /JWT_SECRET/);
  assert.throws(() => authSecret({ NODE_ENV: "production", JWT_SECRET: "" }), /JWT_SECRET/);
  assert.throws(() => authSecret({ NODE_ENV: "production", JWT_SECRET: "dev-secret-change-me" }), /JWT_SECRET/);
  assert.throws(() => checkSecrets(quiet, { NODE_ENV: "production" }), /JWT_SECRET/);
});

test("production uses the configured secret", () => {
  assert.equal(authSecret({ NODE_ENV: "production", JWT_SECRET: "s3cret-from-railway" }), "s3cret-from-railway");
});

test("outside production a missing secret falls back to the dev key", () => {
  assert.equal(authSecret({ NODE_ENV: "development" }), "dev-secret-change-me");
  assert.equal(authSecret({}), "dev-secret-change-me");
  assert.equal(authSecret({ JWT_SECRET: "local" }), "local");
});

test("a missing WEB_API_SECRET in production warns instead of failing", () => {
  const warnings: string[] = [];
  checkSecrets({ warn: (msg) => warnings.push(msg) }, { NODE_ENV: "production", JWT_SECRET: "real" });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /WEB_API_SECRET/);
});
