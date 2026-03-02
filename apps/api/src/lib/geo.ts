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

// ── Google Directions API ────────────────────────

/** Decode a Google Maps encoded polyline string into coordinate array */
export function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

export interface DirectionsLeg {
  durationSeconds: number;
  distanceMeters: number;
}

export interface DirectionsResult {
  polyline: Array<{ lat: number; lng: number }>;
  legs: DirectionsLeg[];
  totalDurationSeconds: number;
  totalDistanceMeters: number;
}

/** Fetch driving directions from Google Routes API (new) */
export async function getDirectionsRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  waypoints?: Array<{ lat: number; lng: number }>,
): Promise<DirectionsResult | null> {
  const key = getGoogleMapsKey();
  if (!key) return null;

  const body: Record<string, unknown> = {
    origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
    destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    computeAlternativeRoutes: false,
  };

  if (waypoints && waypoints.length > 0) {
    body.intermediates = waypoints.map((w) => ({
      location: { latLng: { latitude: w.lat, longitude: w.lng } },
    }));
  }

  const fieldMask = "routes.polyline.encodedPolyline,routes.legs.duration,routes.legs.distanceMeters";

  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": fieldMask,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as {
    routes?: Array<{
      polyline: { encodedPolyline: string };
      legs: Array<{
        duration: string; // e.g. "300s"
        distanceMeters: number;
      }>;
    }>;
    error?: { message: string };
  };

  if (!data.routes?.[0]) return null;

  const route = data.routes[0];
  const polyline = decodePolyline(route.polyline.encodedPolyline);
  const legs = route.legs.map((leg) => ({
    durationSeconds: parseInt(leg.duration) || 0,
    distanceMeters: leg.distanceMeters || 0,
  }));

  return {
    polyline,
    legs,
    totalDurationSeconds: legs.reduce((sum, l) => sum + l.durationSeconds, 0),
    totalDistanceMeters: legs.reduce((sum, l) => sum + l.distanceMeters, 0),
  };
}
