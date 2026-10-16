import { useEffect, useState } from "react";
import { Button, Card, Col, Form, InputNumber, Row, Switch, Typography, message } from "antd";
import { SettingOutlined } from "@ant-design/icons";
import { axiosInstance } from "../../providers/data-provider";
import { sectionTitle } from "../../theme";
import type { FleetSettings } from "./types";

const FIELDS: { name: keyof FleetSettings; label: string; min: number; max: number }[] = [
  { name: "maxOrdersPerTrip", label: "Max orders per trip", min: 1, max: 30 },
  { name: "maxTripsPerRider", label: "Max trips per rider per slot", min: 1, max: 10 },
  { name: "expressBatchSize", label: "Express batch size", min: 1, max: 10 },
  { name: "expressMaxWaitMinutes", label: "Express max wait (minutes)", min: 0, max: 120 },
];

function FleetFields() {
  return (
    <Row gutter={16}>
      {FIELDS.map((f) => (
        <Col key={f.name} xs={24} sm={12} lg={6}>
          <Form.Item name={f.name} label={f.label} rules={[{ required: true }]}>
            <InputNumber min={f.min} max={f.max} style={{ width: "100%" }} />
          </Form.Item>
        </Col>
      ))}
    </Row>
  );
}

export function SettingsForm({ storeId }: { storeId: string }) {
  const [form] = Form.useForm<FleetSettings>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axiosInstance.get(`/delivery-plan/settings?storeId=${storeId}`).then((res) => form.setFieldsValue(res.data.data));
  }, [storeId, form]);

  const save = async (values: FleetSettings) => {
    setSaving(true);
    try {
      await axiosInstance.put("/delivery-plan/settings", { storeId, ...values });
      message.success("Fleet rules saved");
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to save fleet rules");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={sectionTitle(<SettingOutlined />, "Fleet rules")}>
      <Form form={form} layout="vertical" onFinish={save}>
        <FleetFields />
        <Form.Item name="autoPlan" label="Plan trips automatically" valuePropName="checked" style={{ marginBottom: 4 }}>
          <Switch />
        </Form.Item>
        <Typography.Paragraph type="secondary">
          When on, a slot is planned once its booking cutoff passes, and Express orders are batched when enough are ready or the oldest has
          waited too long. You still assign riders and start trips. Leave it off to plan by hand from the Delivery Board.
        </Typography.Paragraph>
        <Button type="primary" htmlType="submit" loading={saving}>Save fleet rules</Button>
      </Form>
    </Card>
  );
}
