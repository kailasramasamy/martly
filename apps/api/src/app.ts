import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import sensible from "@fastify/sensible";
import { ZodError } from "zod";
import { prismaPlugin } from "./plugins/prisma.js";
import { firebasePlugin } from "./plugins/firebase.js";
import { authRoutes } from "./routes/auth/index.js";
import { organizationRoutes } from "./routes/organizations/index.js";
import { storeRoutes } from "./routes/stores/index.js";
import { productRoutes } from "./routes/products/index.js";
import { orderRoutes } from "./routes/orders/index.js";
import { storeProductRoutes } from "./routes/store-products/index.js";
import { uploadRoutes } from "./routes/uploads/index.js";
import { deviceTokenRoutes } from "./routes/device-tokens/index.js";
import { dashboardRoutes } from "./routes/dashboard/index.js";
import { categoryRoutes } from "./routes/categories/index.js";
import { brandRoutes } from "./routes/brands/index.js";
import { userRoutes } from "./routes/users/index.js";
import { stockRoutes } from "./routes/stock/index.js";

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
  await app.register(firebasePlugin);

  // ── Error Handler ────────────────────────────────
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: "Validation Error",
        message: error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        statusCode: 400,
      });
    }
    const err = error as Error & { statusCode?: number };
    app.log.error(error);
    return reply.status(err.statusCode ?? 500).send({
      success: false,
      error: err.name,
      message: err.message,
      statusCode: err.statusCode ?? 500,
    });
  });

  // ── Health Check ──────────────────────────────────
  app.get("/health", async () => {
    return { status: "ok" };
  });

  // ── API Routes ────────────────────────────────────
  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: "/auth" });
      await api.register(organizationRoutes, { prefix: "/organizations" });
      await api.register(storeRoutes, { prefix: "/stores" });
      await api.register(productRoutes, { prefix: "/products" });
      await api.register(orderRoutes, { prefix: "/orders" });
      await api.register(storeProductRoutes, { prefix: "/store-products" });
      await api.register(uploadRoutes, { prefix: "/uploads" });
      await api.register(deviceTokenRoutes, { prefix: "/device-tokens" });
      await api.register(dashboardRoutes, { prefix: "/dashboard" });
      await api.register(categoryRoutes, { prefix: "/categories" });
      await api.register(brandRoutes, { prefix: "/brands" });
      await api.register(userRoutes, { prefix: "/users" });
      await api.register(stockRoutes, { prefix: "/stock" });
    },
    { prefix: "/api/v1" },
  );

  return app;
}
