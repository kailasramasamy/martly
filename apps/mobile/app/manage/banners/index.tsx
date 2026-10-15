import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { BannerPlacement, BannerPlacementLabels, BannerActionTypeLabels } from "@martly/shared/constants";
import { ManageListScreen } from "../../../components/manage/ManageListScreen";
import { HeaderAction } from "../../../components/manage/HeaderAction";
import { ListRow } from "../../../components/manage/ui/ListRow";
import { StatusPill } from "../../../components/manage/ui/StatusPill";
import { formatDate } from "../../../components/manage/ui/dates";
import { GroupHeader, TONES } from "../../../components/manage/marketing/common";
import type { Banner } from "../../../components/manage/marketing/types";
import { usePagedList } from "../../../lib/manage/use-paged-list";

interface GroupHeader {
  id: string;
  header: string;
}
type Row = Banner | GroupHeader;

const PLACEMENT_ORDER = Object.values(BannerPlacement) as string[];

function scopeText(b: Banner): string {
  return b.store?.name ?? b.organization?.name ?? "Global";
}

function scheduleText(b: Banner): string {
  if (!b.startsAt && !b.endsAt) return "Always on";
  return `${b.startsAt ? formatDate(b.startsAt) : "Now"} → ${b.endsAt ? formatDate(b.endsAt) : "open"}`;
}

function groupByPlacement(items: Banner[]): Row[] {
  const sorted = [...items].sort((a, b) => PLACEMENT_ORDER.indexOf(a.placement) - PLACEMENT_ORDER.indexOf(b.placement) || a.sortOrder - b.sortOrder);
  const rows: Row[] = [];
  let current = "";
  for (const b of sorted) {
    if (b.placement !== current) {
      current = b.placement;
      rows.push({ id: `h:${current}`, header: BannerPlacementLabels[current as BannerPlacement] ?? current });
    }
    rows.push(b);
  }
  return rows;
}

export default function BannersScreen() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const list = usePagedList<Banner>("/api/v1/banners", { q }, { pageSize: 100 });
  const rows = useMemo(() => groupByPlacement(list.items), [list.items]);

  return (
    <ManageListScreen<Row>
      title="Banners"
      list={{ ...list, items: rows }}
      search={{ value: q, onChange: setQ, placeholder: "Search banners" }}
      headerRight={() => <HeaderAction onPress={() => router.push("/manage/banners/new")} accessibilityLabel="New banner" />}
      empty={{ icon: "image-outline", title: "No banners yet", message: "Add a banner to promote offers on the home screen." }}
      renderItem={(row) => {
        if ("header" in row) return <GroupHeader label={row.header} />;
        const tone = row.isActive ? TONES.green : TONES.slate;
        return (
          <ListRow
            title={row.title}
            subtitle={`${BannerActionTypeLabels[row.actionType as keyof typeof BannerActionTypeLabels] ?? row.actionType} · ${scopeText(row)}`}
            caption={`Order ${row.sortOrder} · ${scheduleText(row)}`}
            imageUrl={row.imageUrl}
            railColor={tone.color}
            trailing={<StatusPill label={row.isActive ? "Active" : "Off"} {...tone} />}
            onPress={() => router.push(`/manage/banners/${row.id}`)}
            chevron
          />
        );
      }}
    />
  );
}
