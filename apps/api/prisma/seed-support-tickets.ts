import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

async function main() {
  // Find customer user and a recent order
  const customer = await prisma.user.findFirst({
    where: { role: "CUSTOMER" },
    select: { id: true, name: true },
  });

  if (!customer) {
    console.log("No customer found. Run main seed first.");
    return;
  }

  const store = await prisma.store.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, organizationId: true },
  });

  if (!store) {
    console.log("No active store found. Run main seed first.");
    return;
  }

  const recentOrder = await prisma.order.findFirst({
    where: { userId: customer.id, storeId: store.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  console.log(`Creating support tickets for customer: ${customer.name}, store: ${store.name}`);

  // Ticket 1: Order issue with conversation
  await prisma.supportTicket.create({
    data: {
      userId: customer.id,
      storeId: store.id,
      orderId: recentOrder?.id ?? null,
      organizationId: store.organizationId,
      subject: "Missing items in my order",
      status: "OPEN",
      priority: "HIGH",
      messages: [
        { role: "user", content: "I received my order but 2 items are missing", timestamp: new Date(Date.now() - 3600000).toISOString() },
        { role: "assistant", content: "I'm sorry to hear that! Let me look up your order details to help you with this.", timestamp: new Date(Date.now() - 3500000).toISOString() },
        { role: "user", content: "The Amul butter and Tata salt were not in the bag", timestamp: new Date(Date.now() - 3400000).toISOString() },
        { role: "assistant", content: "I can see your order and those items were included. I'm escalating this to our support team for a resolution. They'll look into it and get back to you.", timestamp: new Date(Date.now() - 3300000).toISOString() },
      ],
    },
  });

  // Ticket 2: Payment issue
  await prisma.supportTicket.create({
    data: {
      userId: customer.id,
      storeId: store.id,
      organizationId: store.organizationId,
      subject: "Payment deducted but order failed",
      status: "OPEN",
      priority: "HIGH",
      messages: [
        { role: "user", content: "My payment of Rs 450 was deducted but the order shows as failed", timestamp: new Date(Date.now() - 7200000).toISOString() },
        { role: "assistant", content: "I understand that's frustrating. Let me look into your recent orders to check the payment status.", timestamp: new Date(Date.now() - 7100000).toISOString() },
        { role: "user", content: "Please refund the amount to my wallet", timestamp: new Date(Date.now() - 7000000).toISOString() },
        { role: "assistant", content: "I've escalated this to our team. They will review the payment and process a refund if applicable. You should hear back within 24 hours.", timestamp: new Date(Date.now() - 6900000).toISOString() },
      ],
    },
  });

  // Ticket 3: Delivery question - resolved
  await prisma.supportTicket.create({
    data: {
      userId: customer.id,
      storeId: store.id,
      organizationId: store.organizationId,
      subject: "Delivery time inquiry",
      status: "RESOLVED",
      priority: "LOW",
      messages: [
        { role: "user", content: "How long does delivery usually take?", timestamp: new Date(Date.now() - 86400000).toISOString() },
        { role: "assistant", content: "Delivery from this store typically takes 30-60 minutes depending on distance. Express delivery is available for faster service!", timestamp: new Date(Date.now() - 86300000).toISOString() },
        { role: "user", content: "Great, thanks!", timestamp: new Date(Date.now() - 86200000).toISOString() },
      ],
    },
  });

  // Ticket 4: General feedback
  await prisma.supportTicket.create({
    data: {
      userId: customer.id,
      storeId: store.id,
      organizationId: store.organizationId,
      subject: "App feature request",
      status: "CLOSED",
      priority: "LOW",
      messages: [
        { role: "user", content: "Can you add a feature to save favorite orders for quick reorder?", timestamp: new Date(Date.now() - 172800000).toISOString() },
        { role: "assistant", content: "Thank you for the suggestion! I've passed this feedback to our team. We're always looking for ways to improve. Is there anything else I can help with?", timestamp: new Date(Date.now() - 172700000).toISOString() },
        { role: "admin", content: "Thank you for the feature suggestion! We've added this to our roadmap. Stay tuned for updates!", timestamp: new Date(Date.now() - 172600000).toISOString() },
      ],
    },
  });

  console.log("Created 4 sample support tickets");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
