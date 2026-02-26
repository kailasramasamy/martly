import type { FastifyInstance } from "fastify";
import { createUserAddressSchema, updateUserAddressSchema } from "@martly/shared/schemas";
import type { ApiResponse } from "@martly/shared/types";
import { authenticate } from "../../middleware/auth.js";
import { geocodeAddress } from "../../lib/geo.js";

const MAX_ADDRESSES = 5;

export async function addressRoutes(app: FastifyInstance) {
  // List user's addresses
  app.get("/", { preHandler: [authenticate] }, async (request) => {
    const userId = (request.user as { sub: string }).sub;

    const addresses = await app.prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    const response: ApiResponse<typeof addresses> = { success: true, data: addresses };
    return response;
  });

  // Create address
  app.post("/", { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub;
    const body = createUserAddressSchema.parse(request.body);

    const count = await app.prisma.userAddress.count({ where: { userId } });
    if (count >= MAX_ADDRESSES) {
      return reply.badRequest(`Maximum ${MAX_ADDRESSES} addresses allowed`);
    }

    // If first address or isDefault requested, handle default logic
    const isDefault = count === 0 ? true : body.isDefault ?? false;

    // Auto-geocode if lat/lng not provided
    let { latitude, longitude, pincode } = body;
    if (latitude == null || longitude == null) {
      const geo = await geocodeAddress(body.address);
      if (geo) {
        latitude = geo.lat;
        longitude = geo.lng;
        if (!pincode && geo.pincode) pincode = geo.pincode;
      }
    }

    const address = await app.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.userAddress.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.userAddress.create({
        data: {
          userId,
          label: body.label,
          address: body.address,
          latitude,
          longitude,
          pincode,
          isDefault,
        },
      });
    });

    const response: ApiResponse<typeof address> = { success: true, data: address };
    return response;
  });

  // Update address
  app.put<{ Params: { id: string } }>("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub;
    const body = updateUserAddressSchema.parse(request.body);

    const existing = await app.prisma.userAddress.findUnique({ where: { id: request.params.id } });
    if (!existing || existing.userId !== userId) {
      return reply.notFound("Address not found");
    }

    // Auto-geocode if address changed but lat/lng not provided
    const updateData: Record<string, unknown> = { ...body };
    if (body.address && body.latitude == null && body.longitude == null) {
      const geo = await geocodeAddress(body.address);
      if (geo) {
        updateData.latitude = geo.lat;
        updateData.longitude = geo.lng;
        if (!body.pincode && geo.pincode) updateData.pincode = geo.pincode;
      }
    }

    const address = await app.prisma.$transaction(async (tx) => {
      if (body.isDefault === true) {
        await tx.userAddress.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.userAddress.update({
        where: { id: request.params.id },
        data: updateData,
      });
    });

    const response: ApiResponse<typeof address> = { success: true, data: address };
    return response;
  });

  // Delete address
  app.delete<{ Params: { id: string } }>("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const userId = (request.user as { sub: string }).sub;

    const existing = await app.prisma.userAddress.findUnique({ where: { id: request.params.id } });
    if (!existing || existing.userId !== userId) {
      return reply.notFound("Address not found");
    }

    await app.prisma.userAddress.delete({ where: { id: request.params.id } });

    // If deleted was default, promote next most recent
    if (existing.isDefault) {
      const next = await app.prisma.userAddress.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      if (next) {
        await app.prisma.userAddress.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }

    const response: ApiResponse<null> = { success: true, data: null };
    return response;
  });
}
