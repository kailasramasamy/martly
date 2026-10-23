import { ManualPromoForm } from "../../../components/manage/marketing/ManualPromoForm";
import { OrgRequired } from "../../../components/manage/OrgRequired";
import { useManageScope } from "../../../lib/manage-scope-context";

export default function NewManualPromo() {
  const { organizationId } = useManageScope();
  if (!organizationId) return <OrgRequired title="Manual promotion" what="create a promotion" />;
  return <ManualPromoForm />;
}
