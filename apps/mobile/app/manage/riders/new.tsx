import { useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { useAction } from "../../../lib/manage/use-action";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { EmptyState } from "../../../components/manage/ui/EmptyState";
import { RiderForm, type RiderValues } from "../../../components/manage/delivery/RiderForm";
import { useStoreScope } from "../../../components/manage/StoreScope";

export default function NewRiderScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { storeId, picker } = useStoreScope({ routeParam: true, required: true, placeholder: "Choose a store" });
  const { run, running } = useAction();

  if (!can(user?.role ?? "", "riders", "create")) {
    return <EmptyState icon="lock-closed-outline" title="No access" message="Only store managers and admins can add riders." />;
  }

  const submit = async (values: RiderValues) => {
    const res = await run(() => api.post("/api/v1/riders", { ...values, storeId }), "Rider added");
    if (res) router.back();
  };

  return (
    <ManageStackScreen title="Add rider">
      {picker}
      {storeId ? <RiderForm saving={running} onSubmit={submit} /> : null}
    </ManageStackScreen>
  );
}
