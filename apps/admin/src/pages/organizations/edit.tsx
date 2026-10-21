import { Edit, useForm } from "@refinedev/antd";
import { useGetIdentity } from "@refinedev/core";
import { Form, Input, InputNumber, Select, Card, Row, Col } from "antd";
import { BankOutlined, PercentageOutlined } from "@ant-design/icons";
import { FESTIVAL_REGIONS } from "@martly/shared/constants";

import { sectionTitle } from "../../theme";
import { ReadableSection } from "../../components/ReadableSection";
import { FeaturedBrandsCard } from "./featured-brands-card";

const COMMISSION_HELP = "Includes GST. Applies to orders delivered after you save.";

export const OrganizationEdit = () => {
  const { formProps, saveButtonProps, id } = useForm({ resource: "organizations" });
  const { data: identity } = useGetIdentity<{ role: string }>();
  const initialValues = formProps.initialValues && {
    ...formProps.initialValues,
    onlineCommissionPct: Number(formProps.initialValues.onlineCommissionPct),
    codCommissionPct: Number(formProps.initialValues.codCommissionPct),
  };

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <ReadableSection>
        <Form {...formProps} initialValues={initialValues} layout="vertical">
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
            <Col xs={24} lg={12}>
              <Card title={sectionTitle(<PercentageOutlined />, "Martly Commission")} size="small">
                <Form.Item label="Commission on online payments (%)" name="onlineCommissionPct" help={COMMISSION_HELP}>
                  <InputNumber min={0} max={20} step={0.5} precision={2} style={{ width: "100%" }} />
                </Form.Item>
                <Form.Item label="Commission on COD and wallet payments (%)" name="codCommissionPct" help={COMMISSION_HELP}>
                  <InputNumber min={0} max={20} step={0.5} precision={2} style={{ width: "100%" }} />
                </Form.Item>
              </Card>
            </Col>
          </Row>
        </Form>
        {identity?.role === "SUPER_ADMIN" && id && <FeaturedBrandsCard organizationId={String(id)} />}
      </ReadableSection>
    </Edit>
  );
};
