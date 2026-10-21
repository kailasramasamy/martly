import dotenv from "dotenv";
import { PrismaClient } from "../generated/prisma/index.js";

dotenv.config({ override: true });

const prisma = new PrismaClient();

const ITEMS = ["2 kg ponni rice", "அரை கிலோ துவரம் பருப்பு", "1 litre sunflower oil", "சர்க்கரை 1 கிலோ", "10 rupees curry leaves"];

async function main() {
  const phone = process.env.OTP_REVIEW_PHONE;
  if (!phone) throw new Error("OTP_REVIEW_PHONE is not set");
  const user = await prisma.user.findFirst({ where: { phone } });
  if (!user) throw new Error(`No user with phone ${phone}`);

  const open = await prisma.shoppingListItem.count({ where: { userId: user.id, doneAt: null } });
  if (open > 0) {
    console.log(`${phone} already has ${open} open list items — nothing to do`);
    return;
  }
  await prisma.shoppingListItem.createMany({ data: ITEMS.map((text) => ({ userId: user.id, text })) });
  console.log(`Created ${ITEMS.length} list items for ${phone}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
