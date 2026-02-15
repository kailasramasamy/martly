import { Edit, useForm } from "@refinedev/antd";
import { Form, Input, Select } from "antd";

export const StoreEdit = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "stores" });

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
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
        <Form.Item label="Status" name="status" rules={[{ required: true }]}>
          <Select
            options={[
              { label: "Pending", value: "PENDING" },
              { label: "Active", value: "ACTIVE" },
              { label: "Suspended", value: "SUSPENDED" },
              { label: "Closed", value: "CLOSED" },
            ]}
          />
        </Form.Item>
      </Form>
    </Edit>
  );
};
