import { z } from "zod";
import { BULK_STATUSES } from "../order-flow/index.js";
import { CodCollectionMode, DeliveryFailureReason, UserRole, StoreStatus, OrderStatus, PaymentStatus, UnitType, FoodType, ProductType, StorageType, DiscountType, ReviewStatus, BannerPlacement, EDITABLE_COLLECTION_KINDS, BannerActionType, FESTIVAL_REGIONS, MembershipDuration, SubscriptionFrequency, SubscriptionDeliveryMode, Difficulty, SearchSortBy, SearchEventType, SUPPORTED_LANGUAGES, CatalogDraftStatus, Permission, StockCountStatus } from "../constants/index.js";

// ── Translations ─────────────────────────────────────
const languageCodes = Object.keys(SUPPORTED_LANGUAGES) as [string, ...string[]];
export const translationFieldsSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});
export const translationsSchema = z.record(
  z.enum(languageCodes),
  translationFieldsSchema,
).optional();
export type TranslationFields = z.infer<typeof translationFieldsSchema>;
export type Translations = z.infer<typeof translationsSchema>;

// ── Auth ──────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const selectOrgSchema = z.object({
  organizationId: z.string().uuid(),
});
export type SelectOrgInput = z.infer<typeof selectOrgSchema>;

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  phone: z.string().optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const sendOtpSchema = z.object({
  phone: z.string().min(10).max(15),
});
export type SendOtpInput = z.infer<typeof sendOtpSchema>;

export const verifyOtpSchema = z.object({
  phone: z.string().min(10).max(15),
  otp: z.string().length(6),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

// ── User ──────────────────────────────────────────────
export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  phone: z.string().nullable(),
  role: z.nativeEnum(UserRole),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type User = z.infer<typeof userSchema>;

export const createUserSchema = registerSchema.extend({
  role: z.nativeEnum(UserRole).default(UserRole.CUSTOMER),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

/** Owner-granted add-ons for a member in the caller's organization (replaces the full set) */
export const updateMemberPermissionsSchema = z.object({
  permissions: z.array(z.nativeEnum(Permission)).max(50),
});
export type UpdateMemberPermissionsInput = z.infer<typeof updateMemberPermissionsSchema>;

// ── Organization ─────────────────────────────────────
export const organizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Organization = z.infer<typeof organizationSchema>;

export const createOrganizationSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

const festivalRegionsSchema = z.array(z.enum(Object.keys(FESTIVAL_REGIONS) as [keyof typeof FESTIVAL_REGIONS])).min(1);

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  festivalRegions: festivalRegionsSchema.optional(),
  promoDiscountCap: z.number().int().min(1).max(90).optional(),
});
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

// ── Store ─────────────────────────────────────────────
export const storeSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  address: z.string().min(1),
  phone: z.string().nullable(),
  status: z.nativeEnum(StoreStatus),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Store = z.infer<typeof storeSchema>;

export const createStoreSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  address: z.string().min(1),
  phone: z.string().optional(),
  imageUrl: z.string().url().nullish(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  deliveryRadius: z.number().positive().optional(),
  minOrderAmount: z.number().min(0).optional(),
  freeDeliveryThreshold: z.number().min(0).optional(),
  baseDeliveryFee: z.number().min(0).optional(),
});
export type CreateStoreInput = z.infer<typeof createStoreSchema>;

// ── Department ───────────────────────────────────────
export const createDepartmentSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  sortOrder: z.number().int().min(0).optional(),
  imageUrl: z.string().url().nullish(),
  translations: translationsSchema,
});
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  sortOrder: z.number().int().min(0).optional(),
  imageUrl: z.string().url().nullish(),
  translations: translationsSchema,
});
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;

// ── Category ─────────────────────────────────────────
export const createCategorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  departmentId: z.string().uuid(),
  sortOrder: z.number().int().min(0).optional(),
  imageUrl: z.string().url().nullish(),
  translations: translationsSchema,
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  departmentId: z.string().uuid().optional(),
  sortOrder: z.number().int().min(0).optional(),
  imageUrl: z.string().url().nullish(),
  translations: translationsSchema,
});
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// ── Subcategory ──────────────────────────────────────
// Words shoppers type for a subcategory; search ranks its products first for these queries
const searchTermsSchema = z.array(z.string().trim().toLowerCase().min(1).max(40)).max(30).optional();

export const createSubcategorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  categoryId: z.string().uuid(),
  sortOrder: z.number().int().min(0).optional(),
  imageUrl: z.string().url().nullish(),
  translations: translationsSchema,
  searchTerms: searchTermsSchema,
});
export type CreateSubcategoryInput = z.infer<typeof createSubcategorySchema>;

export const updateSubcategorySchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  categoryId: z.string().uuid().optional(),
  sortOrder: z.number().int().min(0).optional(),
  imageUrl: z.string().url().nullish(),
  translations: translationsSchema,
  searchTerms: searchTermsSchema,
});
export type UpdateSubcategoryInput = z.infer<typeof updateSubcategorySchema>;

// ── Reorder (generic for any level) ──────────────────
export const reorderItemsSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    sortOrder: z.number().int().min(0),
  })).min(1),
});
export type ReorderItemsInput = z.infer<typeof reorderItemsSchema>;

// ── Brand ────────────────────────────────────────────
export const createBrandSchema = z.object({
  name: z.string().min(1),
  /** Generated from the name when omitted */
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  imageUrl: z.string().url().optional(),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  themeColorSecondary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  popularity: z.number().int().min(0).max(100).optional(),
});
export type CreateBrandInput = z.infer<typeof createBrandSchema>;

export const updateBrandSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  imageUrl: z.string().url().nullish(),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullish(),
  themeColorSecondary: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullish(),
  popularity: z.number().int().min(0).max(100).optional(),
});
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;

// ── Product Variant ───────────────────────────────────
export const createProductVariantSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  unitType: z.nativeEnum(UnitType).default(UnitType.PIECE),
  unitValue: z.number().positive().default(1),
  mrp: z.number().positive().optional(),
  packType: z.string().optional(),
  imageUrl: z.string().url().optional(),
  discountType: z.nativeEnum(DiscountType).nullish(),
  discountValue: z.number().min(0).nullish(),
  discountStart: z.coerce.date().nullish(),
  discountEnd: z.coerce.date().nullish(),
});
export type CreateProductVariantInput = z.infer<typeof createProductVariantSchema>;

