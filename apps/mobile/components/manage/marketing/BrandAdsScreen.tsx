import { useState } from "react";
import { Text, Switch, StyleSheet } from "react-native";
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
import { RemotePicker } from "./RemotePicker";
import { discountLabel } from "./promo-utils";
import type { BrandAdsSettings, BrandCampaign } from "./plan-types";

const EXPLAINER = "Brand ads show in your stores only for brands you stock. Block any brand you don't want. A brand promotion lowers prices on that brand, and the brand reimburses the discount. You can opt out of a promotion before it starts.";
const PROMOTE_NOTE = "Your own brands and the brands you feature come first in search, category pages and voice or list orders, marked \"Our brand\" or \"Featured\".";

type Brands = BrandAdsSettings["blockedBrands"];
const ids = (brands: Brands) => brands.map((b) => b.id).join();

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
  const [allow, setAllow] = useState(initial.allowBrandAds);
  const [blocked, setBlocked] = useState<Brands>(initial.blockedBrands);
  const [boostOwn, setBoostOwn] = useState(initial.boostOwnBrands);
  const [featured, setFeatured] = useState<Brands>(initial.featuredBrands);
  const dirty = allow !== initial.allowBrandAds || boostOwn !== initial.boostOwnBrands
    || ids(blocked) !== ids(initial.blockedBrands) || ids(featured) !== ids(initial.featuredBrands);

  const save = async () => {
    const body = { allowBrandAds: allow, blockedBrandIds: blocked.map((b) => b.id), boostOwnBrands: boostOwn, featuredBrandIds: featured.map((b) => b.id) };
    if (await run(() => api.put("/api/v1/marketing/brand-ads", body), "Brand settings saved")) onSaved();
  };

  return (
    <>
      <SectionCard title="In your stores">
        <SwitchRow label="Allow brand ads" description="Turn off to hide every brand promotion and banner" value={allow} onValueChange={setAllow} disabled={!canEdit} />
        {allow ? <BrandList title="Blocked brands" empty="No brands blocked" addLabel="Block a brand" brands={blocked} onChange={setBlocked} canEdit={canEdit} /> : null}
      </SectionCard>
      <SectionCard title="Brands you promote">
        <Text style={styles.note}>{PROMOTE_NOTE}</Text>
        <SwitchRow label="Promote my own brands" description="Your organisation's brands lead their aisles" value={boostOwn} onValueChange={setBoostOwn} disabled={!canEdit} />
        <BrandList title="Featured brands" empty="No featured brands" addLabel="Feature a brand" brands={featured} onChange={setFeatured} canEdit={canEdit} />
      </SectionCard>
      {canEdit ? <Button label="Save" onPress={save} loading={running} disabled={!dirty} /> : <Text style={styles.note}>Only the owner can change this</Text>}
    </>
  );
}

function BrandList({ title, empty, addLabel, brands, onChange, canEdit }: {
  title: string; empty: string; addLabel: string; brands: Brands; onChange: (next: Brands) => void; canEdit: boolean;
}) {
  const { run } = useAction();
  const add = async (id: string) => {
    if (brands.some((b) => b.id === id)) return;
    const res = await run(() => api.get<Brands[number]>(`/api/v1/brands/${id}`));
    if (res) onChange([...brands, { id, name: res.data.name, imageUrl: res.data.imageUrl }]);
  };
  return (
    <>
      <Text style={styles.heading}>{title}</Text>
      {brands.length === 0 ? <Text style={styles.note}>{empty}</Text> : null}
      {brands.map((b) => (
        <ListRow key={b.id} title={b.name} imageUrl={b.imageUrl} imageContain trailing={canEdit ? <Button label="Remove" variant="ghost" compact onPress={() => onChange(brands.filter((x) => x.id !== b.id))} /> : undefined} />
      ))}
      {canEdit ? <RemotePicker label={addLabel} path="/api/v1/brands" value={null} onChange={add} placeholder="Search brands" /> : null}
    </>
  );
}

function Campaigns({ campaigns }: { campaigns: BrandCampaign[] }) {
  const { user } = useAuth();
  const { run } = useAction();
  const canEdit = can(user, "brand-ads", "edit");
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const toggle = async (c: BrandCampaign, optedOut: boolean) => {
    const ok = await run(() => api.put(`/api/v1/marketing/brand-ads/campaigns/${c.id}/opt-out`, { optedOut }), optedOut ? "Opted out" : "Opted back in");
    if (ok) setOverrides((prev) => ({ ...prev, [c.id]: optedOut }));
  };

  return (
    <SectionCard title="Brand promotions" flush>
      {campaigns.length === 0 ? <Text style={[styles.note, styles.pad]}>No brand promotions coming up</Text> : null}
      {campaigns.map((c) => {
        const optedOut = overrides[c.id] ?? c.optedOut;
        const scheduled = c.status === "SCHEDULED";
        return (
          <ListRow
            key={c.id}
            title={c.title}
            imageUrl={c.brand.imageUrl}
            imageContain
            subtitle={`${c.brand.name} · ${discountLabel(c.discountType, c.discountValue)}`}
            caption={c.startsAt ? `${formatDate(c.startsAt)} to ${c.endsAt ? formatDate(c.endsAt) : "open"}` : undefined}
            trailing={scheduled
              ? <Switch value={!optedOut} onValueChange={(on) => toggle(c, !on)} disabled={!canEdit} accessibilityLabel={`Run ${c.title} in my stores`} />
              : <StatusPill label={BrandCampaignStatusLabels[c.status as BrandCampaignStatus] ?? c.status} {...TONES.slate} />}
          />
        );
      })}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, lineHeight: 18, paddingHorizontal: 4 },
  pad: { padding: 14 },
  heading: { fontFamily: fonts.bold, fontSize: 13, color: colors.text, marginTop: 12, marginBottom: 4 },
});
