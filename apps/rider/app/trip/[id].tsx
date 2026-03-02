import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Animated,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { api, getAccessToken, getApiUrl } from "../../lib/api";
import { colors, spacing, fontSize, borderRadius, fonts } from "../../constants/theme";

interface TripOrder {
  id: string;
  orderNumber?: string;
  status: string;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  deliveryAddress: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryPincode: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    phone: string | null;
  };
  items: {
    quantity: number;
    unitPrice: number;
    product: { name: string; imageUrl: string | null };
    variant: { name: string; unitType: string; unitValue: number };
  }[];
}

interface TripStore {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

interface Trip {
  id: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  store: TripStore;
  orders: TripOrder[];
}

type GpsStatus = "off" | "acquiring" | "broadcasting" | "error";

const formatUnit = (unitType: string, unitValue: number, variantName: string): string => {
  const val = Number(unitValue);
  const unitMap: Record<string, string> = {
    KG: val >= 1 ? `${val} kg` : `${val * 1000} g`,
    GRAM: `${val} g`,
    LITRE: val >= 1 ? `${val} L` : `${val * 1000} ml`,
    ML: `${val} ml`,
    PIECE: val === 1 ? "1 pc" : `${val} pcs`,
    PACK: `Pack of ${val}`,
    DOZEN: `${val} dozen`,
  };
  return unitMap[unitType] ?? variantName;
};

const openNavigation = (address: string, lat?: number | null, lng?: number | null) => {
  // Use coordinates if available (more accurate), fall back to text address
  const destination = lat != null && lng != null
    ? `${lat},${lng}`
    : encodeURIComponent(address);
  const isCoords = lat != null && lng != null;

  if (Platform.OS === "ios") {
    Linking.canOpenURL("comgooglemaps://").then((supported) => {
      if (supported) {
        const dest = isCoords ? `${lat},${lng}` : encodeURIComponent(address);
        Linking.openURL(`comgooglemaps://?daddr=${dest}&directionsmode=driving`);
      } else {
        // Apple Maps
        const params = isCoords ? `ll=${lat},${lng}&daddr=${lat},${lng}` : `daddr=${encodeURIComponent(address)}`;
        Linking.openURL(`https://maps.apple.com/?${params}`);
      }
    });
  } else {
    const dest = isCoords ? `${lat},${lng}` : encodeURIComponent(address);
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`);
  }
};

export default function TripScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("off");
  const [codModal, setCodModal] = useState<{
    orderId: string;
    customerName: string;
    amount: number;
  } | null>(null);
  const [codCollected, setCodCollected] = useState("");
  const [codNote, setCodNote] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulsing animation for live indicator
  useEffect(() => {
    if (gpsStatus === "broadcasting") {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.4, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [gpsStatus, pulseAnim]);

  // Fetch trip data
  const fetchTrip = useCallback(async () => {
    if (!tripId) return;
    try {
      const res = await api.get<Trip[]>("/api/v1/rider-location/my-trips");
      const found = (res.data ?? []).find((t) => t.id === tripId);
      if (found) {
        setTrip(found);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

  // Connect WebSocket
  const connectWs = useCallback(() => {
    const token = getAccessToken();
    if (!token || !tripId) return null;

    const wsUrl = getApiUrl().replace(/^http/, "ws");
    const ws = new WebSocket(`${wsUrl}/ws?token=${token}`);

    ws.onopen = () => {
      // WebSocket connected
    };

    ws.onerror = () => {
      // Will fall back to REST
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    wsRef.current = ws;
    return ws;
  }, [tripId]);

  // Send location via WebSocket or REST fallback
  const sendLocation = useCallback(
    async (lat: number, lng: number, heading: number | null, speed: number | null) => {
      if (!tripId) return;

      const payload = {
        type: "location:update" as const,
        tripId,
        lat,
        lng,
        heading: heading ?? undefined,
        speed: speed ?? undefined,
      };

      // Try WebSocket first
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
        return;
      }

      // REST fallback
      try {
        await api.post("/api/v1/rider-location", {
          tripId,
          lat,
          lng,
          heading,
          speed,
        });
      } catch {
        // silently fail
      }
    },
    [tripId]
  );

  // Start GPS broadcasting
  const startGpsBroadcasting = useCallback(async () => {
    setGpsStatus("acquiring");

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setGpsStatus("error");
      Alert.alert(
        "Location Permission Required",
        "Please enable location access in Settings to broadcast your position.",
        [{ text: "OK" }]
      );
      return;
    }

    // Connect WebSocket
    connectWs();

    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 5000,
        },
        (location) => {
          setGpsStatus("broadcasting");
          sendLocation(
            location.coords.latitude,
            location.coords.longitude,
            location.coords.heading,
            location.coords.speed
          );
        }
      );

      locationSubRef.current = subscription;
    } catch {
      setGpsStatus("error");
    }
  }, [connectWs, sendLocation]);

  // Stop GPS broadcasting
  const stopGpsBroadcasting = useCallback(() => {
    if (locationSubRef.current) {
      locationSubRef.current.remove();
      locationSubRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setGpsStatus("off");
  }, []);

  // Auto-start GPS when trip is IN_PROGRESS
  useEffect(() => {
    if (trip?.status === "IN_PROGRESS" && gpsStatus === "off") {
      startGpsBroadcasting();
    }
  }, [trip?.status, gpsStatus, startGpsBroadcasting]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (locationSubRef.current) {
        locationSubRef.current.remove();
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Start trip
  const handleStartTrip = useCallback(async () => {
    if (!tripId) return;
    setActionLoading("start");
    try {
      await api.patch(`/api/v1/delivery-trips/${tripId}/start`);
      await fetchTrip();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to start trip");
    } finally {
      setActionLoading(null);
    }
  }, [tripId, fetchTrip]);

  // Confirm delivery — shared by COD modal and prepaid alert
  const confirmDelivery = useCallback(
    async (orderId: string, codData?: { collectedAmount: number; note: string }) => {
      setCodModal(null);
      setActionLoading(orderId);
      try {
        const body = codData ? { collectedAmount: codData.collectedAmount, codNote: codData.note || undefined } : undefined;
        const res = await api.patch<{ allDelivered: boolean }>(
          `/api/v1/rider-location/trips/${tripId}/deliver/${orderId}`,
          body
        );
        if (res.data.allDelivered) {
          stopGpsBroadcasting();
          Alert.alert(
            "Trip Complete!",
            "All orders have been delivered.",
            [{ text: "Done", onPress: () => router.back() }]
          );
        } else {
          await fetchTrip();
        }
      } catch (err) {
        Alert.alert("Error", err instanceof Error ? err.message : "Failed to mark delivered");
      } finally {
        setActionLoading(null);
      }
    },
    [tripId, fetchTrip, stopGpsBroadcasting, router]
  );

  // Mark order delivered — COD opens modal, prepaid uses simple alert
  const handleDeliverOrder = useCallback(
    (orderId: string, customerName: string, isCod: boolean, amount: number) => {
      if (isCod) {
        setCodCollected(String(Math.round(amount)));
        setCodNote("");
        setCodModal({ orderId, customerName, amount });
        return;
      }
      Alert.alert(
        "Confirm Delivery",
        `Mark ${customerName}'s order as delivered?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delivered", onPress: () => confirmDelivery(orderId) },
        ]
      );
    },
    [confirmDelivery]
  );

  const renderOrder = useCallback(
    ({ item, index }: { item: TripOrder; index: number }) => {
      const isDelivered = item.status === "DELIVERED";
      const isCod = item.paymentMethod === "COD";
      const itemCount = item.items.reduce((sum, i) => sum + i.quantity, 0);
      const orderNum = index + 1;

      return (
        <View style={[styles.orderCard, isDelivered && styles.orderCardDelivered]}>
          <View style={styles.orderHeader}>
            <View style={styles.orderHeaderLeft}>
              <View style={[styles.orderNumBadge, isDelivered && styles.orderNumBadgeDone]}>
                <Text style={styles.orderNumText}>{orderNum}</Text>
              </View>
              <View>
                <Text style={styles.customerName}>{item.user.name}</Text>
                {item.user.phone && (
                  <Text style={styles.customerPhone}>{item.user.phone}</Text>
                )}
              </View>
            </View>
            <View style={styles.orderAmountContainer}>
              <Text style={styles.orderAmount}>
                {"\u20B9"}{Number(item.totalAmount).toLocaleString("en-IN")}
              </Text>
              <View style={[styles.paymentBadge, isCod ? styles.codBadge : styles.paidBadge]}>
                <Text style={[styles.paymentBadgeText, isCod ? styles.codText : styles.paidText]}>
                  {isCod ? "COD" : "PAID"}
                </Text>
              </View>
            </View>
          </View>

          {item.deliveryAddress && (
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={14} color={colors.textSecondary} style={{ marginTop: 2 }} />
              <Text style={styles.addressText} numberOfLines={2}>{item.deliveryAddress}</Text>
              {!isDelivered && (
                <Pressable
                  style={styles.navigateBtn}
                  onPress={() => openNavigation(item.deliveryAddress!, item.deliveryLat, item.deliveryLng)}
                  hitSlop={8}
                >
                  <Ionicons name="navigate" size={14} color="#fff" />
                </Pressable>
              )}
            </View>
          )}

          {/* Itemized product list */}
          <View style={styles.itemsList}>
            <View style={styles.itemsListHeader}>
              <Ionicons name="cube-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.itemsListTitle}>
                {itemCount} item{itemCount !== 1 ? "s" : ""}
              </Text>
            </View>
            {item.items.map((oi, idx) => {
              const unitLabel = formatUnit(oi.variant.unitType, oi.variant.unitValue, oi.variant.name);
              return (
                <View key={idx} style={styles.itemRow}>
                  <Text style={styles.itemQty}>{oi.quantity}x</Text>
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemName} numberOfLines={1}>{oi.product.name}</Text>
                    <Text style={styles.itemUnit}>{unitLabel}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {!isDelivered && trip?.status === "IN_PROGRESS" && (
            <Pressable
              style={[styles.deliverButton, isCod && styles.deliverButtonCod]}
              onPress={() => handleDeliverOrder(item.id, item.user.name, isCod, Number(item.totalAmount))}
              disabled={actionLoading === item.id}
            >
              {actionLoading === item.id ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name={isCod ? "cash" : "checkmark-circle"} size={18} color="#fff" />
                  <Text style={styles.deliverButtonText}>
                    {isCod ? "Collect & Deliver" : "Mark Delivered"}
                  </Text>
                </>
              )}
            </Pressable>
          )}

          {isDelivered && (
            <View style={styles.deliveredBanner}>
              <Ionicons name="checkmark-circle" size={16} color={colors.successDark} />
              <Text style={styles.deliveredText}>Delivered</Text>
            </View>
          )}
        </View>
      );
    },
    [trip?.status, actionLoading, handleDeliverOrder]
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
        <Text style={styles.errorText}>Trip not found</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const isActive = trip.status === "IN_PROGRESS";
  const isCreated = trip.status === "CREATED";
  const isCompleted = trip.status === "COMPLETED";
  const deliveredCount = trip.orders.filter((o) => o.status === "DELIVERED").length;
  const totalOrders = trip.orders.length;

  // Collect all map points: store + delivery locations with coordinates
  const mapPoints: { lat: number; lng: number; label: string; type: "store" | "delivery" | "delivered" }[] = [];
  if (trip.store.latitude != null && trip.store.longitude != null) {
    mapPoints.push({ lat: trip.store.latitude, lng: trip.store.longitude, label: trip.store.name, type: "store" });
  }
  trip.orders.forEach((o, idx) => {
    if (o.deliveryLat != null && o.deliveryLng != null) {
      mapPoints.push({
        lat: o.deliveryLat,
        lng: o.deliveryLng,
        label: `${idx + 1}. ${o.user.name}`,
        type: o.status === "DELIVERED" ? "delivered" : "delivery",
      });
    }
  });

  // Calculate map region to fit all points
  const mapRegion = mapPoints.length > 0
    ? (() => {
        const lats = mapPoints.map((p) => p.lat);
        const lngs = mapPoints.map((p) => p.lng);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const latDelta = Math.max((maxLat - minLat) * 1.5, 0.01);
        const lngDelta = Math.max((maxLng - minLng) * 1.5, 0.01);
        return {
          latitude: (minLat + maxLat) / 2,
          longitude: (minLng + maxLng) / 2,
          latitudeDelta: latDelta,
          longitudeDelta: lngDelta,
        };
      })()
    : null;

  return (
    <View style={[styles.container, isActive && styles.containerDark]}>
      {/* Dark Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }, isActive && styles.headerDark]}>
        {/* Top row: back + live indicator */}
        <View style={styles.headerTopRow}>
          <Pressable style={styles.headerBackButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color={isActive ? "#fff" : colors.text} />
          </Pressable>

          {isActive && (
            <View style={styles.liveIndicator}>
              <Animated.View style={[styles.livePulse, { transform: [{ scale: pulseAnim }] }]} />
              <View style={styles.liveDotInner} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}

          {isCompleted && (
            <View style={styles.completedBadge}>
              <Ionicons name="checkmark-circle" size={16} color={colors.successDark} />
              <Text style={styles.completedBadgeText}>Completed</Text>
            </View>
          )}
        </View>

        {/* Store info */}
        <View style={styles.storeRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerStoreName, isActive && styles.headerStoreNameDark]}>
              {trip.store.name}
            </Text>
            <Text style={[styles.headerStoreAddress, isActive && styles.headerStoreAddressDark]}>
              {trip.store.address}
            </Text>
          </View>
          {!isCompleted && (
            <Pressable
              style={styles.storeNavigateBtn}
              onPress={() => openNavigation(trip.store.address, trip.store.latitude, trip.store.longitude)}
              hitSlop={8}
            >
              <Ionicons name="navigate" size={16} color={colors.info} />
            </Pressable>
          )}
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: totalOrders > 0 ? `${(deliveredCount / totalOrders) * 100}%` : "0%" },
              ]}
            />
          </View>
          <Text style={[styles.progressText, isActive && styles.progressTextDark]}>
            {deliveredCount}/{totalOrders} delivered
          </Text>
        </View>

        {/* GPS Status */}
        {isActive && (
          <View style={styles.gpsRow}>
            <Ionicons
              name={gpsStatus === "broadcasting" ? "navigate" : gpsStatus === "error" ? "warning" : "navigate-outline"}
              size={14}
              color={gpsStatus === "broadcasting" ? colors.success : gpsStatus === "error" ? colors.error : colors.textOnDarkSecondary}
            />
            <Text style={[styles.gpsText, gpsStatus === "broadcasting" && styles.gpsTextActive, gpsStatus === "error" && styles.gpsTextError]}>
              {gpsStatus === "broadcasting"
                ? "Broadcasting location"
                : gpsStatus === "acquiring"
                ? "Acquiring GPS..."
                : gpsStatus === "error"
                ? "Location unavailable"
                : "GPS off"}
            </Text>
          </View>
        )}
      </View>

      {/* Orders List */}
      <FlatList
        data={trip.orders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Trip overview map */}
            {mapRegion && mapPoints.length >= 2 && (
              <View style={styles.mapContainer}>
                <MapView
                  style={styles.tripMap}
                  provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
                  initialRegion={mapRegion}
                  scrollEnabled
                  zoomEnabled
                  pitchEnabled={false}
                  rotateEnabled={false}
                  showsUserLocation
                  showsMyLocationButton={false}
                >
                  {mapPoints.map((pt, idx) => (
                    <Marker
                      key={idx}
                      coordinate={{ latitude: pt.lat, longitude: pt.lng }}
                      title={pt.label}
                    >
                      {pt.type === "store" ? (
                        <View style={styles.storePin}>
                          <Ionicons name="storefront" size={14} color="#fff" />
                        </View>
                      ) : (
                        <View style={[styles.deliveryPin, pt.type === "delivered" && styles.deliveryPinDone]}>
                          <Text style={styles.deliveryPinText}>
                            {mapPoints.filter((p) => p.type !== "store").indexOf(pt) + 1}
                          </Text>
                        </View>
                      )}
                    </Marker>
                  ))}
                </MapView>
              </View>
            )}
            <Text style={[styles.sectionTitle, isActive && styles.sectionTitleDark]}>
              {totalOrders} Order{totalOrders !== 1 ? "s" : ""}
            </Text>
          </>
        }
      />

      {/* Bottom Action */}
      {isCreated && (
        <View style={[styles.bottomAction, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Pressable
            style={[styles.startButton, actionLoading === "start" && styles.buttonDisabled]}
            onPress={handleStartTrip}
            disabled={actionLoading === "start"}
          >
            {actionLoading === "start" ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="play-circle" size={22} color="#fff" />
                <Text style={styles.startButtonText}>Start Trip</Text>
              </>
            )}
          </Pressable>
        </View>
      )}

      {/* COD Collection Modal */}
      <Modal visible={!!codModal} transparent animationType="slide" onRequestClose={() => setCodModal(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.modalBackdrop} onPress={() => setCodModal(null)} />
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            {/* Handle bar */}
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>Collect Cash</Text>
            <Text style={styles.modalSubtitle}>
              Order for {codModal?.customerName}
            </Text>

            {/* Order amount */}
            <View style={styles.codAmountRow}>
              <Text style={styles.codAmountLabel}>Order Total</Text>
              <Text style={styles.codAmountValue}>
                {"\u20B9"}{codModal ? Math.round(codModal.amount).toLocaleString("en-IN") : "0"}
              </Text>
            </View>

            {/* Collected amount input */}
            <View style={styles.codInputGroup}>
              <Text style={styles.codInputLabel}>Amount Collected ({"\u20B9"})</Text>
              <TextInput
                style={styles.codInput}
                value={codCollected}
                onChangeText={setCodCollected}
                keyboardType="numeric"
                placeholder="Enter amount collected"
                placeholderTextColor={colors.textSecondary}
                selectTextOnFocus
              />
              {codCollected && Number(codCollected) !== Math.round(codModal?.amount ?? 0) && (
                <Text style={styles.codMismatch}>
                  {Number(codCollected) < Math.round(codModal?.amount ?? 0)
                    ? `Short by \u20B9${Math.round((codModal?.amount ?? 0) - Number(codCollected)).toLocaleString("en-IN")}`
                    : `Excess \u20B9${Math.round(Number(codCollected) - (codModal?.amount ?? 0)).toLocaleString("en-IN")}`}
                </Text>
              )}
            </View>

            {/* Note input */}
            <View style={styles.codInputGroup}>
              <Text style={styles.codInputLabel}>Note (optional)</Text>
              <TextInput
                style={[styles.codInput, styles.codNoteInput]}
                value={codNote}
                onChangeText={setCodNote}
                placeholder="e.g. Customer paid exact change"
                placeholderTextColor={colors.textSecondary}
                multiline
              />
            </View>

            {/* Actions */}
            <View style={styles.codActions}>
              <Pressable style={styles.codCancelBtn} onPress={() => setCodModal(null)}>
                <Text style={styles.codCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.codConfirmBtn, !codCollected && styles.buttonDisabled]}
                disabled={!codCollected}
                onPress={() => {
                  if (codModal) {
                    confirmDelivery(codModal.orderId, {
                      collectedAmount: Number(codCollected),
                      note: codNote,
                    });
                  }
                }}
              >
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.codConfirmText}>Confirm Delivery</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  containerDark: {
    backgroundColor: colors.surfaceDarker,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  errorText: {
    fontSize: fontSize.subtitle,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  backButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  backButtonText: {
    fontSize: fontSize.body,
    fontFamily: fonts.semibold,
    color: "#fff",
  },

  // Header
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerDark: {
    backgroundColor: colors.surfaceDark,
    borderBottomColor: colors.borderDark,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: -8,
  },

  // Live indicator
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
  },
  livePulse: {
    position: "absolute",
    left: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(34, 197, 94, 0.3)",
  },
  liveDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  liveText: {
    fontSize: fontSize.caption,
    fontFamily: fonts.bold,
    color: colors.success,
    letterSpacing: 1,
  },

  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#dcfce7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
  },
  completedBadgeText: {
    fontSize: fontSize.caption,
    fontFamily: fonts.bold,
    color: colors.successDark,
  },

  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  storeNavigateBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerStoreName: {
    fontSize: fontSize.title,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  headerStoreNameDark: {
    color: "#fff",
  },
  headerStoreAddress: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerStoreAddressDark: {
    color: colors.textOnDarkSecondary,
  },

  // Progress
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.success,
    borderRadius: 3,
  },
  progressText: {
    fontSize: fontSize.caption,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    minWidth: 70,
    textAlign: "right",
  },
  progressTextDark: {
    color: colors.textOnDarkSecondary,
  },

  // GPS status
  gpsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.sm,
  },
  gpsText: {
    fontSize: fontSize.caption,
    fontFamily: fonts.medium,
    color: colors.textOnDarkSecondary,
  },
  gpsTextActive: {
    color: colors.success,
  },
  gpsTextError: {
    color: colors.error,
  },

  // Trip map
  mapContainer: {
    height: 200,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  tripMap: {
    flex: 1,
  },
  storePin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  deliveryPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.info,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  deliveryPinDone: {
    backgroundColor: colors.success,
    opacity: 0.6,
  },
  deliveryPinText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: "#fff",
  },

  // List
  listContent: {
    padding: spacing.lg,
    paddingBottom: 120,
  },
  sectionTitle: {
    fontSize: fontSize.body,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  sectionTitleDark: {
    color: colors.textOnDark,
  },

  // Order Card
  orderCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderCardDelivered: {
    opacity: 0.6,
    borderColor: colors.success,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  orderHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  orderNumBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.info,
    justifyContent: "center",
    alignItems: "center",
  },
  orderNumBadgeDone: {
    backgroundColor: colors.success,
    opacity: 0.6,
  },
  orderNumText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  customerName: {
    fontSize: fontSize.body,
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  customerPhone: {
    fontSize: fontSize.caption,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 1,
  },
  orderAmountContainer: {
    alignItems: "flex-end",
    gap: 4,
  },
  orderAmount: {
    fontSize: fontSize.subtitle,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  paymentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codBadge: {
    backgroundColor: "#fef3c7",
  },
  paidBadge: {
    backgroundColor: "#dcfce7",
  },
  paymentBadgeText: {
    fontSize: 10,
    fontFamily: fonts.bold,
  },
  codText: {
    color: "#b45309",
  },
  paidText: {
    color: "#15803d",
  },

  // Address
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: spacing.sm,
    paddingLeft: 18,
  },
  addressText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  navigateBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.info,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
  },

  // Itemized product list
  itemsList: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemsListHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  itemsListTitle: {
    fontSize: fontSize.caption,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    gap: spacing.sm,
  },
  itemQty: {
    fontSize: fontSize.body,
    fontFamily: fonts.bold,
    color: colors.primary,
    width: 28,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: fontSize.sm,
    fontFamily: fonts.medium,
    color: colors.text,
    lineHeight: 18,
  },
  itemUnit: {
    fontSize: fontSize.caption,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 1,
  },

  // Deliver button
  deliverButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: 14,
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
    minHeight: 48,
  },
  deliverButtonCod: {
    backgroundColor: "#b45309",
  },
  deliverButtonText: {
    fontSize: fontSize.body,
    fontFamily: fonts.bold,
    color: "#fff",
  },

  // Delivered banner
  deliveredBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: spacing.sm,
    padding: 10,
    backgroundColor: "#dcfce7",
    borderRadius: borderRadius.md,
  },
  deliveredText: {
    fontSize: fontSize.sm,
    fontFamily: fonts.semibold,
    color: colors.successDark,
  },

  // Bottom action
  bottomAction: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: 16,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    minHeight: 52,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonText: {
    fontSize: fontSize.subtitle,
    fontFamily: fonts.bold,
    color: "#fff",
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // COD Collection Modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: fontSize.title,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: fontSize.sm,
    fontFamily: fonts.regular,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  codAmountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  codAmountLabel: {
    fontSize: fontSize.body,
    fontFamily: fonts.medium,
    color: "#92400e",
  },
  codAmountValue: {
    fontSize: fontSize.title,
    fontFamily: fonts.bold,
    color: "#92400e",
  },
  codInputGroup: {
    marginBottom: spacing.md,
  },
  codInputLabel: {
    fontSize: fontSize.sm,
    fontFamily: fonts.semibold,
    color: colors.text,
    marginBottom: 6,
  },
  codInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: fontSize.body,
    fontFamily: fonts.medium,
    color: colors.text,
    backgroundColor: colors.background,
  },
  codNoteInput: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  codMismatch: {
    fontSize: fontSize.caption,
    fontFamily: fonts.medium,
    color: "#b45309",
    marginTop: 4,
  },
  codActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  codCancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  codCancelText: {
    fontSize: fontSize.body,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
  },
  codConfirmBtn: {
    flex: 2,
    flexDirection: "row",
    padding: 14,
    borderRadius: borderRadius.md,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  codConfirmText: {
    fontSize: fontSize.body,
    fontFamily: fonts.bold,
    color: "#fff",
  },
});