export const updateProductVariantSchema = z.object({
  name: z.string().min(1).optional(),
  sku: z.string().nullish(),
  barcode: z.string().nullish(),
  unitType: z.nativeEnum(UnitType).optional(),
  unitValue: z.number().positive().optional(),
  mrp: z.number().positive().nullish(),
  packType: z.string().nullish(),
  imageUrl: z.string().url().nullish(),
  discountType: z.nativeEnum(DiscountType).nullish(),
  discountValue: z.number().min(0).nullish(),
  discountStart: z.coerce.date().nullish(),
  discountEnd: z.coerce.date().nullish(),
});
export type UpdateProductVariantInput = z.infer<typeof updateProductVariantSchema>;

// ── Product ───────────────────────────────────────────
export const productSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  subcategoryId: z.string().uuid().nullable(),
  brandId: z.string().uuid().nullable(),
  isActive: z.boolean(),
  tags: z.array(z.string()),
  hsnCode: z.string().nullable(),
  gstPercent: z.number().nullable(),
  foodType: z.nativeEnum(FoodType).nullable(),
  fssaiLicense: z.string().nullable(),
  ingredients: z.string().nullable(),
  nutritionalInfo: z.unknown().nullable(),
  allergens: z.array(z.string()),
  servingSize: z.string().nullable(),
  shelfLifeDays: z.number().int().nullable(),
  storageType: z.nativeEnum(StorageType).nullable(),
  storageInstructions: z.string().nullable(),
  manufacturerName: z.string().nullable(),
  countryOfOrigin: z.string().nullable(),
  images: z.array(z.string()),
  productType: z.nativeEnum(ProductType).nullable(),
  regulatoryMarks: z.array(z.string()),
  certifications: z.array(z.string()),
  mfgLicenseNo: z.string().nullable(),
  dangerWarnings: z.string().nullable(),
  usageInstructions: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Product = z.infer<typeof productSchema>;

