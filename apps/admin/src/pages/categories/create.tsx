import { useState, useEffect } from "react";
import { Create, useForm } from "@refinedev/antd";
import { Form, Input, Select, Card, Row, Col, Tabs } from "antd";
import { AppstoreOutlined, PictureOutlined, TranslationOutlined } from "@ant-design/icons";
import { ImageUpload } from "../../components/ImageUpload";
import { sectionTitle } from "../../theme";
import { axiosInstance } from "../../providers/data-provider";

type Level = "department" | "category" | "subcategory";

export const CategoryCreate = () => {
  const [level, setLevel] = useState<Level>("subcategory");
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  const resource = level === "department" ? "categories/departments"
    : level === "subcategory" ? "categories/subcategories"
    : "categories";

  const { formProps, saveButtonProps } = useForm({ resource });

  useEffect(() => {
    axiosInstance.get("/categories/departments").then((res) => {
      setDepartments(res.data.data ?? []);
    }).catch(() => {});
  }, []);

  const onDepartmentChange = (deptId: string) => {
    axiosInstance.get(`/categories?departmentId=${deptId}`).then((res) => {
      setCategories(res.data.data ?? []);
    }).catch(() => {});
  };

  const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const slug = e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    formProps.form?.setFieldsValue({ slug });
  };

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<AppstoreOutlined />, "Details")} size="small">
              <Row gutter={16}>
                <Col xs={24}>
                  <Form.Item label="Level">
                    <Select
                      value={level}
                      onChange={(v) => setLevel(v)}
                      options={[
                        { value: "department", label: "Department" },
                        { value: "category", label: "Category" },
                        { value: "subcategory", label: "Subcategory" },
                      ]}
                    />
                  </Form.Item>
                </Col>
                {level === "category" && (
                  <Col xs={24} sm={12}>
                    <Form.Item label="Department" name="departmentId" rules={[{ required: true }]}>
                      <Select
                        options={departments.map((d) => ({ value: d.id, label: d.name }))}
                        placeholder="Select department"
                        showSearch
                        optionFilterProp="label"
                      />
                    </Form.Item>
                  </Col>
                )}
                {level === "subcategory" && (
                  <>
                    <Col xs={24} sm={12}>
                      <Form.Item label="Department" rules={[{ required: true }]}>
                        <Select
                          options={departments.map((d) => ({ value: d.id, label: d.name }))}
                          placeholder="Select department"
                          showSearch
                          optionFilterProp="label"
                          onChange={onDepartmentChange}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item label="Category" name="categoryId" rules={[{ required: true }]}>
                        <Select
                          options={categories.map((c) => ({ value: c.id, label: c.name }))}
                          placeholder="Select category"
                          showSearch
                          optionFilterProp="label"
                        />
                      </Form.Item>
                    </Col>
                  </>
                )}
                <Col xs={24} sm={12}>
                  <Form.Item label="Name" name="name" rules={[{ required: true }]}>
                    <Input onChange={onNameChange} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Slug" name="slug" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
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
    </Create>
  );
};
