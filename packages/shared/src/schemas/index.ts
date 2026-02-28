import { z } from "zod";
import { UserRole, StoreStatus, OrderStatus, PaymentStatus, UnitType, FoodType, ProductType, StorageType, DiscountType, ReviewStatus, BannerPlacement, BannerActionType } from "../constants/index.js";

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

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
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
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  deliveryRadius: z.number().positive().optional(),
});
export type CreateStoreInput = z.infer<typeof createStoreSchema>;

// ── Category ──────────────────────────────────────────
export const createCategorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  parentId: z.string().uuid().nullish(),
  sortOrder: z.number().int().min(0).optional(),
  imageUrl: z.string().url().nullish(),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const reorderCategoriesSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    sortOrder: z.number().int().min(0),
  })).min(1),
});
export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;

export const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  parentId: z.string().uuid().nullish(),
  sortOrder: z.number().int().min(0).optional(),
  imageUrl: z.string().url().nullish(),
});
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// ── Brand ────────────────────────────────────────────
export const createBrandSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  imageUrl: z.string().url().optional(),
});
export type CreateBrandInput = z.infer<typeof createBrandSchema>;

export const updateBrandSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  imageUrl: z.string().url().nullish(),
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
  categoryId: z.string().uuid().nullable(),
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
  categoryId: z.string().uuid().optional(),
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
});
export type UpdateStoreProductInput = z.infer<typeof updateStoreProductSchema>;

// ── User Address ─────────────────────────────────────
export const createUserAddressSchema = z.object({
  label: z.enum(["Home", "Work", "Other"]).default("Home"),
  address: z.string().min(5),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  pincode: z.string().optional(),
  isDefault: z.boolean().optional(),
});
export type CreateUserAddressInput = z.infer<typeof createUserAddressSchema>;

export const updateUserAddressSchema = z.object({
  label: z.enum(["Home", "Work", "Other"]).optional(),
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

// ── Update Schemas ───────────────────────────────────
export const updateStoreSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  address: z.string().min(1).optional(),
  phone: z.string().nullish(),
  status: z.nativeEnum(StoreStatus).optional(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  deliveryRadius: z.number().positive().optional(),
});
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;

const emptyToNull = z.string().transform((v) => (v === "" ? null : v));
const optionalUrl = z.union([z.string().url(), z.literal(""), z.null()]).optional().transform((v) => (v === "" ? null : v));
const coerceNumberNullish = z.union([z.number(), z.string().transform((v) => v === "" ? null : Number(v)), z.null()]).optional();

export const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: emptyToNull.nullish(),
  imageUrl: optionalUrl,
  categoryId: z.string().uuid().nullish(),
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
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

export const updatePaymentStatusSchema = z.object({
  paymentStatus: z.enum(["PENDING", "PAID", "FAILED"]),
  note: z.string().max(500).optional(),
});
export type UpdatePaymentStatusInput = z.infer<typeof updatePaymentStatusSchema>;

export const bulkUpdateOrderStatusSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1).max(50),
  status: z.enum(["CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"]),
});
export type BulkUpdateOrderStatusInput = z.infer<typeof bulkUpdateOrderStatusSchema>;

// ── Collection ──────────────────────────────────────
export const createCollectionSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  imageUrl: z.string().url().optional(),
  organizationId: z.string().uuid().nullish(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  productIds: z.array(z.string().uuid()).optional(),
});
export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;

export const updateCollectionSchema = z.object({
  title: z.string().min(1).optional(),
  subtitle: z.string().nullish(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  imageUrl: z.string().url().nullish(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  productIds: z.array(z.string().uuid()).optional(),
});
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;

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
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional(),
  comment: z.string().max(2000).optional(),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  title: z.string().max(200).nullish(),
  comment: z.string().max(2000).nullish(),
});
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;

export const updateReviewStatusSchema = z.object({
  status: z.nativeEnum(ReviewStatus),
});
export type UpdateReviewStatusInput = z.infer<typeof updateReviewStatusSchema>;

// ── Wishlist ────────────────────────────────────────
export const toggleWishlistSchema = z.object({
  productId: z.string().uuid(),
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
});
export type CreateLoyaltyConfigInput = z.infer<typeof createLoyaltyConfigSchema>;

export const updateLoyaltyConfigSchema = z.object({
  isEnabled: z.boolean().optional(),
  earnRate: z.number().int().min(0).max(100).optional(),
  minRedeemPoints: z.number().int().min(0).optional(),
  maxRedeemPercentage: z.number().int().min(1).max(100).optional(),
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
});
export type CreateDeliveryTripInput = z.infer<typeof createDeliveryTripSchema>;

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
  placement: z.nativeEnum(BannerPlacement),
  actionType: z.nativeEnum(BannerActionType).default("NONE"),
  actionTarget: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().default(true),
  startsAt: z.coerce.date().nullish(),
  endsAt: z.coerce.date().nullish(),
  storeId: z.string().uuid().nullish(),
  organizationId: z.string().uuid().nullish(),
  categoryId: z.string().uuid().nullish(),
});
export type CreateBannerInput = z.infer<typeof createBannerSchema>;

export const updateBannerSchema = z.object({
  title: z.string().min(1).optional(),
  subtitle: z.string().nullish(),
  imageUrl: z.string().url().optional(),
  placement: z.nativeEnum(BannerPlacement).optional(),
  actionType: z.nativeEnum(BannerActionType).optional(),
  actionTarget: z.string().nullish(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  startsAt: z.coerce.date().nullish(),
  endsAt: z.coerce.date().nullish(),
  storeId: z.string().uuid().nullish(),
  categoryId: z.string().uuid().nullish(),
});
export type UpdateBannerInput = z.infer<typeof updateBannerSchema>;

// ── Notification ──────────────────────────────────
export const sendNotificationSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
  type: z.enum(["PROMOTIONAL", "GENERAL"]).default("PROMOTIONAL"),
  imageUrl: z.string().url().optional(),
  storeId: z.string().uuid().optional(),
  deepLinkType: z.enum(["product", "category", "store", "screen"]).optional(),
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
  deepLinkType: z.enum(["product", "category", "store", "screen"]).optional(),
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
