import type { PrismaClient } from "../../generated/prisma/index.js";

// Exclude confusable characters: 0/O, 1/I/L
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateReferralCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return `MRT-${code}`;
}

export async function ensureReferralCode(prisma: PrismaClient, userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });

  if (user?.referralCode) return user.referralCode;

  // Retry loop for collision handling
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
      });
      return updated.referralCode!;
    } catch (err: any) {
      // Unique constraint violation — retry with new code
      if (err?.code === "P2002") continue;
      throw err;
    }
  }

  throw new Error("Failed to generate unique referral code after 5 attempts");
}
