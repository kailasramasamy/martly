import { can } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";
import { StoreEditor } from "../../../components/manage/org/StoreEditor";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";

export default function NewStoreScreen() {
  const { user } = useAuth();
  if (!can(user?.role ?? "", "stores", "create")) return <ScreenNotice title="New store" kind="denied" />;
  return <StoreEditor />;
}
