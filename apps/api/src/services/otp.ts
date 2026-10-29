import crypto from "node:crypto";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { authSecret } from "./secrets.js";

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;
const MSG91_OTP_URL = "https://api.msg91.com/api/v5/otp";
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

type Prisma = FastifyInstance["prisma"];

function httpError(statusCode: number, message: string) {
  return Object.assign(new Error(message), { statusCode });
}

function hashCode(phone: string, code: string) {
  return crypto.createHmac("sha256", authSecret()).update(`${phone}:${code}`).digest("hex");
}

/**
 * Phones that sign in with a fixed OTP, never sent by SMS: the App Store review account (OTP_REVIEW_PHONE /
 * OTP_REVIEW_CODE) and team test phones (OTP_FIXED_LOGINS, e.g. "9876543210:123456,9123456780:654321").
 */
function reviewCode(phone: string) {
  const reviewPhone = process.env.OTP_REVIEW_PHONE;
  const code = process.env.OTP_REVIEW_CODE;
  if (reviewPhone && code && phone === reviewPhone) return code;
  const fixed = (process.env.OTP_FIXED_LOGINS ?? "").split(",").map((pair) => pair.trim().split(":"));
  return fixed.find(([p, c]) => p === phone && c)?.[1];
}

async function deliverSms(phone: string, code: string, log: FastifyBaseLogger) {
  const authkey = process.env.MSG91_AUTH_KEY;
  if (!authkey) {
    if (process.env.NODE_ENV === "production") throw httpError(503, "SMS service is not configured");
    log.info(`OTP for ${phone}: ${code} (MSG91_AUTH_KEY not set, SMS skipped)`);
    return;
  }
  const params = new URLSearchParams({
    authkey,
    mobile: `91${phone}`,
    otp: code,
    sender: process.env.MSG91_SENDER_ID ?? "",
    route: process.env.MSG91_ROUTE ?? "4",
    template_id: process.env.MSG91_OTP_TEMPLATE_ID ?? "",
  });
  const res = await fetch(`${MSG91_OTP_URL}?${params}`, { method: "POST" });
  const body = (await res.json().catch(() => ({}))) as { type?: string; message?: string };
  if (!res.ok || body.type !== "success") {
    log.error({ status: res.status, msg91: body.message }, "MSG91 OTP send failed");
    throw httpError(502, "Could not send OTP. Please try again.");
  }
}

export async function issueOtp(prisma: Prisma, phone: string, log: FastifyBaseLogger) {
  const existing = await prisma.otpCode.findUnique({ where: { phone } });
  const waitMs = existing ? existing.updatedAt.getTime() + RESEND_COOLDOWN_MS - Date.now() : 0;
  if (waitMs > 0) throw httpError(429, `Please wait ${Math.ceil(waitMs / 1000)}s before requesting a new OTP`);

  const fixed = reviewCode(phone);
  if (!fixed && !INDIAN_MOBILE.test(phone)) throw httpError(400, "Please enter a valid 10-digit mobile number");
  const code = fixed ?? crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  if (!fixed) await deliverSms(phone, code, log);

  const data = { codeHash: hashCode(phone, code), attempts: 0, expiresAt: new Date(Date.now() + OTP_TTL_MS) };
  await prisma.otpCode.upsert({ where: { phone }, create: { phone, ...data }, update: data });
}

/**
 * Returns true when the code matches; a used, expired or exhausted code is deleted. Each guess claims an attempt with a
 * conditional increment before the code is compared, so parallel guesses can't share one stale attempt count.
 */
export async function verifyOtp(prisma: Prisma, phone: string, code: string) {
  const record = await prisma.otpCode.findUnique({ where: { phone } });
  if (!record || record.expiresAt < new Date()) {
    if (record) await prisma.otpCode.deleteMany({ where: { id: record.id } });
    throw httpError(401, "OTP expired or already used. Please request a new one.");
  }
  const thisCode = { id: record.id, codeHash: record.codeHash };
  const claimed = await prisma.otpCode.updateMany({
    where: { ...thisCode, attempts: { lt: MAX_ATTEMPTS }, expiresAt: { gt: new Date() } },
    data: { attempts: { increment: 1 } },
  });
  if (claimed.count === 0) throw httpError(401, "This OTP can no longer be used. Please request a new one.");

  const expected = Buffer.from(record.codeHash, "hex");
  const actual = Buffer.from(hashCode(phone, code), "hex");
  if (crypto.timingSafeEqual(expected, actual)) {
    // Only the request that deletes the code signs in with it
    const used = await prisma.otpCode.deleteMany({ where: thisCode });
    return used.count === 1;
  }
  const exhausted = await prisma.otpCode.deleteMany({ where: { ...thisCode, attempts: { gte: MAX_ATTEMPTS } } });
  if (exhausted.count > 0) throw httpError(401, "Too many incorrect attempts. Please request a new OTP.");
  return false;
}
