import { useState, useEffect } from "react";
import {
  Card,
  Form,
  InputNumber,
  Switch,
  Button,
  Select,
  Space,
  message,
  Spin,
  Typography,
  TimePicker,
  Alert,
  Row,
  Col,
} from "antd";
import { ThunderboltOutlined, ClockCircleOutlined, SettingOutlined } from "@ant-design/icons";
import { useCustom, useApiUrl } from "@refinedev/core";
import { axiosInstance } from "../../providers/data-provider";
import { sectionTitle } from "../../theme";
import dayjs from "dayjs";

const { Text } = Typography;

interface Store {
  id: string;
  name: string;
}

interface ExpressConfig {
  id?: string;
  isEnabled: boolean;
  etaMinutes: number | null;
  operatingStart: string | null;
  operatingEnd: string | null;
}

export const ExpressDeliveryConfig = () => {
  const apiUrl = useApiUrl();
  const [form] = Form.useForm();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  const { data: storesData } = useCustom<{ data: Store[] }>({
    url: `${apiUrl}/stores`,
    method: "get",
    config: { query: { pageSize: 100 } },
  });
  const stores = storesData?.data?.data ?? [];

  // Auto-select first store
  useEffect(() => {
    if (stores.length > 0 && !storeId) {
      setStoreId(stores[0].id);
    }
  }, [stores, storeId]);

  // Fetch config when store changes
  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    setHasExisting(false);
    axiosInstance
      .get(`/express-delivery/config?storeId=${storeId}`)
      .then((res) => {
        const data = res?.data?.data;
        if (data) {
          form.setFieldsValue({
            isEnabled: data.isEnabled,
            etaMinutes: data.etaMinutes,
            operatingStart: data.operatingStart ? dayjs(data.operatingStart, "HH:mm") : null,
            operatingEnd: data.operatingEnd ? dayjs(data.operatingEnd, "HH:mm") : null,
          });
          setHasExisting(true);
        } else {
          form.setFieldsValue({
            isEnabled: true,
            etaMinutes: null,
            operatingStart: null,
            operatingEnd: null,
          });
        }
      })
      .catch(() => {
        form.setFieldsValue({
          isEnabled: true,
          etaMinutes: null,
          operatingStart: null,
          operatingEnd: null,
        });
      })
      .finally(() => setLoading(false));
  }, [storeId, form]);

  const handleSave = async () => {
    if (!storeId) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      await axiosInstance.put(`/express-delivery/config?storeId=${storeId}`, {
        isEnabled: values.isEnabled,
        etaMinutes: values.etaMinutes || null,
        operatingStart: values.operatingStart ? dayjs(values.operatingStart).format("HH:mm") : null,
        operatingEnd: values.operatingEnd ? dayjs(values.operatingEnd).format("HH:mm") : null,
      });
      message.success("Express delivery config saved");
      setHasExisting(true);
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to save config");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>
          <Space>
            <ThunderboltOutlined style={{ color: "#d97706" }} />
            Express Delivery Config
          </Space>
        </h2>
        <Text type="secondary">
          Configure express (ASAP) delivery per store — enable/disable, custom ETA, and operating hours
        </Text>
      </div>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Form.Item label="Store" style={{ marginBottom: 0 }}>
          <Select
            value={storeId}
            onChange={setStoreId}
            placeholder="Select store"
            style={{ width: 300 }}
            options={stores.map((s) => ({ label: s.name, value: s.id }))}
          />
        </Form.Item>
      </Card>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
          <Spin size="large" />
        </div>
      ) : storeId ? (
        <Form form={form} layout="vertical">
          <Card size="small" style={{ marginBottom: 16 }}>
            <Form.Item
              name="isEnabled"
              label="Enable Express Delivery"
              valuePropName="checked"
              style={{ marginBottom: 0 }}
            >
              <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
            </Form.Item>
          </Card>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Card
                title={sectionTitle(<ThunderboltOutlined />, "Custom ETA")}
                size="small"
                style={{ marginBottom: 16 }}
              >
                <Form.Item
                  name="etaMinutes"
                  label="ETA Override (minutes)"
                  extra="Leave empty to use delivery tier/zone ETA"
                >
                  <InputNumber min={1} max={300} style={{ width: "100%" }} placeholder="e.g. 30" />
                </Form.Item>
              </Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card
                title={sectionTitle(<ClockCircleOutlined />, "Operating Hours")}
                size="small"
                style={{ marginBottom: 16 }}
              >
                <Form.Item
                  name="operatingStart"
                  label="Start Time"
                  extra="Leave empty for 24/7 availability"
                >
                  <TimePicker format="HH:mm" minuteStep={15} style={{ width: "100%" }} />
                </Form.Item>
                <Form.Item
                  name="operatingEnd"
                  label="End Time"
                  extra="Express is unavailable outside this window"
                >
                  <TimePicker format="HH:mm" minuteStep={15} style={{ width: "100%" }} />
                </Form.Item>
              </Card>
            </Col>
          </Row>

          <Alert
            type="info"
            showIcon
            message="How it works"
            description={
              <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                <li><strong>No config row</strong> = express enabled with default behavior (backward compatible)</li>
                <li>When <strong>disabled</strong>, customers only see scheduled delivery slots</li>
                <li><strong>Custom ETA</strong> overrides the tier/zone ETA for express orders</li>
                <li><strong>Operating hours</strong> restrict when express is available — outside the window, customers see a reason banner</li>
              </ul>
            }
            style={{ marginBottom: 16 }}
          />

          <Button
            type="primary"
            icon={<SettingOutlined />}
            onClick={handleSave}
            loading={saving}
            size="large"
          >
            {hasExisting ? "Update Config" : "Save Config"}
          </Button>
        </Form>
      ) : null}
    </div>
  );
};
