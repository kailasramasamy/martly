import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst({ where: { slug: "innovative-foods" } });
  if (!org) {
    console.error("Organization 'innovative-foods' not found. Run db:seed first.");
    process.exit(1);
  }

  const customer = await prisma.user.findUnique({ where: { email: "customer@martly.dev" } });
  if (!customer) {
    console.error("Customer user not found. Run db:seed first.");
    process.exit(1);
  }

  const admin = await prisma.user.findUnique({ where: { email: "owner@innovative.dev" } });
  if (!admin) {
    console.error("Owner user not found.");
    process.exit(1);
  }

  const store = await prisma.store.findFirst({ where: { organizationId: org.id, status: "ACTIVE" } });
  if (!store) {
    console.error("No active store found.");
    process.exit(1);
  }

  // Find some products with store products
  const storeProducts = await prisma.storeProduct.findMany({
    where: { storeId: store.id, isActive: true },
    include: { product: true },
    take: 8,
  });

  if (storeProducts.length === 0) {
    console.error("No store products found.");
    process.exit(1);
  }

  // Find a delivered order for verified reviews
  const deliveredOrder = await prisma.order.findFirst({
    where: { userId: customer.id, status: "DELIVERED", storeId: store.id },
    include: { items: true },
  });

  console.log(`Found ${storeProducts.length} store products, delivered order: ${deliveredOrder?.id ?? "none"}`);

  // Create reviews with images and replies
  const reviewImages = [
    "https://images.unsplash.com/photo-1543168256-418811576931?w=400&h=400&fit=crop",
    "https://images.unsplash.com/photo-1553787499-6f9133860278?w=400&h=400&fit=crop",
    "https://images.unsplash.com/photo-1506617420156-8e4536971650?w=400&h=400&fit=crop",
  ];

  const reviewData = [
    { rating: 5, title: "Excellent quality!", comment: "Fresh and exactly as described. Will buy again.", hasImages: true, hasReply: true },
    { rating: 4, title: "Good product", comment: "Nice quality, packaging could be better but overall good.", hasImages: false, hasReply: true },
    { rating: 3, title: "Average", comment: "Expected better quality for the price. Taste was okay.", hasImages: true, hasReply: false },
    { rating: 5, title: "Best in town", comment: "Amazing freshness and taste. My family loved it!", hasImages: false, hasReply: false },
    { rating: 2, title: "Disappointing", comment: "Not as fresh as expected. Delivery was slow.", hasImages: false, hasReply: true },
    { rating: 4, title: null, comment: "Good value for money.", hasImages: false, hasReply: false },
  ];

  let created = 0;
  for (let i = 0; i < Math.min(reviewData.length, storeProducts.length); i++) {
    const sp = storeProducts[i];
    const rd = reviewData[i];

    // Check if review already exists
    const existing = await prisma.review.findUnique({
      where: { userId_productId: { userId: customer.id, productId: sp.productId } },
    });
    if (existing) {
      console.log(`  Review for "${sp.product.name}" already exists, skipping`);
      continue;
    }

    const isVerified = deliveredOrder?.items.some((item) => item.productId === sp.productId) ?? false;

    const review = await prisma.review.create({
      data: {
        userId: customer.id,
        productId: sp.productId,
        storeId: store.id,
        orderId: isVerified ? deliveredOrder!.id : null,
        rating: rd.rating,
        title: rd.title,
        comment: rd.comment,
        isVerified,
        status: "APPROVED",
      },
    });

    // Add images
    if (rd.hasImages) {
      const imgCount = Math.min(2, reviewImages.length);
      await prisma.reviewImage.createMany({
        data: reviewImages.slice(0, imgCount).map((url, idx) => ({
          reviewId: review.id,
          imageUrl: url,
          sortOrder: idx,
        })),
      });
    }

    // Add admin reply
    if (rd.hasReply) {
      const replies = [
        "Thank you for your wonderful review! We're glad you enjoyed the product.",
        "We appreciate your feedback! We'll work on improving the packaging.",
        "Sorry to hear about the experience. We've noted your feedback for our delivery team.",
      ];
      await prisma.reviewReply.create({
        data: {
          reviewId: review.id,
          userId: admin.id,
          body: replies[created % replies.length],
        },
      });
    }

    console.log(`  Created review for "${sp.product.name}" (${rd.rating}★, images: ${rd.hasImages}, reply: ${rd.hasReply})`);
    created++;
  }

  console.log(`Created ${created} reviews`);

  // Create store ratings for delivered orders
  const deliveredOrders = await prisma.order.findMany({
    where: { storeId: store.id, status: "DELIVERED" },
    take: 5,
    orderBy: { createdAt: "desc" },
  });

  let ratingsCreated = 0;
  const ratingData = [
    { overall: 5, delivery: 5, packaging: 4, comment: "Excellent service! Very fast delivery." },
    { overall: 4, delivery: 3, packaging: 5, comment: "Good packaging, delivery was a bit late." },
    { overall: 5, delivery: 4, packaging: 5, comment: null },
    { overall: 3, delivery: 2, packaging: 3, comment: "Average experience." },
    { overall: 4, delivery: 4, packaging: 4, comment: "Good overall." },
  ];

  for (let i = 0; i < deliveredOrders.length; i++) {
    const order = deliveredOrders[i];
    const rd = ratingData[i % ratingData.length];

    const existing = await prisma.storeRating.findUnique({
      where: { userId_orderId: { userId: order.userId, orderId: order.id } },
    });
    if (existing) continue;

    await prisma.storeRating.create({
      data: {
        userId: order.userId,
        orderId: order.id,
        storeId: store.id,
        overallRating: rd.overall,
        deliveryRating: rd.delivery,
        packagingRating: rd.packaging,
        comment: rd.comment,
      },
    });
    ratingsCreated++;
    console.log(`  Created store rating for order ${order.id.slice(0, 8)} (${rd.overall}★)`);
  }

  console.log(`Created ${ratingsCreated} store ratings`);

  // Update loyalty config to include reviewRewardPoints
  await prisma.loyaltyConfig.updateMany({
    where: { organizationId: org.id },
    data: { reviewRewardPoints: 10 },
  });
  console.log("Updated loyalty config: reviewRewardPoints = 10");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
