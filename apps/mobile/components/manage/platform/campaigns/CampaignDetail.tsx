import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useResource } from "../../../../lib/manage/use-resource";
import { colors, fonts } from "../../../../constants/theme";
import { ManageStackScreen } from "../../ManageStackScreen";
import { HeaderAction } from "../../HeaderAction";
import { StatusPill } from "../../ui/StatusPill";
import { SectionCard } from "../../ui/SectionCard";
import { EDITABLE_STATUSES, type Campaign } from "../types";
import { statusTone } from "./campaign-utils";
import { campaignActionBar } from "./CampaignActionBar";
import { CampaignDialogs } from "./CampaignDialogs";
import { CreativePreview } from "./CreativePreview";
import { CampaignPlacementCard } from "../placements/CampaignPlacementCard";
import { DetailsCard, ResultsCard } from "./CampaignInfoCards";
import { useCampaignActions } from "./use-campaign-actions";

export function CampaignDetail({ id }: { id: string }) {
  const campaign = useResource<Campaign>(`/api/v1/brand-campaigns/${id}`);
  if (!campaign.data) {
    return <ManageStackScreen title="Campaign" loading={campaign.loading} error={campaign.error} onRetry={campaign.reload}>{null}</ManageStackScreen>;
  }
  return <Loaded campaign={campaign.data} onChange={campaign.setData} onRefresh={campaign.reload} />;
}

interface LoadedProps {
  campaign: Campaign;
  onChange: (campaign: Campaign) => void;
  onRefresh: () => void;
}

function Loaded({ campaign, onChange, onRefresh }: LoadedProps) {
  const router = useRouter();
  const a = useCampaignActions(campaign, onChange);
  const tone = statusTone(campaign.status);
  const editable = EDITABLE_STATUSES.includes(campaign.status);

  return (
    <ManageStackScreen
      title={campaign.title}
      onRefresh={onRefresh}
      headerRight={editable ? () => <HeaderAction icon="create-outline" label="Edit" onPress={() => router.push(`/manage/brand-campaigns/edit/${campaign.id}`)} /> : undefined}
      actions={campaignActionBar(campaign, a)}
    >
      <View style={styles.status}>
        <StatusPill label={tone.label} color={tone.color} bg={tone.bg} dot={campaign.status === "LIVE"} />
      </View>
      {campaign.reviewNote ? (
        <SectionCard><Text style={[styles.note, campaign.status === "REJECTED" && styles.rejected]}>{campaign.reviewNote}</Text></SectionCard>
      ) : null}
      <CreativePreview campaign={campaign} generating={a.generating} onGenerate={a.generateArt} />
      <CampaignPlacementCard campaign={campaign} />
      <DetailsCard campaign={campaign} />
      {campaign.results && <ResultsCard results={campaign.results} />}
      <CampaignDialogs campaign={campaign} a={a} />
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: "row" },
  note: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.text },
  rejected: { color: colors.error },
});