export const createProductSchema = z.object({
  name: z.string().min(1),
  organizationId: z.string().uuid().nullish(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  subcategoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  hsnCode: z.string().optional(),
  gstPercent: z.number().min(0).max(100).optional(),
  foodType: z.nativeEnum(FoodType).optional(),
  fssaiLicense: z.string().optional(),
  ingredients: z.string().optional(),
  nutritionalInfo: z.unknown().optional(),
  allergens: z.array(z.string()).optional(),
  servingSize: z.string().optional(),
  shelfLifeDays: z.number().int().positive().optional(),
  storageType: z.nativeEnum(StorageType).optional(),
  storageInstructions: z.string().optional(),
  manufacturerName: z.string().optional(),
  countryOfOrigin: z.string().optional(),
  images: z.array(z.string()).optional(),
  productType: z.nativeEnum(ProductType).optional(),
  regulatoryMarks: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  mfgLicenseNo: z.string().optional(),
  dangerWarnings: z.string().optional(),
  usageInstructions: z.string().optional(),
  variants: z.array(createProductVariantSchema).min(1).optional(),
  storeIds: z.array(z.string().uuid()).optional(),
  translations: translationsSchema,
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

// ── StoreProduct ─────────────────────────────────────
export const createStoreProductSchema = z.object({
  storeId: z.string().uuid(),
  variantId: z.string().uuid(),
  price: z.number().positive(),
  stock: z.number().int().min(0),
  discountType: z.nativeEnum(DiscountType).nullish(),
  discountValue: z.number().min(0).nullish(),
  discountStart: z.coerce.date().nullish(),
  discountEnd: z.coerce.date().nullish(),
});
export type CreateStoreProductInput = z.infer<typeof createStoreProductSchema>;

export const bulkCreateStoreProductSchema = z.object({
  storeId: z.string().uuid(),
  items: z.array(
    z.object({
      variantId: z.string().uuid(),
      price: z.number().positive(),
      stock: z.number().int().min(0).default(0),
      discountType: z.nativeEnum(DiscountType).nullish(),
      discountValue: z.number().min(0).nullish(),
      discountStart: z.coerce.date().nullish(),
      discountEnd: z.coerce.date().nullish(),
    }),
  ).min(1).max(200),
});
export type BulkCreateStoreProductInput = z.infer<typeof bulkCreateStoreProductSchema>;

export const updateStoreProductSchema = z.object({
  price: z.number().positive().optional(),
  stock: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  discountType: z.nativeEnum(DiscountType).nullish(),
  discountValue: z.number().min(0).nullish(),
  discountStart: z.coerce.date().nullish(),
  discountEnd: z.coerce.date().nullish(),
  memberPrice: z.number().positive().nullish(),
});
export type UpdateStoreProductInput = z.infer<typeof updateStoreProductSchema>;

// ── User Address ─────────────────────────────────────
export const createUserAddressSchema = z.object({
  label: z.enum(["Home", "Work", "Other"]).default("Home"),
  placeName: z.string().optional(),
  address: z.string().min(5),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  pincode: z.string().optional(),
  isDefault: z.boolean().optional(),
});
export type CreateUserAddressInput = z.infer<typeof createUserAddressSchema>;

export const updateUserAddressSchema = z.object({
  label: z.enum(["Home", "Work", "Other"]).optional(),
  placeName: z.string().nullish(),
  address: z.string().min(5).optional(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  pincode: z.string().nullish(),
  isDefault: z.boolean().optional(),
});
export type UpdateUserAddressInput = z.infer<typeof updateUserAddressSchema>;

// ── Profile ──────────────────────────────────────────
export const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const deleteAccountSchema = z.object({
  otp: z.string().length(6).optional(),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

// ── Payment Verification ─────────────────────────────
export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string(),
  razorpay_payment_id: z.string(),
  razorpay_signature: z.string(),
});
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;

// ── Order ─────────────────────────────────────────────
export const orderItemSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  variantId: z.string().uuid(),
  storeProductId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  totalPrice: z.number().positive(),
  originalPrice: z.number().nullish(),
  discountType: z.nativeEnum(DiscountType).nullish(),
  discountValue: z.number().nullish(),
});
export type OrderItem = z.infer<typeof orderItemSchema>;

export const orderSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  storeId: z.string().uuid(),
  status: z.nativeEnum(OrderStatus),
  paymentStatus: z.nativeEnum(PaymentStatus),
  totalAmount: z.number().positive(),
  deliveryAddress: z.string().nullable(),
  fulfillmentType: z.enum(["DELIVERY", "PICKUP"]).optional(),
  items: z.array(orderItemSchema).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Order = z.infer<typeof orderSchema>;

export const createOrderSchema = z.object({
  storeId: z.string().uuid(),
  fulfillmentType: z.enum(["DELIVERY", "PICKUP"]).default("DELIVERY"),
  deliveryAddress: z.string().min(1).optional(),
  addressId: z.string().uuid().optional(),
  deliveryAddressLat: z.number().min(-90).max(90).optional(),
  deliveryAddressLng: z.number().min(-180).max(180).optional(),
  paymentMethod: z.enum(["ONLINE", "COD"]).default("ONLINE"),
  couponCode: z.string().optional(),
  deliveryNotes: z.string().max(500).optional(),
  useWallet: z.boolean().default(true),
  useLoyaltyPoints: z.boolean().default(false),
  deliverySlotId: z.string().uuid().optional(),
  scheduledDate: z.string().optional(),
  items: z.array(
    z.object({
      storeProductId: z.string().uuid(),
      quantity: z.number().int().positive(),
    }),
  ),
}).refine(
  (data) => data.fulfillmentType === "PICKUP" || data.deliveryAddress || data.addressId,
  { message: "Either deliveryAddress or addressId is required for delivery orders", path: ["deliveryAddress"] },
);
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// ── Store branding ───────────────────────────────────
export const storeTranslationsSchema = z.record(
  z.enum(languageCodes),
  z.object({ tagline: z.string().trim().max(80).optional(), offerText: z.string().trim().max(80).optional() }),
);
export type StoreTranslations = z.infer<typeof storeTranslationsSchema>;

export const storeBrandingSchema = z.object({
  logoUrl: z.string().url().nullish(),
  promoImages: z.array(z.string().url()).max(3).optional(),
  tagline: z.string().trim().max(80).nullish(),
  offerText: z.string().trim().max(80).nullish(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #f97316").nullish(),
  highlights: z.array(z.string().trim().min(1).max(24)).max(4).optional(),
  translations: storeTranslationsSchema.nullish(),
});

// ── Update Schemas ───────────────────────────────────
export const updateStoreSchema = storeBrandingSchema.extend({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  address: z.string().min(1).optional(),
  phone: z.string().nullish(),
  imageUrl: z.string().url().nullish(),
  status: z.nativeEnum(StoreStatus).optional(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  deliveryRadius: z.number().positive().optional(),
  // Money comes back from the API as Decimal strings; forms send them back as-is
  minOrderAmount: z.coerce.number().min(0).nullish(),
  freeDeliveryThreshold: z.coerce.number().min(0).nullish(),
  baseDeliveryFee: z.coerce.number().min(0).nullish(),
  subscriptionEnabled: z.boolean().optional(),
  subscriptionDeliveryMode: z.nativeEnum(SubscriptionDeliveryMode).optional(),
  subscriptionWindowStart: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  subscriptionWindowEnd: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  subscriptionCutoffTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;

const emptyToNull = z.string().transform((v) => (v === "" ? null : v));
const optionalUrl = z.union([z.string().url(), z.literal(""), z.null()]).optional().transform((v) => (v === "" ? null : v));
const coerceNumberNullish = z.union([z.number(), z.string().transform((v) => v === "" ? null : Number(v)), z.null()]).optional();

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: emptyToNull.nullish(),
  imageUrl: optionalUrl,
  subcategoryId: z.string().uuid().nullish(),
  brandId: z.string().uuid().nullish(),
  isActive: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  hsnCode: emptyToNull.nullish(),
  gstPercent: coerceNumberNullish,
  foodType: z.nativeEnum(FoodType).nullish(),
  fssaiLicense: emptyToNull.nullish(),
  ingredients: emptyToNull.nullish(),
  nutritionalInfo: z.unknown().nullish(),
  allergens: z.array(z.string()).optional(),
  servingSize: emptyToNull.nullish(),
  shelfLifeDays: coerceNumberNullish,
  storageType: z.nativeEnum(StorageType).nullish(),
  storageInstructions: emptyToNull.nullish(),
  manufacturerName: emptyToNull.nullish(),
  countryOfOrigin: emptyToNull.nullish(),
  images: z.array(z.string()).optional(),
  productType: z.nativeEnum(ProductType).nullish(),
  regulatoryMarks: z.array(z.string()).optional(),
  certifications: z.array(z.string()).optional(),
  mfgLicenseNo: emptyToNull.nullish(),
  dangerWarnings: emptyToNull.nullish(),
  usageInstructions: emptyToNull.nullish(),
  variants: z.array(z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1),
    sku: z.string().nullish(),
    barcode: z.string().nullish(),
    unitType: z.nativeEnum(UnitType).optional(),
    unitValue: coerceNumberNullish,
    mrp: coerceNumberNullish,
    packType: emptyToNull.nullish(),
    imageUrl: optionalUrl,
    discountType: z.nativeEnum(DiscountType).nullish(),
    discountValue: coerceNumberNullish,
    discountStart: z.coerce.date().nullish(),
    discountEnd: z.coerce.date().nullish(),
  })).optional(),
  translations: translationsSchema,
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  note: z.string().trim().max(500).optional(),
  /** Delivering a COD order: how the customer paid (cash by default) */
  collectedVia: z.nativeEnum(CodCollectionMode).optional(),
}).refine((d) => d.status !== OrderStatus.CANCELLED || !!d.note, {
  message: "A reason is required to cancel an order",
  path: ["note"],
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

export const updatePaymentStatusSchema = z.object({
  paymentStatus: z.enum(["PENDING", "PAID", "FAILED"]),
  note: z.string().max(500).optional(),
});
export type UpdatePaymentStatusInput = z.infer<typeof updatePaymentStatusSchema>;

export const bulkUpdateOrderStatusSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1).max(50),
  status: z.enum(BULK_STATUSES),
});
export const undoDeliverySchema = z.object({
  reason: z.string().trim().min(1, "A reason is required").max(500),
});
export type UndoDeliveryInput = z.infer<typeof undoDeliverySchema>;

export type BulkUpdateOrderStatusInput = z.infer<typeof bulkUpdateOrderStatusSchema>;

// ── Collection ──────────────────────────────────────
const collectionWindowValid = (v: { startsAt?: Date | null; endsAt?: Date | null }) =>
  !v.startsAt || !v.endsAt || v.endsAt > v.startsAt;

export const createCollectionSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  imageUrl: z.string().url().optional(),
  organizationId: z.string().uuid().nullish(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  productIds: z.array(z.string().uuid()).optional(),
  kind: z.enum(EDITABLE_COLLECTION_KINDS).default("STANDARD"),
  startsAt: z.coerce.date().nullish(),
  endsAt: z.coerce.date().nullish(),
}).refine(collectionWindowValid, { message: "endsAt must be after startsAt", path: ["endsAt"] });
export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;

