import { useState } from "react";
import { Alert, Button, Card, Col, InputNumber, Popconfirm, Progress, Row, Segmented, Space, Tag, Tooltip, Typography } from "antd";
import { CheckOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { formatRupees } from "../promos/promo-utils";
import { usePlanActions } from "./use-plan-actions";
import { usePurchase } from "./use-purchase";
import type { AdProduct, BillingInterval, BillingProfile, Entitlements } from "./types";

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

const fmtDate = (iso: string) => dayjs(iso).format("D MMM YYYY");

interface RenewalProps {
  e: Entitlements;
  canBuy: boolean;
  acting: boolean;
  onCancel: () => void;
  onTurnOn: () => void;
}

function RenewalInfo({ e, canBuy, acting, onCancel, onTurnOn }: RenewalProps) {
  const sub = e.subscription;
  if (e.trial.endsAt) return <Tag color="gold">Free trial · ends {fmtDate(e.trial.endsAt)}</Tag>;
  if (sub?.status === "ACTIVE" && sub.renewsAt && !sub.cancelAtPeriodEnd) {
    return (
      <Space>
        <Tag color="teal">Renews on {fmtDate(sub.renewsAt)} · auto-renew on</Tag>
        {canBuy && (
          <Popconfirm title={`Your plan stays active until ${fmtDate(sub.renewsAt)}, then you move to Free.`} okText="Cancel auto-renew" cancelText="Keep" onConfirm={onCancel}>
            <Button type="link" size="small" loading={acting}>Cancel auto-renew</Button>
          </Popconfirm>
        )}
      </Space>
    );
  }
  if (sub?.cancelAtPeriodEnd && sub.renewsAt) {
    return (
      <Space>
        <Tag>Ends on {fmtDate(sub.renewsAt)} · auto-renew off</Tag>
        {canBuy && <Button type="link" size="small" onClick={onTurnOn}>Turn auto-renew back on</Button>}
      </Space>
    );
  }
  if (sub?.status === "CREATED" && sub.renewsAt) return <Tag color="blue">{sub.productName} starts on {fmtDate(sub.renewsAt)}</Tag>;
  if (e.paidThrough) return <Tag color="teal">Paid through {fmtDate(e.paidThrough)}</Tag>;
  return <Tag>Free plan</Tag>;
}

function UsageCard(props: RenewalProps) {
  const { e } = props;
  const { promotions } = e;
  const activeUntil = e.paidThrough ?? e.period?.endsAt;
  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      <Space align="baseline" style={{ marginBottom: 12 }} wrap>
        <Title level={4} style={{ margin: 0 }}>{e.plan?.name ?? "Free plan"}{e.plan?.billingInterval === "YEARLY" && " (billed yearly)"}</Title>
        <RenewalInfo {...props} />
      </Space>
      {e.trial.endsAt && <div style={{ marginBottom: 12 }}><Text type="secondary">Choose a plan to keep going after the trial</Text></div>}
      {e.subscription?.status === "HALTED" && activeUntil && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={`Renewal payment failed — your plan stays active until ${fmtDate(activeUntil)}. Pay again by choosing the plan below.`}
        />
      )}
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

function TrialCard({ canBuy, acting, onStart }: { canBuy: boolean; acting: boolean; onStart: () => void }) {
  return (
    <Card size="small" style={{ marginBottom: 16, borderColor: "#0d9488", background: "rgba(13, 148, 136, 0.06)" }}>
      <Space style={{ justifyContent: "space-between", width: "100%" }} wrap>
        <Title level={5} style={{ margin: 0 }}>Try Growth free for 14 days — 2 promotions and 2 AI images, no payment needed</Title>
        <Tooltip title={canBuy ? undefined : OWNER_ONLY}>
          <Button type="primary" disabled={!canBuy} loading={acting} onClick={onStart}>Start free trial</Button>
        </Tooltip>
      </Space>
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

const perMonth = (p: AdProduct, interval: BillingInterval) => (interval === "YEARLY" && p.yearlyPrice != null ? Math.round(p.yearlyPrice / 12) : p.price);

interface ButtonState { label: string; disabled: boolean }

function buttonState(plan: AdProduct, interval: BillingInterval, plans: AdProduct[], e: Entitlements): ButtonState {
  const sub = e.subscription;
  const autoRenewing = sub?.productCode === plan.code && sub.interval === interval && sub.status === "ACTIVE" && !sub.cancelAtPeriodEnd;
  if (autoRenewing) return { label: "Current plan", disabled: true };
  const current = e.plan;
  if (!current) return { label: "Upgrade", disabled: false };
  if (plan.code === current.code && interval === current.billingInterval) return { label: "Renew automatically", disabled: false };
  const currentProduct = plans.find((p) => p.code === current.code);
  const currentPerMonth = currentProduct ? perMonth(currentProduct, current.billingInterval) : current.price;
  return { label: perMonth(plan, interval) > currentPerMonth ? "Upgrade" : "Switch at end of current plan", disabled: false };
}

function PlanPrice({ plan, interval }: { plan: AdProduct; interval: BillingInterval }) {
  const yearly = interval === "YEARLY" && plan.price > 0;
  const gst = `+${plan.gstPercent}% GST`;
  if (yearly && plan.yearlyPrice == null) return <Text type="secondary">Monthly only</Text>;
  if (yearly && plan.yearlyPrice != null) {
    return (
      <>
        <Title level={3} style={{ margin: 0 }}>{formatRupees(perMonth(plan, interval))}<Text type="secondary" style={{ fontSize: 14 }}> / month</Text></Title>
        <div><Text type="secondary" style={{ fontSize: 12 }}>Billed {formatRupees(plan.yearlyPrice)} a year {gst} · save {formatRupees(plan.price * 12 - plan.yearlyPrice)}</Text></div>
        <div><Text type="secondary" style={{ fontSize: 12 }}>Renews yearly · cancel anytime</Text></div>
      </>
    );
  }
  return (
    <>
      <Title level={3} style={{ margin: 0 }}>{formatRupees(plan.price)}<Text type="secondary" style={{ fontSize: 14 }}> / month {gst}</Text></Title>
      {plan.price > 0 && <div><Text type="secondary" style={{ fontSize: 12 }}>Renews monthly · cancel anytime</Text></div>}
    </>
  );
}

interface PlanCardsProps {
  plans: AdProduct[];
  interval: BillingInterval;
  e: Entitlements;
  canBuy: boolean;
  buying: string | null;
  buy: (p: AdProduct, quantity: number, interval: BillingInterval) => void;
}

function PlanCards({ plans, interval, e, canBuy, buying, buy }: PlanCardsProps) {
  return (
    <Row gutter={[16, 16]}>
      {plans.map((p) => {
        const isCurrent = e.plan?.code === p.code && (p.price === 0 || e.plan.billingInterval === interval);
        const noAnnual = interval === "YEARLY" && p.yearlyPrice == null;
        const state = buttonState(p, interval, plans, e);
        return (
          <Col xs={24} md={8} key={p.id}>
            <Card size="small" title={<Space>{p.name}{isCurrent && <Tag color="teal">Current</Tag>}</Space>} style={isCurrent ? { borderColor: "#0d9488" } : undefined}>
              <PlanPrice plan={p} interval={interval} />
              {p.description && <div><Text type="secondary">{p.description}</Text></div>}
              <ul style={{ paddingLeft: 0, listStyle: "none", margin: "12px 0" }}>
                {planFeatures(p).map((f) => <li key={f}><CheckOutlined style={{ color: "#0d9488", marginRight: 8 }} />{f}</li>)}
              </ul>
              {p.price > 0 ? (
                <Tooltip title={canBuy ? undefined : OWNER_ONLY}>
                  <Button type={isCurrent ? "default" : "primary"} block disabled={!canBuy || state.disabled || noAnnual} loading={buying === p.id} onClick={() => buy(p, 1, interval)}>
                    {state.label}
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

function TopupCard({ product, canBuy, onPaidPlan, buying, buy }: { product: AdProduct; canBuy: boolean; onPaidPlan: boolean; buying: string | null; buy: (p: AdProduct, quantity: number) => void }) {
  const [quantity, setQuantity] = useState(1);
  return (
    <Card size="small" title="Extra promotion" style={{ marginTop: 16 }}>
      <Space wrap>
        <Text>{formatRupees(product.price)} each +{product.gstPercent}% GST</Text>
        <InputNumber min={1} max={MAX_TOPUP} precision={0} value={quantity} onChange={(v) => setQuantity(v ?? 1)} />
        <Tooltip title={canBuy ? undefined : OWNER_ONLY}>
          <Button type="primary" disabled={!canBuy || !onPaidPlan} loading={buying === product.id} onClick={() => buy(product, quantity)}>
            {onPaidPlan ? `Buy ${quantity * product.promotionCredits} ${quantity * product.promotionCredits === 1 ? "promotion" : "promotions"}` : "Extra promotions are available on Growth and Pro"}
          </Button>
        </Tooltip>
      </Space>
    </Card>
  );
}

export function PlanTab({ entitlements, products, profile, canBuy, onProfileSaved, onPaid }: PlanTabProps) {
  const { buying, buy, modal } = usePurchase(profile, onProfileSaved, onPaid);
  const { acting, startTrial, cancelRenewal } = usePlanActions(onPaid);
  const [interval, setPlanInterval] = useState<BillingInterval>(entitlements.plan?.billingInterval ?? "MONTHLY");
  const plans = products.filter((p) => p.kind === "STORE_PLAN");
  const topup = products.find((p) => p.kind === "PROMOTION_TOPUP");
  // Turning auto-renew back on buys the plan that was renewing again, from the end of the paid time
  const renewingProduct = plans.find((p) => p.code === entitlements.subscription?.productCode);
  return (
    <>
      <UsageCard e={entitlements} canBuy={canBuy} acting={acting === "cancel"} onCancel={cancelRenewal} onTurnOn={() => renewingProduct && buy(renewingProduct, 1, entitlements.subscription?.interval)} />
      {entitlements.trial.available && <TrialCard canBuy={canBuy} acting={acting === "trial"} onStart={startTrial} />}
      <Alert type="info" showIcon style={{ marginBottom: 16 }} message="Upgrading starts now; unused days of your current plan carry over as extra days (a free trial carries none). Switching to a cheaper plan starts after your current month." />
      <Segmented
        style={{ marginBottom: 16 }}
        value={interval}
        onChange={(v) => setPlanInterval(v as BillingInterval)}
        options={[{ value: "MONTHLY", label: "Monthly" }, { value: "YEARLY", label: "Annual · 2 months free" }]}
      />
      <PlanCards plans={plans} interval={interval} e={entitlements} canBuy={canBuy} buying={buying} buy={buy} />
      {topup && <TopupCard product={topup} canBuy={canBuy} onPaidPlan={entitlements.onPaidPlan} buying={buying} buy={buy} />}
      {modal}
    </>
  );
}
