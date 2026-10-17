import { Descriptions, Tag, Typography } from "antd";
import dayjs from "dayjs";
import type { PromoDetail } from "@martly/shared/types";
import { BannerActionTypeLabels, type BannerActionType } from "@martly/shared/constants";
import { PROMO_STATUS_CONFIG } from "../../constants/tag-colors";
import { TargetLabel } from "./target-label";
import { discountLabel, PromoKindTag } from "./promo-utils";

export function PromoHeader({ promo }: { promo: PromoDetail }) {
  return (
    <>
      <Tag color={PROMO_STATUS_CONFIG[promo.status]?.color} style={{ marginBottom: 8 }}>{PROMO_STATUS_CONFIG[promo.status]?.label}</Tag>
      <PromoKindTag kind={promo.kind} />
      {promo.kind === "AI" && <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>{promo.brief}</Typography.Paragraph>}
    </>
  );
}

/** What a manual promotion opens, discounts and when it starts */
export function ManualSetup({ promo }: { promo: PromoDetail }) {
  const actionType = (promo.actionType ?? "NONE") as BannerActionType;
  return (
    <Descriptions size="small" column={1} bordered style={{ margin: "16px 0" }} styles={{ label: { width: 160 } }}>
      <Descriptions.Item label="Opens / covers">{BannerActionTypeLabels[actionType]}: <TargetLabel type={actionType} target={promo.actionTarget} /></Descriptions.Item>
      <Descriptions.Item label="Discount">{discountLabel(promo.discountType, promo.discountValue)}</Descriptions.Item>
      <Descriptions.Item label="Products covered">{promo.productCount.toLocaleString("en-IN")}</Descriptions.Item>
      {promo.launchAt && promo.status === "READY" && (
        <Descriptions.Item label="Scheduled launch">{dayjs(promo.launchAt).format("D MMM YYYY, h:mm A")}</Descriptions.Item>
      )}
    </Descriptions>
  );
}
