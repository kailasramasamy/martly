import { Edit, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, Select, InputNumber, Button, Space, Divider } from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { ImageUpload } from "../../components/ImageUpload";

const UNIT_TYPES = ["KG", "GRAM", "LITER", "ML", "PIECE", "PACK", "DOZEN", "BUNDLE"];

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

export const ProductEdit = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "products" });

  const { selectProps: categorySelectProps } = useSelect({
    resource: "categories",
    optionLabel: "name",
    optionValue: "id",
  });

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Form.Item label="Name" name="name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Description" name="description">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item label="Brand" name="brand">
          <Input placeholder="e.g. Amul, Tata, MDH" />
        </Form.Item>
        <Form.Item label="Category" name="categoryId">
          <Select {...categorySelectProps} allowClear placeholder="Select category" />
        </Form.Item>
        <Form.Item label="Product Type" name="productType">
          <Select options={PRODUCT_TYPES} allowClear placeholder="Select product type" />
        </Form.Item>
        <Form.Item label="Tags" name="tags">
          <Select mode="tags" placeholder="Add tags (e.g. organic, vegan)" />
        </Form.Item>
        <Form.Item label="HSN Code" name="hsnCode">
          <Input placeholder="HSN/SAC code for GST" />
        </Form.Item>
        <Form.Item label="Active" name="isActive" valuePropName="checked">
          <Select options={[{ label: "Yes", value: true }, { label: "No", value: false }]} />
        </Form.Item>
        <Form.Item
          label="Image"
          name="imageUrl"
          getValueFromEvent={(url: string) => url}
        >
          <ImageUpload />
        </Form.Item>

        <Divider>Compliance & Tax</Divider>

        <Form.Item label="GST %" name="gstPercent">
          <Select options={GST_OPTIONS} allowClear placeholder="Select GST rate" />
        </Form.Item>
        <Form.Item label="Food Type" name="foodType">
          <Select options={FOOD_TYPES} allowClear placeholder="Veg / Non-Veg / Vegan / Egg" />
        </Form.Item>
        <Form.Item label="FSSAI License" name="fssaiLicense">
          <Input placeholder="14-digit FSSAI license number" maxLength={14} />
        </Form.Item>

        <Divider>Product Details</Divider>

        <Form.Item label="Ingredients" name="ingredients">
          <Input.TextArea rows={3} placeholder="Ingredient list from pack label" />
        </Form.Item>
        <Form.Item label="Nutritional Info (JSON)" name="nutritionalInfo">
          <Input.TextArea rows={4} placeholder='{"energy":"250kcal","protein":"8g","fat":"12g","carbs":"30g"}' />
        </Form.Item>
        <Form.Item label="Allergens" name="allergens">
          <Select mode="tags" placeholder="Select or type allergens" options={COMMON_ALLERGENS.map((a) => ({ label: a, value: a }))} />
        </Form.Item>
        <Form.Item label="Serving Size" name="servingSize">
          <Input placeholder='e.g. "30g", "1 cup (250ml)"' />
        </Form.Item>
        <Form.Item label="Shelf Life (days)" name="shelfLifeDays">
          <InputNumber min={1} style={{ width: "100%" }} placeholder="Shelf life in days" />
        </Form.Item>
        <Form.Item label="Storage Instructions" name="storageInstructions">
          <Input placeholder="e.g. Store in a cool, dry place" />
        </Form.Item>
        <Form.Item label="Manufacturer Name" name="manufacturerName">
          <Input placeholder="Manufacturer / brand owner name" />
        </Form.Item>
        <Form.Item label="Country of Origin" name="countryOfOrigin">
          <Input placeholder="e.g. India" />
        </Form.Item>
        <Form.Item label="Additional Images" name="images">
          <Select mode="tags" placeholder="Paste image URLs (press Enter after each)" />
        </Form.Item>

        <Divider>FMCG & Regulatory</Divider>

        <Form.Item label="Regulatory Marks" name="regulatoryMarks">
          <Select mode="tags" placeholder="Select or type regulatory marks" options={REGULATORY_MARKS} />
        </Form.Item>
        <Form.Item label="Certifications" name="certifications">
          <Select mode="tags" placeholder="Select or type certifications" options={COMMON_CERTIFICATIONS} />
        </Form.Item>
        <Form.Item label="Mfg License No" name="mfgLicenseNo">
          <Input placeholder="Manufacturing license number" />
        </Form.Item>
        <Form.Item label="Danger Warnings" name="dangerWarnings">
          <Input.TextArea rows={2} placeholder='e.g. "Keep away from children"' />
        </Form.Item>
        <Form.Item label="Usage Instructions" name="usageInstructions">
          <Input.TextArea rows={2} placeholder="How to use this product" />
        </Form.Item>

        <Divider>Variants</Divider>

        <Form.List name="variants">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <Space key={key} style={{ display: "flex", marginBottom: 8 }} align="baseline" wrap>
                  <Form.Item {...restField} name={[name, "name"]} rules={[{ required: true, message: "Variant name required" }]}>
                    <Input placeholder="Variant name (e.g. 500ml)" />
                  </Form.Item>
                  <Form.Item {...restField} name={[name, "sku"]}>
                    <Input placeholder="SKU (optional)" />
                  </Form.Item>
                  <Form.Item {...restField} name={[name, "unitType"]} initialValue="PIECE">
                    <Select style={{ width: 120 }} options={UNIT_TYPES.map((u) => ({ label: u, value: u }))} />
                  </Form.Item>
                  <Form.Item {...restField} name={[name, "unitValue"]} initialValue={1}>
                    <InputNumber min={0.01} step={0.01} placeholder="Unit value" />
                  </Form.Item>
                  <Form.Item {...restField} name={[name, "barcode"]}>
                    <Input placeholder="Barcode (EAN-13)" />
                  </Form.Item>
                  <Form.Item {...restField} name={[name, "mrp"]}>
                    <InputNumber min={0} step={0.01} placeholder="MRP" />
                  </Form.Item>
                  <Form.Item {...restField} name={[name, "packType"]}>
                    <Input placeholder="Pack type (pouch, box...)" style={{ width: 150 }} />
                  </Form.Item>
                  {fields.length > 1 && <MinusCircleOutlined onClick={() => remove(name)} />}
                </Space>
              ))}
              <Form.Item>
                <Button type="dashed" onClick={() => add({ name: "", unitType: "PIECE", unitValue: 1 })} block icon={<PlusOutlined />}>
                  Add Variant
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>
      </Form>
    </Edit>
  );
};
