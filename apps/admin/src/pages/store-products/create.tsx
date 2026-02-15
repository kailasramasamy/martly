import { Create, useForm, useSelect } from "@refinedev/antd";
import { Form, Select, InputNumber } from "antd";

export const StoreProductCreate = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "store-products" });

  const { selectProps: storeSelectProps } = useSelect({
    resource: "stores",
    optionLabel: "name",
    optionValue: "id",
  });

  const { selectProps: productSelectProps } = useSelect({
    resource: "products",
    optionLabel: "name",
    optionValue: "id",
  });

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Form.Item label="Store" name="storeId" rules={[{ required: true }]}>
          <Select {...storeSelectProps} placeholder="Select a store" />
        </Form.Item>
        <Form.Item label="Product" name="productId" rules={[{ required: true }]}>
          <Select {...productSelectProps} placeholder="Select a product" />
        </Form.Item>
        <Form.Item label="Price" name="price" rules={[{ required: true }]}>
          <InputNumber min={0.01} step={0.01} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item label="Stock" name="stock" rules={[{ required: true }]}>
          <InputNumber min={0} step={1} style={{ width: "100%" }} />
        </Form.Item>
      </Form>
    </Create>
  );
};
