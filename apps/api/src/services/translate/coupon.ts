import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import type { ErrorLog } from "./product.js";

const MODEL = "claude-haiku-5-5";

const INSTRUCTIONS = `You translate grocery store coupon headlines and descriptions into Tamil for a shopping app used in Dharmapuri, Tamil Nadu.
- Write short, natural everyday Tamil, the way a local shop would advertise it, not a literal translation.
- Keep amounts, percentages and the ₹ sign exactly as written (₹30, 20%).
- Headline: as short as the English, fit for a coupon ticket. Description: same meaning and length as the English.`;

const TranslationSchema = z.object({
  title: z.string().describe("The headline in Tamil"),
  description: z.string().nullable().describe("The description in Tamil, or null when there is no English description"),
});

type TaFields = { title?: string; description?: string };

async function translate(prisma: PrismaClient, couponId: string) {
  const coupon = await prisma.coupon.findUnique({ where: { id: couponId }, select: { title: true, description: true, translations: true } });
  if (!coupon?.title) return;
  const all = (coupon.translations ?? {}) as Record<string, TaFields>;
  const ta = all.ta ?? {};
  // The owner's own Tamil stays; only blank fields are filled
  const needTitle = !ta.title?.trim();
  const needDescription = !!coupon.description?.trim() && !ta.description?.trim();
  if (!needTitle && !needDescription) return;

  const response = await new Anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    system: INSTRUCTIONS,
    output_config: { effort: "low", format: betaZodOutputFormat(TranslationSchema) },
    messages: [{ role: "user", content: `Headline: ${coupon.title}\nDescription: ${coupon.description?.trim() || "(none)"}` }],
  });
  const out = response.parsed_output;
  if (response.stop_reason === "refusal" || !out) return;

  const next: TaFields = {
    ...ta,
    ...(needTitle ? { title: out.title } : {}),
    ...(needDescription && out.description ? { description: out.description } : {}),
  };
  await prisma.coupon.update({ where: { id: couponId }, data: { translations: { ...all, ta: next } as Prisma.InputJsonValue } });
}

/**
 * Fills a coupon's blank Tamil headline and description (one without a headline has its Tamil made from the discount
 * when shown). Never rejects: a failed call leaves the coupon in English and is logged.
 */
export async function translateCoupon(prisma: PrismaClient, couponId: string, log: ErrorLog) {
  if (!process.env.ANTHROPIC_API_KEY) return;
  await translate(prisma, couponId).catch((err: unknown) => log.error(err, `Tamil translation failed for coupon ${couponId}`));
}
