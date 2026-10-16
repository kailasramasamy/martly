import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import MapView, { PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";

interface PinMapProps {
  latitude: number;
  longitude: number;
  /** The map came to rest with the pin over a new spot */
  onMove: (latitude: number, longitude: number) => void;
  /** Fill the parent (full-screen picker) instead of a framed preview */
  fill?: boolean;
}

// Close enough to the last spot that the map only settled, not moved (about 5 m)
const SAME_SPOT = 0.00005;
const STREET_ZOOM = 0.004;
const PIN_SIZE = 40;

/**
 * Map with a pin fixed in the middle: the shopper drags the map until the pin sits on their door.
 * A new place from search or GPS recentres it; resting after a drag reports the spot under the pin.
 */
export function PinMap({ latitude, longitude, onMove, fill }: PinMapProps) {
  const mapRef = useRef<MapView>(null);
  const last = useRef({ latitude, longitude });

  useEffect(() => {
    const moved = Math.abs(latitude - last.current.latitude) > SAME_SPOT || Math.abs(longitude - last.current.longitude) > SAME_SPOT;
    last.current = { latitude, longitude };
    if (moved) mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: STREET_ZOOM, longitudeDelta: STREET_ZOOM }, 300);
  }, [latitude, longitude]);

  const settle = (region: Region) => {
    const same = Math.abs(region.latitude - last.current.latitude) < SAME_SPOT && Math.abs(region.longitude - last.current.longitude) < SAME_SPOT;
    if (same) return;
    last.current = { latitude: region.latitude, longitude: region.longitude };
    onMove(region.latitude, region.longitude);
  };

  return (
    <View style={fill ? styles.fill : styles.frame}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={{ latitude, longitude, latitudeDelta: STREET_ZOOM, longitudeDelta: STREET_ZOOM }}
        rotateEnabled={false}
        pitchEnabled={false}
        onRegionChangeComplete={settle}
      />
      {/* The pin's tip marks the centre, so the icon sits half its height above it */}
      <View style={styles.pin} pointerEvents="none">
        <Ionicons name="location" size={PIN_SIZE} color={colors.primary} />
      </View>
      <View style={[styles.hint, fill && styles.hintLow]} pointerEvents="none">
        <Text style={styles.hintText}>Move the map to place the pin on your door</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hintLow: { top: "50%", marginTop: -PIN_SIZE - 36 },
  frame: { height: 220, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: colors.border, marginTop: 8 },
  pin: { position: "absolute", left: "50%", top: "50%", marginLeft: -PIN_SIZE / 2, marginTop: -PIN_SIZE },
  hint: {
    position: "absolute", top: 8, alignSelf: "center", backgroundColor: "rgba(15,23,42,0.75)",
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
  },
  hintText: { fontFamily: fonts.semibold, fontSize: 11.5, color: "#fff" },
});
