import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import { PinMap } from "../PinMap";
import { PickerSearch } from "./PickerSearch";
import { addressAt, placeDetails, usePlaceSearch, type PlacePrediction, type PlaceResult } from "../../lib/use-place-search";

type Point = { latitude: number; longitude: number };

interface LocationPickerModalProps {
  visible: boolean;
  /** Where to open: the current pick, else the shopper's store area */
  start: Point;
  onClose: () => void;
  onConfirm: (place: PlaceResult) => void;
}

/** The pin's spot and the address under it, looked up once the map settles */
function usePinnedSpot(start: Point) {
  const [spot, setSpot] = useState<Point>(start);
  const [place, setPlace] = useState<PlaceResult | null>(null);
  const [locating, setLocating] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const moveTo = useCallback((latitude: number, longitude: number) => {
    setSpot({ latitude, longitude });
    setLocating(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const found = await addressAt(latitude, longitude);
      // Without an address the pin still counts; the shopper adds house details on the next step
      setPlace(found ?? { address: "", latitude, longitude });
      setLocating(false);
    }, 400);
  }, []);

  const jumpTo = useCallback((found: PlaceResult) => {
    setSpot({ latitude: found.latitude, longitude: found.longitude });
    setPlace(found);
  }, []);

  return { spot, place, locating, moveTo, jumpTo };
}

/** Full-screen map to find the delivery spot: search or drag, then confirm the address under the pin */
export function LocationPickerModal({ visible, start, onClose, onConfirm }: LocationPickerModalProps) {
  const insets = useSafeAreaInsets();
  const { spot, place, locating, moveTo, jumpTo } = usePinnedSpot(start);
  const search = usePlaceSearch(start);

  useEffect(() => {
    if (visible) moveTo(start.latitude, start.longitude);
  }, [visible, start.latitude, start.longitude, moveTo]);

  const pick = async (p: PlacePrediction) => {
    search.clear();
    const found = await placeDetails(p);
    if (found) jumpTo(found);
  };

  const locateMe = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    const here = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    moveTo(here.coords.latitude, here.coords.longitude);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.root}>
        <PinMap fill latitude={spot.latitude} longitude={spot.longitude} onMove={moveTo} />
        <View style={[styles.searchSlot, { top: insets.top + 8 }]}>
          <PickerSearch query={search.query} onQuery={search.setQuery} onClear={search.clear} predictions={search.predictions} onPick={pick} onBack={onClose} />
        </View>
        <PickerFooter place={place} locating={locating} bottom={insets.bottom} onLocate={locateMe} onConfirm={() => place && onConfirm(place)} />
      </View>
    </Modal>
  );
}

function PickerFooter({ place, locating, bottom, onLocate, onConfirm }: { place: PlaceResult | null; locating: boolean; bottom: number; onLocate: () => void; onConfirm: () => void }) {
  const t = useStrings("search");
  const title = place?.placeName || place?.address.split(",")[0] || t.pinnedLocation;
  return (
    <>
      <TouchableOpacity style={styles.locate} onPress={onLocate} accessibilityRole="button" accessibilityLabel={t.useMyLocation}>
        <Ionicons name="locate" size={20} color={colors.primary} />
        <Text style={styles.locateText}>{t.currentLocation}</Text>
      </TouchableOpacity>
      <View style={[styles.footer, { paddingBottom: Math.max(bottom, 16) }]}>
        <Text style={styles.label}>{t.deliverTo}</Text>
        {locating ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : (
          <>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {place?.address ? <Text style={styles.address} numberOfLines={2}>{place.address}</Text> : null}
          </>
        )}
        <TouchableOpacity style={[styles.confirm, (!place || locating) && styles.confirmOff]} onPress={onConfirm} disabled={!place || locating} accessibilityRole="button">
          <Text style={styles.confirmText}>{t.confirmLocation}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#e2e8f0" },
  searchSlot: { position: "absolute", left: 0, right: 0 },
  locate: {
    position: "absolute", right: 16, bottom: 210, flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: 12,
    borderRadius: 20, backgroundColor: "#fff", shadowColor: "#0f172a", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  locateText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 18, shadowColor: "#0f172a", shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 10,
  },
  label: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.6 },
  loading: { alignSelf: "flex-start", marginVertical: 14 },
  title: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginTop: 4 },
  address: { fontFamily: fonts.regular, fontSize: 13.5, color: colors.textSecondary, marginTop: 2, lineHeight: 19 },
  confirm: { height: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: 16 },
  confirmOff: { opacity: 0.5 },
  confirmText: { fontFamily: fonts.bold, fontSize: 16, color: "#fff" },
});
