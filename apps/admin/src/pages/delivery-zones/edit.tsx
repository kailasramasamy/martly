import { Edit, useForm } from "@refinedev/antd";
import { Form, Input, InputNumber, Select, Switch } from "antd";
import { useList } from "@refinedev/core";

export const DeliveryZoneEdit = () => {
  const { formProps, saveButtonProps, queryResult } = useForm({ resource: "delivery-zones", action: "edit" });
  const record = queryResult?.data?.data;
  const { data: storesData } = useList({ resource: "stores", pagination: { pageSize: 100 } });
  const stores = storesData?.data ?? [];

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical"
        initialValues={{
          ...record,
          storeIds: record?.stores?.map((s: any) => s.store?.id ?? s.storeId) ?? [],
        }}
      >
        <Form.Item label="Zone Name" name="name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="Pincodes" name="pincodes" help="Enter pincodes as comma-separated values">
          <Select mode="tags" tokenSeparators={[","]} placeholder="Enter pincodes" />
        </Form.Item>
        <Form.Item label="Delivery Fee" name="deliveryFee" rules={[{ required: true }]}>
          <InputNumber min={0} style={{ width: "100%" }} prefix="₹" />
        </Form.Item>
        <Form.Item label="Estimated Minutes" name="estimatedMinutes">
          <InputNumber min={1} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item label="Stores" name="storeIds">
          <Select mode="multiple" placeholder="Select stores"
            options={stores.map((s: any) => ({ label: s.name, value: s.id }))}
          />
        </Form.Item>
        <Form.Item label="Active" name="isActive" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Edit>
  );
};
