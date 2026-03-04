import { Edit, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, Select, Card, Row, Col, Tabs } from "antd";
import { AppstoreOutlined, PictureOutlined, TranslationOutlined } from "@ant-design/icons";
import { ImageUpload } from "../../components/ImageUpload";
import { sectionTitle } from "../../theme";

export const CategoryEdit = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "categories" });

  const { selectProps: parentSelectProps } = useSelect({
    resource: "categories",
    optionLabel: "name",
    optionValue: "id",
    filters: [{ field: "parentId", operator: "eq", value: "null" }],
  });

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<AppstoreOutlined />, "Category Details")} size="small">
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
                  <Form.Item label="Parent Category" name="parentId">
                    <Select {...parentSelectProps} allowClear placeholder="None (top-level)" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<PictureOutlined />, "Image")} size="small">
              <Form.Item
                name="imageUrl"
                getValueFromEvent={(url: string) => url}
                style={{ marginBottom: 0 }}
              >
                <ImageUpload />
              </Form.Item>
            </Card>
          </Col>
          <Col xs={24}>
            <Card title={sectionTitle(<TranslationOutlined />, "Translations")} size="small">
              <Tabs
                items={[
                  {
                    key: "ta",
                    label: "Tamil (\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD)",
                    children: (
                      <Form.Item label="Name (Tamil)" name={["translations", "ta", "name"]}>
                        <Input placeholder="\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD \u0BAA\u0BC6\u0BAF\u0BB0\u0BCD" />
                      </Form.Item>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </Form>
    </Edit>
  );
};
