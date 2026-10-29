import { Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { LISTING_FEE } from "@martly/shared/constants";
import { colors, fonts } from "../../../constants/theme";
import { Button } from "../ui/Button";
import { SectionCard } from "../ui/SectionCard";
import { useEntitlements, listingsLeft } from "../marketing/use-entitlements";

export const LISTINGS_USED_UP = "You've used your free product listings";

export function OpenMarketingPlan({ style }: { style?: object }) {
  const router = useRouter();
  return <Button label="Open Marketing plan" variant="secondary" onPress={() => router.push("/manage/marketing-plan")} style={style} />;
}

/** Tells the owner what adding a product costs; never blocks taking photos */
export function ListingsNotice() {
  const { data } = useEntitlements();
  if (!data || data.listings.unlimited) return null;
  const left = listingsLeft(data);
  if (left > 0) return <Text style={styles.line}>{`Uses 1 of your ${left} product listings left`}</Text>;
  return (
    <SectionCard title="No product listings left">
      <Text style={styles.line}>{`Buy more listings for \u20B9${LISTING_FEE} each to add your own products.`}</Text>
      <OpenMarketingPlan style={styles.upsell} />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  line: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  upsell: { marginTop: 12 },
});
