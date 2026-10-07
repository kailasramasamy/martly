import { Edit, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, InputNumber, Select, Switch, Card, Row, Col, Button } from "antd";
import { BookOutlined, UnorderedListOutlined, MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { ImageUpload } from "../../components/ImageUpload";
import { sectionTitle } from "../../theme";

const { TextArea } = Input;

export const RecipeEdit = () => {
  const { formProps, saveButtonProps, queryResult } = useForm({
    resource: "recipes",
  });

  const record = queryResult?.data?.data as any;
  const existingProductIds = record?.items?.map((item: any) => item.product?.id ?? item.productId).filter(Boolean) ?? [];

  const { selectProps: productSelectProps } = useSelect({
    resource: "products",
    optionLabel: "name",
    optionValue: "id",
    defaultValue: existingProductIds,
  });

  const initialItems = record?.items?.map((item: any) => ({
    productId: item.product?.id ?? item.productId,
    displayQty: item.displayQty,
    note: item.note,
  })) ?? [];
  const initialInstructions = Array.isArray(record?.instructions) ? record.instructions : [];

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form
        {...formProps}
        layout="vertical"
        initialValues={{
          ...formProps.initialValues,
          items: initialItems.length > 0 ? initialItems : [{}],
          instructions: initialInstructions.length > 0 ? initialInstructions : [""],
        }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<BookOutlined />, "Recipe Details")} size="small">
              <Form.Item label="Title" name="title" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item label="Slug" name="slug" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item label="Description" name="description">
                <TextArea rows={3} />
              </Form.Item>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label="Prep Time (min)" name="prepTime">
                    <InputNumber min={1} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Cook Time (min)" name="cookTime">
                    <InputNumber min={1} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Servings" name="servings">
                    <InputNumber min={1} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label="Difficulty" name="difficulty">
                    <Select allowClear placeholder="Select">
                      <Select.Option value="EASY">Easy</Select.Option>
                      <Select.Option value="MEDIUM">Medium</Select.Option>
                      <Select.Option value="HARD">Hard</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Cuisine Type" name="cuisineType">
                    <Input placeholder="e.g. Indian" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Diet Type" name="dietType">
                    <Select allowClear placeholder="Select">
                      <Select.Option value="VEG">Veg</Select.Option>
                      <Select.Option value="NON_VEG">Non-Veg</Select.Option>
                      <Select.Option value="VEGAN">Vegan</Select.Option>
                      <Select.Option value="EGG">Egg</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Active" name="isActive" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item label="Cover Image" name="imageUrl" getValueFromEvent={(url: string) => url}>
                <ImageUpload />
              </Form.Item>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<UnorderedListOutlined />, "Ingredients")} size="small" style={{ marginBottom: 16 }}>
              <Form.List name="items">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Row key={key} gutter={8} align="top" style={{ marginBottom: 8 }}>
                        <Col span={10}>
                          <Form.Item {...restField} name={[name, "productId"]} rules={[{ required: true, message: "Required" }]} style={{ marginBottom: 0 }}>
                            <Select {...productSelectProps} placeholder="Product" showSearch allowClear />
                          </Form.Item>
                        </Col>
                        <Col span={5}>
                          <Form.Item {...restField} name={[name, "displayQty"]} rules={[{ required: true, message: "Required" }]} style={{ marginBottom: 0 }}>
                            <Input placeholder="e.g. 500g" />
                          </Form.Item>
                        </Col>
                        <Col span={7}>
                          <Form.Item {...restField} name={[name, "note"]} style={{ marginBottom: 0 }}>
                            <Input placeholder="Note (optional)" />
                          </Form.Item>
                        </Col>
                        <Col span={2}>
                          <MinusCircleOutlined onClick={() => remove(name)} style={{ marginTop: 8, color: "#999" }} />
                        </Col>
                      </Row>
                    ))}
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      Add Ingredient
                    </Button>
                  </>
                )}
              </Form.List>
            </Card>
            <Card title={sectionTitle(<UnorderedListOutlined />, "Instructions")} size="small">
              <Form.List name="instructions">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Row key={key} gutter={8} align="top" style={{ marginBottom: 8 }}>
                        <Col span={2} style={{ textAlign: "center", paddingTop: 5, fontWeight: 600, color: "#888" }}>
                          {name + 1}.
                        </Col>
                        <Col span={20}>
                          <Form.Item {...restField} name={name} rules={[{ required: true, message: "Required" }]} style={{ marginBottom: 0 }}>
                            <TextArea rows={2} placeholder={`Step ${name + 1}`} />
                          </Form.Item>
                        </Col>
                        <Col span={2}>
                          <MinusCircleOutlined onClick={() => remove(name)} style={{ marginTop: 8, color: "#999" }} />
                        </Col>
                      </Row>
                    ))}
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      Add Step
                    </Button>
                  </>
                )}
              </Form.List>
            </Card>
          </Col>
        </Row>
      </Form>
    </Edit>
  );
};
