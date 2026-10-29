import { View, Text, TouchableOpacity, Linking, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { Button } from "../ui/Button";
import { formatDate } from "../ui/dates";
import { useToast } from "../../../lib/toast-context";
import { CATALOG_SIZE_LABEL, OWN_LISTINGS_INCLUDED } from "@martly/shared/constants";
import { colors, fonts, radius } from "../../../constants/theme";
import { useEntitlements } from "./use-entitlements";
import type { Entitlements } from "./plan-types";

type Icon = keyof typeof Ionicons.glyphMap;

function included(e: Entitlements): { icon: Icon; title: string; body: string }[] {
  const promotions = e.promotions.planTotal;
  return [
    { icon: "megaphone-outline", title: `${promotions} promotions a month`, body: "Tell us the offer by typing or speaking. We make the banner and put it live." },
    ...(e.pushIncluded ? [{ icon: "notifications-outline" as Icon, title: "Customer notifications", body: "Every promotion reaches your customers' phones." }] : []),
    { icon: "globe-outline", title: "Web store on martlyshop.in", body: "Customers can browse your shop from any browser." },
    { icon: "pricetags-outline", title: `${OWN_LISTINGS_INCLUDED[e.plan?.code ?? ""] ?? 0} of your own products listed free`, body: `Plus all ${CATALOG_SIZE_LABEL} products in the Martly catalog.` },
    { icon: "add-circle-outline", title: "Extra promotions any time", body: "Buy more when you need them. They never expire." },
  ];
}

function Hero({ e }: { e: Entitlements }) {
  const until = e.subscription?.renewsAt ?? e.paidThrough;
  return (
    <View style={styles.hero}>
      <View style={styles.medal}>
        <Ionicons name="checkmark" size={34} color={colors.primaryDark} />
      </View>
      <Text style={styles.heroEyebrow}>Payment received</Text>
      <Text style={styles.heroTitle}>{`You're on ${e.plan?.name ?? "your new plan"}`}</Text>
      {until ? <Text style={styles.heroLine}>{`${e.subscription?.renewsAt ? "Renews" : "Active until"} ${formatDate(until)}`}</Text> : null}
    </View>
  );
}

function WebStoreCard({ store }: { store: Entitlements["webStores"][number] }) {
  const toast = useToast();
  const copy = async () => {
    await Clipboard.setStringAsync(store.url);
    toast.show("Link copied", "success");
  };
  return (
    <SectionCard title="Your web store is live">
      <Text style={styles.storeName}>{store.name}</Text>
      <TouchableOpacity style={styles.address} onPress={copy} accessibilityRole="button" accessibilityLabel={`Copy ${store.url}`}>
        <Ionicons name="lock-closed" size={14} color={colors.primary} />
        <Text style={styles.url} numberOfLines={1}>{store.url.replace("https://", "")}</Text>
        <Ionicons name="copy-outline" size={16} color={colors.textSecondary} />
      </TouchableOpacity>
      <Button label="Open your web store" icon="open-outline" onPress={() => Linking.openURL(store.url)} style={styles.open} />
    </SectionCard>
  );
}

/** After paying for Growth or Pro: what the plan includes and the web store it just switched on */
export function PlanActiveScreen() {
  const router = useRouter();
  const entitlements = useEntitlements();
  const e = entitlements.data;

  return (
    <ManageStackScreen
      title="Plan active" loading={entitlements.loading} error={entitlements.error} onRetry={entitlements.reload}
      actions={<Button label="Done" variant="secondary" onPress={() => router.back()} />}
    >
      {e ? (
        <>
          <Hero e={e} />
          {e.webStores.length
            ? e.webStores.map((s) => <WebStoreCard key={s.url} store={s} />)
            : <SectionCard title="Web store"><Text style={styles.muted}>Your web store goes live on martlyshop.in as soon as your store launches.</Text></SectionCard>}
          <SectionCard title="Included every month">
            {included(e).map((item) => (
              <View key={item.title} style={styles.row}>
                <View style={styles.rowIcon}><Ionicons name={item.icon} size={20} color={colors.primary} /></View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.muted}>{item.body}</Text>
                </View>
              </View>
            ))}
          </SectionCard>
          {e.promotions.planTotal > 0 ? <Button label="Start your first promotion" icon="rocket-outline" variant="ghost" onPress={() => router.replace("/manage/promos/new")} /> : null}
        </>
      ) : null}
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.primaryDark, borderRadius: radius.lg, paddingVertical: 28, paddingHorizontal: 20, alignItems: "center" },
  medal: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", borderWidth: 6, borderColor: "rgba(251,191,36,0.35)" },
  heroEyebrow: { fontFamily: fonts.bold, fontSize: 11, color: "#99f6e4", letterSpacing: 0.9, textTransform: "uppercase", marginTop: 16 },
  heroTitle: { fontFamily: fonts.extrabold, fontSize: 26, color: "#fff", marginTop: 4, textAlign: "center" },
  heroLine: { fontFamily: fonts.medium, fontSize: 13, color: "#ccfbf1", marginTop: 4 },
  storeName: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text },
  address: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, marginTop: 10, paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  url: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  open: { marginTop: 12 },
  row: { flexDirection: "row", gap: 12, paddingVertical: 8 },
  rowIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#ccfbf1", alignItems: "center", justifyContent: "center" },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  muted: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginTop: 2 },
});
