import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { Prisma } from "../../generated/prisma/client.js";
import { errorReply } from "./error-reply.js";
import { redactUrl } from "./request-log.js";

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError("Invalid `prisma.user.create()` invocation: Unique constraint failed on the fields: (`phone`)", {
    code, clientVersion: "6",
  });

test("errors raised with a 4xx status keep their message", () => {
  const { statusCode, body } = errorReply(Object.assign(new Error("Insufficient wallet balance"), { statusCode: 400 }));
  assert.equal(statusCode, 400);
  assert.equal(body.message, "Insufficient wallet balance");
});

test("validation errors answer 400 with the issues", () => {
  const result = z.object({ phone: z.string() }).safeParse({});
  assert.ok(!result.success);
  const { statusCode, body } = errorReply(result.error);
  assert.equal(statusCode, 400);
  assert.match(body.message, /^phone:/);
});

test("database errors never leak their message", () => {
  const unknown = errorReply(prismaError("P2010"));
  assert.equal(unknown.statusCode, 500);
  assert.doesNotMatch(unknown.body.message, /prisma|phone/i);

  const validation = new Prisma.PrismaClientValidationError("Argument `where` of type users_where_input needs...", { clientVersion: "6" });
  assert.equal(errorReply(validation).statusCode, 500);
  assert.doesNotMatch(errorReply(validation).body.message, /users/);
});

test("unique and not-found database errors map to 409 and 404 with generic messages", () => {
  assert.deepEqual([errorReply(prismaError("P2002")).statusCode, errorReply(prismaError("P2002")).body.message], [409, "This is already in use"]);
  assert.equal(errorReply(prismaError("P2025")).statusCode, 404);
});

test("unexpected errors answer a generic 500", () => {
  const { statusCode, body } = errorReply(new TypeError("Cannot read properties of undefined (reading 'storeId')"));
  assert.equal(statusCode, 500);
  assert.doesNotMatch(body.message, /storeId/);
});

test("the WebSocket token is redacted from logged URLs", () => {
  assert.equal(redactUrl("/ws?token=eyJhbGciOi.abc.def"), "/ws?token=[redacted]");
  assert.equal(redactUrl("/ws?x=1&token=eyJ&y=2"), "/ws?x=1&token=[redacted]&y=2");
  assert.equal(redactUrl("/api/v1/search/suggest?q=rice"), "/api/v1/search/suggest?q=rice");
});
