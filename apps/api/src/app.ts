import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import sensible from "@fastify/sensible";
import { prismaPlugin } from "./plugins/prisma.js";
import { authRoutes } from "./routes/auth/index.js";
import { storeRoutes } from "./routes/stores/index.js";
import { productRoutes } from "./routes/products/index.js";
import { orderRoutes } from "./routes/orders/index.js";
import { storeProductRoutes } from "./routes/store-products/index.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
    },
  });

  // ── Plugins ───────────────────────────────────────
  await app.register(cors, {
    origin: (process.env.CORS_ORIGIN ?? "http://localhost:7000").split(","),
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? "dev-secret-change-me",
    sign: { expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" },
  });

  await app.register(sensible);
  await app.register(prismaPlugin);

  // ── Health Check ──────────────────────────────────
  app.get("/health", async () => {
    return { status: "ok" };
  });

  // ── API Routes ────────────────────────────────────
  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: "/auth" });
      await api.register(storeRoutes, { prefix: "/stores" });
      await api.register(productRoutes, { prefix: "/products" });
      await api.register(orderRoutes, { prefix: "/orders" });
      await api.register(storeProductRoutes, { prefix: "/store-products" });
    },
    { prefix: "/api/v1" },
  );

  return app;
}
