import { useEffect } from "react";
import { Form, Input, InputNumber, Radio, Select, Typography } from "antd";
import { useList } from "@refinedev/core";
import { BannerActionTypeLabels, DISCOUNTABLE_TARGETS } from "@martly/shared/constants";
import { CategoryTargetField, type CascaderOption } from "../category-target";
import { RemoteSelect } from "./remote-select";

const actionTypeOptions = Object.entries(BannerActionTypeLabels).map(([value, label]) => ({ value, label }));
const NO_TARGET_TEXT = "Customers see the banner but nothing opens when it is tapped.";

function CollectionPicker() {
  const { data } = useList({ resource: "collections", pagination: { pageSize: 200 } });
  const options = ((data?.data ?? []) as { id: string; title: string }[]).map((c) => ({ value: c.id, label: c.title }));
  return (
    <Form.Item name="actionTarget" label="Collection" rules={[{ required: true, message: "Pick a collection" }]}>
      <Select showSearch optionFilterProp="label" options={options} placeholder="Select a collection" />
    </Form.Item>
  );
}

function TargetPicker({ actionType, tree }: { actionType: string; tree: CascaderOption[] }) {
  switch (actionType) {
    case "CATEGORY":
      return <CategoryTargetField options={tree} />;
    case "PRODUCT":
      return <Form.Item name="actionTarget" label="Product" rules={[{ required: true, message: "Pick a product" }]}><RemoteSelect path="/products" placeholder="Search products" /></Form.Item>;
    case "BRAND":
      return <Form.Item name="actionTarget" label="Brand" rules={[{ required: true, message: "Pick a brand" }]}><RemoteSelect path="/brands" placeholder="Search brands" /></Form.Item>;
    case "COLLECTION":
      return <CollectionPicker />;
    case "SEARCH":
      return <Form.Item name="actionTarget" label="Search query" rules={[{ required: true, message: "Enter a search" }]}><Input placeholder="e.g. organic fruits" /></Form.Item>;
    case "URL":
      return <Form.Item name="actionTarget" label="URL" rules={[{ required: true, type: "url", message: "Enter a full link" }]}><Input placeholder="https://..." /></Form.Item>;
    default:
      return <Typography.Paragraph type="secondary">{NO_TARGET_TEXT}</Typography.Paragraph>;
  }
}

/** Where the promotion leads, and so which products a discount covers */
export function TargetFields({ tree }: { tree: CascaderOption[] }) {
  const form = Form.useFormInstance();
  const actionType = Form.useWatch("actionType", form) as string;
  return (
    <>
      <Form.Item name="actionType" label="Opens / covers">
        <Select options={actionTypeOptions} onChange={() => form.setFieldsValue({ actionTarget: undefined, actionTargetPath: undefined })} />
      </Form.Item>
      <TargetPicker actionType={actionType} tree={tree} />
    </>
  );
}

/** Optional discount on the products the target covers */
export function DiscountFields() {
  const form = Form.useFormInstance();
  const actionType = Form.useWatch("actionType", form) as string;
  const discountType = Form.useWatch("discountType", form) as string;
  const discountable = (DISCOUNTABLE_TARGETS as readonly string[]).includes(actionType);

  useEffect(() => {
    if (!discountable) form.setFieldValue("discountType", "NONE");
  }, [discountable, form]);

  return (
    <Form.Item label="Discount" extra={discountable ? undefined : "A discount needs a category, product, collection or brand target"}>
      <Form.Item name="discountType" noStyle>
        <Radio.Group
          disabled={!discountable}
          options={[{ value: "NONE", label: "None" }, { value: "PERCENTAGE", label: "Percent off" }, { value: "FLAT", label: "₹ off" }]}
        />
      </Form.Item>
      {discountType !== "NONE" && (
        <Form.Item name="discountValue" noStyle rules={[{ required: true, message: "Enter the discount" }]}>
          <InputNumber min={1} max={discountType === "PERCENTAGE" ? 90 : undefined} style={{ marginLeft: 16, width: 120 }} />
        </Form.Item>
      )}
    </Form.Item>
  );
}
