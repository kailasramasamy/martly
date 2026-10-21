import { z } from "zod";
import { AdProductKind, BannerActionType, BannerPlacement, DISCOUNTABLE_TARGETS, DiscountType, INDIAN_STATES } from "../constants/index.js";

const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const money = z.coerce.number().min(0).max(10_000_000);

// ── Pricing (platform admin) ─────────────────────────
export const adProductSchema = z.object({
  id: z.string().uuid().optional(),
  kind: z.nativeEnum(AdProductKind),
  code: z.string().trim().min(2).max(40).regex(/^[A-Z0-9_]+$/, "Use capitals, digits and _"),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(240).nullish(),
  price: money,
  /** Store plans: the price for a year paid up front; empty means no annual option */
  yearlyPrice: money.nullish(),
  durationDays: z.coerce.number().int().min(1).max(365),
  bannerSlots: z.coerce.number().int().min(0).max(100).nullable(),
  promotionCredits: z.coerce.number().int().min(0).max(100),
  /** Store plans: AI images a month; left out, a save keeps the current number */
  aiImagesPerMonth: z.coerce.number().int().min(0).max(10_000).optional(),
  /** AI image packs: images per pack */
  aiImageCredits: z.coerce.number().int().min(0).max(10_000).optional(),
  pushIncluded: z.boolean(),
  placement: z.nativeEnum(BannerPlacement).nullish(),
  viewsPerUnit: z.coerce.number().int().min(100).max(1_000_000).nullish(),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(999),
});
export type AdProductInput = z.infer<typeof adProductSchema>;

const slotCap = z.coerce.number().int().min(0).max(20);
export const slotLimitsSchema = z.record(
  z.nativeEnum(BannerPlacement),
  z.object({ STORE: slotCap.optional(), BRAND: slotCap.optional(), PLATFORM: slotCap.optional() }),
);

export const marketingConfigSchema = z.object({
  gstPercent: z.coerce.number().min(0).max(28),
  slotLimits: slotLimitsSchema,
  freeRegenerations: z.coerce.number().int().min(0).max(10),
  sellerName: z.string().trim().min(2).max(120),
  sellerGstin: z.string().trim().toUpperCase().regex(GSTIN, "Enter a valid GSTIN").nullish().or(z.literal("")),
  sellerState: z.enum(INDIAN_STATES),
  sellerAddress: z.string().trim().max(400).nullish(),
  invoicePrefix: z.string().trim().min(1).max(10).regex(/^[A-Z0-9]+$/, "Use capitals and digits"),
});

export const updateAdPricingSchema = z.object({
  products: z.array(adProductSchema).max(50),
  config: marketingConfigSchema,
});
export type UpdateAdPricingInput = z.infer<typeof updateAdPricingSchema>;

// ── Purchases ────────────────────────────────────────
export const createAdOrderSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(12).default(1),
  /** Pay online, or from what Martly owes the organization */
  payWith: z.enum(["ONLINE", "BALANCE"]).default("ONLINE"),
});

export const billingProfileSchema = z.object({
  billingName: z.string().trim().min(2).max(120),
  gstin: z.string().trim().toUpperCase().regex(GSTIN, "Enter a valid GSTIN").nullish().or(z.literal("")),
  billingAddress: z.string().trim().min(5).max(400),
  billingState: z.enum(INDIAN_STATES),
});
export type BillingProfileInput = z.infer<typeof billingProfileSchema>;

export const verifyAdPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

// ── Banner analytics ─────────────────────────────────
export const bannerEventsSchema = z.object({
  storeId: z.string().uuid(),
  events: z.array(z.object({
    bannerId: z.string().uuid(),
    type: z.enum(["VIEW", "TAP"]),
    count: z.coerce.number().int().min(1).max(20),
  })).min(1).max(100),
});

// ── Brand ads ────────────────────────────────────────
export const brandAdSettingsSchema = z.object({
  allowBrandAds: z.boolean(),
  blockedBrandIds: z.array(z.string().uuid()).max(500),
  boostOwnBrands: z.boolean(),
  featuredBrandIds: z.array(z.string().uuid()).max(50),
}).refine((s) => !s.featuredBrandIds.some((id) => s.blockedBrandIds.includes(id)), {
  message: "A brand can't be both featured and blocked",
  path: ["featuredBrandIds"],
});

