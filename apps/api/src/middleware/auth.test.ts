import { test } from "node:test";
import assert from "node:assert/strict";
import type { FastifyReply, FastifyRequest } from "fastify";
import { authenticate, authenticateOptional, authenticateOrgSelection, tokenKind } from "./auth.js";

type Claims = { sub: string; type?: string };

/** A request whose token verifies to `claims` (or fails when null), and a reply that records a 401 */
function call(claims: Claims | null, withHeader = true) {
  const request = {
    headers: withHeader ? { authorization: "Bearer x" } : {},
    user: undefined as Claims | undefined,
    async jwtVerify() {
      if (!claims) throw new Error("bad signature");
      request.user = claims;
    },
  };
  const outcome = { rejected: null as string | null };
  const reply = { unauthorized: (message: string) => { outcome.rejected = message; return reply; } };
  return { request: request as unknown as FastifyRequest, reply: reply as unknown as FastifyReply, outcome };
}

const access: Claims = { sub: "u1" };
const refresh: Claims = { sub: "u1", type: "refresh" };
const orgSelect: Claims = { sub: "u1", type: "org-select" };
const phoneChange: Claims = { sub: "u1", type: "phone-change" };

test("tokens without a type are access tokens, so ones issued before the check keep working", () => {
  assert.equal(tokenKind(access), "access");
  assert.equal(tokenKind(refresh), "refresh");
});

test("authenticate accepts access tokens only", async () => {
  for (const [claims, ok] of [[access, true], [refresh, false], [orgSelect, false], [phoneChange, false]] as const) {
    const { request, reply, outcome } = call(claims);
    await authenticate(request, reply);
    assert.equal(outcome.rejected === null, ok, `type ${claims.type ?? "access"}`);
  }
});

test("authenticate rejects a token that fails verification", async () => {
  const { request, reply, outcome } = call(null);
  await authenticate(request, reply);
  assert.equal(outcome.rejected, "Invalid or expired token");
});

test("org selection takes the org-select token or an access token, never a refresh token", async () => {
  for (const [claims, ok] of [[access, true], [orgSelect, true], [refresh, false]] as const) {
    const { request, reply, outcome } = call(claims);
    await authenticateOrgSelection(request, reply);
    assert.equal(outcome.rejected === null, ok, `type ${claims.type ?? "access"}`);
  }
});

test("optional auth lets guests through but still rejects a refresh token sent as a login", async () => {
  const guest = call(null, false);
  await authenticateOptional(guest.request, guest.reply);
  assert.equal(guest.outcome.rejected, null);

  const sent = call(refresh);
  await authenticateOptional(sent.request, sent.reply);
  assert.equal(sent.outcome.rejected, "Invalid token type");
});
