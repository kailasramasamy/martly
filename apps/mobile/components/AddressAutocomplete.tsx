import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  ScrollView,
} from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { colors, spacing } from "../constants/theme";

interface AddressResult {
  address: string;
  latitude: number;
  longitude: number;
  pincode?: string;
  placeName?: string;
}

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text?: string;
  };
}

interface Props {
  onSelect: (result: AddressResult) => void;
  placeholder?: string;
  initialValue?: string;
}

export function AddressAutocomplete({ onSelect, placeholder, initialValue }: Props) {
  const [query, setQuery] = useState(initialValue ?? "");
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPredictions = useCallback(async (text: string) => {
    if (text.length < 3) {
      setPredictions([]);
      return;
    }

    try {
      const res = await api.get<PlacePrediction[]>(`/api/v1/places/autocomplete?input=${encodeURIComponent(text)}`);
      const results = res.data ?? [];
      setPredictions(results);
      if (results.length > 0) Keyboard.dismiss();
    } catch {
      setPredictions([]);
    }
  }, []);

  const handleTextChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(text), 300);
  };

  const handleSelectPlace = async (prediction: PlacePrediction) => {
    setLoading(true);
    setPredictions([]);
    setQuery(prediction.description);

    const placeName = prediction.structured_formatting?.main_text
      ?? prediction.description.split(",")[0];

    try {
      const res = await api.get<AddressResult>(`/api/v1/places/details?place_id=${prediction.place_id}`);
      onSelect({
        ...res.data,
        placeName,
      });
    } catch {
      onSelect({ address: prediction.description, latitude: 0, longitude: 0, placeName });
    } finally {
      setLoading(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;

      try {
        const res = await api.get<AddressResult>(`/api/v1/places/reverse-geocode?lat=${latitude}&lng=${longitude}`);
        if (res.data) {
          setQuery(res.data.address);
          onSelect(res.data);
          setLocLoading(false);
          return;
        }
      } catch {
        // fall through to expo-location fallback
      }

      // Fallback to expo-location reverse geocode
      const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (geo) {
        const addr = [geo.name, geo.street, geo.city, geo.region, geo.postalCode].filter(Boolean).join(", ");
        setQuery(addr);
        onSelect({ address: addr, latitude, longitude, pincode: geo.postalCode ?? undefined });
      }
    } catch {
      // silently fail
    } finally {
      setLocLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleTextChange}
          placeholder={placeholder ?? "Search for an address..."}
          placeholderTextColor="#94a3b8"
        />
        {loading && <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />}
      </View>

      <TouchableOpacity
        style={styles.locationBtn}
        onPress={handleUseCurrentLocation}
        disabled={locLoading}
        activeOpacity={0.7}
      >
        {locLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="navigate" size={16} color={colors.primary} />
        )}
        <Text style={styles.locationText}>Use current location</Text>
      </TouchableOpacity>

      {predictions.length > 0 && (
        <ScrollView style={styles.dropdown} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {predictions.map((item) => (
            <TouchableOpacity
              key={item.place_id}
              style={styles.predictionRow}
              onPress={() => handleSelectPlace(item)}
              activeOpacity={0.6}
            >
              <Ionicons name="location-outline" size={16} color="#64748b" />
              <Text style={styles.predictionText} numberOfLines={2}>{item.description}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "relative" },
  inputRow: { flexDirection: "row", alignItems: "center" },
  input: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  spinner: { position: "absolute", right: 12 },
  locationBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  locationText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  dropdown: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 280,
    marginTop: 4,
  },
  predictionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  predictionText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
});
