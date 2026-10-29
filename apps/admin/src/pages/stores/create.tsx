import { useState } from "react";
import { Create, useForm, useSelect } from "@refinedev/antd";
import { useGetIdentity } from "@refinedev/core";
import { Form, Input, InputNumber, Select, Card, Row, Col, Switch, Radio } from "antd";
import { ShopOutlined, EnvironmentOutlined, ShoppingCartOutlined, CalendarOutlined } from "@ant-design/icons";

import { sectionTitle } from "../../theme";
import { ReadableSection } from "../../components/ReadableSection";
import { TownSelect } from "../../components/TownSelect";
import { URL_SEGMENT_RULE } from "@martly/shared/constants";

interface Identity {
  role: string;
  organizationId?: string;
}

export const StoreCreate = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "stores" });
  const { data: identity } = useGetIdentity<Identity>();
  const [townSlug, setTownSlug] = useState<string>();
  const slug = Form.useWatch("slug", formProps.form);

  const isSuperAdmin = identity?.role === "SUPER_ADMIN";

  const { selectProps: orgSelectProps } = useSelect({
    resource: "organizations",
    optionLabel: "name",
    optionValue: "id",
    queryOptions: { enabled: isSuperAdmin },
  });

  return (
    <Create saveButtonProps={saveButtonProps}>
      <ReadableSection>
        <Form
          {...formProps}
          layout="vertical"
          initialValues={
            !isSuperAdmin && identity?.organizationId
              ? { organizationId: identity.organizationId }
              : undefined
          }
        >
          <Row gutter={[16, 16]}>
            {/* Left column: General info */}
            <Col xs={24} lg={12}>
              <Card title={sectionTitle(<ShopOutlined />, "Store Details")} size="small">
                {isSuperAdmin ? (
                  <Form.Item label="Organization" name="organizationId" rules={[{ required: true }]}>
                    <Select {...orgSelectProps} placeholder="Select organization" />
                  </Form.Item>
                ) : (
                  <Form.Item name="organizationId" hidden>
                    <Input />
                  </Form.Item>
                )}
                <Form.Item label="Name" name="name" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item label="Town" name="townId" rules={[{ required: true }]} extra="Sets the store's state and district, and its web address">
                  <TownSelect onChange={(_, town) => setTownSlug(town.slug)} />
                </Form.Item>
                <Form.Item label="Slug" name="slug" rules={[{ required: true }, URL_SEGMENT_RULE]} extra={`Web address: onmartly.in/${townSlug ?? "{town}"}/${slug || "{slug}"}`}>
                  <Input />
                </Form.Item>
              </Card>

              <Card title={sectionTitle(<EnvironmentOutlined />, "Contact & Location")} size="small" style={{ marginTop: 16 }}>
                <Form.Item label="Address" name="address" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item label="Phone" name="phone">
                  <Input />
                </Form.Item>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item label="Latitude" name="latitude">
                      <InputNumber style={{ width: "100%" }} step={0.0001} placeholder="e.g. 19.0760" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="Longitude" name="longitude">
                      <InputNumber style={{ width: "100%" }} step={0.0001} placeholder="e.g. 72.8777" />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>

            {/* Right column: Operational settings */}
            <Col xs={24} lg={12}>
              <Card title={sectionTitle(<ShoppingCartOutlined />, "Delivery Settings")} size="small">
                <Form.Item label={"Return keep-it limit (\u20B9)"} name="returnKeepThreshold" help="Returns worth up to this amount default to refund without collecting the item.">
                  <InputNumber style={{ width: "100%" }} min={0} addonBefore={"\u20B9"} placeholder="No limit" />
                </Form.Item>
              </Card>

              <Card title={sectionTitle(<CalendarOutlined />, "Subscriptions")} size="small" style={{ marginTop: 16 }}>
                <Form.Item label="Enable Subscriptions" name="subscriptionEnabled" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Form.Item label="Delivery Mode" name="subscriptionDeliveryMode">
                  <Radio.Group>
                    <Radio value="DEDICATED">Dedicated Window</Radio>
                    <Radio value="SLOT_BASED">Regular Slots</Radio>
                  </Radio.Group>
                </Form.Item>
                <Row gutter={12}>
                  <Col span={8}>
                    <Form.Item label="Window Start" name="subscriptionWindowStart" tooltip="e.g. 06:00">
                      <Input placeholder="06:00" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Window End" name="subscriptionWindowEnd" tooltip="e.g. 08:00">
                      <Input placeholder="08:00" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item label="Cutoff Time" name="subscriptionCutoffTime" tooltip="Time by which basket is finalized (e.g. 22:00)">
                      <Input placeholder="22:00" />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>
        </Form>
      </ReadableSection>
    </Create>
  );
};