export const updateCollectionSchema = z.object({
  title: z.string().min(1).optional(),
  subtitle: z.string().nullish(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  imageUrl: z.string().url().nullish(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  productIds: z.array(z.string().uuid()).optional(),
  kind: z.enum(EDITABLE_COLLECTION_KINDS).optional(),
  startsAt: z.coerce.date().nullish(),
  endsAt: z.coerce.date().nullish(),
}).refine(collectionWindowValid, { message: "endsAt must be after startsAt", path: ["endsAt"] });
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;

export const updateCollectionHeroSchema = z.object({
  heroTitle: z.string().trim().min(1).max(40),
  heroTitleTa: z.string().max(60).nullish(),
  heroKicker: z.string().trim().max(60).nullish(),
  heroKickerTa: z.string().max(60).nullish(),
  heroSubtitle: z.string().trim().max(90).nullish(),
  heroSubtitleTa: z.string().max(90).nullish(),
});
export type UpdateCollectionHeroInput = z.infer<typeof updateCollectionHeroSchema>;

export const updateCollectionTileSchema = z.object({
  title: z.string().min(1).max(30).optional(),
  titleTa: z.string().max(45).nullish(),
  subcategoryIds: z.array(z.string().uuid()).min(1).max(4).optional(),
});
export type UpdateCollectionTileInput = z.infer<typeof updateCollectionTileSchema>;

// ── Festival Calendar ───────────────────────────────
const festivalEventFields = {
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  kind: z.enum(["OCCASION", "SEASON"]),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  leadDays: z.number().int().min(0).max(60),
  regions: festivalRegionsSchema,
  guidance: z.string().max(1000).nullish(),
  isActive: z.boolean(),
};
const festivalWindowValid = (v: { startsAt?: Date; endsAt?: Date }) =>
  !v.startsAt || !v.endsAt || v.endsAt >= v.startsAt;

export const createFestivalEventSchema = z.object({
  ...festivalEventFields,
  kind: festivalEventFields.kind.default("OCCASION"),
  leadDays: festivalEventFields.leadDays.default(7),
  regions: festivalEventFields.regions.default(["ALL"]),
  isActive: festivalEventFields.isActive.default(true),
}).refine(festivalWindowValid, { message: "endsAt must not be before startsAt", path: ["endsAt"] });
export type CreateFestivalEventInput = z.infer<typeof createFestivalEventSchema>;

export const updateFestivalEventSchema = z.object(festivalEventFields).partial()
  .refine(festivalWindowValid, { message: "endsAt must not be before startsAt", path: ["endsAt"] });
export type UpdateFestivalEventInput = z.infer<typeof updateFestivalEventSchema>;

// ── Coupon ──────────────────────────────────────────
export const createCouponSchema = z.object({
  code: z.string().min(1).transform((v) => v.toUpperCase()),
  description: z.string().optional(),
  discountType: z.nativeEnum(DiscountType),
  discountValue: z.number().positive(),
  minOrderAmount: z.number().min(0).nullish(),
  maxDiscount: z.number().min(0).nullish(),
  usageLimit: z.number().int().positive().nullish(),
  perUserLimit: z.number().int().positive().default(1),
  startsAt: z.coerce.date().nullish(),
  expiresAt: z.coerce.date().nullish(),
  isActive: z.boolean().default(true),
  organizationId: z.string().uuid().nullish(),
});
export type CreateCouponInput = z.infer<typeof createCouponSchema>;

export const updateCouponSchema = z.object({
  code: z.string().min(1).transform((v) => v.toUpperCase()).optional(),
  description: z.string().nullish(),
  discountType: z.nativeEnum(DiscountType).optional(),
  discountValue: z.number().positive().optional(),
  minOrderAmount: z.number().min(0).nullish(),
  maxDiscount: z.number().min(0).nullish(),
  usageLimit: z.number().int().positive().nullish(),
  perUserLimit: z.number().int().positive().optional(),
  startsAt: z.coerce.date().nullish(),
  expiresAt: z.coerce.date().nullish(),
  isActive: z.boolean().optional(),
});
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;

export const applyCouponSchema = z.object({
  code: z.string().min(1),
  storeId: z.string().uuid(),
  orderAmount: z.number().positive(),
});
export type ApplyCouponInput = z.infer<typeof applyCouponSchema>;

// ── Review ──────────────────────────────────────────
export const createReviewSchema = z.object({
  productId: z.string().uuid(),
  storeId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional(),
  comment: z.string().max(2000).optional(),
  imageUrls: z.array(z.string().url()).max(5).optional(),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  title: z.string().max(200).nullish(),
  comment: z.string().max(2000).nullish(),
  imageUrls: z.array(z.string().url()).max(5).optional(),
});
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;

export const createReviewReplySchema = z.object({
  body: z.string().min(1).max(2000),
});
export type CreateReviewReplyInput = z.infer<typeof createReviewReplySchema>;

export const createStoreRatingSchema = z.object({
  orderId: z.string().uuid(),
  storeId: z.string().uuid(),
  overallRating: z.number().int().min(1).max(5),
  deliveryRating: z.number().int().min(1).max(5).optional(),
  packagingRating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(2000).optional(),
});
export type CreateStoreRatingInput = z.infer<typeof createStoreRatingSchema>;

export const updateReviewStatusSchema = z.object({
  status: z.nativeEnum(ReviewStatus),
});
export type UpdateReviewStatusInput = z.infer<typeof updateReviewStatusSchema>;

// ── Wishlist ────────────────────────────────────────
export const toggleWishlistSchema = z.object({
  productId: z.string().uuid(),
  storeId: z.string().uuid().optional(),
});
export type ToggleWishlistInput = z.infer<typeof toggleWishlistSchema>;

// ── Delivery Zone ───────────────────────────────────
export const createDeliveryZoneSchema = z.object({
  name: z.string().min(1),
  pincodes: z.array(z.string()).default([]),
  deliveryFee: z.number().min(0),
  estimatedMinutes: z.number().int().positive().default(60),
  isActive: z.boolean().default(true),
  organizationId: z.string().uuid(),
  storeIds: z.array(z.string().uuid()).optional(),
});
export type CreateDeliveryZoneInput = z.infer<typeof createDeliveryZoneSchema>;

export const updateDeliveryZoneSchema = z.object({
  name: z.string().min(1).optional(),
  pincodes: z.array(z.string()).optional(),
  deliveryFee: z.number().min(0).optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  storeIds: z.array(z.string().uuid()).optional(),
});
export type UpdateDeliveryZoneInput = z.infer<typeof updateDeliveryZoneSchema>;

// ── Delivery Tier (distance-based) ─────────────────
export const createDeliveryTierSchema = z.object({
  storeId: z.string().uuid(),
  minDistance: z.number().min(0),
  maxDistance: z.number().positive(),
  deliveryFee: z.number().min(0),
  estimatedMinutes: z.number().int().positive().default(45),
  isActive: z.boolean().default(true),
});
export type CreateDeliveryTierInput = z.infer<typeof createDeliveryTierSchema>;

export const updateDeliveryTierSchema = z.object({
  minDistance: z.number().min(0).optional(),
  maxDistance: z.number().positive().optional(),
  deliveryFee: z.number().min(0).optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateDeliveryTierInput = z.infer<typeof updateDeliveryTierSchema>;

export const deliveryLookupSchema = z.object({
  storeId: z.string().uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type DeliveryLookupInput = z.infer<typeof deliveryLookupSchema>;

// ── Loyalty ────────────────────────────────────────
export const createLoyaltyConfigSchema = z.object({
  isEnabled: z.boolean().default(true),
  earnRate: z.number().int().min(0).max(100).default(1),
  minRedeemPoints: z.number().int().min(0).default(10),
  maxRedeemPercentage: z.number().int().min(1).max(100).default(50),
  reviewRewardPoints: z.number().int().min(0).max(1000).default(0),
});
export type CreateLoyaltyConfigInput = z.infer<typeof createLoyaltyConfigSchema>;

export const updateLoyaltyConfigSchema = z.object({
  isEnabled: z.boolean().optional(),
  earnRate: z.number().int().min(0).max(100).optional(),
  minRedeemPoints: z.number().int().min(0).optional(),
  maxRedeemPercentage: z.number().int().min(1).max(100).optional(),
  reviewRewardPoints: z.number().int().min(0).max(1000).optional(),
});
export type UpdateLoyaltyConfigInput = z.infer<typeof updateLoyaltyConfigSchema>;

export const loyaltyAdjustmentSchema = z.object({
  userId: z.string().uuid(),
  points: z.number().int(),
  description: z.string().min(1).max(500),
});
export type LoyaltyAdjustmentInput = z.infer<typeof loyaltyAdjustmentSchema>;

// ── Delivery Slot ──────────────────────────────────
export const createDeliverySlotSchema = z.object({
  storeId: z.string().uuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  maxOrders: z.number().int().positive().default(20),
  cutoffMinutes: z.number().int().min(0).default(60),
  isActive: z.boolean().default(true),
});
export type CreateDeliverySlotInput = z.infer<typeof createDeliverySlotSchema>;

// ── Express Delivery Config ────────────────────────
export const upsertExpressDeliveryConfigSchema = z.object({
  isEnabled: z.boolean().default(true),
  etaMinutes: z.number().int().positive().nullish(),
  operatingStart: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  operatingEnd: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
}).refine(
  (data) => {
    const hasStart = data.operatingStart != null;
    const hasEnd = data.operatingEnd != null;
    return hasStart === hasEnd;
  },
  { message: "Both operatingStart and operatingEnd must be set together", path: ["operatingStart"] },
);
export type UpsertExpressDeliveryConfigInput = z.infer<typeof upsertExpressDeliveryConfigSchema>;

// ── Delivery Trip ──────────────────────────────────
export const createDeliveryTripSchema = z.object({
  storeId: z.string().uuid(),
  riderId: z.string().uuid(),
  orderIds: z.array(z.string().uuid()).min(1).max(30),
  /** Start the trip straight away: its orders go out for delivery with this rider */
  start: z.boolean().optional(),
});
export type CreateDeliveryTripInput = z.infer<typeof createDeliveryTripSchema>;

// ── Delivery planning ─────────────────────────────
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

/** How a store runs its fleet */
export const deliverySettingsSchema = z.object({
  storeId: z.string().uuid(),
  maxOrdersPerTrip: z.number().int().min(1).max(30),
  maxTripsPerRider: z.number().int().min(1).max(10),
  expressBatchSize: z.number().int().min(1).max(10),
  expressMaxWaitMinutes: z.number().int().min(0).max(120),
  autoPlan: z.boolean(),
});
export type DeliverySettingsInput = z.infer<typeof deliverySettingsSchema>;

/** The riders who work a slot every week */
export const slotRosterSchema = z.object({ riderIds: z.array(z.string().uuid()).max(50) });

/** The same weekly riders on several slots at once, e.g. every evening slot of the week */
export const bulkSlotRosterSchema = z.object({
  storeId: z.string().uuid(),
  slotIds: z.array(z.string().uuid()).min(1).max(50),
  riderIds: z.array(z.string().uuid()).max(50),
});

/** One day's change to a slot's roster */
export const slotRosterOverrideSchema = z.object({ riderId: z.string().uuid(), date: dateKey, working: z.boolean() });

/** Plan (or re-plan) a wave: a slot on a day, or express when slotId is left out */
export const planWaveSchema = z.object({ storeId: z.string().uuid(), date: dateKey.optional(), slotId: z.string().uuid().optional() });

export const assignTripsSchema = z.object({
  assignments: z.array(z.object({ tripId: z.string().uuid(), riderId: z.string().uuid() })).min(1).max(50),
});

/** A rider couldn't deliver: the order goes back to the store as Ready, with the reason on record */
export const failDeliverySchema = z.object({
  reason: z.nativeEnum(DeliveryFailureReason),
  note: z.string().trim().max(300).optional(),
}).refine((b) => b.reason !== "OTHER" || !!b.note, { message: "Say what happened", path: ["note"] });
export type FailDeliveryInput = z.infer<typeof failDeliverySchema>;

/** Move a stop to another unstarted trip, or back to the unplanned pool (toTripId null) */
export const moveTripOrderSchema = z.object({ orderId: z.string().uuid(), toTripId: z.string().uuid().nullable() });

// ── Rider ─────────────────────────────────────────
export const createRiderSchema = z.object({
  storeId: z.string().uuid(),
  name: z.string().min(2).max(100),
  phone: z.string().min(10).max(15),
  email: z.string().email(),
  password: z.string().min(6).max(100),
});
export type CreateRiderInput = z.infer<typeof createRiderSchema>;

export const updateRiderSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  phone: z.string().min(10).max(15).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).max(100).optional(),
});
export type UpdateRiderInput = z.infer<typeof updateRiderSchema>;

// ── Banner ──────────────────────────────────────────
export const createBannerSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  imageUrl: z.string().url(),
  textInImage: z.boolean().default(false),
  placement: z.nativeEnum(BannerPlacement),
  actionType: z.nativeEnum(BannerActionType).default("NONE"),
  actionTarget: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().default(true),
  startsAt: z.coerce.date().nullish(),
  endsAt: z.coerce.date().nullish(),
  storeId: z.string().uuid().nullish(),
  organizationId: z.string().uuid().nullish(),
  departmentId: z.string().uuid().nullish(),
  categoryId: z.string().uuid().nullish(),
  subcategoryId: z.string().uuid().nullish(),
});
export type CreateBannerInput = z.infer<typeof createBannerSchema>;

export const updateBannerSchema = z.object({
  title: z.string().min(1).optional(),
  subtitle: z.string().nullish(),
  imageUrl: z.string().url().optional(),
  textInImage: z.boolean().optional(),
  placement: z.nativeEnum(BannerPlacement).optional(),
  actionType: z.nativeEnum(BannerActionType).optional(),
  actionTarget: z.string().nullish(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  startsAt: z.coerce.date().nullish(),
  endsAt: z.coerce.date().nullish(),
  storeId: z.string().uuid().nullish(),
  departmentId: z.string().uuid().nullish(),
  categoryId: z.string().uuid().nullish(),
  subcategoryId: z.string().uuid().nullish(),
});
export type UpdateBannerInput = z.infer<typeof updateBannerSchema>;

// ── Notification ──────────────────────────────────
export const sendNotificationSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
  type: z.enum(["PROMOTIONAL", "GENERAL"]).default("PROMOTIONAL"),
  imageUrl: z.string().url().optional(),
  storeId: z.string().uuid().optional(),
  deepLinkType: z.enum(["product", "category", "collection", "store", "screen"]).optional(),
  deepLinkId: z.string().max(500).optional(),
});
export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;

