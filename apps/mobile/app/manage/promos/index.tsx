import { useState } from "react";
import { useRouter } from "expo-router";
import type { PromoSummary } from "@martly/shared/types";
import { ManageListScreen } from "../../../components/manage/ManageListScreen";
import { HeaderAction } from "../../../components/manage/HeaderAction";
import { ListRow } from "../../../components/manage/ui/ListRow";
import { StatusPill } from "../../../components/manage/ui/StatusPill";
import { SegmentedTabs } from "../../../components/manage/ui/SegmentedTabs";
import { formatDate, timeAgo } from "../../../components/manage/ui/dates";
import { PROMO_STATUS, discountLabel } from "../../../components/manage/marketing/promo-utils";
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

export default function PromosScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("");
  const list = usePagedList<PromoSummary>("/api/v1/promos", { status: filter });

  return (
    <ManageListScreen
      title="Promotions"
      list={list}
      filters={<SegmentedTabs options={TABS} value={filter} onChange={setFilter} />}
      headerRight={() => <HeaderAction onPress={() => router.push("/manage/promos/new")} accessibilityLabel="New promo" />}
      empty={{ icon: "megaphone-outline", title: "No promotions", message: "Describe what to promote and the AI drafts a banner, copy and discount." }}
      renderItem={(p) => {
        const status = PROMO_STATUS[p.status];
        return (
          <ListRow
            title={p.title ?? p.brief}
            subtitle={`${discountLabel(p.discountType, p.discountValue)} · ${p.productCount} products`}
            caption={windowText(p)}
            imageUrl={p.imageUrl}
            railColor={status.color}
            trailing={<StatusPill {...status} dot={p.status === "LIVE"} />}
            onPress={() => router.push(`/manage/promos/${p.id}`)}
            chevron
          />
        );
      }}
    />
  );
}
