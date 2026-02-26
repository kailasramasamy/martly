/**
 * Geo utilities — Haversine formula + Google Maps geocoding
 */

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Calculate distance between two lat/lng points in km using Haversine formula */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c * 100) / 100; // round to 2 decimals
}

function getGoogleMapsKey(): string | undefined {
  return process.env.GOOGLE_MAPS_API_KEY;
}

/** Geocode an address string to coordinates via Google Maps Geocoding API */
export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number; pincode?: string } | null> {
  const key = getGoogleMapsKey();
  if (!key) return null;

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
  const res = await fetch(url);
  const data = (await res.json()) as {
    status: string;
    results: Array<{
      geometry: { location: { lat: number; lng: number } };
      address_components: Array<{ types: string[]; long_name: string }>;
    }>;
  };

  if (data.status !== "OK" || !data.results[0]) return null;

  const result = data.results[0];
  const pinComp = result.address_components.find((c) => c.types.includes("postal_code"));

  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    pincode: pinComp?.long_name,
  };
}

/** Reverse geocode coordinates to address + pincode */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ formattedAddress: string; pincode?: string } | null> {
  const key = getGoogleMapsKey();
  if (!key) return null;

  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`;
  const res = await fetch(url);
  const data = (await res.json()) as {
    status: string;
    results: Array<{
      formatted_address: string;
      address_components: Array<{ types: string[]; long_name: string }>;
    }>;
  };

  if (data.status !== "OK" || !data.results[0]) return null;

  const result = data.results[0];
  const pinComp = result.address_components.find((c) => c.types.includes("postal_code"));

  return {
    formattedAddress: result.formatted_address,
    pincode: pinComp?.long_name,
  };
}
