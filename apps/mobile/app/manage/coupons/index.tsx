import { useState } from "react";
import { useRouter } from "expo-router";
import { ManageListScreen } from "../../../components/manage/ManageListScreen";
import { HeaderAction } from "../../../components/manage/HeaderAction";
import { ListRow } from "../../../components/manage/ui/ListRow";
import { StatusPill } from "../../../components/manage/ui/StatusPill";
import { SegmentedTabs } from "../../../components/manage/ui/SegmentedTabs";
import { formatDate } from "../../../components/manage/ui/dates";
import { formatINR } from "../../../components/manage/ui/tokens";
import { TONES, type Tone } from "../../../components/manage/marketing/common";
import type { Coupon } from "../../../components/manage/marketing/types";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { useAction } from "../../../lib/manage/use-action";
import { api } from "../../../lib/api";

type Filter = "active" | "expired" | "inactive" | "all";

const TABS = [
  { value: "active" as const, label: "Active" },
  { value: "expired" as const, label: "Expired" },
  { value: "inactive" as const, label: "Inactive" },
  { value: "all" as const, label: "All" },
];

function couponState(c: Coupon): Tone {
  const now = Date.now();
  if (c.expiresAt && new Date(c.expiresAt).getTime() < now) return { label: "Expired", ...TONES.slate };
  if (!c.isActive) return { label: "Inactive", ...TONES.amber };
  if (c.usageLimit && c.usedCount >= c.usageLimit) return { label: "Used up", ...TONES.slate };
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return { label: "Scheduled", ...TONES.blue };
  return { label: "Active", ...TONES.green };
}

const discountText = (c: Coupon) =>
  c.discountType === "PERCENTAGE" ? `${Number(c.discountValue)}% off` : `${formatINR(c.discountValue)} off`;

function subtitle(c: Coupon): string {
  const parts = [discountText(c)];
  if (c.minOrderAmount && Number(c.minOrderAmount) > 0) parts.push(`min ${formatINR(c.minOrderAmount)}`);
  if (c.maxDiscount && c.discountType === "PERCENTAGE") parts.push(`up to ${formatINR(c.maxDiscount)}`);
  return parts.join(" · ");
}

function caption(c: Coupon): string {
  const used = c.usageLimit ? `Used ${c.usedCount}/${c.usageLimit}` : `Used ${c.usedCount}`;
  return `${used} · ${c.expiresAt ? `Expires ${formatDate(c.expiresAt)}` : "No expiry"} · long-press to ${c.isActive ? "deactivate" : "activate"}`;
}

export default function CouponsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("active");
  const [q, setQ] = useState("");
  const list = usePagedList<Coupon>("/api/v1/coupons", { status: filter === "all" ? "" : filter, q });
  const { run } = useAction();

  const toggle = async (c: Coupon) => {
    const res = await run(() => api.put(`/api/v1/coupons/${c.id}`, { isActive: !c.isActive }), c.isActive ? "Coupon deactivated" : "Coupon activated");
    if (res) list.refresh();
  };

  return (
    <ManageListScreen
      title="Coupons"
      list={list}
      search={{ value: q, onChange: setQ, placeholder: "Search code" }}
      filters={<SegmentedTabs options={TABS} value={filter} onChange={setFilter} />}
      headerRight={() => <HeaderAction onPress={() => router.push("/manage/coupons/new")} accessibilityLabel="New coupon" />}
      empty={{ icon: "ticket-outline", title: "No coupons here", message: "Create a coupon to offer discounts at checkout." }}
      renderItem={(c) => {
        const state = couponState(c);
        return (
          <ListRow
            title={c.code}
            subtitle={subtitle(c)}
            caption={caption(c)}
            railColor={state.color}
            trailing={<StatusPill {...state} />}
            onPress={() => router.push(`/manage/coupons/${c.id}`)}
            onLongPress={() => toggle(c)}
            chevron
          />
        );
      }}
    />
  );
}
