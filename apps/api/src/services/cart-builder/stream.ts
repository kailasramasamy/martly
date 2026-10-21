import type { OutgoingHttpHeaders } from "node:http";
import type { FastifyReply } from "fastify";
import type { CartBuilderSource } from "@martly/shared/constants";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { buildCart, ListUnreadableError, type BuildEvent } from "./index.js";

/**
 * Streams a cart build as newline-delimited JSON so the app can show each line's products as soon as they're found.
 * Once streaming starts the status is sent, so a failure becomes an `error` event (and is logged) instead of a 5xx.
 */
export async function streamBuild(
  reply: FastifyReply,
  prisma: PrismaClient,
  input: { userId: string; storeId: string; text: string; source: CartBuilderSource; language?: string },
  done: Partial<Extract<BuildEvent, { type: "done" }>> = {},
) {
  reply.hijack();
  reply.raw.writeHead(200, { ...(reply.getHeaders() as OutgoingHttpHeaders), "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" });
  const write = (event: BuildEvent) => reply.raw.write(`${JSON.stringify(event.type === "done" ? { ...event, ...done } : event)}\n`);
  try {
    await buildCart(prisma, input, write);
  } catch (err) {
    if (!(err instanceof ListUnreadableError)) reply.log.error(err);
    write({ type: "error", message: err instanceof ListUnreadableError ? "We couldn't read that list. Please try again." : "Something went wrong. Please try again." });
  } finally {
    reply.raw.end();
  }
}
