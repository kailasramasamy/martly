import { useEffect, useRef, type ReactNode } from "react";
import { View, Text, Pressable, Animated, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useStore } from "../../lib/store-context";
import { useAuth } from "../../lib/auth-context";
import type { Store } from "../../lib/types";
import { FeaturedStoreCard, StoreRow } from "./StoreCards";
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

function SectionTitle({ title, caption }: { title: string; caption?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
    </View>
  );
}

function fastestFirst(stores: Store[]): Store[] {
  return [...stores].sort(
    (a, b) => (a.expressEtaMinutes ?? Infinity) - (b.expressEtaMinutes ?? Infinity) || (a.distance ?? 0) - (b.distance ?? 0),
  );
}

interface HeroProps {
  firstName?: string;
  headline: string;
  onEnableLocation?: () => void;
}

function Hero({ firstName, headline, onEnableLocation }: HeroProps) {
  return (
    <View style={styles.hero}>
      <View style={[styles.heroOrb, styles.heroOrbLarge]} />
      <View style={[styles.heroOrb, styles.heroOrbSmall]} />
      <Text style={styles.heroGreeting}>
        {getGreeting()}{firstName ? `, ${firstName}` : ""}
      </Text>
      <Image source={smile} style={styles.heroSmile} resizeMode="contain" />
      <Text style={styles.heroHeadline}>{headline}</Text>
      {onEnableLocation && (
        <Pressable style={({ pressed }) => [styles.heroBtn, pressed && { opacity: 0.85 }]} onPress={onEnableLocation}>
          <Ionicons name="navigate" size={15} color={colors.primary} />
          <Text style={styles.heroBtnText}>Enable location</Text>
        </Pressable>
      )}
    </View>
  );
}

function headlineFor(locationDenied: boolean, deliverable: Store[]): string {
  if (locationDenied) return "Turn on location to see the stores that deliver to you.";
  if (deliverable.length === 0) return "We don't deliver to your location yet, but you can still browse our stores.";
  const fastest = fastestFirst(deliverable)[0].expressEtaMinutes;
  const count = deliverable.length === 1 ? "1 store delivers" : `${deliverable.length} stores deliver`;
  return fastest ? `${count} to you, the fastest in ${fastest} minutes.` : `${count} to you.`;
}

export default function StoreDiscovery() {
  const { stores, nearbyStores, locationStatus, requestLocation, setSelectedStore } = useStore();
  const { user } = useAuth();

  const locationDenied = locationStatus === "denied";
  const deliverable = nearbyStores.filter((s) => s.deliversToYou);
  const outside = nearbyStores.filter((s) => !s.deliversToYou);
  const [featured, ...others] = fastestFirst(deliverable);
  const browseAll = deliverable.length === 0 ? stores.filter((s) => s.status === "ACTIVE") : [];
  let order = 1;

  if (stores.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="storefront-outline" size={40} color={colors.primary} />
        <Text style={styles.emptyTitle}>No stores yet</Text>
        <Text style={styles.emptyText}>Martly is coming to your area soon. Pull down to check again.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FadeIn index={0}>
        <Hero
          firstName={user?.name?.split(" ")[0]}
          headline={headlineFor(locationDenied, deliverable)}
          onEnableLocation={locationDenied ? requestLocation : undefined}
        />
      </FadeIn>

      {featured && (
        <FadeIn index={order++}>
          <SectionTitle title="Fastest to you" />
          <FeaturedStoreCard store={featured} onPress={setSelectedStore} />
        </FadeIn>
      )}

      {others.length > 0 && <FadeIn index={order++}><SectionTitle title="More stores near you" /></FadeIn>}
      {others.map((store) => (
        <FadeIn key={store.id} index={order++}><StoreRow store={store} onPress={setSelectedStore} /></FadeIn>
      ))}

      {browseAll.length > 0 && <FadeIn index={order++}><SectionTitle title="Martly stores" /></FadeIn>}
      {browseAll.map((store) => (
        <FadeIn key={store.id} index={order++}><StoreRow store={store} onPress={setSelectedStore} /></FadeIn>
      ))}

      {outside.length > 0 && (
        <FadeIn index={order++}>
          <SectionTitle title="Outside your delivery area" caption="These stores can't deliver to your location yet" />
        </FadeIn>
      )}
      {outside.map((store) => (
        <FadeIn key={store.id} index={order++}><StoreRow store={store} onPress={setSelectedStore} disabled /></FadeIn>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },

  hero: {
    backgroundColor: colors.primary, borderRadius: 24, padding: 22, paddingTop: 24, overflow: "hidden",
  },
  heroOrb: { position: "absolute", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.07)" },
  heroOrbLarge: { width: 220, height: 220, right: -70, top: -90 },
  heroOrbSmall: { width: 120, height: 120, right: 40, bottom: -70, backgroundColor: "rgba(251,191,36,0.14)" },
  heroGreeting: { fontFamily: fonts.extrabold, fontSize: 26, color: "#fff", letterSpacing: -0.5 },
  heroSmile: { width: 63, height: 12, marginTop: 6 },
  heroHeadline: {
    fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, color: "rgba(255,255,255,0.9)",
    marginTop: 12, maxWidth: "88%",
  },
  heroBtn: {
    flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start",
    backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 16, height: 44, marginTop: 16,
  },
  heroBtnText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.primary },

  sectionHeader: { marginTop: 12, marginBottom: 10 },
  sectionTitle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.text, letterSpacing: -0.2 },
  sectionCaption: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  empty: { alignItems: "center", padding: 40, gap: 8 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginTop: 8 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
});
