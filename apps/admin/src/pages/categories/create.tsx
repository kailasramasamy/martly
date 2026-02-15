import { Create, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, InputNumber, Select } from "antd";

export const CategoryCreate = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "categories" });

  const { selectProps: parentSelectProps } = useSelect({
    resource: "categories",
    optionLabel: "name",
    optionValue: "id",
  });

  const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const slug = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    formProps.form?.setFieldsValue({ slug });
  };

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Form.Item label="Name" name="name" rules={[{ required: true }]}>
          <Input onChange={onNameChange} />
        </Form.Item>
        <Form.Item label="Slug" name="slug" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Parent Category" name="parentId">
          <Select {...parentSelectProps} allowClear placeholder="None (top-level)" />
        </Form.Item>
        <Form.Item label="Sort Order" name="sortOrder" initialValue={0}>
          <InputNumber min={0} />
        </Form.Item>
        <Form.Item label="Image URL" name="imageUrl">
          <Input />
        </Form.Item>
      </Form>
    </Create>
  );
};
