import { Card, Col, DatePicker, Form, InputNumber, Row, Select } from "antd";
import { PercentageOutlined, CrownOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import type { StoreOfferKind } from "@martly/shared/types";

import { sectionTitle } from "../../theme";
import { DISCOUNT_TYPE_OPTIONS } from "../../constants/tag-colors";
import { offerPayload } from "../../components/OfferFields";
import type { PickedListing } from "./ListingPicker";

export interface OfferFormValues {
  storeId?: string;
  kind: StoreOfferKind;
  offerPreset?: string;
  offerBuyQty?: number | null;
  offerGetQty?: number | null;
  offerStart?: Dayjs | null;
  offerEnd?: Dayjs | null;
  discountType?: "FLAT" | "PERCENTAGE";
  discountValue?: number;
  discountStart?: Dayjs | null;
  discountEnd?: Dayjs | null;
  percentOff?: number;
}

export const DiscountCard = () => {
  const type = Form.useWatch("discountType");
  return (
    <Card title={sectionTitle(<PercentageOutlined />, "Discount")} size="small">
      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item label="Discount type" name="discountType" initialValue="PERCENTAGE" rules={[{ required: true }]}>
            <Select options={DISCOUNT_TYPE_OPTIONS} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Discount value" name="discountValue" rules={[{ required: true, message: "Enter the discount" }]}>
            <InputNumber min={0.01} max={type === "PERCENTAGE" ? 100 : undefined} prefix={type === "FLAT" ? "₹" : undefined} suffix={type === "PERCENTAGE" ? "%" : undefined} style={{ width: "100%" }} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Starts" name="discountStart" extra="Leave empty to start now"><DatePicker showTime style={{ width: "100%" }} /></Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Ends" name="discountEnd" extra="Leave empty for no end date"><DatePicker showTime style={{ width: "100%" }} /></Form.Item>
        </Col>
      </Row>
    </Card>
  );
};

export const MemberPriceCard = () => (
  <Card title={sectionTitle(<CrownOutlined />, "Member price")} size="small">
    <Form.Item
      label="% below the selling price"
      name="percentOff"
      rules={[{ required: true, message: "Enter a whole % from 1 to 90" }]}
      extra="Each size's member price is its price less this, rounded down to the rupee. Mart Plus members only, always on."
    >
      <InputNumber min={1} max={90} precision={0} suffix="%" style={{ width: 200 }} />
    </Form.Item>
  </Card>
);

/** The POST /offers body, or what to fix first */
export function offerBody(v: OfferFormValues, picked: PickedListing[]): Record<string, unknown> | string {
  if (!v.storeId) return "Pick a store";
  if (picked.length === 0) return "Pick at least one product";
  const base = { kind: v.kind, storeId: v.storeId, storeProductIds: picked.map((p) => p.id) };
  if (v.kind === "MEMBER_PRICE") return { ...base, percentOff: v.percentOff };
  if (v.kind === "DISCOUNT") {
    return {
      ...base, discountType: v.discountType, discountValue: v.discountValue,
      startsAt: v.discountStart?.toISOString() ?? null, endsAt: v.discountEnd?.toISOString() ?? null,
    };
  }
  const offer = offerPayload(v);
  if (offer.offerBuyQty == null || offer.offerGetQty == null) return "Pick Buy X Get Y";
  return { ...base, buy: offer.offerBuyQty, get: offer.offerGetQty, startsAt: offer.offerStart, endsAt: offer.offerEnd };
}
