import { useState, useEffect } from "react";
import { Edit, useForm } from "@refinedev/antd";
import { Form, Input, Select, Switch, Card, Row, Col, Tabs, Tag, Spin } from "antd";
import { AppstoreOutlined, PictureOutlined, TranslationOutlined } from "@ant-design/icons";
import { ImageUpload } from "../../components/ImageUpload";
import { sectionTitle } from "../../theme";
import { axiosInstance } from "../../providers/data-provider";
import { useParams } from "react-router";
import { ReadableSection } from "../../components/ReadableSection";

type Level = "department" | "category" | "subcategory";

export const CategoryEdit = () => {
  const { id } = useParams<{ id: string }>();
  const [level, setLevel] = useState<Level | null>(null);
  const [resource, setResource] = useState<string>("categories");

  // Detect level by trying each endpoint
  useEffect(() => {
    if (!id) return;
    axiosInstance.get(`/categories/departments/${id}`).then(() => {
      setLevel("department");
      setResource("categories/departments");
    }).catch(() => {
      axiosInstance.get(`/categories/${id}`).then(() => {
        setLevel("category");
        setResource("categories");
      }).catch(() => {
        axiosInstance.get(`/categories/subcategories/${id}`).then(() => {
          setLevel("subcategory");
          setResource("categories/subcategories");
        }).catch(() => {});
      });
    });
  }, [id]);

  const { formProps, saveButtonProps } = useForm({ resource, id });

  if (!level) return <Spin style={{ display: "block", margin: "100px auto" }} />;

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <ReadableSection>
        <Form {...formProps} layout="vertical">
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title={sectionTitle(<AppstoreOutlined />, "Details")} size="small">
                <Row gutter={16}>
                  <Col xs={24}>
                    <Form.Item label="Level">
                      <Tag color={level === "department" ? "blue" : level === "category" ? "green" : "default"}>
                        {level}
                      </Tag>
                    </Form.Item>
                  </Col>
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
                  {level === "subcategory" && (
                    <Col xs={24}>
                      <Form.Item
                        label="Search terms"
                        name="searchTerms"
                        tooltip="Words shoppers type for this aisle (e.g. shaving, razor, dadhi). Search shows these products first for them"
                      >
                        <Select mode="tags" tokenSeparators={[","]} open={false} placeholder="Type a term and press Enter" />
                      </Form.Item>
                    </Col>
                  )}
                  {level === "subcategory" && (
                    <Col xs={24}>
                      <Form.Item
                        label="Restocked regularly"
                        name="restockable"
                        valuePropName="checked"
                        tooltip="On for things that get used up (milk, detergent). Off for durables and seasonal items (brooms, bottles, diyas), so reorder suggestions skip them"
                      >
                        <Switch />
                      </Form.Item>
                    </Col>
                  )}
                </Row>
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title={sectionTitle(<PictureOutlined />, "Image")} size="small">
                <Form.Item name="imageUrl" getValueFromEvent={(url: string) => url} style={{ marginBottom: 0 }}>
                  <ImageUpload />
                </Form.Item>
              </Card>
            </Col>
            <Col xs={24}>
              <Card title={sectionTitle(<TranslationOutlined />, "Translations")} size="small">
                <Tabs
                  items={[{
                    key: "ta",
                    label: "Tamil (\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD)",
                    children: (
                      <Form.Item label="Name (Tamil)" name={["translations", "ta", "name"]}>
                        <Input placeholder="\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD \u0BAA\u0BC6\u0BAF\u0BB0\u0BCD" />
                      </Form.Item>
                    ),
                  }]}
                />
              </Card>
            </Col>
          </Row>
        </Form>
      </ReadableSection>
    </Edit>
  );
};