/** @deprecated Use sendNotificationSchema instead */
export const sendPromotionalNotificationSchema = sendNotificationSchema;
export type SendPromotionalNotificationInput = SendNotificationInput;

export const updateDeliverySlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  maxOrders: z.number().int().positive().optional(),
  cutoffMinutes: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateDeliverySlotInput = z.infer<typeof updateDeliverySlotSchema>;

// ── Notification Campaign ───────────────────────────
export const audienceConfigSchema = z.object({
  storeId: z.string().uuid().optional(),
  days: z.number().int().positive().optional(),
  minAmount: z.number().positive().optional(),
});
export type AudienceConfig = z.infer<typeof audienceConfigSchema>;

export const sendCampaignSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  type: z.enum(["PROMOTIONAL", "GENERAL"]).default("PROMOTIONAL"),
  imageUrl: z.string().url().optional(),
  audienceType: z.enum(["ALL_CUSTOMERS", "STORE_CUSTOMERS", "ORDERED_LAST_N_DAYS", "NOT_ORDERED_N_DAYS", "HIGH_VALUE_CUSTOMERS"]).default("ALL_CUSTOMERS"),
  audienceConfig: audienceConfigSchema.optional(),
  deepLinkType: z.enum(["product", "category", "collection", "store", "screen"]).optional(),
  deepLinkId: z.string().max(500).optional(),
  scheduledAt: z.coerce.date().optional(),
});
export type SendCampaignInput = z.infer<typeof sendCampaignSchema>;

