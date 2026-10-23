import { useEffect, useState } from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { api } from "../../../../lib/api";
import { colors, fonts, radius } from "../../../../constants/theme";
import { SectionCard } from "../../ui/SectionCard";
import { Button } from "../../ui/Button";
import { manage } from "../../ui/tokens";
import { CREATIVE_STATUSES, type Campaign } from "../types";

interface Props {
  campaign: Campaign;
  generating: boolean;
  onGenerate: () => void;
}

function Logo({ uri }: { uri: string | null }) {
  return uri
    ? <Image source={{ uri }} style={styles.logo} resizeMode="contain" />
    : <View style={[styles.logo, styles.logoEmpty]} />;
}

function FeatureCard({ campaign }: { campaign: Campaign }) {
  return (
    <SectionCard title="Featured brand">
      <View style={styles.row}>
        <Logo uri={campaign.brand.imageUrl} />
        <Text style={styles.copy}>
          {campaign.brand.name} products in {campaign.category?.name ?? "its category"} rank ahead, marked Featured, in search, category pages and list orders.
        </Text>
      </View>
    </SectionCard>
  );
}

function TabSlotCard({ campaign }: { campaign: Campaign }) {
  return (
    <SectionCard title="Brand tab slot">
      <View style={styles.row}>
        <Logo uri={campaign.imageUrl ?? campaign.brand.imageUrl} />
        <Text style={styles.copy}>{campaign.brand.name}'s logo in the app's bottom bar, opening its brand page.</Text>
      </View>
    </SectionCard>
  );
}

function SponsoredCard({ campaign }: { campaign: Campaign }) {
  const [item, setItem] = useState<{ name: string; imageUrl: string | null } | null>(null);
  useEffect(() => {
    api.get<{ name: string; imageUrl: string | null }>(`/api/v1/products/${campaign.actionTarget}`)
      .then((res) => setItem(res.data))
      .catch(() => setItem(null));
  }, [campaign.actionTarget]);

  return (
    <SectionCard title="Sponsored product">
      <View style={styles.row}>
        <Logo uri={item?.imageUrl ?? campaign.imageUrl} />
        <View style={styles.flex}>
          <Text style={styles.name}>{item?.name ?? "Loading…"}</Text>
          <Text style={styles.copy}>Shows in: {campaign.category?.name ?? "—"}</Text>
        </View>
      </View>
    </SectionCard>
  );
}

const ASPECTS: Record<string, number> = { HOME_POSTER: 2 / 3, CATEGORY_TOP: 2 };

function BannerCard({ campaign, generating, onGenerate }: Props) {
  const poster = campaign.placement === "HOME_POSTER";
  const noun = poster ? "poster" : "banner";
  const canGenerate = CREATIVE_STATUSES.includes(campaign.status) && !!campaign.brief;
  const aspectRatio = ASPECTS[campaign.placement ?? ""] ?? 3 / 2;

  return (
    <SectionCard title={poster ? "Poster" : "Banner"}>
      {campaign.imageUrl
        ? <Image source={{ uri: campaign.imageUrl }} style={[styles.art, { aspectRatio }, poster && styles.poster]} resizeMode="cover" />
        : <Text style={styles.copy}>No {noun} yet</Text>}
      <Text style={styles.name}>{campaign.title}</Text>
      {campaign.subtitle ? <Text style={styles.copy}>{campaign.subtitle}</Text> : null}
      {canGenerate && (
        <Button label={`${campaign.imageUrl ? "Regenerate" : "Generate"} ${noun}`} icon="sparkles-outline" variant="secondary" loading={generating} onPress={onGenerate} style={styles.generate} />
      )}
      {generating && <Text style={styles.copy}>Designing… up to a minute or two</Text>}
    </SectionCard>
  );
}

export function CreativePreview(props: Props) {
  const { campaign } = props;
  if (campaign.placement === null) return <FeatureCard campaign={campaign} />;
  if (campaign.placement === "SPONSORED_PRODUCT") return <SponsoredCard campaign={campaign} />;
  if (campaign.placement === "BRAND_TAB") return <TabSlotCard campaign={campaign} />;
  return <BannerCard {...props} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  flex: { flex: 1, gap: 2 },
  logo: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: manage.hairline },
  logoEmpty: { borderWidth: 1, borderColor: manage.line },
  copy: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 19, color: colors.textSecondary },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, marginTop: 8 },
  art: { width: "100%", borderRadius: radius.md, backgroundColor: manage.hairline },
  poster: { width: "60%", alignSelf: "center" },
  generate: { marginTop: 12 },
});
