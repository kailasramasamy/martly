import { Create, useForm } from "@refinedev/antd";
import { Form, Input } from "antd";

export const StoreCreate = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "stores" });

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Form.Item label="Organization ID" name="organizationId" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Name" name="name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Slug" name="slug" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Address" name="address" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Phone" name="phone">
          <Input />
        </Form.Item>
      </Form>
    </Create>
  );
};
