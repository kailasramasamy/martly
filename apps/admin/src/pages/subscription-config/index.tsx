import { useState, useEffect } from "react";
import { App, Card, Form, Input, Switch, Radio, Button, Select, Space, Spin, Typography } from "antd";
import { CalendarOutlined, ShopOutlined, SaveOutlined } from "@ant-design/icons";
import { axiosInstance } from "../../providers/data-provider";
import { sectionTitle } from "../../theme";

const { Text } = Typography;

interface Store {
  id: string;
  name: string;
}

interface OrgConfig {
  subscriptionEnabled: boolean;
  organizationName?: string;
}

interface StoreConfig {
  storeId: string;
  enabled: boolean;
  deliveryMode: "DEDICATED_WINDOW" | "REGULAR_SLOTS";
  windowStart: string | null;
  windowEnd: string | null;
  cutoffTime: string;
}

export const SubscriptionConfig = () => {
  const { notification } = App.useApp();
  const [orgForm] = Form.useForm();
  const [storeForm] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [storeConfigs, setStoreConfigs] = useState<Record<string, StoreConfig>>({});
  const [savingOrg, setSavingOrg] = useState(false);
  const [savingStore, setSavingStore] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgEnabled, setOrgEnabled] = useState(false);

  useEffect(() => {
    Promise.all([
      axiosInstance.get("/subscriptions/config"),
      axiosInstance.get("/stores?pageSize=100"),
    ])
      .then(([configRes, storesRes]) => {
        const config = configRes?.data?.data;
        const storeList = storesRes?.data?.data ?? [];

        setStores(storeList);

        if (config) {
          const org = config.organization;
          setOrgName(org?.name ?? "");
          const enabled = org?.subscriptionEnabled ?? false;
          setOrgEnabled(enabled);
          orgForm.setFieldsValue({ subscriptionEnabled: enabled });

          const configMap: Record<string, StoreConfig> = {};
          for (const s of config.stores ?? []) {
            configMap[s.id] = {
              storeId: s.id,
              enabled: s.subscriptionEnabled,
              deliveryMode: s.subscriptionDeliveryMode === "DEDICATED" ? "DEDICATED_WINDOW" : "REGULAR_SLOTS",

              windowStart: s.subscriptionWindowStart ?? null,
              windowEnd: s.subscriptionWindowEnd ?? null,
              cutoffTime: s.subscriptionCutoffTime ?? "22:00",
            };
          }
          setStoreConfigs(configMap);
        } else {
          orgForm.setFieldsValue({ subscriptionEnabled: false });
        }
      })
      .catch(() => {
        orgForm.setFieldsValue({ subscriptionEnabled: false });
      })
      .finally(() => setLoading(false));
  }, [orgForm]);

  useEffect(() => {
    if (!selectedStoreId) {
      storeForm.resetFields();
      return;
    }
    const sc = storeConfigs[selectedStoreId];
    if (sc) {
      storeForm.setFieldsValue({
        enabled: sc.enabled,
        deliveryMode: sc.deliveryMode,
        windowStart: sc.windowStart ?? "",
        windowEnd: sc.windowEnd ?? "",
        cutoffTime: sc.cutoffTime ?? "",
      });
    } else {
      storeForm.setFieldsValue({
        enabled: false,
        deliveryMode: "REGULAR_SLOTS",
        windowStart: "",
        windowEnd: "",
        cutoffTime: "22:00",
      });
    }
  }, [selectedStoreId, storeConfigs, storeForm]);

  const handleOrgSave = async () => {
    const values = await orgForm.validateFields();
    setSavingOrg(true);
    try {
      await axiosInstance.patch("/subscriptions/config/org", values);
      setOrgEnabled(values.subscriptionEnabled);
      notification.success({ message: "Success", description: "Organization subscription settings saved" });
    } catch (err: any) {
      notification.error({ message: "Error", description: err?.response?.data?.message ?? "Failed to save" });
    } finally {
      setSavingOrg(false);
    }
  };

  const handleStoreSave = async () => {
    if (!selectedStoreId) return;
    const values = await storeForm.validateFields();
    setSavingStore(true);
    try {
      const payload = {
        subscriptionEnabled: values.enabled,
        subscriptionDeliveryMode: values.deliveryMode === "DEDICATED_WINDOW" ? "DEDICATED" : "SLOT_BASED",
        subscriptionWindowStart: values.windowStart || null,
        subscriptionWindowEnd: values.windowEnd || null,
        subscriptionCutoffTime: values.cutoffTime,
      };
      const res = await axiosInstance.patch(`/subscriptions/config/store/${selectedStoreId}`, payload);
      const s = res?.data?.data;
      if (s) {
        setStoreConfigs((prev) => ({
          ...prev,
          [selectedStoreId]: {
            storeId: s.id,
            enabled: s.subscriptionEnabled,
            deliveryMode: s.subscriptionDeliveryMode === "DEDICATED" ? "DEDICATED_WINDOW" : "REGULAR_SLOTS",
            windowStart: s.subscriptionWindowStart ?? null,
            windowEnd: s.subscriptionWindowEnd ?? null,
            cutoffTime: s.subscriptionCutoffTime ?? "22:00",
          },
        }));
      }
      notification.success({ message: "Success", description: "Store subscription config saved" });
    } catch (err: any) {
      notification.error({ message: "Error", description: err?.response?.data?.message ?? "Failed to save" });
    } finally {
      setSavingStore(false);
    }
  };

  const storeEnabled = Form.useWatch("enabled", storeForm);
  const deliveryMode = Form.useWatch("deliveryMode", storeForm);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>
          <Space>
            <CalendarOutlined style={{ color: "#0d9488" }} />
            Subscription Settings
          </Space>
        </h2>
        <Text type="secondary">
          Configure subscription / auto-delivery for your organization and stores
        </Text>
      </div>

      {/* Org-level toggle */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Form form={orgForm} layout="inline">
          <Form.Item
            name="subscriptionEnabled"
            label={`Enable Subscriptions${orgName ? ` for ${orgName}` : ""}`}
            valuePropName="checked"
            style={{ marginBottom: 0 }}
          >
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" loading={savingOrg} onClick={handleOrgSave}>
              Save
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Store-level configs */}
      <Card
        title={sectionTitle(<ShopOutlined />, "Store Configuration")}
        size="small"
        style={!orgEnabled ? { opacity: 0.5, pointerEvents: "none" } : undefined}
        extra={!orgEnabled ? <Text type="secondary">Enable subscriptions at org level first</Text> : undefined}
      >
        <Select
          placeholder="Select a store"
          value={selectedStoreId}
          onChange={setSelectedStoreId}
          options={stores.map((s) => ({ label: s.name, value: s.id }))}
          allowClear
          disabled={!orgEnabled}
          style={{ width: "100%", marginBottom: 16 }}
        />

        {selectedStoreId && orgEnabled && (
          <Form form={storeForm} layout="vertical">
            <Form.Item
              name="enabled"
              label="Subscriptions Enabled"
              valuePropName="checked"
            >
              <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
            </Form.Item>

            {storeEnabled && (
              <>
                <Form.Item name="deliveryMode" label="Delivery Mode">
                  <Radio.Group>
                    <Radio value="DEDICATED_WINDOW">Dedicated Window</Radio>
                    <Radio value="REGULAR_SLOTS">Regular Slots</Radio>
                  </Radio.Group>
                </Form.Item>

                {deliveryMode === "DEDICATED_WINDOW" && (
                  <Space size={16}>
                    <Form.Item
                      name="windowStart"
                      label="Window Start"
                      rules={[{ required: true, message: "Required" }, { pattern: /^\d{2}:\d{2}$/, message: "HH:MM format" }]}
                    >
                      <Input placeholder="06:00" style={{ width: 120 }} />
                    </Form.Item>
                    <Form.Item
                      name="windowEnd"
                      label="Window End"
                      rules={[{ required: true, message: "Required" }, { pattern: /^\d{2}:\d{2}$/, message: "HH:MM format" }]}
                    >
                      <Input placeholder="09:00" style={{ width: 120 }} />
                    </Form.Item>
                  </Space>
                )}

                <Form.Item
                  name="cutoffTime"
                  label="Cutoff Time"
                  rules={[{ required: true, message: "Required" }, { pattern: /^\d{2}:\d{2}$/, message: "HH:MM format" }]}
                  extra="Orders placed after this time will be scheduled for the next delivery day"
                >
                  <Input placeholder="22:00" style={{ width: 120 }} />
                </Form.Item>
              </>
            )}

            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={savingStore}
              onClick={handleStoreSave}
            >
              Save Store Config
            </Button>
          </Form>
        )}
      </Card>
    </div>
  );
};
