import { ZoneForm } from "../../../components/manage/delivery-config/ZoneForm";
import { OrgRequired } from "../../../components/manage/OrgRequired";
import { useManageScope } from "../../../lib/manage-scope-context";

export default function NewDeliveryZoneScreen() {
  const { organizationId } = useManageScope();
  if (!organizationId) return <OrgRequired title="New delivery zone" what="add a delivery zone" />;
  return <ZoneForm />;
}
