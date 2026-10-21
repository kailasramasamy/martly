import { useState } from "react";
import { Text, StyleSheet } from "react-native";
import { can } from "@martly/shared/permissions";
import { BrandCampaignStatusLabels, type BrandCampaignStatus } from "@martly/shared/constants";
import { ManageStackScreen } from "../ManageStackScreen";
import { SectionCard } from "../ui/SectionCard";
import { SwitchRow } from "../ui/SwitchRow";
import { ListRow } from "../ui/ListRow";
import { Button } from "../ui/Button";
import { StatusPill } from "../ui/StatusPill";
import { formatDate } from "../ui/dates";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useResource } from "../../../lib/manage/use-resource";
import { useAuth } from "../../../lib/auth-context";
import { colors, fonts } from "../../../constants/theme";
import { TONES } from "./common";
import { discountLabel } from "./promo-utils";
import type { BrandAdsSettings, BrandCampaign } from "./plan-types";

// Running campaigns stand out from ones still to come
const STATUS_TONES: Record<string, (typeof TONES)[keyof typeof TONES]> = { LIVE: TONES.green, SCHEDULED: TONES.blue };

const EXPLAINER = "Brand ads are booked by Martly and show in your stores for brands you stock.";

export function BrandAdsScreen() {
  const settings = useResource<BrandAdsSettings>("/api/v1/marketing/brand-ads");
  const campaigns = useResource<BrandCampaign[]>("/api/v1/marketing/brand-ads/campaigns");
  const reload = () => { settings.reload(); campaigns.reload(); };
  return (
    <ManageStackScreen title="Brand ads" loading={settings.loading || campaigns.loading} error={settings.error ?? campaigns.error} onRetry={reload} onRefresh={reload}>
      {settings.data ? (
        <>
          <Text style={styles.note}>{EXPLAINER}</Text>
          <SettingsCard key={JSON.stringify(settings.data)} initial={settings.data} onSaved={settings.reload} />
          <Campaigns campaigns={campaigns.data ?? []} />
        </>
      ) : null}
    </ManageStackScreen>
  );
}

function SettingsCard({ initial, onSaved }: { initial: BrandAdsSettings; onSaved: () => void }) {
  const { user } = useAuth();
  const { run, running } = useAction();
  const canEdit = can(user, "brand-ads", "edit");
  const [boostOwn, setBoostOwn] = useState(initial.boostOwnBrands);

  const save = async () => {
    if (await run(() => api.put("/api/v1/marketing/brand-ads", { boostOwnBrands: boostOwn }), "Brand settings saved")) onSaved();
  };

  return (
    <>
      <SectionCard title="Brands you promote">
        <SwitchRow label="Promote my own brands" description={"Your own brand and unbranded staples (rice, dal, flour…) lead search and category pages, marked \"Our brand\""} value={boostOwn} onValueChange={setBoostOwn} disabled={!canEdit} />
      </SectionCard>
      {canEdit ? <Button label="Save" onPress={save} loading={running} disabled={boostOwn === initial.boostOwnBrands} /> : <Text style={styles.note}>Only the owner can change this</Text>}
      <SectionCard title="Featured by Martly" flush={initial.featuredBrands.length > 0}>
        {initial.featuredBrands.length === 0 ? <Text style={styles.note}>None right now</Text> : null}
        {initial.featuredBrands.map((b) => <ListRow key={b.id} title={b.name} imageUrl={b.imageUrl} imageContain />)}
      </SectionCard>
    </>
  );
}

function Campaigns({ campaigns }: { campaigns: BrandCampaign[] }) {
  return (
    <SectionCard title="Brand promotions" flush>
      {campaigns.length === 0 ? <Text style={[styles.note, styles.pad]}>No brand promotions coming up</Text> : null}
      {campaigns.map((c) => (
        <ListRow
          key={c.id}
          title={c.title}
          imageUrl={c.brand.imageUrl}
          imageContain
          subtitle={`${c.brand.name} · ${c.packageName}${c.discountType ? ` · ${discountLabel(c.discountType, c.discountValue)}` : ""}`}
          caption={c.startsAt ? `${formatDate(c.startsAt)} to ${c.endsAt ? formatDate(c.endsAt) : "open"}` : undefined}
          trailing={<StatusPill label={BrandCampaignStatusLabels[c.status as BrandCampaignStatus] ?? c.status} {...(STATUS_TONES[c.status] ?? TONES.slate)} />}
        />
      ))}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, lineHeight: 18, paddingHorizontal: 4 },
  pad: { padding: 14 },
});
