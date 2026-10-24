import { useEffect, useState } from "react";
import { useSelect } from "@refinedev/antd";
import { Button, ColorPicker, Form, Input, InputNumber, Radio, Select, Space, Typography } from "antd";
import type { SelectProps } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { TabRailStyle } from "@martly/shared/constants";
import { homeSectionItemsSchema } from "@martly/shared/schemas";
import { axiosInstance } from "../../providers/data-provider";
import { ImageUpload } from "../../components/ImageUpload";
import type { HomeLayoutSection, ItemInput } from "./use-home-layout";

const { Text } = Typography;

export const MIN_TABS = 2;
export const MAX_TABS = 8;
const MIN_BANDS = 2;
const MAX_BANDS = 5;

const colorField = { getValueFromEvent: (c: { toHexString: () => string }) => c.toHexString() };
const urlField = { getValueFromEvent: (url: string) => url };

const TAB_STYLES = [
  { value: TabRailStyle.ICON_CARD, label: "Icon cards" },
  { value: TabRailStyle.ICON_UNDERLINE, label: "Icons with underline" },
  { value: TabRailStyle.PILL, label: "Pills" },
];

const DEFAULT_BANDS = [19, 29, 49, 99].map((price) => ({ label: `Under ₹${price}`, maxPrice: price }));

/** Tiles the form starts with when editing a section whose content is items (tabs or grid tiles) */
export const itemsOf = (section?: HomeLayoutSection) =>
  (section?.items ?? []).map((i) => ({
    label: i.label,
    // Not edited here, but carried so a save doesn't drop the Tamil labels
    translations: i.translations ?? undefined,
    imageUrl: i.imageUrl ?? undefined,
    collectionId: i.collectionId ?? undefined,
    subcategoryIds: i.subcategoryIds ?? [],
    wide: i.wide ?? false,
  }));

interface ItemLimits {
  min: number;
  max: number;
  noun: string;
  /** What each item opens: a collection (the default), or exactly one aisle (theme band tiles) */
  opens?: "COLLECTION" | "AISLE";
}

/** Validates the item list the way the items endpoint will, or returns the problem */
export function parseItems(items: unknown, { min, max, noun, opens = "COLLECTION" }: ItemLimits): { items: ItemInput[] } | { error: string } {
  const list = (Array.isArray(items) ? items : []).map((t) => ({ ...t, imageUrl: t.imageUrl || undefined }));
  if (list.length < min || list.length > max) return { error: `Add ${min} to ${max} ${noun}s` };
  const parsed = homeSectionItemsSchema.safeParse({ items: list });
  if (!parsed.success) return { error: parsed.error.issues.map((i) => `${noun} ${Number(i.path[1]) + 1}: ${i.message}`).join("; ") };
  if (opens === "COLLECTION" && list.some((t) => !t.collectionId)) return { error: `Every ${noun} needs a collection` };
  if (opens === "AISLE" && list.some((t) => t.subcategoryIds?.length !== 1)) return { error: `Every ${noun} needs one aisle` };
  return { items: parsed.data.items };
}

interface TabbedRowProps {
  collectionProps: SelectProps;
}

export const TabbedRowFields = ({ collectionProps }: TabbedRowProps) => (
  <>
    <Form.Item label="Tab style" name={["config", "tabStyle"]} initialValue={TabRailStyle.ICON_CARD}>
      <Radio.Group options={TAB_STYLES} optionType="button" />
    </Form.Item>
    <Form.Item label="Tint colour" name={["config", "tint"]} extra="Colours the rail and the collection screen" {...colorField}>
      <ColorPicker showText disabledAlpha />
    </Form.Item>
    <Form.List name="items">
      {(fields, { add, remove }) => (
        <Form.Item label="Tabs" extra={`${MIN_TABS} to ${MAX_TABS} tabs, each showing one collection`}>
          {fields.map(({ key, name }) => (
            <div key={key} style={{ marginBottom: 12 }}>
              <Space align="start" wrap>
                <Form.Item name={[name, "label"]} rules={[{ required: true, message: "Label" }]} style={{ marginBottom: 0 }}>
                  <Input placeholder="Label" maxLength={40} style={{ width: 130 }} />
                </Form.Item>
                <Form.Item name={[name, "collectionId"]} rules={[{ required: true, message: "Pick a collection" }]} style={{ marginBottom: 0 }}>
                  <Select {...collectionProps} showSearch optionFilterProp="label" placeholder="Collection" style={{ width: 190 }} />
                </Form.Item>
                <Button icon={<DeleteOutlined />} danger disabled={fields.length <= MIN_TABS} onClick={() => remove(name)} />
              </Space>
              <Form.Item name={[name, "imageUrl"]} {...urlField} style={{ marginBottom: 0, marginTop: 4 }}>
                <ImageUpload />
              </Form.Item>
            </div>
          ))}
          <Button icon={<PlusOutlined />} disabled={fields.length >= MAX_TABS} onClick={() => add({})}>Add tab</Button>
        </Form.Item>
      )}
    </Form.List>
  </>
);

