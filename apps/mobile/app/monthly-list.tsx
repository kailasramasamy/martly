import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SectionList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "../constants/theme";
import { useLanguage } from "../lib/language-context";
import { useStore } from "../lib/store-context";
import { strings } from "../lib/i18n";
import { useStrings } from "../lib/i18n/use-strings";
import { formatDate } from "../lib/i18n/format";
import type { MonthlyList, MonthlyListCheck, StoreProduct } from "../lib/types";
import { Loader } from "../components/Loader";
import { withSignIn } from "../components/SignInPrompt";
import { ListRow } from "../components/monthly-list/ListRow";
import { SetupSheet, type ListSettings } from "../components/monthly-list/SetupSheet";
import { ChangesSheet } from "../components/monthly-list/ChangesSheet";
import { OrderSheet } from "../components/monthly-list/OrderSheet";
import { MonthlyListEmpty } from "../components/monthly-list/MonthlyListEmpty";
import { SwapSheet } from "../components/monthly-list/SwapSheet";
import { AddItemSheet } from "../components/monthly-list/AddItemSheet";
import { listSavesDone } from "../components/monthly-list/list-saves";
import { useMonthlyList, type LinesEdit } from "../components/monthly-list/use-monthly-list";
import { useCheckoutHandoff, useMonthPlan, type Verdict } from "../components/monthly-list/use-month-plan";
import { useQuickOrder } from "../components/monthly-list/use-quick-order";

type Sheet = "setup" | "changes" | "order" | "swap" | "add" | null;

/** "November", and the day next month's list will be ready, e.g. "1 Dec" */
function useMonthNames(list: MonthlyList) {
  return useMemo(() => {
    const [y, m] = list.month.split("-").map(Number);
    return {
      month: formatDate(new Date(y, m - 1, 1), { month: "long" }),
      next: formatDate(new Date(y, m, list.reminderDay), { day: "numeric", month: "short" }),
    };
  }, [list.month, list.reminderDay]);
}

/** Groups the lines by aisle, in the order the list has them */
function sectionsOf(list: MonthlyList, aisleName: (a: NonNullable<MonthlyList["items"][number]["aisle"]>) => string) {
  const groups = new Map<string, { title: string; data: MonthlyList["items"] }>();
  for (const item of list.items) {
    const key = item.aisle?.id ?? "";
    const group = groups.get(key) ?? { title: item.aisle ? aisleName(item.aisle) : "", data: [] };
    group.data.push(item);
    groups.set(key, group);
  }
  return [...groups.values()];
}

// Settling a check: this month's swap or skip stays on the screen; pack switches, removals and new usuals change the list
function useAnswer(list: MonthlyList, plan: ReturnType<typeof useMonthPlan>, saveLines: ReturnType<typeof useMonthlyList>["saveLines"]) {
  return useCallback((c: MonthlyListCheck, v: Verdict) => {
    plan.settle(c, v);
    if (c.kind === "OUT_OF_STOCK") {
      if (v === "yes" && c.swap) plan.swapFor(c.itemId, c.swap);
      else plan.leaveOut(c.itemId);
      return;
    }
    const item = c.kind === "NEW_USUAL" ? null : list.items.find((i) => i.id === c.itemId);
    if (c.kind === "BIGGER_PACK" && v === "yes" && item) {
      const bigger = { productId: c.bigger.product.id, variantId: c.bigger.variantId, quantity: c.packs };
      void saveLines(list.id, (lines) => lines.map((l) => (l.variantId === item.variantId ? bigger : l)));
    }
    // By product, so it still goes if its pack was just switched
    if (c.kind === "LAPSED" && v === "no" && item) void saveLines(list.id, (lines) => lines.filter((l) => l.productId !== item.productId));
    if (c.kind === "NEW_USUAL" && v === "yes") {
      const usual = { productId: c.product.product.id, variantId: c.product.variantId, quantity: 1 };
      void saveLines(list.id, (lines) => (lines.some((l) => l.variantId === usual.variantId) ? lines : [...lines, usual]));
    }
  }, [list, plan, saveLines]);
}

// Changes made here stay on the list for later months: a size or brand swap (in the same place, same quantity, merged into
// that size if it's already on the list), a removal, a new line
function useLineEdits(list: MonthlyList, saveLines: ReturnType<typeof useMonthlyList>["saveLines"]) {
  return useMemo(() => {
    const save = (edit: LinesEdit) => void saveLines(list.id, edit);
    const variantOf = (itemId: string) => list.items.find((i) => i.id === itemId)?.variantId;
    const lineOf = (sp: StoreProduct, quantity: number) => ({ productId: sp.product.id, variantId: sp.variant.id, quantity });
    return {
      swap: (itemId: string, sp: StoreProduct) => save((lines) => {
        const at = lines.findIndex((l) => l.variantId === variantOf(itemId));
        const there = lines.findIndex((l) => l.variantId === sp.variant.id);
        if (at < 0 || at === there) return lines;
        const merged = lines.map((l, i) => (i === at ? lineOf(sp, l.quantity + (there >= 0 ? lines[there].quantity : 0)) : l));
        return there >= 0 ? merged.filter((_, i) => i !== there) : merged;
      }),
      remove: (itemId: string) => save((lines) => lines.filter((l) => l.variantId !== variantOf(itemId))),
      add: (sp: StoreProduct) => save((lines) => (lines.some((l) => l.variantId === sp.variant.id) ? lines : [...lines, lineOf(sp, 1)])),
    };
  }, [list, saveLines]);
}

