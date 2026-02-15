import { Create, useForm } from "@refinedev/antd";
import { Form, Input } from "antd";

export const ProductCreate = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "products" });

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Form.Item label="Name" name="name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Description" name="description">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Form.Item label="SKU" name="sku">
          <Input />
        </Form.Item>
        <Form.Item label="Image URL" name="imageUrl">
          <Input />
        </Form.Item>
      </Form>
    </Create>
  );
};
