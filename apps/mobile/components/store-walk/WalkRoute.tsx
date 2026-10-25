import { useEffect, useRef } from "react";
import { Animated, FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { StoreWalkDepartment, StoreWalkStop } from "@martly/shared/types";
import { colors, fonts } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import { useStrings } from "../../lib/i18n/use-strings";
import type { WalkRoute as Route } from "../../lib/types";
import { useEntrance } from "./motion";
import { ShelfRow } from "./ShelfRow";
import { ShopFloor } from "./ShopFloor";

const PATH_DOTS = 7;

type ChipProps = { department: StoreWalkDepartment; active: boolean; onPress: () => void; onLayout: (x: number) => void };

function DepartmentChip({ department, active, onPress, onLayout }: ChipProps) {
  const t = useStrings("storeWalk");
  const { getLocalizedName } = useLanguage();
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.8} onLayout={(e) => onLayout(e.nativeEvent.layout.x)}
      accessibilityRole="button" accessibilityState={{ selected: active }}
    >
      {department.imageUrl && <Image source={{ uri: department.imageUrl }} style={styles.chipImage} />}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{getLocalizedName(department)}</Text>
      {department.dueCount > 0 && (
        <View style={[styles.badge, active && styles.badgeActive]}><Text style={styles.badgeText}>{t.dueBadge(department.dueCount)}</Text></View>
      )}
    </TouchableOpacity>
  );
}

// The walking path down the floor: dotted, with the aisle's number where it meets the shelf
function Path({ n, last }: { n: number; last: boolean }) {
  return (
    <View style={styles.path} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.pathDots}>{Array.from({ length: PATH_DOTS }, (_, i) => <View key={i} style={styles.pathDot} />)}</View>
      <View style={styles.pathStop}><Text style={styles.pathStopText}>{n}</Text></View>
      {/* The last stop keeps an empty half below it, so its number sits level with the shelf like the others */}
      <View style={styles.pathDots}>{!last && Array.from({ length: PATH_DOTS }, (_, i) => <View key={i} style={styles.pathDot} />)}</View>
    </View>
  );
}

// An aisle as a shelf unit: its blade sign, then a shelf stocked with its best sellers. Tap it to start the walk there
function StopRow({ stop, n, last, onOpen }: { stop: StoreWalkStop; n: number; last: boolean; onOpen: () => void }) {
  const t = useStrings("storeWalk");
  const { getLocalizedName } = useLanguage();
  const entrance = useEntrance(Math.min(n, 8) * 60, 18);
  return (
    <Animated.View style={[styles.stopRow, entrance]}>
      <Path n={n} last={last} />
      <TouchableOpacity
        style={styles.unit} onPress={onOpen} activeOpacity={0.85}
        accessibilityRole="button" accessibilityLabel={`${t.aisleTag(n)}, ${getLocalizedName(stop)}`}
      >
        <View style={styles.unitHead}>
          <View style={styles.tag}><Text style={styles.tagText}>{t.aisleTag(n)}</Text></View>
          <Text style={styles.stopName} numberOfLines={1}>{getLocalizedName(stop)}</Text>
          {stop.dueCount > 0 && <View style={styles.due}><Text style={styles.dueText}>{t.dueBadge(stop.dueCount)}</Text></View>}
          {stop.inCart && stop.dueCount === 0 && <Ionicons name="bag-check-outline" size={16} color={colors.primary} accessibilityLabel={t.inBag} />}
        </View>
        {stop.packs.length > 0
          ? <ShelfRow images={stop.packs} />
          : stop.imageUrl && <Image source={{ uri: stop.imageUrl }} style={styles.stopImage} />}
      </TouchableOpacity>
    </Animated.View>
  );
}

