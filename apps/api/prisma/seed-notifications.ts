import { PrismaClient } from "../generated/prisma/client.js";

const prisma = new PrismaClient();

async function main() {
  // Find both customer users
  const emailCustomer = await prisma.user.findFirst({
    where: { email: "customer@martly.dev" },
  });

  const phoneCustomer = await prisma.user.findFirst({
    where: { phone: "9876543210" },
  });

  if (!emailCustomer && !phoneCustomer) {
    console.log("No customer users found — skipping notification seed");
    return;
  }

  const customerIds = [emailCustomer?.id, phoneCustomer?.id].filter(Boolean) as string[];

  // Find a recent order for realistic data
  const order = await prisma.order.findFirst({
    where: { userId: { in: customerIds } },
    orderBy: { createdAt: "desc" },
  });

  const orderId = order?.id ?? "00000000-0000-0000-0000-000000000000";
  const orderShort = orderId.slice(0, 8);

  // Find a product and category for deep link data
  const product = await prisma.product.findFirst({
    where: { isActive: true },
    select: { id: true, name: true },
  });

  const category = await prisma.category.findFirst({
    where: { parentId: { not: null } },
    select: { id: true, name: true },
  });

  const store = await prisma.store.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true, name: true },
  });

  const now = Date.now();
  const min = 60 * 1000;
  const hr = 60 * min;
  const day = 24 * hr;

  const buildNotifications = (userId: string) => [
    // Order lifecycle
    {
      userId,
      type: "ORDER_CONFIRMED" as const,
      title: "Order Confirmed",
      body: `Your order #${orderShort} has been confirmed and will be prepared shortly.`,
      data: { orderId },
      isRead: false,
      createdAt: new Date(now - 45 * min),
    },
    {
      userId,
      type: "ORDER_PREPARING" as const,
      title: "Order Being Prepared",
      body: `Your order #${orderShort} is being prepared. We'll notify you when it's ready.`,
      data: { orderId },
      isRead: false,
      createdAt: new Date(now - 30 * min),
    },
    {
      userId,
      type: "ORDER_DELIVERED" as const,
      title: "Order Delivered",
      body: `Your order #${orderShort} has been delivered. Enjoy your groceries!`,
      data: { orderId },
      isRead: true,
      createdAt: new Date(now - 2 * day),
    },
    {
      userId,
      type: "ORDER_CANCELLED" as const,
      title: "Order Cancelled",
      body: `Your order #${orderShort} has been cancelled. Refund will be credited to your wallet.`,
      data: { orderId },
      isRead: true,
      createdAt: new Date(now - 5 * day),
    },

    // Review request
    {
      userId,
      type: "REVIEW_REQUEST" as const,
      title: "How was your order?",
      body: `Rate your order #${orderShort} and help others shop better.`,
      data: { orderId, screen: "write-review" },
      isRead: true,
      createdAt: new Date(now - 2 * day + 5 * min),
    },

    // Wallet
    {
      userId,
      type: "WALLET_CREDITED" as const,
      title: "Wallet Credited",
      body: `\u20B9150 has been added to your wallet. Refund for order #${orderShort}`,
      data: { screen: "wallet" },
      isRead: false,
      createdAt: new Date(now - 6 * hr),
    },
    {
      userId,
      type: "WALLET_DEBITED" as const,
      title: "Wallet Used",
      body: `\u20B975 was deducted from your wallet for order #${orderShort}`,
      data: { screen: "wallet" },
      isRead: true,
      createdAt: new Date(now - 3 * day),
    },

    // Loyalty
    {
      userId,
      type: "LOYALTY_POINTS_EARNED" as const,
      title: "Points Earned!",
      body: "You earned 15 loyalty points. Keep shopping to earn more!",
      data: { screen: "loyalty" },
      isRead: true,
      createdAt: new Date(now - 2 * day + 3 * min),
    },
    {
      userId,
      type: "LOYALTY_POINTS_REDEEMED" as const,
      title: "Points Redeemed",
      body: "You redeemed 50 loyalty points. \u20B950 discount applied to your order.",
      data: { screen: "loyalty" },
      isRead: true,
      createdAt: new Date(now - 4 * day),
    },

    // General / informational
    {
      userId,
      type: "GENERAL" as const,
      title: "Store Hours Updated",
      body: "**Bigmart** now delivers until **11 PM**!\n\nOrder your late-night essentials anytime. Updated timings:\n\n- **Mon–Fri:** 7 AM – 11 PM\n- **Sat–Sun:** 8 AM – 11 PM\n\n> Express delivery available until 10 PM",
      isRead: false,
      createdAt: new Date(now - 4 * hr),
    },
    {
      userId,
      type: "GENERAL" as const,
      title: "New Payment Option",
      body: "You can now pay using **UPI** at checkout.\n\nSupported apps:\n- Google Pay\n- PhonePe\n- Paytm\n\nFaster, easier payments with *zero extra charges*!",
      isRead: true,
      createdAt: new Date(now - 10 * day),
    },

    // Promotional — product deep link
    ...(product
      ? [{
          userId,
          type: "PROMOTIONAL" as const,
          title: "Fresh Arrivals!",
          body: `Check out ${product.name} — now available at your nearest store!`,
          imageUrl: "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400&h=200&fit=crop",
          data: { productId: product.id },
          isRead: false,
          createdAt: new Date(now - 2 * hr),
        }]
      : []),

    // Promotional — category deep link
    ...(category
      ? [{
          userId,
          type: "PROMOTIONAL" as const,
          title: `${category.name} Sale!`,
          body: `Flat 20% off on all ${category.name}. Limited time offer!`,
          imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=200&fit=crop",
          data: { categoryId: category.id },
          isRead: false,
          createdAt: new Date(now - 3 * hr),
        }]
      : []),

    // Promotional — no deep link (goes to home)
    {
      userId,
      type: "PROMOTIONAL" as const,
      title: "Weekend Special - 20% Off!",
      body: "Shop groceries this weekend and get **flat 20% off** on all fresh produce.\n\n### What's on offer:\n- Fresh fruits & vegetables\n- Dairy & bread\n- Snacks & beverages\n\n*Valid Saturday & Sunday only. Max discount \u20B9200.*",
      imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=200&fit=crop",
      isRead: false,
      createdAt: new Date(now - 1 * day),
    },

    // Promotional — store deep link
    ...(store
      ? [{
          userId,
          type: "PROMOTIONAL" as const,
          title: `${store.name} Grand Sale`,
          body: `Visit ${store.name} for exclusive deals on daily essentials!`,
          data: { storeId: store.id },
          isRead: true,
          createdAt: new Date(now - 7 * day),
        }]
      : []),

    // Welcome
    {
      userId,
      type: "WELCOME" as const,
      title: "Welcome to Martly!",
      body: "Start exploring fresh groceries and daily essentials near you.",
      data: { screen: "home" },
      isRead: true,
      createdAt: new Date(now - 30 * day),
    },
  ];

  // Seed for each customer
  for (const userId of customerIds) {
    await prisma.notification.deleteMany({ where: { userId } });

    const notifications = buildNotifications(userId);
    for (const n of notifications) {
      await prisma.notification.create({ data: n });
    }

    const user = userId === emailCustomer?.id ? "customer@martly.dev" : "9876543210";
    console.log(`Seeded ${notifications.length} notifications for ${user}`);
    console.log(`  - ${notifications.filter((n) => !n.isRead).length} unread`);
    console.log(`  - ${notifications.filter((n) => n.isRead).length} read`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
