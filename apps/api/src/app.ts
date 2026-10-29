import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import sensible from "@fastify/sensible";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import { authSecret, checkSecrets } from "./services/secrets.js";
import { errorReply } from "./services/error-reply.js";
import { redactUrl } from "./services/request-log.js";
import { clampPageSize } from "./services/page-size.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { firebasePlugin } from "./plugins/firebase.js";
import { authRoutes } from "./routes/auth/index.js";
import { organizationRoutes } from "./routes/organizations/index.js";
import { storeRoutes } from "./routes/stores/index.js";
import { onboardingRoutes } from "./routes/onboarding/index.js";
import { townRoutes } from "./routes/towns/index.js";
import { webRoutes } from "./routes/web/index.js";
import { productRoutes } from "./routes/products/index.js";
import { orderRoutes } from "./routes/orders/index.js";
import { storeProductRoutes } from "./routes/store-products/index.js";
import { offerRoutes } from "./routes/offers/index.js";
import { priceReviewRoutes } from "./routes/price-review/index.js";
import { stockCheckRoutes } from "./routes/stock-check/index.js";
import { storefrontRoutes } from "./routes/storefront/index.js";
import { looseStapleRoutes } from "./routes/loose-staples/index.js";
import { uploadRoutes } from "./routes/uploads/index.js";
import { deviceTokenRoutes } from "./routes/device-tokens/index.js";
import { dashboardRoutes } from "./routes/dashboard/index.js";
import { categoryRoutes } from "./routes/categories/index.js";
import { brandRoutes } from "./routes/brands/index.js";
import { userRoutes } from "./routes/users/index.js";
import { stockRoutes } from "./routes/stock/index.js";
import { addressRoutes } from "./routes/addresses/index.js";
import { collectionRoutes } from "./routes/collections/index.js";
import { festivalEventRoutes } from "./routes/festival-events/index.js";
import { homeRoutes } from "./routes/home/index.js";
import { homeLayoutRoutes } from "./routes/home-layout/index.js";
import { festiveRoutes } from "./routes/festive/index.js";
import { promoRoutes } from "./routes/promos/index.js";
import { catalogDraftRoutes } from "./routes/catalog-drafts/index.js";
import { wishlistRoutes } from "./routes/wishlist/index.js";
import { reviewRoutes } from "./routes/reviews/index.js";
import { couponRoutes } from "./routes/coupons/index.js";
import { creditRoutes } from "./routes/credits/index.js";
import { deliveryZoneRoutes } from "./routes/delivery-zones/index.js";
import { deliveryTierRoutes } from "./routes/delivery-tiers/index.js";
import { deliverySlotRoutes } from "./routes/delivery-slots/index.js";
import { walletRoutes } from "./routes/wallet/index.js";
import { loyaltyRoutes } from "./routes/loyalty/index.js";
import { expressDeliveryRoutes } from "./routes/express-delivery/index.js";
import { deliveryTripRoutes } from "./routes/delivery-trips/index.js";
import { deliveryPlanRoutes } from "./routes/delivery-plan/index.js";
import { riderRoutes } from "./routes/riders/index.js";
import { bannerRoutes } from "./routes/banners/index.js";
import { notificationRoutes } from "./routes/notifications/index.js";
import { storeRatingRoutes } from "./routes/store-ratings/index.js";
import { reviewAnalyticsRoutes } from "./routes/review-analytics/index.js";
import { referralRoutes } from "./routes/referrals/index.js";
import { placesRoutes } from "./routes/places/index.js";
import { aiRoutes } from "./routes/ai/index.js";
import { listToCartRoutes } from "./routes/list-to-cart/index.js";
import { cartRoutes } from "./routes/cart/index.js";
import { storeWalkRoutes } from "./routes/store-walk/index.js";
import { monthlyListRoutes } from "./routes/monthly-list/index.js";
import { storeVoiceRoutes } from "./routes/store-voice/index.js";
import { shoppingListRoutes } from "./routes/shopping-list/index.js";
import { listGlossaryRoutes } from "./routes/list-glossary/index.js";
import { speechRoutes } from "./routes/speech/index.js";
import { supportRoutes } from "./routes/support/index.js";
import { smartReorderRoutes } from "./routes/smart-reorder/index.js";
import { storeIntelligenceRoutes } from "./routes/store-intelligence/index.js";
import { customerInsightsRoutes } from "./routes/customer-insights/index.js";
import { returnRequestRoutes } from "./routes/return-requests/index.js";
import { ledgerRoutes } from "./routes/ledger/index.js";
import { riderLocationRoutes } from "./routes/rider-location/index.js";
import { membershipRoutes } from "./routes/memberships/index.js";
import { marketingRoutes } from "./routes/marketing/index.js";
import { marketingAdminRoutes } from "./routes/marketing-admin/index.js";
import { paymentWebhookRoutes } from "./routes/payment-webhooks/index.js";
import { brandCampaignAdminRoutes } from "./routes/brand-campaigns/index.js";
import { brandPortalRoutes } from "./routes/brand-portal/index.js";
import { subscriptionRoutes } from "./routes/subscriptions/index.js";
import { recipeRoutes } from "./routes/recipes/index.js";
import { searchRoutes } from "./routes/search/index.js";
import { websocketPlugin } from "./plugins/websocket.js";
import notificationSchedulerPlugin from "./plugins/notification-scheduler.js";
import reorderNudgeSchedulerPlugin from "./plugins/reorder-nudge-scheduler.js";
import subscriptionSchedulerPlugin from "./plugins/subscription-scheduler.js";
import seasonalCurationSchedulerPlugin from "./plugins/seasonal-curation-scheduler.js";
import promoSchedulerPlugin from "./plugins/promo-scheduler.js";
import marketingSchedulerPlugin from "./plugins/marketing-scheduler.js";
import storefrontHealthSchedulerPlugin from "./plugins/storefront-health-scheduler.js";
import stockAlertsSchedulerPlugin from "./plugins/stock-alerts-scheduler.js";
import wishlistAlertSchedulerPlugin from "./plugins/wishlist-alert-scheduler.js";
import deliveryPlanningSchedulerPlugin from "./plugins/delivery-planning-scheduler.js";
import deliveryAlertsSchedulerPlugin from "./plugins/delivery-alerts-scheduler.js";
import membershipSchedulerPlugin from "./plugins/membership-scheduler.js";
import orderSlaSchedulerPlugin from "./plugins/order-sla-scheduler.js";
import returnsSchedulerPlugin from "./plugins/returns-scheduler.js";
import settlementSchedulerPlugin from "./plugins/settlement-scheduler.js";
import attentionSchedulerPlugin from "./plugins/attention-scheduler.js";
import monthlyListSchedulerPlugin from "./plugins/monthly-list-scheduler.js";
import creditSchedulerPlugin from "./plugins/credit-scheduler.js";
import packImagesPlugin from "./plugins/pack-images.js";
import catalogAgentWorkerPlugin from "./plugins/catalog-agent-worker.js";
import schedulerLockPlugin from "./plugins/scheduler-lock.js";
import alertPruneSchedulerPlugin from "./plugins/alert-prune-scheduler.js";
import { checkReadiness } from "./services/health.js";