export const audiencePreviewSchema = z.object({
  audienceType: z.enum(["ALL_CUSTOMERS", "STORE_CUSTOMERS", "ORDERED_LAST_N_DAYS", "NOT_ORDERED_N_DAYS", "HIGH_VALUE_CUSTOMERS"]),
  audienceConfig: audienceConfigSchema.optional(),
});
export type AudiencePreviewInput = z.infer<typeof audiencePreviewSchema>;

// ── Notification Template ───────────────────────────
export const createNotificationTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(2000),
  type: z.enum(["PROMOTIONAL", "GENERAL"]).default("PROMOTIONAL"),
  imageUrl: z.string().url().optional(),
});
export type CreateNotificationTemplateInput = z.infer<typeof createNotificationTemplateSchema>;

export const updateNotificationTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(2000).optional(),
  type: z.enum(["PROMOTIONAL", "GENERAL"]).optional(),
  imageUrl: z.string().url().nullish(),
});
export type UpdateNotificationTemplateInput = z.infer<typeof updateNotificationTemplateSchema>;

// ── Referral ──────────────────────────────────────────
export const applyReferralCodeSchema = z.object({
  code: z.string().min(1).transform((v) => v.toUpperCase().trim()),
  storeId: z.string().uuid(),
});
export type ApplyReferralCodeInput = z.infer<typeof applyReferralCodeSchema>;

export const createReferralConfigSchema = z.object({
  isEnabled: z.boolean().default(true),
  referrerReward: z.number().min(0).max(10000).default(50),
  refereeReward: z.number().min(0).max(10000).default(25),
  maxReferralsPerUser: z.number().int().min(1).max(1000).default(50),
});
export type CreateReferralConfigInput = z.infer<typeof createReferralConfigSchema>;

// ── Return Request ──────────────────────────────────
export const createReturnRequestSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.enum([
    "Damaged/broken item",
    "Wrong item received",
    "Item expired/stale",
    "Quality not as expected",
    "Missing items",
    "Other",
  ]),
  description: z.string().max(1000).optional(),
  imageUrls: z.array(z.string().url()).max(5).optional(),
  items: z.array(z.object({
    orderItemId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1),
});
export type CreateReturnRequestInput = z.infer<typeof createReturnRequestSchema>;

export const resolveReturnRequestSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  approvedAmount: z.number().min(0).optional(),
  adminNote: z.string().max(500).optional(),
});
export type ResolveReturnRequestInput = z.infer<typeof resolveReturnRequestSchema>;

// ── Membership ──────────────────────────────────────
export const createMembershipPlanSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  price: z.number().positive(),
  duration: z.nativeEnum(MembershipDuration),
  freeDelivery: z.boolean().default(true),
  loyaltyMultiplier: z.number().min(1).max(10).default(1),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).optional(),
});
export type CreateMembershipPlanInput = z.infer<typeof createMembershipPlanSchema>;

export const updateMembershipPlanSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullish(),
  price: z.number().positive().optional(),
  duration: z.nativeEnum(MembershipDuration).optional(),
  freeDelivery: z.boolean().optional(),
  loyaltyMultiplier: z.number().min(1).max(10).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});
export type UpdateMembershipPlanInput = z.infer<typeof updateMembershipPlanSchema>;

