import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { View, Text, Pressable, Animated, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "../../constants/theme";
import { useStore } from "../../lib/store-context";
import { useAuth } from "../../lib/auth-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { strings } from "../../lib/i18n";
import type { Store } from "../../lib/types";
import { StoreBrowser } from "./StoreBrowser";
import { ChooseStoreButton } from "./ChooseStoreButton";
import type { StoreBanner } from "./StoreDetailPanel";
import { hasBannerTarget, openBannerTarget } from "../../lib/banner-action";
import { getGreeting } from "./store-info";

const smile = require("../../assets/branding/smile.png");

function FadeIn({ index, children }: { index: number; children: ReactNode }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 380, delay: index * 70, useNativeDriver: true }).start();
  }, [index, progress]);
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  return <Animated.View style={{ opacity: progress, transform: [{ translateY }] }}>{children}</Animated.View>;
}

function fastestFirst(stores: Store[]): Store[] {
  return [...stores].sort(
    (a, b) => (a.expressEtaMinutes ?? Infinity) - (b.expressEtaMinutes ?? Infinity) || (a.distance ?? 0) - (b.distance ?? 0),
  );
}

interface GreetingProps {
  firstName?: string;
  status: { text: string; tone: "good" | "warn" };
  onEnableLocation?: () => void;
}

/** A light greeting and one line on whether anything delivers here, so the stores come into view straight away */
function Greeting({ firstName, status, onEnableLocation }: GreetingProps) {
  const t = useStrings("home");
  const warn = status.tone === "warn";
  return (
    <View style={styles.greeting}>
      <View style={styles.greetingName}>
        <Text style={styles.greetingText}>
          {getGreeting()}{firstName ? `, ${firstName}` : ""}
        </Text>
        <Image source={smile} style={styles.smile} resizeMode="contain" />
      </View>
      <View style={[styles.status, warn ? styles.statusWarn : styles.statusGood]}>
        <Ionicons name={warn ? "information-circle-outline" : "flash"} size={16} color={warn ? colors.textSecondary : colors.primary} />
        <Text style={[styles.statusText, { color: warn ? colors.text : colors.primary }]}>{status.text}</Text>
        {onEnableLocation && (
          <Pressable style={({ pressed }) => [styles.locationBtn, pressed && { opacity: 0.85 }]} onPress={onEnableLocation} hitSlop={6}>
            <Text style={styles.locationBtnText}>{t.enableLocation}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function statusFor(locationDenied: boolean, deliverable: Store[]): GreetingProps["status"] {
  const t = strings("home");
  if (locationDenied) return { text: t.turnOnLocation, tone: "warn" };
  if (deliverable.length === 0) return { text: t.noDelivery, tone: "warn" };
  return { text: t.storesDeliver(deliverable.length, fastestFirst(deliverable)[0].expressEtaMinutes), tone: "good" };
}

/** Stores in the order shoppers should see them: those that deliver (fastest first), else every store, then the rest */
function browseOrder(stores: Store[], nearbyStores: Store[]) {
  const deliverable = fastestFirst(nearbyStores.filter((s) => s.deliversToYou));
  const outside = nearbyStores.filter((s) => !s.deliversToYou);
  const browseAll = deliverable.length === 0 ? stores.filter((s) => s.status === "ACTIVE") : [];
  const seen = new Set<string>();
  const ordered = [...deliverable, ...browseAll, ...outside].filter((s) => !seen.has(s.id) && seen.add(s.id));
  // When something delivers, stores outside the area can be previewed but not chosen
  const blocked = new Set(deliverable.length > 0 ? outside.map((s) => s.id) : []);
  return { deliverable, ordered, blocked };
}

/** Which store is being previewed, shared by the discovery list and the button docked above the tab bar */
export function useStoreDiscovery() {
  const { stores, nearbyStores } = useStore();
  const [previewId, setPreviewId] = useState<string | null>(null);
  return useMemo(() => {
    const { deliverable, ordered, blocked } = browseOrder(stores, nearbyStores);
    const preview = ordered.find((s) => s.id === previewId) ?? ordered[0];
    return { deliverable, ordered, blocked, preview, setPreviewId };
  }, [stores, nearbyStores, previewId]);
}

export type StoreDiscoveryState = ReturnType<typeof useStoreDiscovery>;

/** Shop at the previewed store; lives in the bottom dock so it never scrolls away */
export function StoreDiscoveryButton({ discovery }: { discovery: StoreDiscoveryState }) {
  const { setSelectedStore } = useStore();
  const t = useStrings("home");
  const insets = useSafeAreaInsets();
  const { preview, blocked } = discovery;
  if (!preview) return null;
  return (
    <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <ChooseStoreButton store={preview} blockedReason={blocked.has(preview.id) ? t.notDeliverYet : null} onChoose={setSelectedStore} />
    </View>
  );
}

export default function StoreDiscovery({ discovery }: { discovery: StoreDiscoveryState }) {
  const { stores, locationStatus, requestLocation, setSelectedStore } = useStore();
  const { user } = useAuth();
  const t = useStrings("home");
  const { deliverable, ordered, blocked, preview, setPreviewId } = discovery;
  // Nothing chosen yet, so an offer simply picks its store; out-of-area stores can't be picked
  const tapOffer = (store: Store, banner: StoreBanner) => {
    if (blocked.has(store.id) || !hasBannerTarget(banner)) return;
    setSelectedStore(store);
    openBannerTarget(banner);
  };

  if (stores.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="storefront-outline" size={40} color={colors.primary} />
        <Text style={styles.emptyTitle}>{t.noStoresYet}</Text>
        <Text style={styles.emptyText}>{t.comingSoon}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FadeIn index={0}>
        <Greeting
          firstName={user?.name?.split(" ")[0]}
          status={statusFor(locationStatus === "denied", deliverable)}
          onEnableLocation={locationStatus === "denied" ? requestLocation : undefined}
        />
      </FadeIn>
      <FadeIn index={1}>
        <Text style={styles.sectionTitle}>{t.chooseYourStore}</Text>
        <StoreBrowser stores={ordered} activeId={preview?.id ?? null} onPreview={(st) => setPreviewId(st.id)} isMuted={(st) => blocked.has(st.id)} inset={16} onBannerPress={tapOffer} />
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },

  greeting: { gap: 10 },
  greetingName: { alignSelf: "flex-start" },
  greetingText: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text, letterSpacing: -0.4 },
  smile: { width: 52, height: 10, marginTop: 4 },
  status: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  statusWarn: { backgroundColor: "#f1f5f9" },
  statusGood: { backgroundColor: "#f0fdfa" },
  statusText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  locationBtn: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 12, height: 34, justifyContent: "center" },
  locationBtnText: { fontFamily: fonts.bold, fontSize: 13, color: "#fff" },
  dock: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#f1f5f9" },

  sectionTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.text, letterSpacing: -0.2, marginTop: 8, marginBottom: 10 },

  empty: { alignItems: "center", padding: 40, gap: 8 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginTop: 8 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
});
