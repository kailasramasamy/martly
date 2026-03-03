import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  // 1. Find Innovative Foods org
  const org = await prisma.organization.findFirst({ where: { slug: "innovative-foods" } });
  if (!org) {
    console.error("Organization 'innovative-foods' not found. Run db:seed first.");
    process.exit(1);
  }

  // Enable subscriptions on the org
  await prisma.organization.update({
    where: { id: org.id },
    data: { subscriptionEnabled: true },
  });
  console.log(`Enabled subscriptions on org: ${org.name}`);

  // 2. Find and configure Bigmart store
  const store = await prisma.store.findFirst({
    where: { organizationId: org.id, name: { contains: "Bigmart", mode: "insensitive" } },
  });
  if (!store) {
    console.error("Bigmart store not found under Innovative Foods.");
    process.exit(1);
  }

  await prisma.store.update({
    where: { id: store.id },
    data: {
      subscriptionEnabled: true,
      subscriptionDeliveryMode: "DEDICATED",
      subscriptionWindowStart: "06:00",
      subscriptionWindowEnd: "08:00",
      subscriptionCutoffTime: "22:00",
    },
  });
  console.log(`Configured subscription settings on store: ${store.name}`);

  // 3. Find the customer user
  const customer = await prisma.user.findUnique({ where: { email: "customer@martly.dev" } });
  if (!customer) {
    console.error("Customer user (customer@martly.dev) not found. Run seed-test-users first.");
    process.exit(1);
  }
  console.log(`Found customer: ${customer.name} (${customer.email})`);

  // 4. Find store products from Bigmart with stock > 0
  const storeProducts = await prisma.storeProduct.findMany({
    where: { storeId: store.id, isActive: true, stock: { gt: 0 } },
    include: { product: true, variant: true },
    take: 6,
    orderBy: { createdAt: "asc" },
  });

  if (storeProducts.length < 5) {
    console.error(`Need at least 5 store products with stock, found ${storeProducts.length}. Seed products first.`);
    process.exit(1);
  }
  console.log(`Found ${storeProducts.length} store products for subscriptions`);

  // 5. Get or create a customer address
  let address = await prisma.userAddress.findFirst({
    where: { userId: customer.id, isDefault: true },
  });
  if (!address) {
    address = await prisma.userAddress.findFirst({ where: { userId: customer.id } });
  }

  const deliveryAddress = address?.address ?? "123 Main Street, Andheri West, Mumbai 400058";
  const deliveryLat = address?.latitude ?? 19.1364;
  const deliveryLng = address?.longitude ?? 72.8296;
  const deliveryPincode = address?.pincode ?? "400058";
  const addressId = address?.id ?? null;

  // Date helpers
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const dayAfterTomorrow = new Date();
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
  dayAfterTomorrow.setHours(0, 0, 0, 0);

  // Find next valid day for Mon/Wed/Fri (1, 3, 5)
  const selectedDays = [1, 3, 5];
  const nextValidDay = new Date(tomorrow);
  while (!selectedDays.includes(nextValidDay.getDay())) {
    nextValidDay.setDate(nextValidDay.getDate() + 1);
  }

  // Clean up existing subscriptions for this customer+store to make script idempotent
  const existingSubs = await prisma.subscription.findMany({
    where: { userId: customer.id, storeId: store.id },
    select: { id: true },
  });
  if (existingSubs.length > 0) {
    const subIds = existingSubs.map((s) => s.id);
    // Clean up subscription orders (not cascade-deleted)
    await prisma.orderStatusLog.deleteMany({ where: { order: { subscriptionId: { in: subIds } } } });
    await prisma.orderItem.deleteMany({ where: { order: { subscriptionId: { in: subIds } } } });
    await prisma.order.deleteMany({ where: { subscriptionId: { in: subIds } } });
    // Clean up basket add-ons
    await prisma.basketAddOn.deleteMany({
      where: { userId: customer.id, storeId: store.id },
    });
    await prisma.subscription.deleteMany({
      where: { id: { in: subIds } },
    });
    console.log(`Cleaned up ${existingSubs.length} existing subscription(s) + related orders`);
  }

  // 5a. Subscription 1: Daily — first 3 products
  const dailyProducts = storeProducts.slice(0, 3);
  const sub1 = await prisma.subscription.create({
    data: {
      userId: customer.id,
      storeId: store.id,
      organizationId: org.id,
      status: "ACTIVE",
      frequency: "DAILY",
      selectedDays: [],
      deliveryAddress,
      deliveryLat,
      deliveryLng,
      deliveryPincode,
      addressId,
      nextDeliveryDate: tomorrow,
      cutoffTime: "22:00",
      autoPayWithWallet: true,
      items: {
        create: dailyProducts.map((sp) => ({
          storeProductId: sp.id,
          quantity: sp.product.name.toLowerCase().includes("milk") ? 2 : 1,
        })),
      },
    },
    include: { items: { include: { storeProduct: { include: { product: true, variant: true } } } } },
  });
  console.log(`Created Daily subscription: ${sub1.id}`);
  for (const item of sub1.items) {
    console.log(`  - ${item.storeProduct.product.name} x${item.quantity}`);
  }

  // 5b. Subscription 2: Specific Days (Mon/Wed/Fri) — next 2-3 products
  const specificDayProducts = storeProducts.slice(3, 6);
  const sub2 = await prisma.subscription.create({
    data: {
      userId: customer.id,
      storeId: store.id,
      organizationId: org.id,
      status: "ACTIVE",
      frequency: "SPECIFIC_DAYS",
      selectedDays,
      deliveryAddress,
      deliveryLat,
      deliveryLng,
      deliveryPincode,
      addressId,
      nextDeliveryDate: nextValidDay,
      cutoffTime: "22:00",
      autoPayWithWallet: true,
      items: {
        create: specificDayProducts.map((sp) => ({
          storeProductId: sp.id,
          quantity: 1,
        })),
      },
    },
    include: { items: { include: { storeProduct: { include: { product: true, variant: true } } } } },
  });
  console.log(`Created Specific Days (Mon/Wed/Fri) subscription: ${sub2.id}`);
  for (const item of sub2.items) {
    console.log(`  - ${item.storeProduct.product.name} x${item.quantity}`);
  }

  // 5c. Subscription 3: Weekly (every Saturday) — first 2 products
  const weeklyProducts = storeProducts.slice(0, 2);
  const nextSaturday = new Date(tomorrow);
  while (nextSaturday.getDay() !== 6) {
    nextSaturday.setDate(nextSaturday.getDate() + 1);
  }
  const sub3 = await prisma.subscription.create({
    data: {
      userId: customer.id,
      storeId: store.id,
      organizationId: org.id,
      status: "ACTIVE",
      frequency: "WEEKLY",
      selectedDays: [6], // Saturday
      deliveryAddress,
      deliveryLat,
      deliveryLng,
      deliveryPincode,
      addressId,
      nextDeliveryDate: nextSaturday,
      cutoffTime: "22:00",
      autoPayWithWallet: true,
      items: {
        create: weeklyProducts.map((sp) => ({
          storeProductId: sp.id,
          quantity: 1,
        })),
      },
    },
    include: { items: { include: { storeProduct: { include: { product: true, variant: true } } } } },
  });
  console.log(`Created Weekly (Saturday) subscription: ${sub3.id}`);
  for (const item of sub3.items) {
    console.log(`  - ${item.storeProduct.product.name} x${item.quantity}`);
  }

  // 5d. Subscription 4: Monthly (15th of each month) — products 2-4
  const monthlyProducts = storeProducts.slice(1, 4);
  const next15th = new Date(tomorrow);
  if (next15th.getDate() > 15) {
    next15th.setMonth(next15th.getMonth() + 1);
  }
  next15th.setDate(15);
  const sub4 = await prisma.subscription.create({
    data: {
      userId: customer.id,
      storeId: store.id,
      organizationId: org.id,
      status: "ACTIVE",
      frequency: "MONTHLY",
      selectedDays: [15], // 15th of each month
      deliveryAddress,
      deliveryLat,
      deliveryLng,
      deliveryPincode,
      addressId,
      nextDeliveryDate: next15th,
      cutoffTime: "22:00",
      autoPayWithWallet: true,
      items: {
        create: monthlyProducts.map((sp) => ({
          storeProductId: sp.id,
          quantity: 1,
        })),
      },
    },
    include: { items: { include: { storeProduct: { include: { product: true, variant: true } } } } },
  });
  console.log(`Created Monthly (15th) subscription: ${sub4.id}`);
  for (const item of sub4.items) {
    console.log(`  - ${item.storeProduct.product.name} x${item.quantity}`);
  }

  // 6. Add a BasketAddOn — extra item for tomorrow
  // Use a product not in either subscription if possible, else reuse one
  const addOnProduct = storeProducts.length >= 6 ? storeProducts[5] : storeProducts[0];
  const addOn = await prisma.basketAddOn.create({
    data: {
      userId: customer.id,
      storeId: store.id,
      storeProductId: addOnProduct.id,
      quantity: 2,
      deliveryDate: tomorrow,
    },
  });
  console.log(`Created BasketAddOn for tomorrow: ${addOnProduct.product.name} x2 (${addOn.id})`);

  // 7. Add SubscriptionSkips — multiple skips on sub1 and sub2
  const skipDates = [
    { sub: sub1, daysFromNow: 2, reason: "Out of town" },
    { sub: sub1, daysFromNow: 5, reason: "Festival holiday" },
    { sub: sub1, daysFromNow: 8, reason: null },
    { sub: sub2, daysFromNow: 4, reason: "Not needed this week" },
  ];
  for (const { sub, daysFromNow, reason } of skipDates) {
    const skipDate = new Date();
    skipDate.setDate(skipDate.getDate() + daysFromNow);
    skipDate.setHours(0, 0, 0, 0);
    await prisma.subscriptionSkip.create({
      data: { subscriptionId: sub.id, date: skipDate, reason },
    });
    console.log(`Created skip for ${sub.frequency} sub on ${skipDate.toISOString().split("T")[0]}: "${reason ?? "no reason"}"`);
  }

  // 8. Create past subscription orders for sub1 (daily) — last 7 days
  const orderStatuses: Array<"DELIVERED" | "CANCELLED"> = ["DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED", "CANCELLED", "DELIVERED"];
  for (let i = 1; i <= 7; i++) {
    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - i);
    orderDate.setHours(7, 0, 0, 0);

    const status = orderStatuses[i - 1];
    const itemTotal = sub1.items.reduce((sum, item) => sum + item.quantity * Number(item.storeProduct.price), 0);
    const deliveryFee = 20;
    const total = itemTotal + deliveryFee;

    const order = await prisma.order.create({
      data: {
        userId: customer.id,
        storeId: store.id,
        status,
        paymentStatus: status === "CANCELLED" ? "FAILED" : "PAID",
        paymentMethod: "ONLINE",
        fulfillmentType: "DELIVERY",
        totalAmount: total,
        deliveryAddress,
        deliveryLat,
        deliveryLng,
        deliveryFee,
        deliveryPincode,
        subscriptionId: sub1.id,
        isSubscriptionOrder: true,
        createdAt: orderDate,
        items: {
          create: sub1.items.map((item) => ({
            productId: item.storeProduct.product.id,
            variantId: item.storeProduct.variant!.id,
            storeProductId: item.storeProductId,
            quantity: item.quantity,
            unitPrice: item.storeProduct.price,
            totalPrice: Number(item.storeProduct.price) * item.quantity,
          })),
        },
      },
    });
    console.log(`Created ${status} order for daily sub: ${order.id.slice(0, 8)} (${orderDate.toISOString().split("T")[0]})`);
  }

  // Create 3 past orders for sub2 (specific days)
  for (let i = 0; i < 3; i++) {
    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - (7 + i * 2));
    orderDate.setHours(7, 0, 0, 0);

    const itemTotal = sub2.items.reduce((sum, item) => sum + item.quantity * Number(item.storeProduct.price), 0);
    const total = itemTotal + 20;

    const order = await prisma.order.create({
      data: {
        userId: customer.id,
        storeId: store.id,
        status: "DELIVERED",
        paymentStatus: "PAID",
        paymentMethod: "ONLINE",
        fulfillmentType: "DELIVERY",
        totalAmount: total,
        deliveryAddress,
        deliveryLat,
        deliveryLng,
        deliveryFee: 20,
        deliveryPincode,
        subscriptionId: sub2.id,
        isSubscriptionOrder: true,
        createdAt: orderDate,
        items: {
          create: sub2.items.map((item) => ({
            productId: item.storeProduct.product.id,
            variantId: item.storeProduct.variant!.id,
            storeProductId: item.storeProductId,
            quantity: item.quantity,
            unitPrice: item.storeProduct.price,
            totalPrice: Number(item.storeProduct.price) * item.quantity,
          })),
        },
      },
    });
    console.log(`Created DELIVERED order for specific-days sub: ${order.id.slice(0, 8)}`);
  }

  // 9a. Seed orders + skips for phone user 5555555555 (Varaha)
  const phoneUser = await prisma.user.findFirst({ where: { phone: "5555555555" } });
  if (phoneUser) {
    const phoneSubs = await prisma.subscription.findMany({
      where: { userId: phoneUser.id, storeId: store.id },
      include: { items: { include: { storeProduct: { include: { product: true, variant: true } } } } },
    });

    for (const sub of phoneSubs) {
      // Clean up existing subscription orders
      await prisma.orderItem.deleteMany({ where: { order: { subscriptionId: sub.id } } });
      await prisma.order.deleteMany({ where: { subscriptionId: sub.id } });
      await prisma.subscriptionSkip.deleteMany({ where: { subscriptionId: sub.id } });

      // Create past orders
      const numOrders = sub.frequency === "DAILY" ? 5 : sub.frequency === "MONTHLY" ? 2 : 3;
      for (let i = 1; i <= numOrders; i++) {
        const orderDate = new Date();
        orderDate.setDate(orderDate.getDate() - (i * (sub.frequency === "MONTHLY" ? 30 : sub.frequency === "WEEKLY" ? 7 : 1)));
        orderDate.setHours(7, 0, 0, 0);

        const isCancelled = i === numOrders; // last one cancelled
        const itemTotal = sub.items.reduce((s, it) => s + it.quantity * Number(it.storeProduct.price), 0);
        await prisma.order.create({
          data: {
            userId: phoneUser.id,
            storeId: store.id,
            status: isCancelled ? "CANCELLED" : "DELIVERED",
            paymentStatus: isCancelled ? "FAILED" : "PAID",
            paymentMethod: "ONLINE",
            fulfillmentType: "DELIVERY",
            totalAmount: itemTotal + 20,
            deliveryAddress: sub.deliveryAddress,
            deliveryLat: sub.deliveryLat,
            deliveryLng: sub.deliveryLng,
            deliveryFee: 20,
            deliveryPincode: sub.deliveryPincode,
            subscriptionId: sub.id,
            isSubscriptionOrder: true,
            createdAt: orderDate,
            items: {
              create: sub.items.map((item) => ({
                productId: item.storeProduct.product.id,
                variantId: item.storeProduct.variant!.id,
                storeProductId: item.storeProductId,
                quantity: item.quantity,
                unitPrice: item.storeProduct.price,
                totalPrice: Number(item.storeProduct.price) * item.quantity,
              })),
            },
          },
        });
      }
      console.log(`Created ${numOrders} orders for ${phoneUser.name}'s ${sub.frequency} subscription`);

      // Add skips
      if (sub.status === "ACTIVE") {
        for (let d = 3; d <= 6; d += 3) {
          const skipDate = new Date();
          skipDate.setDate(skipDate.getDate() + d);
          skipDate.setHours(0, 0, 0, 0);
          await prisma.subscriptionSkip.create({
            data: { subscriptionId: sub.id, date: skipDate, reason: d === 3 ? "Traveling" : "Don't need" },
          });
        }
        console.log(`Created 2 skips for ${phoneUser.name}'s ${sub.frequency} subscription`);
      }
    }
  } else {
    console.log("Phone user 5555555555 not found, skipping");
  }

  // 10. Ensure customer wallet has at least ₹500 (for Test Customer)
  const currentBalance = Number(customer.walletBalance);
  if (currentBalance < 500) {
    const topUp = 500 - currentBalance;
    await prisma.user.update({
      where: { id: customer.id },
      data: { walletBalance: 500 },
    });
    await prisma.walletTransaction.create({
      data: {
        userId: customer.id,
        type: "CREDIT",
        amount: topUp,
        description: "Subscription seed: wallet top-up",
        balanceAfter: 500,
      },
    });
    console.log(`Topped up wallet by \u20B9${topUp} → balance: \u20B9500`);
  } else {
    console.log(`Wallet balance already sufficient: \u20B9${currentBalance}`);
  }

  console.log("\nSubscription seed data created successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
