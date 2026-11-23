import { Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../../lib/auth-context";
import { useResource } from "../../../lib/manage/use-resource";
import { LISTING_FEE } from "@martly/shared/constants";
import { colors, fonts } from "../../../constants/theme";
import { Button } from "../ui/Button";
import { SectionCard } from "../ui/SectionCard";

const canBuy = (role?: string) => role === "ORG_ADMIN" || role === "SUPER_ADMIN";

export const LISTINGS_USED_UP = "You've used your free product listings";

/** Stops a new own product before any photos: while the balance hasn't loaded nothing is blocked, and the API still refuses */
export function useListingsGate() {
  const { data, reload } = useResource<{ left: number | null; waiting: number }>("/api/v1/catalog-drafts/listings-left");
  const left = data?.left ?? null;
  return { left, waiting: data?.waiting ?? 0, blocked: left === 0, reload };
}

export function OpenMarketingPlan({ style }: { style?: object }) {
  const router = useRouter();
  return <Button label="Open Marketing plan" variant="secondary" onPress={() => router.push("/manage/marketing-plan")} style={style} />;
}

/** Tells the owner what adding a product costs, or takes the place of the capture screen when nothing is left */
export function ListingsNotice({ left, waiting }: { left: number | null; waiting: number }) {
  const { user } = useAuth();
  const router = useRouter();
  if (left === null) return null;
  if (left > 0) return <Text style={styles.line}>{`Uses 1 of your ${left} product listings left`}</Text>;
  if (waiting > 0) {
    return (
      <SectionCard title="Listings held by the queue">
        <Text style={styles.line}>{`${waiting} product${waiting === 1 ? " is" : "s are"} waiting in the queue and will use your remaining listings. Approve or discard ${waiting === 1 ? "it" : "them"} to add more.`}</Text>
        <Button label="Open queue" variant="secondary" onPress={() => router.push("/manage/catalog-drafts")} style={styles.upsell} />
      </SectionCard>
    );
  }
  return (
    <SectionCard title="No product listings left">
      <Text style={styles.line}>{canBuy(user?.role) ? `Buy more listings for \u20B9${LISTING_FEE} each to add your own products.` : "Ask your store owner to buy more listings."}</Text>
      {canBuy(user?.role) && <OpenMarketingPlan style={styles.upsell} />}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  line: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  upsell: { marginTop: 12 },
});
