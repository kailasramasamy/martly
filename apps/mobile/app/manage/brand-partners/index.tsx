import { useAuth } from "../../../lib/auth-context";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";
import { PartnersList } from "../../../components/manage/platform/partners/PartnersList";

export default function BrandPartnersRoute() {
  const { user } = useAuth();
  if (user?.role !== "SUPER_ADMIN") return <ScreenNotice title="Brand partners" kind="denied" />;
  return <PartnersList />;
}
