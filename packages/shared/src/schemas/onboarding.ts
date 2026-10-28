import { z } from "zod";
import { StoreSize } from "../constants/onboarding.js";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const mobile = z.string().regex(/^\d{10}$/, "Enter the 10-digit mobile number");
/** With an email, signs in to the admin panel; without one, the login is OTP on the phone only */
const password = z.string().min(8, "At least 8 characters");

export const onboardingOwnerSchema = z.object({
  name: z.string().trim().min(2),
  phone: mobile,
  email: z.string().trim().toLowerCase().email().optional(),
  password: password.optional(),
});
export type OnboardingOwnerInput = z.infer<typeof onboardingOwnerSchema>;

export const onboardingStoreSchema = z.object({
  name: z.string().trim().min(2),
  address: z.string().trim().min(5),
  townId: z.string().uuid(),
  phone: mobile.optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  deliveryRadius: z.number().positive().max(30),
  minOrderAmount: z.number().min(0),
  freeDeliveryThreshold: z.number().min(0).nullable(),
  baseDeliveryFee: z.number().min(0),
  logoUrl: z.string().url().nullish(),
  expressEtaMinutes: z.number().int().min(5).max(240),
  opensAt: time,
  closesAt: time,
});
export type OnboardingStoreInput = z.infer<typeof onboardingStoreSchema>;

export const createOnboardingSchema = z.object({
  organizationName: z.string().trim().min(2),
  owner: onboardingOwnerSchema,
  /** The owner's phone already belongs to a shopper account, and Martly agreed to turn it into the owner's login */
  upgradeShopper: z.boolean().default(false),
  store: onboardingStoreSchema,
});
export type CreateOnboardingInput = z.infer<typeof createOnboardingSchema>;

export const updateOnboardingSchema = z.object({
  organizationName: z.string().trim().min(2).optional(),
  owner: onboardingOwnerSchema.pick({ name: true, email: true, password: true }).partial().optional(),
  store: onboardingStoreSchema.partial().optional(),
  size: z.nativeEnum(StoreSize).optional(),
});
export type UpdateOnboardingInput = z.infer<typeof updateOnboardingSchema>;

export const ONBOARDING_STAFF_ROLES = ["STORE_MANAGER", "STAFF", "RIDER"] as const;

/** A store employee added during onboarding; signs in to the Martly app by OTP like the owner */
export const onboardingStaffSchema = onboardingOwnerSchema.extend({
  role: z.enum(ONBOARDING_STAFF_ROLES),
  /** The phone already belongs to a shopper account, and Martly agreed to turn it into this staff login */
  upgradeShopper: z.boolean().default(false),
});
export type OnboardingStaffInput = z.infer<typeof onboardingStaffSchema>;

/** Adjustments to the catalog the store's region and size propose */
export const catalogRulesSchema = z.object({
  excludedSubcategoryIds: z.array(z.string().uuid()).default([]),
  /** Aisles outside the size's tiers to carry anyway */
  includedSubcategoryIds: z.array(z.string().uuid()).default([]),
  excludedBrandIds: z.array(z.string().uuid()).default([]),
  /** Brands to carry even when their region doesn't match */
  includedBrandIds: z.array(z.string().uuid()).default([]),
  brandsPerAisle: z.number().int().min(1).max(30).optional(),
  productsPerAisle: z.number().int().min(1).max(200).optional(),
  likelyPerAisle: z.number().int().min(0).max(200).optional(),
});
export type CatalogRules = z.infer<typeof catalogRulesSchema>;

export const catalogProposalSchema = catalogRulesSchema.extend({
  /** Return this aisle's proposed products too */
  subcategoryId: z.string().uuid().optional(),
});
export type CatalogProposalInput = z.infer<typeof catalogProposalSchema>;

export const applyCatalogSchema = catalogRulesSchema.extend({
  /** Selling price is MRP less this percentage */
  discountPct: z.number().min(0).max(50).default(0),
  openingStock: z.number().int().min(0).max(10000),
});
export type ApplyCatalogInput = z.infer<typeof applyCatalogSchema>;

export const STOREFRONT_PARTS = ["homeLayout", "banners", "memberships", "loyalty", "referrals", "deliverySlots"] as const;
export type StorefrontPart = (typeof STOREFRONT_PARTS)[number];

export const copyStorefrontSchema = z.object({
  templateOrganizationId: z.string().uuid(),
  /** Collections always come with the Home layout; each part can be left out */
  parts: z.array(z.enum(STOREFRONT_PARTS)).min(1),
});
export type CopyStorefrontInput = z.infer<typeof copyStorefrontSchema>;
