import type { FastifyInstance } from "fastify";
import type { ApiResponse } from "@martly/shared/types";
import { deviceTokenReleaseSchema } from "@martly/shared/schemas";
import { authenticate } from "../../middleware/auth.js";
import { byIp, rateLimits } from "../../middleware/rate-limit.js";

export async function deviceTokenRoutes(app: FastifyInstance) {
  // Register device token (upsert)
  app.post("/", { preHandler: [authenticate] }, async (request) => {
    const { token, platform } = request.body as { token: string; platform?: string };
    const user = request.user as { sub: string };

    await app.prisma.deviceToken.upsert({
      where: { token },
      update: { userId: user.sub, platform: platform ?? "unknown", updatedAt: new Date() },
      create: { userId: user.sub, token, platform: platform ?? "unknown" },
    });

    const response: ApiResponse<{ registered: boolean }> = {
      success: true,
      data: { registered: true },
    };
    return response;
  });

  // Release a device token on sign-out. No session needed: after a forced sign-out the app has none, and only the
  // device knows its token
  const releaseLimit = rateLimits(app, [{ max: 60, window: "15 minutes", key: byIp }]);
  app.delete("/", { preHandler: [releaseLimit] }, async (request) => {
    const { token } = deviceTokenReleaseSchema.parse(request.body);

    await app.prisma.deviceToken.deleteMany({ where: { token } });

    const response: ApiResponse<{ removed: boolean }> = {
      success: true,
      data: { removed: true },
    };
    return response;
  });
}
