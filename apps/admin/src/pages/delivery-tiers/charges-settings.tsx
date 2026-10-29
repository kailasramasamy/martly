import { useEffect, useState } from "react";
import { App, Button, Form, InputNumber, Space } from "antd";
import { isAxiosError } from "axios";
import { ReadableSection } from "../../components/ReadableSection";
import { axiosInstance } from "../../providers/data-provider";

interface ChargesSettings {
  deliveryRadius: number;
  freeDeliveryThreshold: number | null;
  minOrderAmount: number | null;
}

export function ChargesSettingsForm({ storeId }: { storeId: string }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<ChargesSettings>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axiosInstance
      .get<{ data: ChargesSettings }>("/delivery-tiers/settings", { params: { storeId } })
      .then((res) => form.setFieldsValue(res.data.data))
      .catch((err) => {
        if (!isAxiosError(err)) throw err;
        message.error(err.response?.data?.message ?? "Failed to load delivery settings");
      });
  }, [storeId]);

  const handleSave = async (values: ChargesSettings) => {
    setSaving(true);
    try {
      const body = {
        deliveryRadius: values.deliveryRadius,
        freeDeliveryThreshold: values.freeDeliveryThreshold ?? null,
        minOrderAmount: values.minOrderAmount ?? null,
      };
      const res = await axiosInstance.put<{ data: ChargesSettings }>("/delivery-tiers/settings", body, {
        params: { storeId },
      });
      form.setFieldsValue(res.data.data);
      message.success("Delivery settings saved");
    } catch (err) {
      if (!isAxiosError(err)) throw err;
      message.error(err.response?.data?.message ?? "Failed to save delivery settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ReadableSection>
      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Space align="start" size="middle" wrap>
          <Form.Item label="Delivery radius (km)" name="deliveryRadius" rules={[{ required: true, message: "Required" }]}>
            <InputNumber min={0.5} max={30} step={0.5} />
          </Form.Item>
          <Form.Item label={"Free delivery above (₹)"} name="freeDeliveryThreshold">
            <InputNumber min={0} placeholder="No free delivery" />
          </Form.Item>
          <Form.Item label={"Minimum order (₹)"} name="minOrderAmount">
            <InputNumber min={0} placeholder="No minimum" />
          </Form.Item>
          <Form.Item label=" ">
            <Button type="primary" htmlType="submit" loading={saving}>Save</Button>
          </Form.Item>
        </Space>
      </Form>
    </ReadableSection>
  );
}
