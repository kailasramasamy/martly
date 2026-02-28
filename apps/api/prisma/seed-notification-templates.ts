import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst({
    where: { slug: "innovative-foods" },
  });
  if (!org) {
    console.log("Organization 'innovative-foods' not found. Run base seed first.");
    process.exit(1);
  }

  const owner = await prisma.user.findFirst({
    where: { email: "owner@innovative.dev" },
  });
  if (!owner) {
    console.log("User 'owner@innovative.dev' not found. Run base seed first.");
    process.exit(1);
  }

  // Check if templates already exist
  const existing = await prisma.notificationTemplate.count({
    where: { organizationId: org.id },
  });
  if (existing > 0) {
    console.log(`${existing} templates already exist for ${org.name}. Skipping.`);
    return;
  }

  const templates = [
    {
      name: "Weekend Sale",
      title: "Weekend Sale - Up to 30% Off!",
      body: "Don't miss our weekend sale! Get up to 30% off on fresh produce, dairy, and snacks. Shop now before stocks run out!",
      type: "PROMOTIONAL" as const,
    },
    {
      name: "Flash Deal",
      title: "Flash Deal - 2 Hours Only!",
      body: "Hurry! Flat 25% off on all beverages for the next 2 hours. Use the app to grab your favorites before the deal ends!",
      type: "PROMOTIONAL" as const,
    },
    {
      name: "New Arrivals",
      title: "Fresh Arrivals Just In!",
      body: "We've stocked up on fresh fruits, vegetables, and organic products. Check out what's new and add them to your cart today!",
      type: "PROMOTIONAL" as const,
    },
    {
      name: "Win-Back",
      title: "We Miss You!",
      body: "It's been a while since your last order. Come back and enjoy a special 15% discount on your next purchase. Your favorites are waiting!",
      type: "PROMOTIONAL" as const,
    },
    {
      name: "Loyalty Reminder",
      title: "Your Loyalty Points Are Waiting!",
      body: "You have loyalty points ready to redeem. Use them on your next order to save more. Points expire if unused — shop now!",
      type: "GENERAL" as const,
    },
    {
      name: "Delivery Update",
      title: "Important: Delivery Schedule Update",
      body: "Please note that delivery timings have been updated for your area. Check the app for the latest delivery slots and plan your orders accordingly.",
      type: "GENERAL" as const,
    },
    {
      name: "Festival Special",
      title: "Festival Special Offers!",
      body: "Celebrate with us! Special festival discounts on sweets, dry fruits, and festive essentials. Order now for timely delivery!",
      type: "PROMOTIONAL" as const,
    },
    {
      name: "Feedback Request",
      title: "How Was Your Experience?",
      body: "We'd love to hear from you! Rate your recent order and help us serve you better. Your feedback means a lot to us.",
      type: "GENERAL" as const,
    },
  ];

  console.log(`Seeding ${templates.length} notification templates for ${org.name}...`);

  for (const t of templates) {
    await prisma.notificationTemplate.create({
      data: {
        organizationId: org.id,
        name: t.name,
        title: t.title,
        body: t.body,
        type: t.type,
        createdBy: owner.id,
      },
    });
    console.log(`  + ${t.name}`);
  }

  console.log("Done! Notification templates seeded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
