import { useState } from "react";
import { View, Text, Image, Switch, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { BannerPlacementLabels } from "@martly/shared/constants";
import type { PromoBanner, PromoDetail } from "@martly/shared/types";
import { SectionCard } from "../ui/SectionCard";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { manage } from "../ui/tokens";
import { colors, fonts, radius } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { PlanLimitNotice, usePlanLimit } from "./PlanLimit";
import { MAX_BANNERS } from "./banner-draft";

const EDITABLE = ["READY", "LIVE", "ENDED"];

interface CardProps {
  banner: PromoBanner;
  canToggle: boolean;
  busy: boolean;
  onToggle: (active: boolean) => void;
  onEdit: () => void;
  onRemove: () => void;
}

function BannerCard({ banner, canToggle, busy, onToggle, onEdit, onRemove }: CardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Image source={{ uri: banner.imageUrl }} style={styles.thumb} resizeMode="cover" />
        <View style={styles.info}>
          <Text style={styles.placement}>{BannerPlacementLabels[banner.placement as keyof typeof BannerPlacementLabels] ?? banner.placement}</Text>
          <Text style={styles.title} numberOfLines={1}>{banner.title}</Text>
          <Text style={styles.stats}>{`${banner.views.toLocaleString("en-IN")} views · ${banner.taps.toLocaleString("en-IN")} taps`}</Text>
        </View>
        <Switch
          value={banner.isActive} onValueChange={onToggle} disabled={!canToggle || busy}
          trackColor={{ true: colors.primary, false: manage.line }} accessibilityLabel={`Show ${banner.title}`}
        />
      </View>
      <View style={styles.row}>
        <Button label="Edit" icon="create-outline" variant="secondary" compact onPress={onEdit} style={styles.flex} />
        <Button label="Remove" icon="trash-outline" variant="danger" compact onPress={onRemove} style={styles.flex} />
      </View>
    </View>
  );
}

interface Props {
  promo: PromoDetail;
  onChange: (promo: PromoDetail) => void;
}

/** The banners a promotion runs: switch them on or off, edit, remove, or add another placement */
export function PromoBannersSection({ promo, onChange }: Props) {
  const router = useRouter();
  const { run, running } = useAction();
  const limit = usePlanLimit();
  const [removing, setRemoving] = useState<PromoBanner | null>(null);
  const base = `/api/v1/promos/${promo.id}/banners`;
  const canEdit = EDITABLE.includes(promo.status);
  const open = (bannerId?: string) => router.push({ pathname: "/manage/promos/banner", params: { promoId: promo.id, ...(bannerId ? { bannerId } : {}) } });

  const toggle = async (b: PromoBanner, isActive: boolean) => {
    const res = await run(() => limit.capture(() => api.put<PromoDetail>(`${base}/${b.id}`, { isActive })));
    if (res) onChange(res.data);
  };
  const remove = async () => {
    if (!removing) return;
    const res = await run(() => api.delete<PromoDetail>(`${base}/${removing.id}`), "Banner removed");
    setRemoving(null);
    if (res) onChange(res.data);
  };

  return (
    <SectionCard title="Banners" action={canEdit && promo.banners.length < MAX_BANNERS ? { label: "Add banner", onPress: () => open() } : undefined}>
      {promo.banners.length === 0 ? <Text style={styles.stats}>No banners yet.</Text> : null}
      {promo.banners.map((b) => (
        <BannerCard key={b.id} banner={b} canToggle={promo.status === "LIVE"} busy={running} onToggle={(v) => toggle(b, v)} onEdit={() => open(b.id)} onRemove={() => setRemoving(b)} />
      ))}
      <PlanLimitNotice message={limit.message} />
      <ConfirmDialog
        visible={!!removing} title="Remove this banner?" message="It stops showing in the app straight away." confirmLabel="Remove"
        running={running} onConfirm={remove} onClose={() => setRemoving(null)}
      />
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: manage.hairline },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  thumb: { width: 72, height: 48, borderRadius: radius.sm, backgroundColor: manage.canvas },
  info: { flex: 1, gap: 2 },
  placement: { fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary, letterSpacing: 0.6, textTransform: "uppercase" },
  title: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text },
  stats: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  row: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
});
