import { useAuth } from "../../../lib/auth-context";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";
import { PartnerForm } from "../../../components/manage/platform/partners/PartnerForm";

export default function NewBrandPartnerRoute() {
  const { user } = useAuth();
  if (user?.role !== "SUPER_ADMIN") return <ScreenNotice title="New brand login" kind="denied" />;
  return <PartnerForm />;
}
