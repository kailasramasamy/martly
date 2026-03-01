import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: "owner@innovative.dev" } });
  if (!admin) {
    console.error("Owner user not found.");
    process.exit(1);
  }

  // Get existing approved reviews that don't have images or replies
  const reviews = await prisma.review.findMany({
    where: { status: "APPROVED" },
    include: { images: true, reply: true, product: { select: { name: true } } },
    take: 10,
  });

  const reviewImages = [
    "https://images.unsplash.com/photo-1543168256-418811576931?w=400&h=400&fit=crop",
    "https://images.unsplash.com/photo-1553787499-6f9133860278?w=400&h=400&fit=crop",
    "https://images.unsplash.com/photo-1506617420156-8e4536971650?w=400&h=400&fit=crop",
  ];

  const replies = [
    "Thank you for your review! We're glad you enjoyed the product.",
    "We appreciate your feedback! We'll continue to improve.",
    "Thanks for taking the time to share your experience!",
  ];

  let imagesAdded = 0;
  let repliesAdded = 0;

  for (let i = 0; i < reviews.length; i++) {
    const r = reviews[i];

    // Add images to first 3 reviews that don't have them
    if (r.images.length === 0 && imagesAdded < 3) {
      const imgCount = (i % 2) + 1; // 1 or 2 images
      await prisma.reviewImage.createMany({
        data: reviewImages.slice(0, imgCount).map((url, idx) => ({
          reviewId: r.id,
          imageUrl: url,
          sortOrder: idx,
        })),
      });
      console.log(`  Added ${imgCount} images to review for "${r.product.name}"`);
      imagesAdded++;
    }

    // Add replies to first 4 reviews that don't have them
    if (!r.reply && repliesAdded < 4) {
      await prisma.reviewReply.create({
        data: {
          reviewId: r.id,
          userId: admin.id,
          body: replies[repliesAdded % replies.length],
        },
      });
      console.log(`  Added reply to review for "${r.product.name}"`);
      repliesAdded++;
    }
  }

  console.log(`Added ${imagesAdded} image sets and ${repliesAdded} replies`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