export const purchaseMembershipSchema = z.object({
  planId: z.string().uuid(),
  storeId: z.string().uuid(),
});
export type PurchaseMembershipInput = z.infer<typeof purchaseMembershipSchema>;

export const upgradeMembershipSchema = z.object({
  planId: z.string().uuid(),
  storeId: z.string().uuid(),
});
export type UpgradeMembershipInput = z.infer<typeof upgradeMembershipSchema>;

// ── Subscription ──────────────────────────────────
export const createSubscriptionSchema = z.object({
  storeId: z.string().uuid(),
  frequency: z.nativeEnum(SubscriptionFrequency),
  selectedDays: z.array(z.number().int().min(0).max(31)).optional(),
  deliveryAddress: z.string().min(5),
  deliveryLat: z.number().min(-90).max(90).optional(),
  deliveryLng: z.number().min(-180).max(180).optional(),
  deliveryPincode: z.string().optional(),
  addressId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  autoPayWithWallet: z.boolean().default(true),
  items: z.array(z.object({
    storeProductId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1),
}).superRefine((data, ctx) => {
  const freq = data.frequency;
  const days = data.selectedDays ?? [];

  if (freq === "SPECIFIC_DAYS") {
    if (days.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "selectedDays is required for SPECIFIC_DAYS frequency", path: ["selectedDays"] });
    }
    if (days.some((d) => d < 0 || d > 6)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "selectedDays values must be 0-6 for SPECIFIC_DAYS", path: ["selectedDays"] });
    }
  }

  if (freq === "WEEKLY" || freq === "BIWEEKLY") {
    if (days.length !== 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "selectedDays must have exactly 1 day (0-6) for WEEKLY/BIWEEKLY", path: ["selectedDays"] });
    }
    if (days.some((d) => d < 0 || d > 6)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "selectedDays values must be 0-6 for WEEKLY/BIWEEKLY", path: ["selectedDays"] });
    }
  }

  if (freq === "MONTHLY") {
    if (days.length !== 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "selectedDays must have exactly 1 day (1-28) for MONTHLY", path: ["selectedDays"] });
    }
    if (days.some((d) => d < 1 || d > 28)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "selectedDays values must be 1-28 for MONTHLY", path: ["selectedDays"] });
    }
  }
});
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

export const updateSubscriptionSchema = z.object({
  frequency: z.nativeEnum(SubscriptionFrequency).optional(),
  selectedDays: z.array(z.number().int().min(0).max(31)).optional(),
  deliveryAddress: z.string().min(5).optional(),
  deliveryLat: z.number().min(-90).max(90).nullish(),
  deliveryLng: z.number().min(-180).max(180).nullish(),
  deliveryPincode: z.string().nullish(),
  addressId: z.string().uuid().nullish(),
  autoPayWithWallet: z.boolean().optional(),
  status: z.enum(["ACTIVE", "PAUSED"]).optional(),
  pausedUntil: z.string().optional(),
  items: z.array(z.object({
    storeProductId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1).optional(),
});
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;

export const skipSubscriptionDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(500).optional(),
});
export type SkipSubscriptionDateInput = z.infer<typeof skipSubscriptionDateSchema>;

export const basketAddOnSchema = z.object({
  storeProductId: z.string().uuid(),
  quantity: z.number().int().positive(),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
export type BasketAddOnInput = z.infer<typeof basketAddOnSchema>;

export const subscriptionConfigSchema = z.object({
  subscriptionEnabled: z.boolean().optional(),
  subscriptionDeliveryMode: z.nativeEnum(SubscriptionDeliveryMode).optional(),
  subscriptionWindowStart: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  subscriptionWindowEnd: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  subscriptionCutoffTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});
export type SubscriptionConfigInput = z.infer<typeof subscriptionConfigSchema>;

export const orgSubscriptionConfigSchema = z.object({
  subscriptionEnabled: z.boolean(),
});
export type OrgSubscriptionConfigInput = z.infer<typeof orgSubscriptionConfigSchema>;

export const subscriptionItemOverrideSchema = z.object({
  subscriptionId: z.string().uuid(),
  storeProductId: z.string().uuid(),
  quantity: z.number().int().min(0),
});
export type SubscriptionItemOverrideInput = z.infer<typeof subscriptionItemOverrideSchema>;

// ── Recipe ──────────────────────────────────────────
export const recipeItemSchema = z.object({
  productId: z.string().uuid(),
  displayQty: z.string().min(1),
  note: z.string().nullish(),
});
export type RecipeItemInput = z.infer<typeof recipeItemSchema>;

export const createRecipeSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  instructions: z.array(z.string().min(1)).optional(),
  prepTime: z.number().int().positive().optional(),
  cookTime: z.number().int().positive().optional(),
  servings: z.number().int().positive().optional(),
  difficulty: z.nativeEnum(Difficulty).optional(),
  cuisineType: z.string().optional(),
  dietType: z.nativeEnum(FoodType).optional(),
  imageUrl: z.string().url().optional(),
  organizationId: z.string().uuid().nullish(),
  isActive: z.boolean().optional(),
  items: z.array(recipeItemSchema).optional(),
  translations: translationsSchema,
});
export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;

export const updateRecipeSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().nullish(),
  instructions: z.array(z.string().min(1)).optional(),
  prepTime: z.number().int().positive().nullish(),
  cookTime: z.number().int().positive().nullish(),
  servings: z.number().int().positive().nullish(),
  difficulty: z.nativeEnum(Difficulty).nullish(),
  cuisineType: z.string().nullish(),
  dietType: z.nativeEnum(FoodType).nullish(),
  imageUrl: z.string().url().nullish(),
  isActive: z.boolean().optional(),
  items: z.array(recipeItemSchema).optional(),
  translations: translationsSchema,
});
export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;

export const storeProductSearchQuerySchema = z.object({
  q: z.string().trim().min(1),
  tag: z.string().trim().toLowerCase().optional(),
  subcategoryId: z.string().uuid().optional(),
  brandIds: z.string().optional().transform((v) => v?.split(",").filter(Boolean)),
  size: z.string().optional(),
  foodType: z.nativeEnum(FoodType).optional(),
  hasDiscount: z.enum(["true", "false"]).optional().transform((v) => v === "true"),
  sortBy: z.nativeEnum(SearchSortBy).default(SearchSortBy.RELEVANCE),
  // "Search instead for <typed>": skip spelling correction and fuzzy fallbacks
  exact: z.enum(["true", "false"]).optional().transform((v) => v === "true"),
});

export const searchLandingQuerySchema = z.object({
  storeId: z.string().uuid(),
});

