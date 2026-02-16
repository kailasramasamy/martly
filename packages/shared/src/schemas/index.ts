import { z } from "zod";
import { UserRole, StoreStatus, OrderStatus, PaymentStatus, UnitType, FoodType, ProductType, StorageType, DiscountType } from "../constants/index.js";

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
  discountType: z.nativeEnum(DiscountType).nullish(),
  discountValue: z.number().min(0).nullish(),
  discountStart: z.coerce.date().nullish(),
  discountEnd: z.coerce.date().nullish(),
});
export type UpdateStoreProductInput = z.infer<typeof updateStoreProductSchema>;

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
  deliveryAddress: z.string().min(1),
  items: z.array(orderItemSchema).optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Order = z.infer<typeof orderSchema>;

export const createOrderSchema = z.object({
  storeId: z.string().uuid(),
  deliveryAddress: z.string().min(1),
  items: z.array(
    z.object({
      storeProductId: z.string().uuid(),
      quantity: z.number().int().positive(),
    }),
  ),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// ── Update Schemas ───────────────────────────────────
export const updateStoreSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  address: z.string().min(1).optional(),
  phone: z.string().nullish(),
  status: z.nativeEnum(StoreStatus).optional(),
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
