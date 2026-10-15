import { View, Text, StyleSheet, Platform } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { fonts } from "../../../constants/theme";
import { manage } from "../ui/tokens";
import { FieldFrame } from "../ui/FieldFrame";

interface LocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onPick: (latitude: number, longitude: number) => void;
}

const INDIA = { latitude: 20.59, longitude: 78.96, latitudeDelta: 22, longitudeDelta: 22 };
const ZOOMED = 0.02;
const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** Tap the map to drop the store pin; coordinates feed the lat/lng fields above it */
export function LocationPicker({ latitude, longitude, onPick }: LocationPickerProps) {
  const hasPin = latitude !== null && longitude !== null && !Number.isNaN(latitude) && !Number.isNaN(longitude);
  const initialRegion = hasPin ? { latitude, longitude, latitudeDelta: ZOOMED, longitudeDelta: ZOOMED } : INDIA;
  return (
    <FieldFrame label="Pin on map" hint="Tap the map to set the store location">
      <View style={styles.frame}>
        <MapView
          style={styles.map}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
          initialRegion={initialRegion}
          rotateEnabled={false}
          onPress={(e) => onPick(round(e.nativeEvent.coordinate.latitude), round(e.nativeEvent.coordinate.longitude))}
        >
          {hasPin && (
            <Marker
              coordinate={{ latitude, longitude }}
              draggable
              onDragEnd={(e) => onPick(round(e.nativeEvent.coordinate.latitude), round(e.nativeEvent.coordinate.longitude))}
            />
          )}
        </MapView>
        {!hasPin && <View style={styles.badge} pointerEvents="none"><Text style={styles.badgeText}>No location set</Text></View>}
      </View>
    </FieldFrame>
  );
}

const styles = StyleSheet.create({
  frame: { height: 220, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: manage.line },
  map: { flex: 1 },
  badge: { position: "absolute", top: 10, left: 10, backgroundColor: manage.attentionBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontFamily: fonts.bold, fontSize: 12, color: manage.attentionText },
});
