import { useState } from "react";
import { Create } from "@refinedev/antd";
import { Alert, Segmented } from "antd";
import { Link } from "react-router";
import { PromoCreateCard } from "./create-card";
import { ManualPromoForm } from "./manual/form";
import { usePromoEntitlements } from "./promo-access";

type Kind = "AI" | "MANUAL";

function PromoAllowance({ left, topUp }: { left: number; topUp: number }) {
  if (left + topUp > 0) return <Alert type="info" showIcon style={{ marginBottom: 16 }} message={`Promotions left: ${left} this month + ${topUp} extra`} />;
  return (
    <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="No promotions left" description={<Link to="/marketing-plan">Buy an extra promotion or upgrade</Link>} />
  );
}

export const PromoCreate = () => {
  const [kind, setKind] = useState<Kind>("AI");
  const { isOrgUser, isPlatform, entitlements } = usePromoEntitlements();
  const noAllowance = !!entitlements && entitlements.promotions.planLeft + entitlements.promotions.topUpBalance === 0;
  return (
    <Create title="New promotion" footerButtons={[]}>
      {isOrgUser && entitlements && <PromoAllowance left={entitlements.promotions.planLeft} topUp={entitlements.promotions.topUpBalance} />}
      <Segmented<Kind>
        value={kind}
        onChange={setKind}
        options={[{ value: "AI", label: "AI promotion" }, { value: "MANUAL", label: "Manual promotion" }]}
        style={{ marginBottom: 16 }}
      />
      {kind === "AI" ? (
        <PromoCreateCard entitlements={entitlements} isPlatform={isPlatform} noAllowance={noAllowance} />
      ) : (
        <ManualPromoForm entitlements={entitlements} isOrgUser={isOrgUser} noAllowance={noAllowance} />
      )}
    </Create>
  );
};
