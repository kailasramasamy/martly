import type { FastifyInstance } from "fastify";
import { authenticate } from "../../middleware/auth.js";

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY ?? "";
const NEARBY_RADIUS_M = 30_000;
// A leading Open Location Code such as "67Q7+5P, "
const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{0,3},?\s*/;

export async function placesRoutes(app: FastifyInstance) {
  // ── Autocomplete ─────────────────────────────────
  app.get("/autocomplete", { preHandler: [authenticate] }, async (request, reply) => {
    const { input, lat, lng } = request.query as { input?: string; lat?: string; lng?: string };
    if (!input || input.length < 3) return { success: true, data: [] };
    if (!GOOGLE_API_KEY) return reply.badRequest("Google Maps API key not configured");

    // Prefer places around where the shopper is (or the store they shop at), so a local street beats a namesake across the country
    const near = lat && lng && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng)) ? `&location=${Number(lat)},${Number(lng)}&radius=${NEARBY_RADIUS_M}` : "";
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&components=country:in${near}&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      predictions: Array<{
        place_id: string;
        description: string;
        structured_formatting?: { main_text: string; secondary_text?: string };
      }>;
    };

    return { success: true, data: data.predictions ?? [] };
  });

  // ── Place details ────────────────────────────────
  app.get("/details", { preHandler: [authenticate] }, async (request, reply) => {
    const { place_id } = request.query as { place_id?: string };
    if (!place_id) return reply.badRequest("place_id is required");
    if (!GOOGLE_API_KEY) return reply.badRequest("Google Maps API key not configured");

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=geometry,formatted_address,address_components&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      result: {
        formatted_address: string;
        geometry: { location: { lat: number; lng: number } };
        address_components: Array<{ types: string[]; long_name: string }>;
      };
    };

    const result = data.result;
    const pinComp = result.address_components.find((c) => c.types.includes("postal_code"));

    return {
      success: true,
      data: {
        address: result.formatted_address,
        latitude: result.geometry.location.lat,
        longitude: result.geometry.location.lng,
        pincode: pinComp?.long_name ?? null,
      },
    };
  });

  // ── Reverse geocode ──────────────────────────────
  app.get("/reverse-geocode", { preHandler: [authenticate] }, async (request, reply) => {
    const { lat, lng } = request.query as { lat?: string; lng?: string };
    if (!lat || !lng) return reply.badRequest("lat and lng are required");
    if (!GOOGLE_API_KEY) return reply.badRequest("Google Maps API key not configured");

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      results: Array<{
        formatted_address: string;
        types: string[];
        address_components: Array<{ types: string[]; long_name: string }>;
      }>;
    };

    if (data.status !== "OK" || !data.results[0]) {
      return { success: true, data: null };
    }

    // Google often puts a plus code ("67Q7+5P") first; shoppers and riders need a street or area name
    const result = data.results.find((r) => !r.types.includes("plus_code") && !PLUS_CODE.test(r.formatted_address)) ?? data.results[0];
    const pinComp = result.address_components.find((c) => c.types.includes("postal_code"));
    const neighborhood = result.address_components.find((c) =>
      c.types.includes("sublocality_level_1") || c.types.includes("neighborhood"),
    );
    const locality = result.address_components.find((c) => c.types.includes("locality"));

    return {
      success: true,
      data: {
        address: result.formatted_address.replace(PLUS_CODE, ""),
        latitude: Number(lat),
        longitude: Number(lng),
        pincode: pinComp?.long_name ?? null,
        placeName: neighborhood?.long_name ?? locality?.long_name ?? null,
      },
    };
  });
}
