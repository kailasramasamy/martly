import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Linking,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { api } from "../lib/api";
import { colors, spacing, fontSize } from "../constants/theme";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:7001";
const WS_URL = API_URL.replace(/^http/, "ws");

const ROUTE_TEAL = "#0d9488";
const STOP_GRAY = "#94a3b8";
const STOP_RED = "#ef4444";

interface RemainingStop {
  sequence: number;
  lat: number;
  lng: number;
  isYourStop: boolean;
}

interface TrackingData {
  tripId: string;
  tripStatus: string;
  rider: { id: string; name: string; phone: string } | null;
  location: {
    lat: number;
    lng: number;
    heading: number | null;
    speed: number | null;
    updatedAt: string;
  } | null;
  store: { name: string; latitude: number | null; longitude: number | null } | null;
  deliveryAddress: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  remainingStops: RemainingStop[];
  customerStopNumber: number | null;
  totalStops: number;
}

interface RouteData {
  polyline: Array<{ lat: number; lng: number }>;
  legs: Array<{ durationSeconds: number; distanceMeters: number }>;
  totalDurationSeconds: number;
  totalDistanceMeters: number;
}

export default function LiveTrackingScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();

  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const mapRef = useRef<MapView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const routeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasInitialFit = useRef(false);
  const hadLocationRef = useRef(false);

  // Pulsing animation for live indicator
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const fetchTracking = useCallback(async () => {
    if (!orderId) { setLoading(false); return; }
    try {
      const res = await api.get<TrackingData>(`/api/v1/rider-location/by-order/${orderId}`);
      if (res.data) {
        setTracking(res.data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const fetchRoute = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await api.get<RouteData>(`/api/v1/rider-location/route/by-order/${orderId}`);
      if (res.data) {
        setRouteData(res.data);
      }
    } catch {
      // silently fail — map works without polyline
    }
  }, [orderId]);

  useEffect(() => {
    fetchTracking();
  }, [fetchTracking]);

  // Fetch route when rider location first becomes available, then every 45s
  useEffect(() => {
    if (!tracking?.location) return;

    // On first location, fetch route immediately
    if (!hadLocationRef.current) {
      hadLocationRef.current = true;
      fetchRoute();
    }

    // Set up 45s interval (re-created only when tripId changes)
    if (!routeIntervalRef.current) {
      routeIntervalRef.current = setInterval(fetchRoute, 45_000);
    }
  }, [tracking?.location, fetchRoute]);

  // Clean up route interval on unmount or trip change
  useEffect(() => {
    return () => {
      if (routeIntervalRef.current) {
        clearInterval(routeIntervalRef.current);
        routeIntervalRef.current = null;
      }
    };
  }, [tracking?.tripId]);

  // Connect to WebSocket for real-time location updates
  useEffect(() => {
    if (!tracking?.tripId) return;

    let ws: WebSocket | null = null;

    const connect = async () => {
      const token = await SecureStore.getItemAsync("martly_access_token");
      if (!token) return;

      ws = new WebSocket(`${WS_URL}/ws?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        ws?.send(JSON.stringify({ type: "subscribe", tripId: tracking.tripId }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(typeof event.data === "string" ? event.data : "");
          if (msg.type === "location:updated" && msg.tripId === tracking.tripId) {
            setTracking((prev) => prev ? { ...prev, location: msg.data } : prev);
          }
          if (msg.type === "trip:stop_completed" && msg.tripId === tracking.tripId) {
            // Re-fetch both tracking data and route on stop completion
            fetchTracking();
            fetchRoute();
          }
        } catch {}
      };

      ws.onclose = () => {
        setWsConnected(false);
        setTimeout(() => { if (wsRef.current === ws) connect(); }, 3000);
      };

      ws.onerror = () => {};
    };

    connect();

    // Fallback: poll every 10s
    const pollInterval = setInterval(async () => {
      try {
        const res = await api.get<TrackingData>(`/api/v1/rider-location/by-order/${orderId}`);
        if (res.data?.location) {
          setTracking((prev) => prev ? { ...prev, location: res.data!.location } : prev);
        }
      } catch {}
    }, 10_000);

    return () => {
      clearInterval(pollInterval);
      if (ws) { ws.onclose = null; ws.close(); }
      wsRef.current = null;
    };
  }, [tracking?.tripId, orderId, fetchTracking, fetchRoute]);

  // Fit map to route when route data arrives
  useEffect(() => {
    if (!routeData?.polyline?.length || !mapRef.current) return;
    if (hasInitialFit.current) return;
    hasInitialFit.current = true;

    const coords = routeData.polyline.map((p) => ({
      latitude: p.lat,
      longitude: p.lng,
    }));

    // Include rider location and stops
    if (tracking?.location) {
      coords.push({ latitude: tracking.location.lat, longitude: tracking.location.lng });
    }
    if (tracking?.remainingStops) {
      for (const stop of tracking.remainingStops) {
        coords.push({ latitude: stop.lat, longitude: stop.lng });
      }
    }

    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 60, bottom: 200, left: 60 },
      animated: true,
    });
  }, [routeData, tracking?.location, tracking?.remainingStops]);

  // Animate map to rider location when it changes (only if no route)
  useEffect(() => {
    if (!tracking?.location || !mapRef.current || routeData) return;
    mapRef.current.animateToRegion({
      latitude: tracking.location.lat,
      longitude: tracking.location.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 1000);
  }, [tracking?.location?.lat, tracking?.location?.lng, routeData]);

  const callRider = () => {
    if (tracking?.rider?.phone) {
      Linking.openURL(`tel:${tracking.rider.phone}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Finding your rider...</Text>
      </View>
    );
  }

  if (!tracking || !tracking.rider) {
    return (
      <View style={styles.center}>
        <Ionicons name="navigate-outline" size={48} color={colors.textSecondary} />
        <Text style={styles.emptyTitle}>Tracking Not Available</Text>
        <Text style={styles.emptySubtitle}>
          Your order hasn't been assigned to a rider yet.
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasLocation = !!tracking.location;
  const storeLat = tracking.store?.latitude ? Number(tracking.store.latitude) : null;
  const storeLng = tracking.store?.longitude ? Number(tracking.store.longitude) : null;
  const hasStoreCoords = storeLat != null && storeLng != null;

  const initialRegion = hasLocation
    ? {
        latitude: tracking.location!.lat,
        longitude: tracking.location!.lng,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }
    : hasStoreCoords
      ? {
          latitude: storeLat!,
          longitude: storeLng!,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }
      : {
          latitude: 12.9716,
          longitude: 77.5946,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };

  const lastUpdated = tracking.location?.updatedAt
    ? new Date(tracking.location.updatedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  const etaMinutes = routeData?.totalDurationSeconds
    ? Math.ceil(routeData.totalDurationSeconds / 60)
    : null;

  const polylineCoords = routeData?.polyline?.map((p) => ({
    latitude: p.lat,
    longitude: p.lng,
  })) ?? [];

  const showMultiStop = (tracking.totalStops ?? 0) > 1;

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        rotateEnabled={false}
      >
        {/* Route polyline */}
        {polylineCoords.length > 1 && (
          <Polyline
            coordinates={polylineCoords}
            strokeColor={ROUTE_TEAL}
            strokeWidth={4}
          />
        )}

        {/* Rider marker */}
        {hasLocation && (
          <Marker
            coordinate={{
              latitude: tracking.location!.lat,
              longitude: tracking.location!.lng,
            }}
            title={tracking.rider.name}
            description="Your delivery rider"
          >
            <View style={styles.riderMarker}>
              <Ionicons name="bicycle" size={20} color="#fff" />
            </View>
          </Marker>
        )}

        {/* Store marker */}
        {hasStoreCoords && (
          <Marker
            coordinate={{ latitude: storeLat!, longitude: storeLng! }}
            title={tracking.store?.name ?? "Store"}
            description="Pickup location"
          >
            <View style={styles.storeMarker}>
              <Ionicons name="storefront" size={16} color="#fff" />
            </View>
          </Marker>
        )}

        {/* Numbered stop markers */}
        {tracking.remainingStops?.map((stop, idx) => (
          <Marker
            key={`stop-${stop.sequence}`}
            coordinate={{ latitude: stop.lat, longitude: stop.lng }}
            title={stop.isYourStop ? "Your delivery" : `Stop ${idx + 1}`}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[
              styles.stopMarker,
              stop.isYourStop && styles.stopMarkerYours,
            ]}>
              <Text style={styles.stopMarkerText}>{idx + 1}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Live indicator overlay */}
      <View style={styles.liveOverlay}>
        <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
        <Text style={styles.liveText}>
          {wsConnected ? "LIVE" : "CONNECTING..."}
        </Text>
      </View>

      {/* Bottom sheet */}
      <View style={styles.bottomSheet}>
        {/* Multi-stop indicator */}
        {showMultiStop && tracking.customerStopNumber != null && (
          <View style={styles.stopPillRow}>
            <View style={styles.stopPill}>
              <Ionicons name="pin-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.stopPillText}>
                You're stop {tracking.customerStopNumber} of {tracking.totalStops}
              </Text>
            </View>
          </View>
        )}

        {/* Rider info */}
        <View style={styles.riderRow}>
          <View style={styles.riderAvatar}>
            <Ionicons name="person" size={24} color="#fff" />
          </View>
          <View style={styles.riderInfo}>
            <Text style={styles.riderName}>{tracking.rider.name}</Text>
            <Text style={styles.riderLabel}>Your delivery partner</Text>
          </View>
          <TouchableOpacity style={styles.callBtn} onPress={callRider} activeOpacity={0.7}>
            <Ionicons name="call" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Status info */}
        <View style={styles.statusRow}>
          {hasLocation ? (
            <>
              <View style={styles.statusItem}>
                <Ionicons name="location" size={16} color={colors.primary} />
                <Text style={styles.statusText}>On the way</Text>
              </View>
              {etaMinutes != null && (
                <View style={styles.statusItem}>
                  <Ionicons name="time" size={16} color={ROUTE_TEAL} />
                  <Text style={styles.etaText}>~{etaMinutes} min</Text>
                </View>
              )}
              {tracking.location?.speed != null && tracking.location.speed > 0 && (
                <View style={styles.statusItem}>
                  <Ionicons name="speedometer-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.statusTextSecondary}>
                    {(tracking.location.speed * 3.6).toFixed(0)} km/h
                  </Text>
                </View>
              )}
              {lastUpdated && !etaMinutes && (
                <View style={styles.statusItem}>
                  <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.statusTextSecondary}>{lastUpdated}</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.statusItem}>
              <Ionicons name="navigate-outline" size={16} color="#f59e0b" />
              <Text style={styles.statusText}>Waiting for rider location...</Text>
            </View>
          )}
        </View>

        {/* Delivery address */}
        {tracking.deliveryAddress && (
          <View style={styles.addressRow}>
            <View style={styles.addressDot} />
            <Text style={styles.addressText} numberOfLines={2}>
              {tracking.deliveryAddress}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  loadingText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  backBtn: {
    marginTop: spacing.lg,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  backBtnText: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: "#fff",
  },
  map: {
    flex: 1,
  },
  liveOverlay: {
    position: "absolute",
    top: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#22c55e",
  },
  liveText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 1,
  },
  bottomSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 34,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  stopPillRow: {
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  stopPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  stopPillText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  riderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  riderAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  riderInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  riderName: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
  },
  riderLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 1,
  },
  callBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#22c55e",
    justifyContent: "center",
    alignItems: "center",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusText: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.text,
  },
  statusTextSecondary: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  etaText: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: ROUTE_TEAL,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ef4444",
    marginTop: 4,
  },
  addressText: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    lineHeight: 20,
  },
  riderMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  storeMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#6366f1",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  stopMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: STOP_GRAY,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  stopMarkerYours: {
    backgroundColor: STOP_RED,
  },
  stopMarkerText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
});
