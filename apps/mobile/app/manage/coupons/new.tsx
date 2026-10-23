import { CouponForm } from "../../../components/manage/marketing/CouponForm";
import { OrgRequired } from "../../../components/manage/OrgRequired";
import { useManageScope } from "../../../lib/manage-scope-context";

export default function NewCoupon() {
  const { organizationId } = useManageScope();
  if (!organizationId) return <OrgRequired title="New coupon" what="create a coupon" />;
  return <CouponForm />;
}
