import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const STORE_ID = "375d5737-069b-42f0-9791-1cc8390c0993"; // Bigmart

const SLOT_TEMPLATES = [
  { startTime: "09:00", endTime: "11:00", maxOrders: 20, cutoffMinutes: 60 },
  { startTime: "11:00", endTime: "13:00", maxOrders: 25, cutoffMinutes: 60 },
  { startTime: "14:00", endTime: "16:00", maxOrders: 20, cutoffMinutes: 60 },
  { startTime: "16:00", endTime: "18:00", maxOrders: 25, cutoffMinutes: 60 },
  { startTime: "18:00", endTime: "20:00", maxOrders: 30, cutoffMinutes: 90 },
  { startTime: "20:00", endTime: "22:00", maxOrders: 15, cutoffMinutes: 60 },
];

// Mon-Sat (1-6) get all slots; Sunday (0) gets fewer
const WEEKDAY_SLOTS = [0, 1, 2, 3, 4, 5]; // All 6 templates
const SUNDAY_SLOTS = [0, 1, 2, 3]; // First 4 templates (9am-6pm only)

async function main() {
  // Delete existing slots for this store
  const deleted = await prisma.deliverySlot.deleteMany({ where: { storeId: STORE_ID } });
  console.log(`Deleted ${deleted.count} existing slots`);

  const slotsToCreate = [];

  // Monday through Saturday
  for (let day = 1; day <= 6; day++) {
    for (const idx of WEEKDAY_SLOTS) {
      slotsToCreate.push({
        storeId: STORE_ID,
        dayOfWeek: day,
        ...SLOT_TEMPLATES[idx],
        isActive: true,
      });
    }
  }

  // Sunday
  for (const idx of SUNDAY_SLOTS) {
    slotsToCreate.push({
      storeId: STORE_ID,
      dayOfWeek: 0,
      ...SLOT_TEMPLATES[idx],
      isActive: true,
    });
  }

  const result = await prisma.deliverySlot.createMany({ data: slotsToCreate });
  console.log(`Created ${result.count} delivery slots for Bigmart`);

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const slots = await prisma.deliverySlot.findMany({
    where: { storeId: STORE_ID },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  console.log("\nSlots created:");
  for (const slot of slots) {
    console.log(`  ${DAY_NAMES[slot.dayOfWeek]} ${slot.startTime}-${slot.endTime} (max: ${slot.maxOrders}, cutoff: ${slot.cutoffMinutes}min)`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
