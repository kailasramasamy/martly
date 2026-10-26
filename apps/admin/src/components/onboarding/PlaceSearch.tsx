import { useEffect, useRef, useState } from "react";
import { AutoComplete, Input, Typography } from "antd";
import { SearchOutlined } from "@ant-design/icons";

import { onboardingApi } from "../../pages/onboarding/api";

const { Text } = Typography;

export interface PickedPlace { address: string; latitude: number; longitude: number }

/** Finds the shop on Google Places; picking a result fills the address and pins the map */
export function PlaceSearch({ onPick }: { onPick: (place: PickedPlace) => void }) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timer.current);
    if (query.trim().length < 3) return setOptions([]);
    timer.current = setTimeout(async () => {
      const results = await onboardingApi.searchPlaces(query).catch(() => []);
      setOptions(results.map((r) => ({ value: r.place_id, label: r.description })));
    }, 300);
    return () => clearTimeout(timer.current);
  }, [query]);

  const pick = async (placeId: string) => {
    setQuery("");
    onPick(await onboardingApi.placeDetails(placeId));
  };

  return (
    <AutoComplete value={query} options={options} onSearch={setQuery} onSelect={pick} style={{ width: "100%" }}>
      <Input prefix={<SearchOutlined />} placeholder="Search the shop or its street, e.g. Car Street Harur" />
    </AutoComplete>
  );
}

/** The pin and delivery reach on OpenStreetMap, to eyeball before launch */
export function MapPreview({ latitude, longitude, radiusKm }: { latitude?: number | null; longitude?: number | null; radiusKm: number }) {
  if (latitude == null || longitude == null) {
    return <Text type="secondary">Search for the shop above to place the pin.</Text>;
  }
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180));
  const bbox = [longitude - dLng, latitude - dLat, longitude + dLng, latitude + dLat].map((n) => n.toFixed(5)).join(",");
  return (
    <div>
      <iframe
        title="Store location"
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`}
        style={{ width: "100%", height: 260, border: 0, borderRadius: 8 }}
      />
      <Text type="secondary" style={{ fontSize: 12 }}>
        Map shows {radiusKm} km around the pin · {latitude.toFixed(5)}, {longitude.toFixed(5)}
      </Text>
    </div>
  );
}
