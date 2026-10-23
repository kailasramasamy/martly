import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import type { BrandCampaignStatus } from "@martly/shared/constants";
import { useResource } from "../../../../lib/manage/use-resource";
import { ManageListScreen } from "../../ManageListScreen";
import { HeaderAction } from "../../HeaderAction";
import { ListRow } from "../../ui/ListRow";
import { SegmentedTabs, type SegmentOption } from "../../ui/SegmentedTabs";
import { StatusPill } from "../../ui/StatusPill";
import type { Campaign } from "../types";
import { dateRange, lengthLabel, statusTone } from "./campaign-utils";

type Filter = "ALL" | "LIVE" | "SCHEDULED" | "IN_REVIEW" | "PENDING_PAYMENT" | "ENDED" | "CLOSED";

const FILTERS: Record<Filter, BrandCampaignStatus[] | null> = {
  ALL: null,
  LIVE: ["LIVE"],
  SCHEDULED: ["SCHEDULED"],
  IN_REVIEW: ["IN_REVIEW"],
  PENDING_PAYMENT: ["PENDING_PAYMENT"],
  ENDED: ["ENDED"],
  CLOSED: ["CANCELLED", "REJECTED"],
};

const OPTIONS: SegmentOption<Filter>[] = [
  { value: "ALL", label: "All" },
  { value: "LIVE", label: "Live" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "IN_REVIEW", label: "In review" },
  { value: "PENDING_PAYMENT", label: "Awaiting payment" },
  { value: "ENDED", label: "Ended" },
  { value: "CLOSED", label: "Cancelled / Rejected" },
];

const ALL_TYPES = "ALL";

// One chip per package that has campaigns, so the row only offers types there are
function typeOptions(campaigns: Campaign[]): SegmentOption<string>[] {
  const names = [...new Set(campaigns.map((c) => c.product.name))].sort();
  return [{ value: ALL_TYPES, label: "All types" }, ...names.map((name) => ({ value: name, label: name }))];
}

export function CampaignList() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [type, setType] = useState(ALL_TYPES);
  const [refreshing, setRefreshing] = useState(false);
  const campaigns = useResource<Campaign[]>("/api/v1/brand-campaigns");

  const items = useMemo(() => {
    const statuses = FILTERS[filter];
    return (campaigns.data ?? []).filter((c) => (!statuses || statuses.includes(c.status)) && (type === ALL_TYPES || c.product.name === type));
  }, [campaigns.data, filter, type]);
  const types = useMemo(() => typeOptions(campaigns.data ?? []), [campaigns.data]);

  const refresh = async () => {
    setRefreshing(true);
    await campaigns.reload();
    setRefreshing(false);
  };

  const list = { items, loading: campaigns.loading, refreshing, loadingMore: false, error: campaigns.error, refresh, loadMore: () => undefined };

  return (
    <ManageListScreen
      title="Brand campaigns"
      list={list}
      filters={
        <View style={styles.filters}>
          <SegmentedTabs options={OPTIONS} value={filter} onChange={setFilter} />
          <SegmentedTabs options={types} value={type} onChange={setType} />
        </View>
      }
      headerRight={() => (
        <View style={styles.actions}>
          <HeaderAction icon="calendar-outline" accessibilityLabel="Campaign calendar" onPress={() => router.push("/manage/brand-campaigns/calendar")} />
          <HeaderAction accessibilityLabel="Book a campaign" onPress={() => router.push("/manage/brand-campaigns/new")} />
        </View>
      )}
      empty={{ icon: "megaphone-outline", title: "No campaigns", message: filter === "ALL" && type === ALL_TYPES ? "Book the first brand campaign." : "Nothing matches these filters." }}
      renderItem={(c) => {
        const tone = statusTone(c.status);
        return (
          <ListRow
            title={c.title}
            subtitle={c.product.name}
            caption={`${dateRange(c)} · ${lengthLabel(c)}`}
            imageUrl={c.brand.imageUrl}
            imageContain
            chevron
            trailing={<StatusPill label={tone.label} color={tone.color} bg={tone.bg} dot={c.status === "LIVE"} />}
            onPress={() => router.push(`/manage/brand-campaigns/${c.id}`)}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  filters: { gap: 8 },
  actions: { flexDirection: "row", alignItems: "center" },
});
