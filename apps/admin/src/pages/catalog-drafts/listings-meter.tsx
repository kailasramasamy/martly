import { Alert, Card, Progress, Space, Typography } from "antd";
import { useGetIdentity } from "@refinedev/core";
import { Link } from "react-router";
import { LISTING_FEE } from "@martly/shared/constants";
import { useEntitlements } from "../../hooks/use-entitlements";

const { Text } = Typography;

/** How many of the plan's own-product listings are used, for owners; same numbers as the app's Add product screen */
export function ListingsMeter() {
  const { data: identity } = useGetIdentity<{ role: string }>();
  // Martly staff have no plan of their own; each organisation's is under Platform → Store plans
  const { entitlements } = useEntitlements(!!identity && identity.role !== "SUPER_ADMIN");
  if (!entitlements || identity?.role === "SUPER_ADMIN") return null;
  const { included, used, planLeft, extraBalance, unlimited } = entitlements.listings;
  const empty = !unlimited && planLeft + extraBalance <= 0;
  const percent = unlimited || included === 0 ? 100 : Math.min(100, Math.round((used / included) * 100));

  return (
    <Card size="small" style={{ marginBottom: 16, maxWidth: 1040 }}>
      <Space direction="vertical" size={4} style={{ width: "100%" }}>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Text strong>Your own products</Text>
          <Text type="secondary">{unlimited ? `${used} listed` : `${Math.min(used, included)} of ${included} free used`}</Text>
        </Space>
        <Progress percent={percent} showInfo={false} status={empty ? "exception" : "normal"} strokeColor={unlimited ? "#99f6e4" : undefined} />
        <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
          <Text type="secondary">
            {unlimited ? "Unlimited listings, set by Martly" : `${extraBalance} extra listing${extraBalance === 1 ? "" : "s"} · then ₹${LISTING_FEE} each`}
          </Text>
          {!unlimited && <Link to="/marketing-plan">Buy more</Link>}
        </Space>
        <Text type="secondary">Add your own products from the Martly app: take photos of the pack and we fill in the details.</Text>
      </Space>
      {empty && <Alert type="warning" showIcon style={{ marginTop: 12 }} message="No listings left. Buy more to add products." />}
    </Card>
  );
}
