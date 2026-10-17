import { useState } from "react";
import { Alert, Button, Card, Col, InputNumber, Progress, Row, Space, Tag, Tooltip, Typography } from "antd";
import { CheckOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { formatRupees } from "../promos/promo-utils";
import { usePurchase } from "./use-purchase";
import type { AdProduct, BillingProfile, Entitlements } from "./types";

const { Text, Title } = Typography;
const MAX_TOPUP = 12;
const OWNER_ONLY = "Only the owner can buy";

interface PlanTabProps {
  entitlements: Entitlements;
  products: AdProduct[];
  profile: BillingProfile | null;
  canBuy: boolean;
  onProfileSaved: (p: BillingProfile) => void;
  onPaid: () => Promise<void>;
}

function Meter({ label, used, total, detail }: { label: string; used: number; total: number; detail?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <Space style={{ justifyContent: "space-between", width: "100%" }}>
        <Text>{label}</Text>
        <Text type="secondary">{`${used} / ${total}`}{detail}</Text>
      </Space>
      <Progress percent={total ? Math.min(100, Math.round((used / total) * 100)) : 100} showInfo={false} size="small" />
    </div>
  );
}

function UsageCard({ e }: { e: Entitlements }) {
  const { promotions } = e;
  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      <Space align="baseline" style={{ marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0 }}>{e.plan?.name ?? "Free plan"}</Title>
        {e.paidThrough ? <Tag color="teal">Paid through {dayjs(e.paidThrough).format("D MMM YYYY")}</Tag> : <Tag>Free plan</Tag>}
      </Space>
      <Meter
        label="Promotions left this month"
        used={promotions.planTotal - promotions.planLeft}
        total={promotions.planTotal}
        detail={` · ${promotions.planLeft} left + ${promotions.topUpBalance} extra`}
      />
      <Meter label="AI images this month" used={e.aiImages.used} total={e.aiImages.total} />
      <Text>Push notifications: {e.pushIncluded ? <Tag color="green">Included</Tag> : <Tag>Not included</Tag>}</Text>
    </Card>
  );
}

function planFeatures(p: AdProduct): string[] {
  return [
    `${p.promotionCredits} promotions a month`,
    `${p.aiImagesPerMonth} AI images a month`,
    p.pushIncluded ? "Push notifications included" : "No push notifications",
  ];
}

const FREE_NOTE = "You're on this plan whenever no paid plan is running.";

function buttonLabel(plan: AdProduct, current: Entitlements["plan"]): string {
  if (!current) return "Upgrade";
  if (plan.code === current.code) return "Renew";
  return plan.price > current.price ? "Upgrade" : "Buy";
}

function PlanCards({ plans, e, canBuy, buying, buy }: { plans: AdProduct[]; e: Entitlements; canBuy: boolean; buying: string | null; buy: (p: AdProduct) => void }) {
  return (
    <Row gutter={[16, 16]}>
      {plans.map((p) => {
        const isCurrent = e.plan?.code === p.code;
        return (
          <Col xs={24} md={8} key={p.id}>
            <Card size="small" title={<Space>{p.name}{isCurrent && <Tag color="teal">Current</Tag>}</Space>} style={isCurrent ? { borderColor: "#0d9488" } : undefined}>
              <Title level={3} style={{ margin: 0 }}>{formatRupees(p.price)}<Text type="secondary" style={{ fontSize: 14 }}> / month +{p.gstPercent}% GST</Text></Title>
              {p.description && <Text type="secondary">{p.description}</Text>}
              <ul style={{ paddingLeft: 0, listStyle: "none", margin: "12px 0" }}>
                {planFeatures(p).map((f) => <li key={f}><CheckOutlined style={{ color: "#0d9488", marginRight: 8 }} />{f}</li>)}
              </ul>
              {p.price > 0 ? (
                <Tooltip title={canBuy ? undefined : OWNER_ONLY}>
                  <Button type={isCurrent ? "default" : "primary"} block disabled={!canBuy} loading={buying === p.id} onClick={() => buy(p)}>
                    {buttonLabel(p, e.plan)}
                  </Button>
                </Tooltip>
              ) : (
                <Text type="secondary">{FREE_NOTE}</Text>
              )}
            </Card>
          </Col>
        );
      })}
    </Row>
  );
}

function TopupCard({ product, canBuy, buying, buy }: { product: AdProduct; canBuy: boolean; buying: string | null; buy: (p: AdProduct, quantity: number) => void }) {
  const [quantity, setQuantity] = useState(1);
  return (
    <Card size="small" title="Extra promotion" style={{ marginTop: 16 }}>
      <Space wrap>
        <Text>{formatRupees(product.price)} each +{product.gstPercent}% GST</Text>
        <InputNumber min={1} max={MAX_TOPUP} precision={0} value={quantity} onChange={(v) => setQuantity(v ?? 1)} />
        <Tooltip title={canBuy ? undefined : OWNER_ONLY}>
          <Button type="primary" disabled={!canBuy} loading={buying === product.id} onClick={() => buy(product, quantity)}>
            Buy {quantity * product.promotionCredits} {quantity * product.promotionCredits === 1 ? "promotion" : "promotions"}
          </Button>
        </Tooltip>
      </Space>
    </Card>
  );
}

export function PlanTab({ entitlements, products, profile, canBuy, onProfileSaved, onPaid }: PlanTabProps) {
  const { buying, buy, modal } = usePurchase(profile, onProfileSaved, onPaid);
  const plans = products.filter((p) => p.kind === "STORE_PLAN");
  const topup = products.find((p) => p.kind === "PROMOTION_TOPUP");
  return (
    <>
      <UsageCard e={entitlements} />
      <Alert type="info" showIcon style={{ marginBottom: 16 }} message="Upgrading starts now; unused days of your current plan carry over as extra days. Buying the same or a cheaper plan queues after your current one." />
      <PlanCards plans={plans} e={entitlements} canBuy={canBuy} buying={buying} buy={buy} />
      {topup && <TopupCard product={topup} canBuy={canBuy} buying={buying} buy={buy} />}
      {modal}
    </>
  );
}
