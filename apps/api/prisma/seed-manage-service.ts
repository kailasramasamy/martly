/**
 * Seeds reviews, return requests, support tickets and store ratings for the mobile Manage persona
 * (Demo Grocers / Harur Fresh Mart). Idempotent: rows are keyed on their natural unique keys.
 *
 *   cd apps/api && npx tsx prisma/seed-manage-service.ts
 *
 * Needs delivered orders at Harur Fresh Mart (run seed-manage-orders.ts first).
 */
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const REVIEW_IMAGES = [
  "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=400&fit=crop",
  "https://images.unsplash.com/photo-1506617564039-2f3b650b7010?w=400&h=400&fit=crop",
];
const RETURN_IMAGE = "https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=400&h=400&fit=crop";

const REVIEW_PLAN = [
  { rating: 5, status: "PENDING", comment: "Fresh and well packed. Delivery was quick.", images: true },
  { rating: 4, status: "PENDING", comment: "Good quality, slightly pricey.", images: false },
  { rating: 2, status: "PENDING", comment: "Item was close to expiry when it arrived.", images: true },
  { rating: 5, status: "APPROVED", comment: "My regular pick every week.", images: false, reply: "Thank you for the kind words!" },
  { rating: 1, status: "REJECTED", comment: "Spam text about another shop.", images: false },
] as const;

async function main() {
  const store = await prisma.store.findFirst({ where: { name: "Harur Fresh Mart" } });
  if (!store) throw new Error("Harur Fresh Mart not found");
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: "owner@demogrocers.dev" } });

  const orders = await prisma.order.findMany({
    where: { storeId: store.id, status: "DELIVERED" },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });
  if (orders.length === 0) throw new Error("No delivered orders at Harur Fresh Mart; run seed-manage-orders.ts first");

  await seedStoreRatings(store.id, orders);
  await seedReviews(store.id, orders, owner.id);
  await seedReturns(store.organizationId, store.id, orders);
  await seedTickets(store.organizationId, store.id, orders);
  console.log("Service seed done");
}

type SeedOrder = Awaited<ReturnType<typeof prisma.order.findMany<{ include: { items: true } }>>>[number];

async function seedStoreRatings(storeId: string, orders: SeedOrder[]) {
  const ratings = [
    { overall: 5, delivery: 5, packaging: 4, comment: "Super fast delivery." },
    { overall: 4, delivery: 4, packaging: 5, comment: null },
    { overall: 3, delivery: 2, packaging: 4, comment: "Rider took a long time to find the address." },
    { overall: 5, delivery: 5, packaging: 5, comment: "Always reliable." },
  ];
  for (const [i, o] of orders.slice(0, ratings.length).entries()) {
    const r = ratings[i];
    const data = { storeId, overallRating: r.overall, deliveryRating: r.delivery, packagingRating: r.packaging, comment: r.comment };
    await prisma.storeRating.upsert({
      where: { userId_orderId: { userId: o.userId, orderId: o.id } },
      update: data,
      create: { ...data, userId: o.userId, orderId: o.id },
    });
  }
}

async function seedReviews(storeId: string, orders: SeedOrder[], ownerId: string) {
  const pairs = orders.flatMap((o) => o.items.map((i) => ({ userId: o.userId, orderId: o.id, productId: i.productId })));
  const seen = new Set<string>();
  const unique = pairs.filter((p) => !seen.has(`${p.userId}:${p.productId}`) && seen.add(`${p.userId}:${p.productId}`));

  for (const [i, plan] of REVIEW_PLAN.entries()) {
    const pair = unique[i];
    if (!pair) break;
    const data = { storeId, orderId: pair.orderId, rating: plan.rating, comment: plan.comment, status: plan.status, isVerified: true };
    const review = await prisma.review.upsert({
      where: { userId_productId: { userId: pair.userId, productId: pair.productId } },
      update: data,
      create: { ...data, userId: pair.userId, productId: pair.productId },
    });
    if (plan.images) {
      await prisma.reviewImage.deleteMany({ where: { reviewId: review.id } });
      await prisma.reviewImage.createMany({ data: REVIEW_IMAGES.map((imageUrl, sortOrder) => ({ reviewId: review.id, imageUrl, sortOrder })) });
    }
    if ("reply" in plan) {
      await prisma.reviewReply.upsert({
        where: { reviewId: review.id },
        update: { body: plan.reply, userId: ownerId },
        create: { reviewId: review.id, body: plan.reply, userId: ownerId },
      });
    }
  }
}

async function seedReturns(organizationId: string, storeId: string, orders: SeedOrder[]) {
  const plans = [
    { status: "PENDING", reason: "DAMAGED", description: "Packet was torn when delivered.", adminNote: null, approved: null },
    { status: "APPROVED", reason: "WRONG_ITEM", description: "Received a different brand.", adminNote: "Refunded to wallet.", approved: true },
    { status: "REJECTED", reason: "CHANGED_MIND", description: "No longer needed.", adminNote: "Outside the return policy for this item.", approved: null },
  ] as const;

  for (const [i, plan] of plans.entries()) {
    const order = orders[i];
    if (!order || order.items.length === 0) break;
    const item = order.items[0];
    const requested = Number(item.unitPrice) * item.quantity;
    const resolved = plan.status !== "PENDING";
    const data = {
      status: plan.status,
      reason: plan.reason,
      description: plan.description,
      images: [RETURN_IMAGE],
      requestedAmount: requested,
      approvedAmount: plan.approved ? requested : null,
      adminNote: plan.adminNote,
      resolvedAt: resolved ? new Date() : null,
      ...(plan.approved ? { remedy: "REFUND" as const, method: "KEEP" as const, refundedAt: new Date() } : {}),
    };
    const request = await prisma.returnRequest.upsert({
      where: { orderId: order.id },
      update: data,
      create: { ...data, orderId: order.id, userId: order.userId, organizationId, storeId },
    });
    await prisma.returnRequestItem.deleteMany({ where: { returnRequestId: request.id } });
    await prisma.returnRequestItem.create({ data: { returnRequestId: request.id, orderItemId: item.id, quantity: item.quantity } });
  }
}

async function seedTickets(organizationId: string, storeId: string, orders: SeedOrder[]) {
  const now = Date.now();
  const at = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();
  const tickets = [
    {
      subject: "[seed] Order never arrived", status: "OPEN", priority: "HIGH",
      messages: [
        { role: "user", content: "My order was marked delivered but I never got it.", timestamp: at(180) },
        { role: "assistant", content: "I'm sorry about that. I've flagged this for the store team.", timestamp: at(179) },
      ],
    },
    {
      subject: "[seed] Wrong item in the bag", status: "OPEN", priority: "MEDIUM",
      messages: [{ role: "user", content: "I got a different brand of detergent.", timestamp: at(90) }],
    },
    {
      subject: "[seed] Refund timeline question", status: "RESOLVED", priority: "LOW",
      messages: [
        { role: "user", content: "How long does a wallet refund take?", timestamp: at(2880) },
        { role: "admin", content: "Wallet refunds are instant once approved.", timestamp: at(2800) },
      ],
    },
  ];

  for (const [i, t] of tickets.entries()) {
    const order = orders[i % orders.length];
    const existing = await prisma.supportTicket.findFirst({ where: { subject: t.subject, userId: order.userId } });
    const data = { ...t, storeId, organizationId, orderId: order.id };
    if (existing) await prisma.supportTicket.update({ where: { id: existing.id }, data });
    else await prisma.supportTicket.create({ data: { ...data, userId: order.userId } });
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
