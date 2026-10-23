import { useLocalSearchParams } from "expo-router";
import { CampaignForm } from "../../../../components/manage/platform/booking/CampaignForm";
import { ManageStackScreen } from "../../../../components/manage/ManageStackScreen";
import { EmptyState } from "../../../../components/manage/ui/EmptyState";
import { ScreenNotice } from "../../../../components/manage/delivery-config/ScreenNotice";
import { EDITABLE_STATUSES, type Campaign } from "../../../../components/manage/platform/types";
import { useAuth } from "../../../../lib/auth-context";
import { useResource } from "../../../../lib/manage/use-resource";

export default function EditBrandCampaign() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const allowed = user?.role === "SUPER_ADMIN";
  const { data, loading, error, reload } = useResource<Campaign>(allowed ? `/api/v1/brand-campaigns/${id}` : null);

  if (!allowed) return <ScreenNotice title="Edit campaign" kind="denied" />;
  if (!data) return <ManageStackScreen title="Edit campaign" loading={loading} error={error} onRetry={reload}>{null}</ManageStackScreen>;
  if (!EDITABLE_STATUSES.includes(data.status)) {
    return (
      <ManageStackScreen title="Edit campaign">
        <EmptyState icon="lock-closed-outline" title="Can't be edited" message="This campaign can no longer be edited." />
      </ManageStackScreen>
    );
  }
  return <CampaignForm campaign={data} />;
}