// Back on the list from a walk that filled it (or anywhere else): reload once the walk's saves have gone through
function useReloadOnReturn(reload: () => Promise<void>) {
  const first = useRef(true);
  useFocusEffect(useCallback(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void listSavesDone().then(reload);
  }, [reload]));
}

function AddRow({ onPress }: { onPress: () => void }) {
  const t = useStrings("monthlyList");
  return (
    <TouchableOpacity style={styles.add} onPress={onPress} accessibilityRole="button">
      <Ionicons name="add-circle" size={22} color={colors.primary} />
      <Text style={styles.addText}>{t.addItem}</Text>
    </TouchableOpacity>
  );
}

function Header({ list, toCheck, onChecks }: { list: MonthlyList; toCheck: number; onChecks: () => void }) {
  const t = useStrings("monthlyList");
  const { month } = useMonthNames(list);
  return (
    <View style={styles.header}>
      <Text style={styles.month}>{t.listFor(month)}</Text>
      <Text style={styles.asOf}>{t.pricesAsOf(formatDate(new Date(), { day: "numeric", month: "short" }))}</Text>
      {toCheck > 0 && (
        <TouchableOpacity style={styles.checks} onPress={onChecks} accessibilityRole="button">
          <View style={styles.checksIcon}><Ionicons name="alert-circle" size={20} color="#b45309" /></View>
          <Text style={styles.checksText}>{t.toCheck(toCheck)}</Text>
          <Ionicons name="chevron-forward" size={18} color="#b45309" />
        </TouchableOpacity>
      )}
    </View>
  );
}

function Footer({ lines, of, total, onOrder }: { lines: number; of: number; total: number; onOrder: () => void }) {
  const t = useStrings("monthlyList");
  const insets = useSafeAreaInsets();
  const rupees = Math.round(total).toLocaleString("en-IN");
  return (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.sum}>
        <Text style={styles.count}>{t.count(lines, of)}</Text>
        <Text style={styles.total}>{`₹${rupees}`}</Text>
      </View>
      <View style={styles.buttons}>
        <TouchableOpacity style={styles.walk} onPress={() => router.push({ pathname: "/store-walk", params: { from: "monthly-list" } })} accessibilityRole="button">
          <Text style={styles.walkText}>{t.walkStore}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.order, lines === 0 && styles.disabled]} disabled={lines === 0} onPress={onOrder} accessibilityRole="button">
          <Text style={styles.orderText}>{t.order(rupees)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// The reminder day in the header; tapping it opens the settings
function useDayPill(list: MonthlyList, onPress: () => void) {
  const t = useStrings("monthlyList");
  const navigation = useNavigation();
  const { reminderDay, pushOn, whatsappOn, isActive } = list;
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity style={styles.dayPill} onPress={onPress} accessibilityRole="button">
          <Text style={styles.dayPillText}>{isActive ? t.everyDay(reminderDay) : t.paused}</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, reminderDay, isActive, t, onPress]);
  return useMemo<ListSettings>(() => ({ reminderDay, pushOn, whatsappOn, isActive }), [reminderDay, pushOn, whatsappOn, isActive]);
}

