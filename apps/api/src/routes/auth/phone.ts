import type { FastifyInstance } from "fastify";
import { sendOtpSchema, verifyOtpSchema } from "@martly/shared/schemas";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { issueOtp, verifyOtp } from "../../services/otp.js";

/**
 * Changing your own phone: the number doubles as an OTP login, so a new number is only saved
 * after proving you can receive codes on it, and never if another account already uses it.
 */
export async function phoneChangeRoutes(app: FastifyInstance) {
  async function denial(userId: string, phone: string): Promise<string | null> {
    const me = await app.prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    if (me?.phone === phone) return "That's already your number";
    const taken = await app.prisma.user.findFirst({ where: { phone, id: { not: userId }, deletedAt: null }, select: { id: true } });
    return taken ? "This number is already used by another account" : null;
  }

  app.post("/phone/otp", { preHandler: [authenticate] }, async (request, reply) => {
    const { phone } = sendOtpSchema.parse(request.body);
    const denied = await denial(request.user.sub, phone);
    if (denied) return reply.conflict(denied);
    await issueOtp(app.prisma, phone, request.log);
    const response: ApiResponse<{ sent: boolean }> = { success: true, data: { sent: true } };
    return response;
  });

  app.post("/phone/verify", { preHandler: [authenticate] }, async (request, reply) => {
    const { phone, otp } = verifyOtpSchema.parse(request.body);
    const denied = await denial(request.user.sub, phone);
    if (denied) return reply.conflict(denied);
    if (!(await verifyOtp(app.prisma, phone, otp))) return reply.unauthorized("Invalid OTP");

    const user = await app.prisma.user.update({
      where: { id: request.user.sub },
      data: { phone },
      select: { id: true, phone: true },
    });
    const response: ApiResponse<typeof user> = { success: true, data: user };
    return response;
  });
}
