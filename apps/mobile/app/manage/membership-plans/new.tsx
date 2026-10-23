import { MembershipPlanForm } from "../../../components/manage/marketing/MembershipPlanForm";
import { OrgRequired } from "../../../components/manage/OrgRequired";
import { useManageScope } from "../../../lib/manage-scope-context";

export default function NewPlan() {
  const { organizationId } = useManageScope();
  if (!organizationId) return <OrgRequired title="New plan" what="create a membership plan" />;
  return <MembershipPlanForm />;
}
