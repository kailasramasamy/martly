import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ManageListScreen } from "../../../components/manage/ManageListScreen";
import { HeaderAction } from "../../../components/manage/HeaderAction";
import { ListRow } from "../../../components/manage/ui/ListRow";
import { StatusPill } from "../../../components/manage/ui/StatusPill";
import { formatINR } from "../../../components/manage/ui/tokens";
import { TONES } from "../../../components/manage/marketing/common";
import { DURATION_LABEL } from "../../../components/manage/marketing/MembershipPlanForm";
import type { MembershipPlan } from "../../../components/manage/marketing/loyalty-types";
import { usePagedList } from "../../../lib/manage/use-paged-list";

export default function MembershipPlansScreen() {
  const router = useRouter();
  const list = usePagedList<MembershipPlan>("/api/v1/memberships/plans");

  return (
    <ManageListScreen
      title="Memberships"
      list={list}
      headerRight={() => (
        <View style={styles.headerRight}>
          <HeaderAction icon="people-outline" onPress={() => router.push("/manage/membership-plans/subscribers")} accessibilityLabel="Subscribers" />
          <HeaderAction onPress={() => router.push("/manage/membership-plans/new")} accessibilityLabel="New plan" />
        </View>
      )}
      empty={{ icon: "diamond-outline", title: "No membership plans", message: "Create a plan to offer free delivery and bonus points." }}
      renderItem={(p) => {
        const tone = p.isActive ? TONES.green : TONES.slate;
        return (
          <ListRow
            title={p.name}
            subtitle={`${DURATION_LABEL[p.duration] ?? p.duration}${p.freeDelivery ? " · Free delivery" : ""} · ${Number(p.loyaltyMultiplier)}x points`}
            caption={p.description ?? undefined}
            railColor={tone.color}
            value={formatINR(p.price)}
            trailing={<StatusPill label={p.isActive ? "Active" : "Inactive"} {...tone} />}
            onPress={() => router.push(`/manage/membership-plans/${p.id}`)}
            chevron
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: "row" },
});
