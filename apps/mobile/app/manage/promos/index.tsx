import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import type { PromoSummary } from "@martly/shared/types";
import { ManageListScreen } from "../../../components/manage/ManageListScreen";
import { HeaderAction } from "../../../components/manage/HeaderAction";
import { ListRow } from "../../../components/manage/ui/ListRow";
import { StatusPill } from "../../../components/manage/ui/StatusPill";
import { SegmentedTabs } from "../../../components/manage/ui/SegmentedTabs";
import { NewPromoSheet } from "../../../components/manage/marketing/NewPromoSheet";
import { formatDate, timeAgo } from "../../../components/manage/ui/dates";
import { PROMO_KIND, PROMO_STATUS, discountLabel } from "../../../components/manage/marketing/promo-utils";
import { usePagedList } from "../../../lib/manage/use-paged-list";

type Filter = "" | PromoSummary["status"];

const TABS: { value: Filter; label: string }[] = [
  { value: "", label: "All" },
  { value: "DRAFTING", label: "Drafting" },
  { value: "READY", label: "Ready" },
  { value: "LIVE", label: "Live" },
  { value: "ENDED", label: "Ended" },
  { value: "FAILED", label: "Failed" },
];


function windowText(p: PromoSummary): string {
  if (!p.startsAt && !p.endsAt) return `Created ${timeAgo(p.createdAt)}`;
  return `${p.startsAt ? formatDate(p.startsAt) : "—"} → ${p.endsAt ? formatDate(p.endsAt) : "—"}`;
}

function PromoRow({ promo: p, onPress }: { promo: PromoSummary; onPress: () => void }) {
  const status = PROMO_STATUS[p.status];
  return (
    <ListRow
      title={p.title ?? p.brief}
      subtitle={`${discountLabel(p.discountType, p.discountValue)} · ${p.productCount} products`}
      caption={windowText(p)}
      imageUrl={p.imageUrl}
      railColor={status.color}
      trailing={
        <View style={styles.badges}>
          <StatusPill {...status} dot={p.status === "LIVE"} />
          <StatusPill {...PROMO_KIND[p.kind]} />
        </View>
      }
      onPress={onPress}
      chevron
    />
  );
}

export default function PromosScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("");
  const [choosing, setChoosing] = useState(false);
  const list = usePagedList<PromoSummary>("/api/v1/promos", { status: filter });

  return (
    <>
      <ManageListScreen
        title="Promotions"
        list={list}
        filters={<SegmentedTabs options={TABS} value={filter} onChange={setFilter} />}
        headerRight={() => <HeaderAction onPress={() => setChoosing(true)} accessibilityLabel="New promo" />}
        empty={{ icon: "megaphone-outline", title: "No promotions", message: "Describe what to promote and the AI drafts a banner, copy and discount." }}
        renderItem={(p) => <PromoRow promo={p} onPress={() => router.push(`/manage/promos/${p.id}`)} />}
      />
      <NewPromoSheet
        visible={choosing}
        onPick={(href) => {
          setChoosing(false);
          router.push(href as never);
        }}
        onClose={() => setChoosing(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  badges: { alignItems: "flex-end", gap: 4 },
});