// The department strip, scrolled so the chosen chip shows in full with a little of the one before it
function DepartmentChips({ route, onPick }: { route: Route; onPick: (id: string) => void }) {
  const scroll = useRef<ScrollView>(null);
  const offsets = useRef(new Map<string, number>());
  const reveal = (id: string) => {
    const x = offsets.current.get(id);
    if (x !== undefined) scroll.current?.scrollTo({ x: Math.max(0, x - 48), animated: true });
  };
  useEffect(() => reveal(route.departmentId), [route.departmentId]);
  return (
    <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={styles.chipsContent}>
      {route.departments.map((d) => (
        <DepartmentChip
          key={d.id} department={d} active={d.id === route.departmentId} onPress={() => onPick(d.id)}
          onLayout={(x) => {
            offsets.current.set(d.id, x);
            if (d.id === route.departmentId) reveal(d.id);
          }}
        />
      ))}
    </ScrollView>
  );
}

/** Before the walk: the departments to pick from, and the chosen one's aisles in shelf order */
interface Props {
  route: Route;
  onPick: (departmentId: string) => void;
  onStart: () => void;
  /** Start the walk at this aisle (its index in the route) */
  onOpen: (index: number) => void;
}

export function WalkRoute({ route, onPick, onStart, onOpen }: Props) {
  const t = useStrings("storeWalk");
  const { getLocalizedName } = useLanguage();
  const insets = useSafeAreaInsets();
  const department = route.departments.find((d) => d.id === route.departmentId)!;
  const name = getLocalizedName(department);
  return (
    <ShopFloor>
      <DepartmentChips route={route} onPick={onPick} />
      <FlatList
        key={route.departmentId}
        data={route.stops}
        keyExtractor={(s) => s.categoryId}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Text style={styles.introText}>{department.dueCount > 0 ? t.routeIntroDue(name) : t.routeIntro(name)}</Text>
            <Text style={styles.title}>{name} · {t.aisles(route.stops.length)}</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <StopRow stop={item} n={index + 1} last={index === route.stops.length - 1} onOpen={() => onOpen(index)} />
        )}
      />
      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
        <TouchableOpacity style={styles.start} onPress={onStart} activeOpacity={0.85} accessibilityRole="button">
          <Text style={styles.startText}>{t.walkAisles(route.stops.length)}</Text>
          <Ionicons name="arrow-forward" size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </ShopFloor>
  );
}

const styles = StyleSheet.create({
  chips: { flexGrow: 0, flexShrink: 0, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
  chipsContent: { gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  chip: {
    height: 40, paddingLeft: 4, paddingRight: 14, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
  },
  chipImage: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#ffffff" },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.text },
  chipTextActive: { color: "#ffffff" },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: "#fef3c7" },
  badgeActive: { backgroundColor: colors.salePill },
  badgeText: { fontFamily: fonts.extrabold, fontSize: 10, color: "#78350f" },
  list: { paddingBottom: 24 },
  intro: { paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  introText: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.textSecondary },
  title: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.text },
  stopRow: { flexDirection: "row", paddingRight: 16 },
  path: { width: 44, alignItems: "center" },
  pathDots: { flex: 1, justifyContent: "space-evenly", alignItems: "center" },
  pathDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#94a3b8" },
  pathStop: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  pathStopText: { fontFamily: fonts.extrabold, fontSize: 12, color: "#ffffff" },
  unit: {
    flex: 1, marginVertical: 6, padding: 10, paddingBottom: 8, gap: 8, borderRadius: 14, backgroundColor: colors.background,
    shadowColor: "#0f172a", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  unitHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  tag: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.primaryDark },
  tagText: { fontFamily: fonts.extrabold, fontSize: 10, letterSpacing: 0.5, color: "#ffffff" },
  stopImage: { width: 48, height: 48, borderRadius: 8, alignSelf: "center" },
  stopName: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.text },
  due: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: "#fef3c7" },
  dueText: { fontFamily: fonts.extrabold, fontSize: 11, color: "#78350f" },
  footer: { paddingTop: 12, paddingHorizontal: 16, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
  start: { height: 52, borderRadius: 12, backgroundColor: colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  startText: { fontFamily: fonts.extrabold, fontSize: 16, color: "#ffffff" },
});
