import { Edit, useForm } from "@refinedev/antd";
import { Form, Input, InputNumber, Select, Card, Row, Col } from "antd";
import { BankOutlined } from "@ant-design/icons";
import { FESTIVAL_REGIONS } from "@martly/shared/constants";

import { sectionTitle } from "../../theme";

export const OrganizationEdit = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "organizations" });

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<BankOutlined />, "Organization Details")} size="small">
              <Form.Item label="Name" name="name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item label="Slug" name="slug" rules={[{ required: true, pattern: /^[a-z0-9-]+$/, message: "Lowercase letters, numbers, and hyphens only" }]}>
                <Input />
              </Form.Item>
              <Form.Item label="Festival calendar regions" name="festivalRegions">
                <Select
                  mode="multiple"
                  options={Object.entries(FESTIVAL_REGIONS).map(([value, label]) => ({ value, label }))}
                />
              </Form.Item>
              <Form.Item label="Promo discount cap (%)" name="promoDiscountCap" help="The promo agent never sets a discount above this.">
                <InputNumber min={1} max={90} style={{ width: "100%" }} />
              </Form.Item>
            </Card>
          </Col>
        </Row>
      </Form>
    </Edit>
  );
};