export const PriceBandFields = () => (
  <>
    <Form.Item label="Headline" name={["config", "headline"]} extra="Optional line above the price bands">
      <Input maxLength={40} />
    </Form.Item>
    <Form.List name={["config", "bands"]} initialValue={DEFAULT_BANDS}>
      {(fields, { add, remove }) => (
        <Form.Item label="Price bands" extra="Leave the price empty for an open-ended band such as 'Above ₹99'">
          {fields.map(({ key, name }) => (
            <Space key={key} align="start" style={{ display: "flex", marginBottom: 8 }}>
              <Form.Item name={[name, "label"]} rules={[{ required: true, message: "Label" }]} style={{ marginBottom: 0 }}>
                <Input placeholder="Label" maxLength={16} style={{ width: 150 }} />
              </Form.Item>
              <Form.Item name={[name, "maxPrice"]} style={{ marginBottom: 0 }}>
                <InputNumber min={1} prefix={"₹"} placeholder="No limit" style={{ width: 130 }} />
              </Form.Item>
              <Button icon={<DeleteOutlined />} danger disabled={fields.length <= MIN_BANDS} onClick={() => remove(name)} />
            </Space>
          ))}
          <Button icon={<PlusOutlined />} disabled={fields.length >= MAX_BANDS} onClick={() => add({ label: "", maxPrice: null })}>Add band</Button>
        </Form.Item>
      )}
    </Form.List>
  </>
);

export const BrandCardFields = ({ brandId }: { brandId?: string }) => {
  const { selectProps } = useSelect({
    resource: "brands",
    optionLabel: "name",
    optionValue: "id",
    defaultValue: brandId,
    onSearch: (q) => [{ field: "q", operator: "contains", value: q }],
  });
  return (
    <>
      <Form.Item label="Brand" name={["config", "brandId"]} rules={[{ required: true, message: "Pick a brand" }]}>
        <Select {...(selectProps as SelectProps)} showSearch placeholder="Search brands" />
      </Form.Item>
      <Form.Item label="Tint colour" name={["config", "tint"]} extra="Defaults to the brand's theme colour" {...colorField}>
        <ColorPicker showText disabledAlpha />
      </Form.Item>
      <Form.Item label="Image" name={["config", "imageUrl"]} extra="Optional hero image on the card" {...urlField}>
        <ImageUpload />
      </Form.Item>
    </>
  );
};

interface DepartmentNode {
  id: string;
  name: string;
}

/** Selection order is the display order, so the multi-select keeps values in the order they were picked */
export const CategoryDirectoryFields = () => {
  const [departments, setDepartments] = useState<DepartmentNode[]>([]);
  useEffect(() => {
    axiosInstance.get("/categories/tree").then((res) => setDepartments(res.data.data as DepartmentNode[]));
  }, []);
  return (
    <Form.Item
      label="Departments"
      name={["config", "departmentIds"]}
      extra={<Text type="secondary">Shown in the order picked. Leave empty to list every department.</Text>}
    >
      <Select
        mode="multiple"
        allowClear
        optionFilterProp="label"
        placeholder="All departments"
        options={departments.map((d) => ({ value: d.id, label: d.name }))}
      />
    </Form.Item>
  );
};