export const festiveTileProductsQuerySchema = z.object({
  storeId: z.string().uuid(),
  subcategoryId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

// Logged only when a search is committed (submit, result tap), so the query is what the customer meant
export const searchLogSchema = z.object({
  storeId: z.string().uuid(),
  query: z.string().trim().toLowerCase().min(2).max(100),
  resultCount: z.number().int().min(0),
});

export const searchEventSchema = z.object({
  searchLogId: z.string().uuid(),
  productId: z.string().uuid(),
  type: z.nativeEnum(SearchEventType),
  position: z.number().int().min(0),
});

export const searchSuggestQuerySchema = z.object({
  storeId: z.string().uuid(),
  q: z.string().trim().min(1).max(100),
});

// ── Promo agent ──────────────────────────────────────
export const createPromoSchema = z.object({
  brief: z.string().trim().min(3).max(200),
  autoLaunch: z.boolean().default(false),
  notify: z.boolean().default(true),
  organizationId: z.string().uuid().optional(),
  /** The owner's own banner (uploaded); without it the AI paints one */
  imageUrl: z.string().url().optional(),
});
export type CreatePromoInput = z.infer<typeof createPromoSchema>;

export const updatePromoItemsSchema = z.object({
  productIds: z.array(z.string().uuid()).min(1),
});

export const promoListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ── Catalog agent ────────────────────────────────────
export const createCatalogDraftSchema = z
  .object({
    storeId: z.string().uuid(),
    photos: z.array(z.string().url()).min(1).max(8),
    hintName: z.string().trim().max(120).optional(),
    mrp: z.number().positive(),
    sellingPrice: z.number().positive(),
    stock: z.number().int().min(0).default(0),
  })
  .refine((d) => d.sellingPrice <= d.mrp, { message: "Selling price can't be above MRP", path: ["sellingPrice"] });
export type CreateCatalogDraftInput = z.infer<typeof createCatalogDraftSchema>;

export const catalogDraftListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  storeId: z.string().uuid().optional(),
  status: z.nativeEnum(CatalogDraftStatus).optional(),
});

// Another pack size of a drafted product, listed in the draft's store
export const catalogDraftSizeSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    unitType: z.nativeEnum(UnitType),
    unitValue: z.number().positive(),
    mrp: z.number().positive(),
    sellingPrice: z.number().positive(),
    stock: z.number().int().min(0).default(0),
  })
  .refine((d) => d.sellingPrice <= d.mrp, { message: "Selling price can't be above MRP", path: ["sellingPrice"] });
export type CatalogDraftSizeInput = z.infer<typeof catalogDraftSizeSchema>;

export const addCatalogDraftSizesSchema = z.object({ sizes: z.array(catalogDraftSizeSchema).min(1).max(10) });
export type AddCatalogDraftSizesInput = z.infer<typeof addCatalogDraftSizesSchema>;

// Reviewer's corrections; anything left out keeps what the agent read
export const approveCatalogDraftSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    brandId: z.string().uuid().optional(),
    newBrandName: z.string().trim().min(1).max(80).optional(),
    subcategoryId: z.string().uuid().optional(),
    variantName: z.string().trim().min(1).max(60).optional(),
    unitType: z.nativeEnum(UnitType).optional(),
    unitValue: z.number().positive().optional(),
    foodType: z.nativeEnum(FoodType).optional(),
    mrp: z.number().positive().optional(),
    sellingPrice: z.number().positive().optional(),
    stock: z.number().int().min(0).optional(),
    extraSizes: z.array(catalogDraftSizeSchema).max(10).optional(),
  })
  .refine((d) => !(d.brandId && d.newBrandName), { message: "Pick a brand or name a new one, not both", path: ["newBrandName"] });
export type ApproveCatalogDraftInput = z.infer<typeof approveCatalogDraftSchema>;

export const collectionProductsQuerySchema = z.object({
  storeId: z.string().uuid(),
  /** Comma-separated aisles to narrow the collection to */
  subcategoryIds: z.string().optional().transform((v) => (v ? v.split(",").filter(Boolean) : [])).pipe(z.array(z.string().uuid()).max(50)),
  /** Searches within the collection */
  q: z.string().trim().max(100).optional().transform((v) => v || undefined),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

// ── Stock ledger & counts ───────────────────────────
export const receiveStockSchema = z.object({
  storeId: z.string().uuid(),
  lines: z.array(z.object({ storeProductId: z.string().uuid(), quantity: z.number().int().positive() })).min(1).max(200),
  note: z.string().trim().max(500).optional(),
});
export type ReceiveStockInput = z.infer<typeof receiveStockSchema>;

export const adjustStockSchema = z.object({
  storeProductId: z.string().uuid(),
  /** Signed change: negative for write-offs */
  quantity: z.number().int().refine((n) => n !== 0, "Quantity can't be zero"),
  type: z.enum(["DAMAGE", "EXPIRY", "MANUAL"]),
  note: z.string().trim().min(1, "Add a note explaining the change").max(500),
});
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export const createStockCountSchema = z.object({
  storeId: z.string().uuid(),
  subcategoryId: z.string().uuid(),
  note: z.string().trim().max(500).optional(),
});
export type CreateStockCountInput = z.infer<typeof createStockCountSchema>;

export const saveStockCountLinesSchema = z.object({
  lines: z.array(z.object({ storeProductId: z.string().uuid(), countedQty: z.number().int().min(0) })).min(1).max(500),
});
export type SaveStockCountLinesInput = z.infer<typeof saveStockCountLinesSchema>;

export const reviewStockCountSchema = z.object({
  note: z.string().trim().max(500).optional(),
});
export type ReviewStockCountInput = z.infer<typeof reviewStockCountSchema>;

/** Approver sends selected lines back to be counted again (blind) */
export const requestRecountSchema = z.object({
  storeProductIds: z.array(z.string().uuid()).min(1).max(500),
  note: z.string().trim().max(500).optional(),
  /** Apply every line not sent for recount to stock now */
  approveRest: z.boolean().default(true),
});
export type RequestRecountInput = z.infer<typeof requestRecountSchema>;

/** Approver overrides a counted quantity; the reason is kept in the line's history */
export const correctCountLineSchema = z.object({
  countedQty: z.number().int().min(0),
  reason: z.string().trim().min(3, "Say why the count is being corrected").max(300),
});
export type CorrectCountLineInput = z.infer<typeof correctCountLineSchema>;

export const stockCountListQuerySchema = z.object({
  storeId: z.string().uuid().optional(),
  status: z.nativeEnum(StockCountStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export * from "./marketing.js";
export * from "./home.js";
