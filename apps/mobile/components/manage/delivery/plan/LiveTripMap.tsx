import { useRef } from "react";
import { Modal, View, Text, TouchableOpacity, Platform, StyleSheet } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../../../constants/theme";
import { tabular } from "../../ui/tokens";
import { lastSeenText } from "./format";
import type { TripRoute } from "../../rider/types";
import type { PlanTrip } from "./types";

interface LiveTripMapProps {
  trip: PlanTrip | null;
  route: TripRoute | null;
  onClose: () => void;
}

const EDGE = { top: 140, right: 60, bottom: 80, left: 60 };

/** Where the rider is now, the road ahead and the stops still to do, numbered in route order */
export function LiveTripMap({ trip, route, onClose }: LiveTripMapProps) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const stops = (trip?.stops ?? [])
    .map((s, i) => ({ stop: s, number: i + 1 }))
    .filter(({ stop }) => stop.status === "OUT_FOR_DELIVERY" && stop.deliveryLat != null && stop.deliveryLng != null);
  const rider = trip?.live ? { latitude: trip.live.lat, longitude: trip.live.lng } : null;
  const points = [...(rider ? [rider] : []), ...stops.map(({ stop }) => ({ latitude: stop.deliveryLat as number, longitude: stop.deliveryLng as number }))];
  const line = (route?.polyline ?? []).map((p) => ({ latitude: p.lat, longitude: p.lng }));

  return (
    <Modal visible={!!trip} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.root}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
          onMapReady={() => points.length > 0 && mapRef.current?.fitToCoordinates(points, { edgePadding: EDGE, animated: false })}
        >
          {line.length > 1 && <Polyline coordinates={line} strokeColor={colors.primary} strokeWidth={4} />}
          {stops.map(({ stop, number }) => (
            <Marker key={stop.id} coordinate={{ latitude: stop.deliveryLat as number, longitude: stop.deliveryLng as number }} title={stop.user.name} description={stop.deliveryAddress ?? undefined}>
              <View style={styles.stop}><Text style={[styles.stopText, tabular]}>{number}</Text></View>
            </Marker>
          ))}
          {rider && (
            <Marker coordinate={rider} title={trip?.rider?.name} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.rider}><Ionicons name="bicycle" size={18} color="#fff" /></View>
            </Marker>
          )}
        </MapView>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.back} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close map">
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headText}>
            <Text style={styles.title} numberOfLines={1}>{trip?.rider?.name ?? "Rider"}</Text>
            <Text style={[styles.sub, tabular]} numberOfLines={1}>
              {lastSeenText(trip?.live ?? null)} · {stops.length} stop{stops.length === 1 ? "" : "s"} left
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#e2e8f0" },
  header: {
    position: "absolute", left: 0, right: 0, top: 0, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingBottom: 12,
    backgroundColor: "#fff", shadowColor: "#0f172a", shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headText: { flex: 1 },
  title: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text },
  sub: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textSecondary, marginTop: 1 },
  stop: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#fff", borderWidth: 2, borderColor: colors.primary, alignItems: "center", justifyContent: "center" },
  stopText: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.primary },
  rider: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#6d28d9", borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
});