export const brandCampaignSchema = z.object({
  brandId: z.string().uuid(),
  productId: z.string().uuid(),
  title: z.string().trim().min(2).max(60),
  subtitle: z.string().trim().max(90).nullish(),
  imageUrl: z.string().url().nullish(),
  brief: z.string().trim().max(600).nullish(),
  categoryId: z.string().uuid().nullish(),
  actionType: z.nativeEnum(BannerActionType).default("BRAND"),
  actionTarget: z.string().max(200).nullish(),
  targetStoreIds: z.array(z.string().uuid()).max(500).default([]),
  discountType: z.nativeEnum(DiscountType).nullish(),
  discountValue: z.coerce.number().positive().max(90).nullish(),
  quantity: z.coerce.number().int().min(1).max(52).default(1),
  startsAt: z.coerce.date(),
  // A sponsored product's photo is its creative
}).refine((c) => c.imageUrl || c.brief || c.actionType === "PRODUCT", { message: "Upload an image or describe what the AI should make", path: ["imageUrl"] });
export type BrandCampaignInput = z.infer<typeof brandCampaignSchema>;

export const reviewBrandCampaignSchema = z.object({
  approve: z.boolean(),
  note: z.string().trim().max(400).nullish(),
});

export const offlinePaymentSchema = z.object({
  reference: z.string().trim().min(3).max(120),
});

export const brandPartnerSchema = z.object({
  brandId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  phone: z.string().trim().max(15).nullish(),
});

// ── AI banner art ────────────────────────────────────
export const generateBannerImageSchema = z.object({
  title: z.string().trim().min(2).max(40),
  subtitle: z.string().trim().max(60).nullish(),
  /** What the picture should show; when empty, the banner's tap target (or else its title) decides */
  brief: z.string().trim().max(400).nullish(),
  actionType: z.nativeEnum(BannerActionType).nullish(),
  actionTarget: z.string().trim().max(200).nullish(),
});

// ── Manual promotions ────────────────────────────────
/** A promotion's one banner: replace its image or edit its wording */
export const promoBannerUpdateSchema = z.object({
  imageUrl: z.string().url().optional(),
  textInImage: z.boolean().optional(),
  title: z.string().trim().min(2).max(60).optional(),
  subtitle: z.string().trim().max(90).nullish(),
});

export const createManualPromoSchema = z.object({
  title: z.string().trim().min(2).max(60),
  subtitle: z.string().trim().max(90).nullish(),
  actionType: z.nativeEnum(BannerActionType),
  actionTarget: z.string().trim().max(500).nullish(),
  discountType: z.nativeEnum(DiscountType).nullish(),
  discountValue: z.coerce.number().positive().nullish(),
  durationDays: z.coerce.number().int().min(1).max(90).default(7),
  /** Launch later at this time; otherwise it waits as Ready (or goes live now with launchNow) */
  launchAt: z.coerce.date().nullish(),
  launchNow: z.boolean().default(false),
  notify: z.boolean().default(false),
  organizationId: z.string().uuid().optional(),
  /** The promotion's banner in the home carousel: uploaded, or made with "Generate with AI" */
  imageUrl: z.string().url(),
  textInImage: z.boolean().default(true),
})
  .refine((p) => !p.discountType === !p.discountValue, { message: "Give both a discount type and value, or neither", path: ["discountValue"] })
  .refine((p) => !p.discountType || (DISCOUNTABLE_TARGETS as readonly string[]).includes(p.actionType), {
    message: "A discount needs a category, product, collection or brand target", path: ["actionType"],
  })
  .refine((p) => p.actionType === "NONE" || !!p.actionTarget, { message: "Choose where the promotion leads", path: ["actionTarget"] })
  .refine((p) => p.discountType !== "PERCENTAGE" || (p.discountValue ?? 0) <= 90, { message: "A percentage discount can be at most 90%", path: ["discountValue"] });
export type CreateManualPromoInput = z.infer<typeof createManualPromoSchema>;
