import { ZodError } from "zod";
import { Prisma } from "../../generated/prisma/client.js";

interface ErrorReply {
  statusCode: number;
  body: { success: false; error: string; message: string; statusCode: number };
}

const reply = (statusCode: number, error: string, message: string): ErrorReply => ({
  statusCode,
  body: { success: false, error, message, statusCode },
});

/**
 * What a failed request answers. Errors our code raises with a status code keep their message; database and other
 * unexpected errors answer a generic 500 so table names, queries and stack details never reach a client.
 */
export function errorReply(error: unknown): ErrorReply {
  if (error instanceof ZodError) {
    return reply(400, "Validation Error", error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return reply(409, "Conflict", "This is already in use");
    if (error.code === "P2025") return reply(404, "Not Found", "Not found");
  }
  const err = error as Error & { statusCode?: number };
  const isPrisma = err.name?.startsWith("PrismaClient");
  if (typeof err.statusCode === "number" && err.statusCode >= 400 && !isPrisma) {
    return reply(err.statusCode, err.name, err.message);
  }
  return reply(500, "Internal Server Error", "Something went wrong. Please try again.");
}
