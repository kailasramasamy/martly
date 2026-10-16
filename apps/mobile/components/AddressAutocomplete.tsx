import { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/theme";
import { useStore } from "../lib/store-context";
import { LocationPickerModal } from "./location/LocationPickerModal";
import type { PlaceResult } from "../lib/use-place-search";

interface AddressResult {
  address: string;
  latitude: number;
  longitude: number;
  pincode?: string;
  placeName?: string;
}

interface Props {
  onSelect: (result: AddressResult) => void;
  placeholder?: string;
  initialValue?: string;
}

// Centre of India, when neither the shopper nor their store has a location yet
const INDIA = { latitude: 20.59, longitude: 78.96 };

/**
 * The address field: shows the chosen place and opens a full-screen map to search and pin the exact spot.
 * The pin's coordinates are what get saved, so riders navigate to the door, not just the area.
 */
export function AddressAutocomplete({ onSelect, placeholder, initialValue }: Props) {
  const { userLocation, selectedStore } = useStore();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<PlaceResult | null>(null);
  const label = chosen?.address || initialValue || "";

  // Open where it's most likely right: the last pin, the shopper's location, then their store's area
  const start = useMemo(() => {
    if (chosen) return { latitude: chosen.latitude, longitude: chosen.longitude };
    if (userLocation) return userLocation;
    if (selectedStore?.latitude != null && selectedStore.longitude != null) return { latitude: selectedStore.latitude, longitude: selectedStore.longitude };
    return INDIA;
  }, [chosen, userLocation, selectedStore?.latitude, selectedStore?.longitude]);

  const confirm = (place: PlaceResult) => {
    setChosen(place);
    setOpen(false);
    onSelect({
      address: place.address, latitude: place.latitude, longitude: place.longitude,
      pincode: place.pincode ?? undefined, placeName: place.placeName ?? undefined,
    });
  };

  return (
    <View>
      <TouchableOpacity style={styles.field} onPress={() => setOpen(true)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={label ? `Address: ${label}. Change on map` : "Pick your address on the map"}>
        <Ionicons name={label ? "location" : "map-outline"} size={18} color={colors.primary} />
        <Text style={[styles.text, !label && styles.placeholder]} numberOfLines={2}>
          {label || placeholder || "Search or pick on map"}
        </Text>
        <Text style={styles.action}>{label ? "Change" : "Open map"}</Text>
      </TouchableOpacity>
      <LocationPickerModal visible={open} start={start} onClose={() => setOpen(false)} onConfirm={confirm} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: colors.border,
  },
  text: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 19 },
  placeholder: { color: "#94a3b8" },
  action: { fontSize: 13, fontWeight: "700", color: colors.primary },
});
