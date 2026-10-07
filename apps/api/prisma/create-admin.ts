/**
 * Create a SUPER_ADMIN account with a generated password (printed once).
 * Refuses to modify an existing account, so it can't silently reset a live password.
 * Run: cd apps/api && ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name" npx tsx prisma/create-admin.ts
 */

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.ADMIN_NAME?.trim() || "Martly Admin";
  if (!email) throw new Error("Set ADMIN_EMAIL");

  if (await prisma.user.findUnique({ where: { email } })) {
    throw new Error(`An account for ${email} already exists — not modifying it`);
  }

  const password = randomBytes(12).toString("base64url");
  await prisma.user.create({
    data: { email, name, role: "SUPER_ADMIN", passwordHash: await bcrypt.hash(password, 10) },
  });
  console.log(`✔ SUPER_ADMIN created\n  email:    ${email}\n  password: ${password}\n  (shown once — store it in your password manager)`);
}

main()
  .catch((err) => {
    console.error(err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