export async function buildApp() {
  const app = Fastify({
    // One Railway proxy hop sits in front of the API, so request.ip is the client it saw
    trustProxy: 1,
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      serializers: {
        // The WebSocket handshake carries the JWT in its query string; never write it to the logs
        req: (request) => ({ method: request.method, url: redactUrl(request.url), host: request.host, remoteAddress: request.ip }),
      },
    },
  });
  checkSecrets(app.log);

  // ── Plugins ───────────────────────────────────────
  await app.register(cors, {
    origin: (process.env.CORS_ORIGIN ?? "http://localhost:7000").split(","),
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
  });

  await app.register(jwt, {
    secret: authSecret(),
    sign: { expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" },
  });

  await app.register(sensible);
  // Limits are set per route with rateLimits() from middleware/rate-limit.ts
  await app.register(rateLimit, { global: false });
  app.addHook("preValidation", async (request) => clampPageSize(request.query));
  await app.register(prismaPlugin);
  await app.register(firebasePlugin);
  await app.register(websocketPlugin);
  await app.register(schedulerLockPlugin);
  await app.register(notificationSchedulerPlugin);
  await app.register(reorderNudgeSchedulerPlugin);
  await app.register(subscriptionSchedulerPlugin);
  await app.register(seasonalCurationSchedulerPlugin);
  await app.register(promoSchedulerPlugin);
  await app.register(marketingSchedulerPlugin);
  await app.register(storefrontHealthSchedulerPlugin);
  await app.register(deliveryPlanningSchedulerPlugin);
  await app.register(deliveryAlertsSchedulerPlugin);
  await app.register(stockAlertsSchedulerPlugin);
  await app.register(wishlistAlertSchedulerPlugin);
  await app.register(membershipSchedulerPlugin);
  await app.register(orderSlaSchedulerPlugin);
  await app.register(returnsSchedulerPlugin);
  await app.register(settlementSchedulerPlugin);
  await app.register(attentionSchedulerPlugin);
  await app.register(monthlyListSchedulerPlugin);
  await app.register(alertPruneSchedulerPlugin);
  await app.register(creditSchedulerPlugin);
  await app.register(catalogAgentWorkerPlugin);
  await app.register(packImagesPlugin);

  // ── Error Handler ────────────────────────────────
  app.setErrorHandler((error, _request, reply) => {
    const { statusCode, body } = errorReply(error);
    if (!(error instanceof ZodError)) app.log.error(error);
    return reply.status(statusCode).send(body);
  });

  // ── Health Check ──────────────────────────────────
  // Liveness: the process answers. Readiness (Railway's deploy healthcheck): the database answers too
  app.get("/health", async () => {
    return { status: "ok" };
  });
  app.get("/health/ready", async (_request, reply) => {
    const { statusCode, body } = await checkReadiness(() => app.prisma.$queryRaw`SELECT 1`);
    if (statusCode !== 200) app.log.warn(body, "Readiness check failed");
    return reply.status(statusCode).send(body);
  });

  // ── API Routes ────────────────────────────────────
  await app.register(
    async (api) => {
      await api.register(authRoutes, { prefix: "/auth" });
      await api.register(organizationRoutes, { prefix: "/organizations" });
      await api.register(storeRoutes, { prefix: "/stores" });
      await api.register(onboardingRoutes, { prefix: "/onboarding" });
      await api.register(townRoutes, { prefix: "/towns" });
      await api.register(webRoutes, { prefix: "/web" });
      await api.register(productRoutes, { prefix: "/products" });
      await api.register(orderRoutes, { prefix: "/orders" });
      await api.register(storeProductRoutes, { prefix: "/store-products" });
      await api.register(offerRoutes, { prefix: "/offers" });
      await api.register(priceReviewRoutes, { prefix: "/price-review" });
      await api.register(stockCheckRoutes, { prefix: "/stock-check" });
      await api.register(storefrontRoutes, { prefix: "/storefront" });
      await api.register(looseStapleRoutes, { prefix: "/loose-staples" });
      await api.register(uploadRoutes, { prefix: "/uploads" });
      await api.register(deviceTokenRoutes, { prefix: "/device-tokens" });
      await api.register(dashboardRoutes, { prefix: "/dashboard" });
      await api.register(categoryRoutes, { prefix: "/categories" });
      await api.register(brandRoutes, { prefix: "/brands" });
      await api.register(userRoutes, { prefix: "/users" });
      await api.register(stockRoutes, { prefix: "/stock" });
      await api.register(addressRoutes, { prefix: "/addresses" });
      await api.register(collectionRoutes, { prefix: "/collections" });
      await api.register(festivalEventRoutes, { prefix: "/festival-events" });
      await api.register(homeRoutes, { prefix: "/home" });
      await api.register(homeLayoutRoutes, { prefix: "/home-layout" });
      await api.register(festiveRoutes, { prefix: "/festive" });
      await api.register(promoRoutes, { prefix: "/promos" });
      await api.register(catalogDraftRoutes, { prefix: "/catalog-drafts" });
      await api.register(wishlistRoutes, { prefix: "/wishlist" });
      await api.register(reviewRoutes, { prefix: "/reviews" });
      await api.register(couponRoutes, { prefix: "/coupons" });
      await api.register(creditRoutes, { prefix: "/credits" });
      await api.register(deliveryZoneRoutes, { prefix: "/delivery-zones" });
      await api.register(deliveryTierRoutes, { prefix: "/delivery-tiers" });
      await api.register(deliverySlotRoutes, { prefix: "/delivery-slots" });
      await api.register(walletRoutes, { prefix: "/wallet" });
      await api.register(loyaltyRoutes, { prefix: "/loyalty" });
      await api.register(expressDeliveryRoutes, { prefix: "/express-delivery" });
      await api.register(deliveryTripRoutes, { prefix: "/delivery-trips" });
      await api.register(deliveryPlanRoutes, { prefix: "/delivery-plan" });
      await api.register(riderRoutes, { prefix: "/riders" });
      await api.register(bannerRoutes, { prefix: "/banners" });
      await api.register(notificationRoutes, { prefix: "/notifications" });
      await api.register(storeRatingRoutes, { prefix: "/store-ratings" });
      await api.register(reviewAnalyticsRoutes, { prefix: "/review-analytics" });
      await api.register(referralRoutes, { prefix: "/referrals" });
      await api.register(placesRoutes, { prefix: "/places" });
      await api.register(aiRoutes, { prefix: "/ai" });
      await api.register(listToCartRoutes, { prefix: "/list-to-cart" });
      await api.register(cartRoutes, { prefix: "/cart" });
      await api.register(storeWalkRoutes, { prefix: "/store-walk" });
      await api.register(monthlyListRoutes, { prefix: "/monthly-list" });
      await api.register(storeVoiceRoutes, { prefix: "/store-voice" });
      await api.register(shoppingListRoutes, { prefix: "/shopping-list" });
      await api.register(listGlossaryRoutes, { prefix: "/list-glossary" });
      await api.register(speechRoutes, { prefix: "/speech" });
      await api.register(supportRoutes, { prefix: "/support" });
      await api.register(smartReorderRoutes, { prefix: "/smart-reorder" });
      await api.register(storeIntelligenceRoutes, { prefix: "/store-intelligence" });
      await api.register(customerInsightsRoutes, { prefix: "/customer-insights" });
      await api.register(returnRequestRoutes, { prefix: "/return-requests" });
      await api.register(ledgerRoutes, { prefix: "/ledger" });
      await api.register(riderLocationRoutes, { prefix: "/rider-location" });
      await api.register(membershipRoutes, { prefix: "/memberships" });
      await api.register(marketingRoutes, { prefix: "/marketing" });
      await api.register(marketingAdminRoutes, { prefix: "/marketing-admin" });
      await api.register(paymentWebhookRoutes, { prefix: "/payments/webhooks" });
      await api.register(brandCampaignAdminRoutes, { prefix: "/brand-campaigns" });
      await api.register(brandPortalRoutes, { prefix: "/brand-portal" });
      await api.register(subscriptionRoutes, { prefix: "/subscriptions" });
      await api.register(recipeRoutes, { prefix: "/recipes" });
      await api.register(searchRoutes, { prefix: "/search" });
    },
    { prefix: "/api/v1" },
  );

  return app;
}
