import { z } from "zod";
import { UserRole, StoreStatus, OrderStatus, PaymentStatus } from "../constants/index.js";

// ── Auth ──────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof loginSchema>;

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

// ── Product ───────────────────────────────────────────
export const productSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  sku: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Product = z.infer<typeof productSchema>;

export const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  sku: z.string().optional(),
  imageUrl: z.string().url().optional(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

// ── Order ─────────────────────────────────────────────
export const orderItemSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  storeProductId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  totalPrice: z.number().positive(),
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
