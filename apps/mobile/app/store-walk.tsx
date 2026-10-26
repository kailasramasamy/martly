import { useCallback, useEffect, useRef, useState } from "react";
import type { StoreWalkStop } from "@martly/shared/types";
import { Animated, BackHandler, Dimensions, Easing, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Loader } from "../components/Loader";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";
import { useStore } from "../lib/store-context";
import { useLanguage } from "../lib/language-context";
import { useStrings } from "../lib/i18n/use-strings";
import { ProductActionsProvider } from "../lib/product-actions";
import { AisleMapSheet } from "../components/store-walk/AisleMapSheet";
import { AisleView } from "../components/store-walk/AisleView";
import { NextDepartmentCard } from "../components/store-walk/NextDepartmentCard";
import { WalkDock } from "../components/store-walk/WalkDock";
import { WalkProgress } from "../components/store-walk/WalkProgress";
import { WalkRoute } from "../components/store-walk/WalkRoute";
import { WalkSummary } from "../components/store-walk/WalkSummary";
import { useReduceMotion } from "../lib/use-reduce-motion";
import { FlyProvider } from "../components/store-walk/basket-fly";
import { walkSession } from "../lib/walk-session";
import { ShopFloor } from "../components/store-walk/ShopFloor";
import { useStoreWalk, type StoreWalk } from "../components/store-walk/use-store-walk";
import { ListCart } from "../components/monthly-list/ListCart";

const SHIFT = Dimensions.get("window").width * 0.35;
// Back button, the gutters either side and the gap before the buttons on the right
const HEADER_BACK_WIDTH = 104;

// Moving on slides the aisle out to the left and the next one in from the right, like walking forward; going back
// (`direction` -1) slides the other way
function useAisleSlide() {
  const reduce = useReduceMotion();
  const x = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const timing = (v: Animated.Value, toValue: number, duration: number) =>
    Animated.timing(v, { toValue, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true });
  const go = (change: () => void, direction: 1 | -1 = 1) => {
    if (reduce) return change();
    Animated.parallel([timing(x, -SHIFT * direction, 200), timing(opacity, 0, 200)]).start(() => {
      change();
      x.setValue(SHIFT * direction);
      Animated.parallel([timing(x, 0, 260), timing(opacity, 1, 260)]).start();
    });
  };
  return { style: { flex: 1, opacity, transform: [{ translateX: x }] }, go, x };
}

function Message({ text, onRetry }: { text: string; onRetry?: () => void }) {
  const t = useStrings("storeWalk");
  return (
    <View style={styles.message}>
      <Text style={styles.messageText}>{text}</Text>
      {onRetry && <TouchableOpacity style={styles.retry} onPress={onRetry} accessibilityRole="button"><Text style={styles.retryText}>{t.retry}</Text></TouchableOpacity>}
    </View>
  );
}

