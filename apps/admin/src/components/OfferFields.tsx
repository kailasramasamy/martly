import { Card, Col, DatePicker, Form, InputNumber, Row, Select } from "antd";
import { GiftOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";

import { sectionTitle } from "../theme";

const CUSTOM = "custom";
const PRESETS = ["1:1", "2:1", "3:1", "2:2"];

const OFFER_OPTIONS = [
  ...PRESETS.map((p) => {
    const [buy, get] = p.split(":");
    return { value: p, label: `Buy ${buy} Get ${get}` };
  }),
  { value: CUSTOM, label: "Custom" },
];

interface OfferValues {
  offerPreset?: string;
  offerBuyQty?: number | null;
  offerGetQty?: number | null;
  offerStart?: Dayjs | null;
  offerEnd?: Dayjs | null;
}

/** Form values for an existing record's offer: a matching preset, else Custom */
export function offerInitialValues(record: { offerBuyQty?: number | null; offerGetQty?: number | null }) {
  const { offerBuyQty: buy, offerGetQty: get } = record;
  if (buy == null || get == null) return { offerPreset: undefined };
  const key = `${buy}:${get}`;
  return { offerPreset: PRESETS.includes(key) ? key : CUSTOM };
}

/** API payload for the offer fields; nulls clear the offer */
export function offerPayload(values: OfferValues) {
  const preset = values.offerPreset;
  let buy: number | null = null;
  let get: number | null = null;
  if (preset === CUSTOM) {
    buy = values.offerBuyQty ?? null;
    get = values.offerGetQty ?? null;
  } else if (preset) {
    [buy, get] = preset.split(":").map(Number);
  }
  const active = buy != null && get != null;
  return {
    offerBuyQty: active ? buy : null,
    offerGetQty: active ? get : null,
    offerStart: active && values.offerStart ? values.offerStart.toISOString() : null,
    offerEnd: active && values.offerEnd ? values.offerEnd.toISOString() : null,
  };
}

export const OfferCard = ({ disabled }: { disabled?: boolean }) => {
  const form = Form.useFormInstance();
  const preset = Form.useWatch("offerPreset", form);
  const qtyRules = [{ required: true, message: "Required" }];

  return (
    <Card title={sectionTitle(<GiftOutlined />, "Offer")} size="small">
      <Row gutter={16}>
        <Col xs={24} sm={12}>
          <Form.Item label="Buy X Get Y" name="offerPreset">
            <Select options={OFFER_OPTIONS} allowClear placeholder="None" disabled={disabled} />
          </Form.Item>
        </Col>
        {preset === CUSTOM && (
          <>
            <Col xs={12} sm={6}>
              <Form.Item label="Buy qty" name="offerBuyQty" rules={qtyRules}>
                <InputNumber min={1} max={10} precision={0} style={{ width: "100%" }} disabled={disabled} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item label="Free qty" name="offerGetQty" rules={qtyRules}>
                <InputNumber min={1} max={10} precision={0} style={{ width: "100%" }} disabled={disabled} />
              </Form.Item>
            </Col>
          </>
        )}
        <Col xs={24} sm={12}>
          <Form.Item label="Offer Start" name="offerStart">
            <DatePicker showTime style={{ width: "100%" }} disabled={disabled} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item label="Offer End" name="offerEnd">
            <DatePicker showTime style={{ width: "100%" }} disabled={disabled} />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  );
};
