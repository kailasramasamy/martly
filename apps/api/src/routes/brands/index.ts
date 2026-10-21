import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { randomUUID } from "crypto";
import { createBrandSchema, updateBrandSchema } from "@martly/shared/schemas";
import type { ApiResponse, BrandDirectory, BrandSegment, BrandSpotlight, BrandSummary, DirectoryBrand, DirectoryDepartment, PaginatedResponse } from "@martly/shared/types";
import { authenticate, authenticateOptional } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorize.js";
import { Permission } from "@martly/shared/constants";
import type { JwtUser } from "../../types/jwt.js";
import { brandVisibility, uniqueBrandSlug } from "../../services/brands.js";
import { cleanLogo } from "../../services/brand-logo.js";
import { putObject } from "../../services/media.js";
import { istDateKey } from "../../services/ist-day.js";

type Translations = DirectoryDepartment["translations"];
type DirectoryRow = DirectoryBrand & {
  deptId: string; deptName: string; deptTranslations: Translations;
  catId: string; catName: string; catTranslations: Translations;
};

// Rows arrive ordered by department, category, then brand rank: fold them into the nested directory
function buildDirectory(rows: DirectoryRow[]): BrandDirectory {
  const departments: DirectoryDepartment[] = [];
  const featured = new Map<string, DirectoryBrand>();
  for (const { deptId, deptName, deptTranslations, catId, catName, catTranslations, ...brand } of rows) {
    let dept = departments.at(-1);
    if (dept?.id !== deptId) departments.push(dept = { id: deptId, name: deptName, translations: deptTranslations, categories: [] });
    let cat = dept.categories.at(-1);
    if (cat?.id !== catId) dept.categories.push(cat = { id: catId, name: catName, translations: catTranslations, brands: [] });
    cat.brands.push(brand);
    if (brand.themeColor) {
      const seen = featured.get(brand.id);
      featured.set(brand.id, { ...brand, productCount: (seen?.productCount ?? 0) + brand.productCount });
    }
  }
  return {
    featured: [...featured.values()].sort((a, b) => b.productCount - a.productCount),
    departments,
    brandCount: new Set(rows.map((r) => r.id)).size,
  };
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Each KPI card counts one slice and lists the same slice when clicked, so the number always matches the rows
const SEGMENTS: Record<BrandSegment, () => Record<string, unknown>> = {
  brandStores: () => ({ themeColor: { not: null } }),
  withoutLogo: () => ({ imageUrl: null }),
  withoutProducts: () => ({ products: { none: {} } }),
  addedLast30d: () => ({ createdAt: { gte: new Date(Date.now() - THIRTY_DAYS_MS) } }),
};

// The tab bar rotates daily through this many of the store's best-known brand stores
const SPOTLIGHT_POOL = 5;

const isSegment = (value: string): value is BrandSegment => Object.hasOwn(SEGMENTS, value);

export async function brandRoutes(app: FastifyInstance) {
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
  // List brands (master brands plus the caller's organization's own)
  app.get("/", { preHandler: [authenticateOptional] }, async (request, reply) => {
    const { page = 1, pageSize = 50, q, segment } = request.query as {
      page?: number; pageSize?: number; q?: string; segment?: string;
    };
    const skip = (Number(page) - 1) * Number(pageSize);

    if (segment !== undefined && !isSegment(segment)) return reply.badRequest("Unknown brand segment");
    const where: Record<string, unknown> = {
      AND: [brandVisibility(request.user), segment === undefined ? {} : SEGMENTS[segment]()],
    };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
      ];
    }

    const [brands, total] = await Promise.all([
      app.prisma.brand.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: { name: "asc" },
        include: { _count: { select: { products: true } } },
      }),
      app.prisma.brand.count({ where }),
    ]);

    const response: PaginatedResponse<(typeof brands)[0]> = {
      success: true,
      data: brands,
      meta: { total, page: Number(page), pageSize: Number(pageSize), totalPages: Math.ceil(total / Number(pageSize)) },
    };
    return response;
  });

  // KPI counts for the admin brand list
  app.get("/summary", { preHandler: [authenticate] }, async (request) => {
    const visible = brandVisibility(request.user);
    const count = (segment?: BrandSegment) =>
      app.prisma.brand.count({ where: { AND: [visible, segment ? SEGMENTS[segment]() : {}] } });
    const [total, brandStores, withoutLogo, withoutProducts, addedLast30d] = await Promise.all([
      count(), count("brandStores"), count("withoutLogo"), count("withoutProducts"), count("addedLast30d"),
    ]);
    const response: ApiResponse<BrandSummary> = {
      success: true,
      data: { total, brandStores, withoutLogo, withoutProducts, addedLast30d },
    };
    return response;
  });

  // Brands with active listings in a store: brands with a brand store (theme colour) first, then most products — powers "Shop by brand"
  app.get<{ Params: { storeId: string } }>("/store/:storeId", async (request, reply) => {
    const store = await app.prisma.store.findUnique({ where: { id: request.params.storeId }, select: { id: true } });
    if (!store) return reply.notFound("Store not found");
    const limit = Math.min(Math.max(Number((request.query as { limit?: string }).limit) || 50, 1), 200);

    const brands = await app.prisma.$queryRaw<{ id: string; name: string; imageUrl: string | null; themeColor: string | null; productCount: number }[]>`
      SELECT b.id, b.name, b.image_url AS "imageUrl", b.theme_color AS "themeColor", COUNT(DISTINCT p.id)::int AS "productCount"
      FROM store_products sp
      JOIN products p ON p.id = sp.product_id
      JOIN brands b ON b.id = p.brand_id
      WHERE sp.store_id = ${store.id} AND sp.is_active = true AND p.is_active = true
      GROUP BY b.id
      ORDER BY (b.theme_color IS NOT NULL) DESC, "productCount" DESC, b.name ASC
      LIMIT ${limit}`;

    const response: ApiResponse<typeof brands> = { success: true, data: brands };
    return response;
  });

  // A store's brands by department → category, for the "All brands" screen
  app.get<{ Params: { storeId: string } }>("/store/:storeId/directory", async (request, reply) => {
    const store = await app.prisma.store.findUnique({ where: { id: request.params.storeId }, select: { id: true } });
    if (!store) return reply.notFound("Store not found");

    const rows = await app.prisma.$queryRaw<DirectoryRow[]>`
      SELECT d.id AS "deptId", d.name AS "deptName", d.translations AS "deptTranslations",
        c.id AS "catId", c.name AS "catName", c.translations AS "catTranslations",
        b.id, b.name, b.image_url AS "imageUrl", b.theme_color AS "themeColor",
        b.theme_color_secondary AS "themeColorSecondary", COUNT(DISTINCT p.id)::int AS "productCount",
        (array_agg(p.image_url ORDER BY COALESCE(sales.qty, 0) DESC, sp.stock DESC, p.id)
          FILTER (WHERE b.image_url IS NULL AND p.image_url IS NOT NULL))[1] AS "coverImageUrl"
      FROM store_products sp
      JOIN products p ON p.id = sp.product_id
      JOIN brands b ON b.id = p.brand_id
      JOIN subcategories s ON s.id = p.subcategory_id
      JOIN categories c ON c.id = s.category_id
      JOIN departments d ON d.id = c.department_id
      LEFT JOIN (
        SELECT oi.product_id, SUM(oi.quantity) AS qty
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.store_id = ${store.id} AND o.status <> 'CANCELLED' AND o.created_at > now() - interval '30 days'
        GROUP BY oi.product_id
      ) sales ON sales.product_id = p.id
      WHERE sp.store_id = ${store.id} AND sp.is_active = true AND p.is_active = true
      GROUP BY d.id, c.id, b.id
      ORDER BY d.sort_order, d.name, c.sort_order, c.name,
        (b.theme_color IS NOT NULL) DESC, "productCount" DESC, b.name`;

    const response: ApiResponse<BrandDirectory> = { success: true, data: buildDirectory(rows) };
    return response;
  });

  // One brand store for the shopper tab bar: the store's best-known stocked brands, rotating each day
  app.get<{ Params: { storeId: string } }>("/store/:storeId/spotlight", async (request) => {
    const pool = await app.prisma.$queryRaw<BrandSpotlight[]>`
      SELECT b.id, b.name, b.image_url AS "imageUrl"
      FROM brands b
      WHERE b.theme_color IS NOT NULL AND b.image_url IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM store_products sp JOIN products p ON p.id = sp.product_id
          WHERE sp.store_id = ${request.params.storeId} AND sp.is_active = true AND p.is_active = true AND p.brand_id = b.id
        )
      ORDER BY b.popularity DESC, b.name
      LIMIT ${SPOTLIGHT_POOL}`;
    const day = Math.floor(new Date(istDateKey(new Date())).getTime() / 86_400_000);
    const response: ApiResponse<BrandSpotlight | null> = { success: true, data: pool.length ? pool[day % pool.length] : null };
    return response;
  });

  // Get brand by ID
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const brand = await app.prisma.brand.findUnique({
      where: { id: request.params.id },
    });
    if (!brand) return reply.notFound("Brand not found");

    const response: ApiResponse<typeof brand> = { success: true, data: brand };
    return response;
  });

  /** Why the caller can't change this brand: master brands belong to the platform, local brands to their organization */
  function ownershipDenial(user: JwtUser, brand: { organizationId: string | null }): string | null {
    if (brand.organizationId === null) return user.role === "SUPER_ADMIN" ? null : "Only the platform admin can change master brands";
    return brand.organizationId === user.organizationId ? null : "Access denied";
  }

  // Create brand (platform admin → master brand, catalog editors → their organization's local brand)
  // Clean up an uploaded logo (background removed unless already clean, trimmed) and suggest brand colours from it
  app.post(
    "/logo",
    { preHandler: [authenticate, requirePermission(Permission.CATALOG_BRANDS)] },
    async (request, reply) => {
      const file = await request.file();
      if (!file) return reply.badRequest("No file uploaded");
      // ?removeBackground=false keeps a logo that's already clean as it is
      const { removeBackground } = request.query as { removeBackground?: string };
      const logo = await cleanLogo(await file.toBuffer(), removeBackground !== "false");
      const { url } = await putObject(`brands/${randomUUID()}.png`, logo.image, "image/png");
      const data = { imageUrl: url, themeColor: logo.themeColor, themeColorSecondary: logo.themeColorSecondary, background: logo.background };
      return { success: true, data } satisfies ApiResponse<typeof data>;
    },
  );

  app.post(
    "/",
    { preHandler: [authenticate, requirePermission(Permission.CATALOG_BRANDS)] },
    async (request, reply) => {
      const { slug, popularity, ...body } = createBrandSchema.parse(request.body);
      const isPlatform = request.user.role === "SUPER_ADMIN";
      if (!isPlatform && !request.user.organizationId) return reply.badRequest("Select an organization first");
      if (slug && (await app.prisma.brand.findUnique({ where: { slug } }))) return reply.conflict("That slug is already taken");

      const brand = await app.prisma.brand.create({
        data: {
          ...body,
          slug: slug ?? (await uniqueBrandSlug(app.prisma, body.name)),
          // Popularity drives search ranking across every store, so only the platform sets it
          popularity: isPlatform ? popularity : undefined,
          organizationId: isPlatform ? null : request.user.organizationId,
        },
      });

      const response: ApiResponse<typeof brand> = { success: true, data: brand };
      return response;
    },
  );

  // Update brand
  app.put<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requirePermission(Permission.CATALOG_BRANDS)] },
    async (request, reply) => {
      const { popularity, ...body } = updateBrandSchema.parse(request.body);
      const existing = await app.prisma.brand.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.notFound("Brand not found");
      const denied = ownershipDenial(request.user, existing);
      if (denied) return reply.forbidden(denied);

      const brand = await app.prisma.brand.update({
        where: { id: request.params.id },
        data: { ...body, popularity: request.user.role === "SUPER_ADMIN" ? popularity : undefined },
      });

      const response: ApiResponse<typeof brand> = { success: true, data: brand };
      return response;
    },
  );

  // Delete brand (only if no products reference it)
  app.delete<{ Params: { id: string } }>(
    "/:id",
    { preHandler: [authenticate, requirePermission(Permission.CATALOG_BRANDS)] },
    async (request, reply) => {
      const existing = await app.prisma.brand.findUnique({
        where: { id: request.params.id },
        include: { _count: { select: { products: true } } },
      });
      if (!existing) return reply.notFound("Brand not found");
      const denied = ownershipDenial(request.user, existing);
      if (denied) return reply.forbidden(denied);
      if (existing._count.products > 0) return reply.conflict("Brand has products — remove them first");

      await app.prisma.brand.delete({ where: { id: request.params.id } });

      const response: ApiResponse<null> = { success: true, data: null };
      return response;
    },
  );
}
