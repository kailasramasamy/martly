import { Create, useForm } from "@refinedev/antd";
import { Form, Input } from "antd";

export const OrganizationCreate = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "organizations" });

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Form.Item label="Name" name="name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Slug" name="slug" rules={[{ required: true, pattern: /^[a-z0-9-]+$/, message: "Lowercase letters, numbers, and hyphens only" }]}>
          <Input />
        </Form.Item>
      </Form>
    </Create>
  );
};
