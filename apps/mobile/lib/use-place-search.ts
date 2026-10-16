import { useCallback, useRef, useState } from "react";
import { api } from "./api";

export interface PlaceResult {
  address: string;
  latitude: number;
  longitude: number;
  pincode?: string | null;
  placeName?: string | null;
}

export interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting?: { main_text: string; secondary_text?: string };
}

// Wait for a real pause in typing before asking for suggestions
const TYPING_PAUSE_MS = 600;

/** Address suggestions as the shopper types, preferring places near `near` (e.g. their store) */
export function usePlaceSearch(near: { latitude: number; longitude: number } | null) {
  const [query, setQueryState] = useState("");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Only the reply for the latest text may update the list; a slow earlier one must not overwrite it
  const latest = useRef("");

  const fetchFor = useCallback(async (text: string) => {
    if (text.length < 3) return setPredictions([]);
    const bias = near ? `&lat=${near.latitude}&lng=${near.longitude}` : "";
    const res = await api.get<PlacePrediction[]>(`/api/v1/places/autocomplete?input=${encodeURIComponent(text)}${bias}`).catch(() => null);
    if (text === latest.current) setPredictions(res?.data ?? []);
  }, [near]);

  const setQuery = useCallback((text: string) => {
    setQueryState(text);
    latest.current = text;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fetchFor(text), TYPING_PAUSE_MS);
  }, [fetchFor]);

  const clear = useCallback(() => {
    setQueryState("");
    latest.current = "";
    setPredictions([]);
  }, []);

  return { query, setQuery, predictions, clear };
}

/** The coordinates and address of a picked suggestion */
export async function placeDetails(prediction: PlacePrediction): Promise<PlaceResult | null> {
  const res = await api.get<PlaceResult>(`/api/v1/places/details?place_id=${prediction.place_id}`).catch(() => null);
  if (!res?.data) return null;
  return { ...res.data, placeName: prediction.structured_formatting?.main_text ?? prediction.description.split(",")[0] };
}

/** The address under a point on the map; null when it can't be looked up */
export async function addressAt(latitude: number, longitude: number): Promise<PlaceResult | null> {
  const res = await api.get<PlaceResult | null>(`/api/v1/places/reverse-geocode?lat=${latitude}&lng=${longitude}`).catch(() => null);
  return res?.data ? { ...res.data, latitude, longitude } : null;
}
