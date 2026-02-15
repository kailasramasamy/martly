import { Create, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, Select, InputNumber, Button, Card, Row, Col } from "antd";
import {
  MinusCircleOutlined,
  PlusOutlined,
  InfoCircleOutlined,
  PictureOutlined,
  SafetyCertificateOutlined,
  AuditOutlined,
  ExperimentOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";
import { ImageUpload } from "../../components/ImageUpload";
import { sectionTitle } from "../../theme";

const UNIT_TYPES = ["KG", "GRAM", "LITER", "ML", "PIECE", "PACK", "DOZEN", "BUNDLE"];

const STORAGE_TYPES = [
  { label: "Room Temperature", value: "AMBIENT" },
  { label: "Refrigerated (2-8°C)", value: "REFRIGERATED" },
  { label: "Deep Chilled (0-2°C)", value: "DEEP_CHILLED" },
  { label: "Frozen (-18°C)", value: "FROZEN" },
  { label: "Cool & Dry", value: "COOL_DRY" },
  { label: "Humidity Controlled", value: "HUMIDITY_CONTROLLED" },
];

const FOOD_TYPES = [
  { label: "Vegetarian", value: "VEG" },
  { label: "Non-Vegetarian", value: "NON_VEG" },
  { label: "Vegan", value: "VEGAN" },
  { label: "Egg", value: "EGG" },
];

const GST_OPTIONS = [
  { label: "0%", value: 0 },
  { label: "5%", value: 5 },
  { label: "12%", value: 12 },
  { label: "18%", value: 18 },
  { label: "28%", value: 28 },
];

const COMMON_ALLERGENS = [
  "Gluten", "Milk", "Eggs", "Tree Nuts", "Peanuts", "Soy", "Fish", "Shellfish", "Sesame", "Mustard", "Celery", "Sulphites",
];

const PRODUCT_TYPES = [
  { label: "Grocery", value: "GROCERY" },
  { label: "Snacks", value: "SNACKS" },
  { label: "Beverages", value: "BEVERAGES" },
  { label: "Dairy", value: "DAIRY" },
  { label: "Frozen", value: "FROZEN" },
  { label: "Fresh Produce", value: "FRESH_PRODUCE" },
  { label: "Bakery", value: "BAKERY" },
  { label: "Personal Care", value: "PERSONAL_CARE" },
  { label: "Household", value: "HOUSEHOLD" },
  { label: "Baby Care", value: "BABY_CARE" },
  { label: "Pet Care", value: "PET_CARE" },
  { label: "OTC Pharma", value: "OTC_PHARMA" },
];

const REGULATORY_MARKS = [
  { label: "FSSAI", value: "FSSAI" },
  { label: "ISI Mark", value: "ISI" },
  { label: "AGMARK", value: "AGMARK" },
  { label: "BIS Certification", value: "BIS" },
  { label: "Organic India", value: "ORGANIC_INDIA" },
  { label: "Halal", value: "HALAL" },
  { label: "Kosher", value: "KOSHER" },
  { label: "Ecomark", value: "ECOMARK" },
  { label: "FPO Mark", value: "FPO" },
];

const COMMON_CERTIFICATIONS = [
  { label: "Organic", value: "Organic" },
  { label: "Cruelty-Free", value: "Cruelty-Free" },
  { label: "ISO 22000", value: "ISO 22000" },
  { label: "GMP", value: "GMP" },
  { label: "HACCP", value: "HACCP" },
  { label: "Vegan Certified", value: "Vegan Certified" },
  { label: "Dermatologically Tested", value: "Dermatologically Tested" },
];

export const ProductCreate = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "products" });

  const { selectProps: categorySelectProps } = useSelect({
    resource: "categories",
    optionLabel: "name",
    optionValue: "id",
  });

  const { selectProps: brandSelectProps } = useSelect({
    resource: "brands",
    optionLabel: "name",
    optionValue: "id",
  });

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical" initialValues={{ variants: [{ name: "Default", unitType: "PIECE", unitValue: 1 }] }}>
        <Row gutter={[16, 16]}>
          {/* Basic Information */}
          <Col xs={24} lg={16}>
            <Card title={sectionTitle(<InfoCircleOutlined />, "Basic Information")} size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label="Name" name="name" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Brand" name="brandId">
                    <Select {...brandSelectProps} allowClear placeholder="Select brand" />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item label="Description" name="description">
                    <Input.TextArea rows={3} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Category" name="categoryId">
                    <Select {...categorySelectProps} allowClear placeholder="Select category" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Product Type" name="productType">
                    <Select options={PRODUCT_TYPES} allowClear placeholder="Select product type" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Food Type" name="foodType">
                    <Select options={FOOD_TYPES} allowClear placeholder="Veg / Non-Veg / Vegan / Egg" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="HSN Code" name="hsnCode">
                    <Input placeholder="HSN/SAC code for GST" />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item label="Tags" name="tags">
                    <Select mode="tags" placeholder="Add tags (e.g. organic, vegan)" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* Image */}
          <Col xs={24} lg={8}>
            <Card title={sectionTitle(<PictureOutlined />, "Image")} size="small" style={{ marginBottom: 16 }}>
              <Form.Item
                name="imageUrl"
                getValueFromEvent={(url: string) => url}
                style={{ marginBottom: 0 }}
              >
                <ImageUpload />
              </Form.Item>
            </Card>

            <Card title={sectionTitle(<PictureOutlined />, "Additional Images")} size="small" style={{ marginBottom: 16 }}>
              <Form.Item name="images" style={{ marginBottom: 0 }}>
                <Select mode="tags" placeholder="Paste image URLs (press Enter after each)" />
              </Form.Item>
            </Card>
          </Col>

          {/* Compliance & Tax */}
          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<SafetyCertificateOutlined />, "Compliance & Tax")} size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label="GST %" name="gstPercent">
                    <Select options={GST_OPTIONS} allowClear placeholder="Select GST rate" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="FSSAI License" name="fssaiLicense">
                    <Input placeholder="14-digit FSSAI license number" maxLength={14} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Mfg License No" name="mfgLicenseNo">
                    <Input placeholder="Manufacturing license number" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Manufacturer Name" name="manufacturerName">
                    <Input placeholder="Manufacturer / brand owner name" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Country of Origin" name="countryOfOrigin">
                    <Input placeholder="e.g. India" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* FMCG & Regulatory */}
          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<AuditOutlined />, "FMCG & Regulatory")} size="small" style={{ marginBottom: 16 }}>
              <Form.Item label="Regulatory Marks" name="regulatoryMarks">
                <Select mode="tags" placeholder="Select or type regulatory marks" options={REGULATORY_MARKS} />
              </Form.Item>
              <Form.Item label="Certifications" name="certifications">
                <Select mode="tags" placeholder="Select or type certifications" options={COMMON_CERTIFICATIONS} />
              </Form.Item>
              <Form.Item label="Danger Warnings" name="dangerWarnings">
                <Input.TextArea rows={2} placeholder='e.g. "Keep away from children"' />
              </Form.Item>
              <Form.Item label="Usage Instructions" name="usageInstructions">
                <Input.TextArea rows={2} placeholder="How to use this product" />
              </Form.Item>
            </Card>
          </Col>

          {/* Product Details */}
          <Col xs={24}>
            <Card title={sectionTitle(<ExperimentOutlined />, "Product Details")} size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col xs={24} lg={12}>
                  <Form.Item label="Ingredients" name="ingredients">
                    <Input.TextArea rows={3} placeholder="Ingredient list from pack label" />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={12}>
                  <Form.Item label="Nutritional Info (JSON)" name="nutritionalInfo">
                    <Input.TextArea rows={3} placeholder='{"energy":"250kcal","protein":"8g","fat":"12g","carbs":"30g"}' />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item label="Allergens" name="allergens">
                    <Select mode="tags" placeholder="Select or type allergens" options={COMMON_ALLERGENS.map((a) => ({ label: a, value: a }))} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item label="Serving Size" name="servingSize">
                    <Input placeholder='e.g. "30g", "1 cup (250ml)"' />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item label="Shelf Life (days)" name="shelfLifeDays">
                    <InputNumber min={1} style={{ width: "100%" }} placeholder="Shelf life in days" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Storage Type" name="storageType">
                    <Select options={STORAGE_TYPES} allowClear placeholder="Select storage type" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Storage Instructions" name="storageInstructions">
                    <Input placeholder="e.g. Store in a cool, dry place" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* Variants */}
          <Col xs={24}>
            <Card title={sectionTitle(<AppstoreOutlined />, "Variants")} size="small">
              <Form.List name="variants">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Card
                        key={key}
                        size="small"
                        style={{ marginBottom: 12, background: "#fafafa" }}
                        extra={fields.length > 1 ? <MinusCircleOutlined onClick={() => remove(name)} style={{ color: "#ff4d4f" }} /> : null}
                      >
                        <Row gutter={16}>
                          <Col xs={24} sm={8}>
                            <Form.Item {...restField} label="Variant Name" name={[name, "name"]} rules={[{ required: true, message: "Variant name required" }]}>
                              <Input placeholder="e.g. 500ml" />
                            </Form.Item>
                          </Col>
                          <Col xs={12} sm={8}>
                            <Form.Item {...restField} label="SKU" name={[name, "sku"]}>
                              <Input placeholder="Optional" />
                            </Form.Item>
                          </Col>
                          <Col xs={12} sm={8}>
                            <Form.Item {...restField} label="Barcode" name={[name, "barcode"]}>
                              <Input placeholder="EAN-13" />
                            </Form.Item>
                          </Col>
                          <Col xs={12} sm={6}>
                            <Form.Item {...restField} label="Unit Type" name={[name, "unitType"]} initialValue="PIECE">
                              <Select options={UNIT_TYPES.map((u) => ({ label: u, value: u }))} />
                            </Form.Item>
                          </Col>
                          <Col xs={12} sm={6}>
                            <Form.Item {...restField} label="Unit Value" name={[name, "unitValue"]} initialValue={1}>
                              <InputNumber min={0.01} step={0.01} style={{ width: "100%" }} />
                            </Form.Item>
                          </Col>
                          <Col xs={12} sm={6}>
                            <Form.Item {...restField} label="MRP" name={[name, "mrp"]}>
                              <InputNumber min={0} step={0.01} style={{ width: "100%" }} placeholder="MRP" />
                            </Form.Item>
                          </Col>
                          <Col xs={12} sm={6}>
                            <Form.Item {...restField} label="Pack Type" name={[name, "packType"]}>
                              <Input placeholder="pouch, box..." />
                            </Form.Item>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                    <Form.Item>
                      <Button type="dashed" onClick={() => add({ name: "", unitType: "PIECE", unitValue: 1 })} block icon={<PlusOutlined />}>
                        Add Variant
                      </Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>
            </Card>
          </Col>
        </Row>
      </Form>
    </Create>
  );
};
