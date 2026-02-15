import { Edit, useForm } from "@refinedev/antd";
import { Form, InputNumber, Switch, Typography } from "antd";

const { Text } = Typography;

export const StoreProductEdit = () => {
  const { formProps, saveButtonProps, query } = useForm({
    resource: "store-products",
  });

  const record = query?.data?.data as { store?: { name: string }; product?: { name: string } } | undefined;

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        {record?.store && (
          <Form.Item label="Store">
            <Text>{record.store.name}</Text>
          </Form.Item>
        )}
        {record?.product && (
          <Form.Item label="Product">
            <Text>{record.product.name}</Text>
          </Form.Item>
        )}
        <Form.Item label="Price" name="price" rules={[{ required: true }]}>
          <InputNumber min={0.01} step={0.01} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item label="Stock" name="stock" rules={[{ required: true }]}>
          <InputNumber min={0} step={1} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item label="Active" name="isActive" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Edit>
  );
};