function ListScreen({ list, hook, openOrder }: { list: MonthlyList; hook: ReturnType<typeof useMonthlyList>; openOrder: boolean }) {
  const { getLocalizedName } = useLanguage();
  const [sheet, setSheet] = useState<Sheet>(openOrder ? "order" : null);
  const [swapId, setSwapId] = useState<string | null>(null);
  const plan = useMonthPlan(list);
  const answer = useAnswer(list, plan, hook.saveLines);
  const edits = useLineEdits(list, hook.saveLines);
  const sections = useMemo(() => sectionsOf(list, getLocalizedName), [list, getLocalizedName]);
  const onList = useMemo(() => new Set(list.items.map((i) => i.variantId)), [list.items]);
  const setQuantity = useCallback((itemId: string, quantity: number) =>
    (quantity < 1 ? edits.remove(itemId) : hook.setQuantity(itemId, quantity)), [edits, hook.setQuantity]);
  const openSwap = useCallback((itemId: string) => { setSwapId(itemId); setSheet("swap"); }, []);
  const outChecks = useMemo(() => new Map(list.changes.flatMap((c) => (c.kind === "OUT_OF_STOCK" ? [[c.itemId, c] as const] : []))), [list.changes]);
  const swapMonth = useCallback((itemId: string) => {
    const check = outChecks.get(itemId);
    if (check) answer(check, "yes");
  }, [outChecks, answer]);
  const settings = useDayPill(list, useCallback(() => setSheet("setup"), []));
  const close = () => setSheet(null);
  return (
    <View style={styles.page}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={<Header list={list} toCheck={plan.open.length} onChecks={() => setSheet("changes")} />}
        ListFooterComponent={<AddRow onPress={() => setSheet("add")} />}
        renderSectionHeader={({ section }) => (
          <View style={styles.aisle}><Text style={styles.aisleText}>{section.title.toUpperCase()}</Text></View>
        )}
        renderItem={({ item, index, section }) => (
          <ListRow
            item={item} on={!plan.skipped.has(item.id)} swap={plan.swaps.get(item.id)} last={index === section.data.length - 1}
            onToggle={plan.toggle} onQuantity={setQuantity} onOpen={openSwap}
            alternative={outChecks.get(item.id)?.swap} onSwap={swapMonth}
          />
        )}
      />
      <Footer lines={plan.lines.length} of={list.items.length} total={plan.total} onOrder={() => setSheet("order")} />
      <SwapSheet
        visible={sheet === "swap"} listId={list.id} item={list.items.find((i) => i.id === swapId) ?? null}
        onPick={(itemId, sp) => { close(); edits.swap(itemId, sp); }} onRemove={(itemId) => { close(); edits.remove(itemId); }} onClose={close}
      />
      <AddItemSheet visible={sheet === "add"} storeId={list.storeId} onList={onList} onAdd={edits.add} onClose={close} />
      <SetupSheet visible={sheet === "setup"} initial={settings} editing replaces={false} onSave={(s) => hook.saveSettings(list.id, s)} onClose={close} />
      <ChangesSheet visible={sheet === "changes"} list={list} verdicts={plan.verdicts} onAnswer={answer} onClose={close} />
      <ListOrderSheet list={list} hook={hook} plan={plan} visible={sheet === "order"} onClose={close} />
    </View>
  );
}

// One-tap order for this month's lines, or checkout; placing it reloads the list (it's ordered for the month)
function ListOrderSheet({ list, hook, plan, visible, onClose }: {
  list: MonthlyList; hook: ReturnType<typeof useMonthlyList>; plan: ReturnType<typeof useMonthPlan>; visible: boolean; onClose: () => void;
}) {
  const toCheckout = useCheckoutHandoff(list.id, plan.lines);
  const quick = useQuickOrder(list.id, list.storeId, plan.lines, visible);
  const names = useMonthNames(list);
  const closeOrder = () => {
    if (quick.state.phase === "placed") void hook.reload();
    onClose();
  };
  return (
    <OrderSheet
      visible={visible} month={names.month} next={names.next} state={quick.state} onPlace={quick.place}
      onCheckout={() => { onClose(); toCheckout(); }} onWalk={() => { closeOrder(); router.push("/store-walk"); }}
      onView={(id) => { closeOrder(); router.push(`/order/${id}`); }} onEdit={onClose} onClose={closeOrder}
    />
  );
}

/** The monthly provision list: back each month at today's prices, checked, changed and ordered in one tap */
function MonthlyListScreen() {
  const { selectedStore } = useStore();
  const { order } = useLocalSearchParams<{ order?: string }>();
  const hook = useMonthlyList(selectedStore?.id);
  const { state } = hook;
  useReloadOnReturn(hook.reload);
  if (state.kind === "loading") return <View style={[styles.page, styles.center]}><Loader /></View>;
  if (state.kind === "ready") return <ListScreen list={state.list} hook={hook} openOrder={order === "1"} />;
  return <MonthlyListEmpty failed={state.kind === "failed"} onRetry={hook.reload} onCreate={(s) => hook.create({ source: "ORDER", ...s })} />;
}

export default withSignIn(MonthlyListScreen, "calendar-outline", () => ({
  title: strings("monthlyList").signInTitle,
  message: strings("monthlyList").signInMessage,
}));

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  content: { paddingBottom: 24 },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  month: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text },
  asOf: { marginTop: 2, fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  checks: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: "#fde68a", backgroundColor: "#fffbeb" },
  checksIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#fef3c7", alignItems: "center", justifyContent: "center" },
  checksText: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: "#78350f" },
  aisle: { marginTop: 16, marginHorizontal: 16, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4, backgroundColor: "#ffffff", borderTopLeftRadius: 14, borderTopRightRadius: 14, borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border },
  aisleText: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 0.6, color: colors.textSecondary },
  dayPill: { height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: colors.border, justifyContent: "center" },
  dayPillText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  footer: { paddingHorizontal: 16, paddingTop: 12, gap: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: "#ffffff" },
  sum: { flexDirection: "row", justifyContent: "space-between" },
  count: { fontFamily: fonts.bold, fontSize: 13, color: colors.textSecondary },
  total: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.text },
  buttons: { flexDirection: "row", gap: 10 },
  walk: { flex: 1, height: 50, borderRadius: 12, borderWidth: 1.5, borderColor: "#cbd5e1", alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  walkText: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.text, textAlign: "center" },
  order: { flex: 1.6, height: 50, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  orderText: { fontFamily: fonts.extrabold, fontSize: 15, color: "#ffffff" },
  disabled: { opacity: 0.5 },
  add: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, marginTop: 16, marginHorizontal: 16, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#99d5cf", backgroundColor: "#ffffff" },
  addText: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.primary },
});
