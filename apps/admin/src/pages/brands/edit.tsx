import { Edit, useForm } from "@refinedev/antd";
import { Form, Input, InputNumber, Card, Row, Col, ColorPicker } from "antd";
import { TrademarkOutlined } from "@ant-design/icons";
import { ImageUpload } from "../../components/ImageUpload";
import { sectionTitle } from "../../theme";

export const BrandEdit = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "brands" });

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<TrademarkOutlined />, "Brand Details")} size="small">
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label="Name" name="name" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Slug" name="slug" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Brand colour"
                    name="themeColor"
                    tooltip="Themes the brand's store in the app"
                    getValueFromEvent={(_: unknown, hex: string) => hex || null}
                  >
                    <ColorPicker showText allowClear disabledAlpha format="hex" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Accent colour"
                    name="themeColorSecondary"
                    tooltip="Optional second logo colour, used for accents in the brand's store"
                    getValueFromEvent={(_: unknown, hex: string) => hex || null}
                  >
                    <ColorPicker showText allowClear disabledAlpha format="hex" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    label="Popularity"
                    name="popularity"
                    tooltip="0–100: how well shoppers know this brand. Search shows better-known brands first"
                  >
                    <InputNumber min={0} max={100} precision={0} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<TrademarkOutlined />, "Brand Image")} size="small">
              <Form.Item
                name="imageUrl"
                getValueFromEvent={(url: string) => url}
                style={{ marginBottom: 0 }}
              >
                <ImageUpload />
              </Form.Item>
            </Card>
          </Col>
        </Row>
      </Form>
    </Edit>
  );
};