// While walking, the app bar carries the department and the aisle count, with search (inside this aisle) and the Map
// on its right
function useAisleHeader(department: string, position: string, onMap: () => void, onSearch: () => void) {
  const navigation = useNavigation();
  // iOS doesn't bound a custom header title, so it gets the width the Back button and the buttons on the right leave
  const [actionsWidth, setActionsWidth] = useState(0);
  const titleWidth = Dimensions.get("window").width - HEADER_BACK_WIDTH - actionsWidth;
  const t = useStrings("storeWalk");
  const nav = useStrings("nav");
  useEffect(() => {
    navigation.setOptions({
      // Left-aligned, so the aisle name gets the room between Back and the buttons (centred, a long name runs under them)
      headerTitleAlign: "left",
      headerTitle: () => (
        <View style={[styles.headerTitle, actionsWidth > 0 && { maxWidth: titleWidth }]}>
          <Text style={styles.department} numberOfLines={1}>{department.toUpperCase()}</Text>
          <Text style={styles.position}>{position}</Text>
        </View>
      ),
      headerRight: () => (
        <View style={styles.headerActions} onLayout={(e) => setActionsWidth(e.nativeEvent.layout.width)}>
          <TouchableOpacity style={styles.searchButton} onPress={onSearch} hitSlop={4} accessibilityRole="button" accessibilityLabel={t.searchAisle}>
            <Ionicons name="search" size={18} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.mapButton} onPress={onMap} accessibilityRole="button" hitSlop={{ top: 6, bottom: 6 }}>
            <Ionicons name="map-outline" size={16} color={colors.text} />
            <Text style={styles.mapText}>{t.map}</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, department, position, onMap, onSearch, t, actionsWidth, titleWidth]);
  // Back to the plain title once the walk leaves the aisles
  useEffect(() => () => navigation.setOptions({ headerTitle: nav.storeWalk, headerTitleAlign: undefined, headerRight: undefined }), [navigation, nav]);
}

// Back in the aisles steps back to the department's route instead of leaving the walk. The native stack can't reliably
// cancel its own Back, so the aisles carry their own button and stop the swipe; Android's back key does the same.
// Null (a walk opened from the cart or checkout, which starts in the aisles) keeps the normal Back, which leaves
function useAisleBack(onBack: (() => void) | null) {
  const navigation = useNavigation();
  const c = useStrings("common");
  useEffect(() => {
    if (!onBack) return;
    navigation.setOptions({
      gestureEnabled: false,
      headerBackVisible: false,
      headerLeft: () => (
        <TouchableOpacity style={styles.backButton} onPress={onBack} accessibilityRole="button" accessibilityLabel={c.back}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
      ),
    });
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { onBack(); return true; });
    return () => {
      sub.remove();
      navigation.setOptions({ gestureEnabled: true, headerBackVisible: true, headerLeft: undefined });
    };
  }, [navigation, onBack, c]);
}

// `forList`: the walk fills the monthly list, and finishing or the bag goes back to it
function Aisles({ walk, onBack, onFinish, forList }: { walk: StoreWalk; onBack: (() => void) | null; onFinish: () => void; forList: boolean }) {
  const t = useStrings("storeWalk");
  const { getLocalizedName } = useLanguage();
  const [mapOpen, setMapOpen] = useState(false);
  const slide = useAisleSlide();
  const department = walk.route!.departments.find((d) => d.id === walk.route!.departmentId)!;
  const next = walk.stops[walk.index + 1];
  const prev = walk.index > 0 ? walk.stops[walk.index - 1] : undefined;
  const here = walk.aisle && walk.aisle !== "error" ? new Set([...walk.aisle.due, ...walk.aisle.popular].map((sp) => sp.product.id)) : null;
  const addedHere = here ? walk.added.filter((l) => here.has(l.item.productId)).reduce((n, l) => n + l.added, 0) : 0;
  const leave = () => slide.go(walk.leave);
  // The cart is a tab, so going there ends the walk; it counts as walked, so the cart doesn't nudge for another
  const goToCart = () => {
    if (forList) return onFinish();
    walkSession.walked = true;
    router.navigate("/(tabs)/cart");
  };
  const openMap = useCallback(() => setMapOpen(true), []);
  const aisleId = walk.stop?.categoryId;
  const aisleName = walk.stop ? getLocalizedName(walk.stop) : "";
  const searchAisle = useCallback(
    () => aisleId && router.push({ pathname: "/search", params: { within: aisleId, withinName: aisleName } }),
    [aisleId, aisleName],
  );
  useAisleHeader(getLocalizedName(department), t.aisleOf(walk.index + 1, walk.stops.length), openMap, searchAisle);
  useAisleBack(onBack);
  const near = (stop: StoreWalkStop | undefined, onPress: () => void) =>
    stop ? { name: getLocalizedName(stop), label: getLocalizedName(stop), onPress } : null;
  return (
    <ShopFloor>
      <View style={styles.progressRow}><WalkProgress count={walk.stops.length} index={walk.index} /></View>
      <Animated.View style={slide.style}>
        {walk.stop && (
          <AisleView
            key={walk.stop.categoryId} stop={walk.stop} aisle={walk.aisle} onRetry={walk.retryAisle} slide={slide.x} wallPhoto={department.aisleImageUrl}
            prev={near(prev, () => slide.go(() => walk.jump(walk.index - 1), -1))}
            next={near(next, leave)}
          />
        )}
      </Animated.View>
      <WalkDock
        addedHere={addedHere} basket={walk.added.flatMap((l) => l.item.imageUrl ?? [])} next={next ? { name: getLocalizedName(next), imageUrl: next.imageUrl } : null}
        onBag={onFinish} onNext={leave} onCart={goToCart} forList={forList}
      />
      <AisleMapSheet
        visible={mapOpen} stops={walk.stops} index={walk.index} walked={walk.walked}
        onJump={(i) => slide.go(() => walk.jump(i), i < walk.index ? -1 : 1)} onFinish={onFinish} onClose={() => setMapOpen(false)} forList={forList}
      />
    </ShopFloor>
  );
}

function Walk({ from, departmentId }: { from?: string; departmentId?: string }) {
  const t = useStrings("storeWalk");
  const { selectedStore } = useStore();
  const [startedAt] = useState(Date.now);
  const fromBag = from === "cart" || from === "checkout";
  const forList = from === "monthly-list";
  const walk = useStoreWalk(selectedStore?.id, { skipCovered: fromBag, departmentId });
  const finish = forList ? () => router.back() : walk.finish;

  let body;
  if (walk.failed) body = <Message text={t.loadFailed} onRetry={walk.retry} />;
  else if (!walk.route) body = <Loader style={styles.spinner} />;
  else if (walk.stops.length === 0) body = <Message text={t.emptyStore} />;
  else if (walk.phase === "route") body = <WalkRoute route={walk.route} onPick={(id) => walk.switchDepartment(id, false)} onStart={walk.start} onOpen={walk.jump} />;
  else if (walk.phase === "aisle") body = <FlyProvider><Aisles walk={walk} onBack={fromBag ? null : walk.toRoute} onFinish={finish} forList={forList} /></FlyProvider>;
  else if (walk.phase === "department") {
    body = <NextDepartmentCard route={walk.route} walked={walk.walkedDepartments} onWalk={(id) => walk.switchDepartment(id, true)} onFinish={finish} forList={forList} />;
  } else body = <WalkSummary walk={walk} minutes={Math.max(1, Math.round((Date.now() - startedAt) / 60_000))} onBack={() => walk.jump(walk.index)} />;

  return (
    <ProductActionsProvider store={selectedStore ?? null}>
      <View style={styles.container}>{body}</View>
    </ProductActionsProvider>
  );
}

/**
 * Walk the store: a department's aisles one by one, like strolling the shop. From the cart, covered aisles are skipped;
 * from the monthly list, what's picked goes on the list
 */
export default function StoreWalkScreen() {
  const { from, departmentId } = useLocalSearchParams<{ from?: string; departmentId?: string }>();
  const walk = <Walk from={from} departmentId={departmentId} />;
  return from === "monthly-list" ? <ListCart>{walk}</ListCart> : walk;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  spinner: { marginTop: 48 },
  headerTitle: { flexShrink: 1 },
  progressRow: { paddingVertical: 6 },
  department: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 0.6, color: colors.primary },
  position: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary },
  backButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  searchButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  mapButton: {
    height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    flexDirection: "row", alignItems: "center", gap: 6,
  },
  mapText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  message: { alignItems: "center", paddingTop: 64, paddingHorizontal: 32, gap: 16 },
  messageText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, textAlign: "center" },
  retry: { height: 44, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.primary, justifyContent: "center" },
  retryText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
});
