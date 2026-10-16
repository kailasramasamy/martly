import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { useResource } from "../../../lib/manage/use-resource";
import { ManageListScreen } from "../ManageListScreen";
import { HeaderAction } from "../HeaderAction";
import { ListRow } from "../ui/ListRow";
import { SegmentedTabs, type SegmentOption } from "../ui/SegmentedTabs";
import type { BrandListItem, BrandSegment, BrandSummary } from "./brand-types";

function segmentOptions(summary: BrandSummary | null): SegmentOption<BrandSegment>[] {
  return [
    { value: "all", label: "All", count: summary?.total },
    { value: "brandStores", label: "Brand stores", count: summary?.brandStores },
    { value: "addedLast30d", label: "New", count: summary?.addedLast30d },
    { value: "withoutLogo", label: "No logo", count: summary?.withoutLogo },
    { value: "withoutProducts", label: "No products", count: summary?.withoutProducts },
  ];
}

export function BrandListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [segment, setSegment] = useState<BrandSegment>("all");
  const { data: summary } = useResource<BrandSummary>("/api/v1/brands/summary");
  const params = useMemo(() => ({ q, segment: segment === "all" ? "" : segment }), [q, segment]);
  const list = usePagedList<BrandListItem>("/api/v1/brands", params);
  const canCreate = can(user, "brands", "create");

  return (
    <ManageListScreen
      title="Brands"
      list={list}
      search={{ value: q, onChange: setQ, placeholder: "Search brands" }}
      headerRight={canCreate ? () => <HeaderAction onPress={() => router.push("/manage/brands/new")} accessibilityLabel="New brand" /> : undefined}
      filters={<SegmentedTabs options={segmentOptions(summary)} value={segment} onChange={setSegment} />}
      empty={{ icon: "pricetag-outline", title: "No brands found" }}
      renderItem={(b) => (
        <ListRow
          title={b.name}
          subtitle={`${b._count.products} product${b._count.products === 1 ? "" : "s"}`}
          imageUrl={b.imageUrl}
          imageContain
          railColor={b.themeColor ?? undefined}
          chevron
          onPress={() => router.push(`/manage/brands/${b.id}`)}
        />
      )}
    />
  );
}
