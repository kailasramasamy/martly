import { useEffect, useState } from "react";
import { useSelect } from "@refinedev/antd";
import { Alert, Button, Drawer, Form, Input, Select, Space, Switch, message } from "antd";
import { HomeSectionType, HomeSectionTypeLabels, SECTION_COLLECTION } from "@martly/shared/constants";
import { homeSectionConfigSchemas } from "@martly/shared/schemas";
import { CampaignCardFields, ProductRowFields } from "./config-forms";
import { BrandCardFields, CategoryDirectoryFields, PriceBandFields, TabbedRowFields, parseTabs, tabsOf } from "./config-forms-phase2";
import type { HomeLayoutSection, SectionPayload } from "./use-home-layout";

const EDITABLE: HomeSectionType[] = ["PRODUCT_ROW", "CAMPAIGN_CARD", "TABBED_ROW", "PRICE_BAND_DEALS", "BRAND_CARD", "CATEGORY_DIRECTORY"];
const COMING_SOON: HomeSectionType[] = [
  "EXPLORE_GRID", "STORE_GRID", "OFFERS", "BRAND_POSTERS", "PERSONALISED",
];
const SYSTEM = (Object.keys(HomeSectionType) as HomeSectionType[]).filter((t) => !EDITABLE.includes(t) && !COMING_SOON.includes(t));

const typeOptions = [
  { label: "Configurable", options: EDITABLE.map((t) => ({ value: t, label: HomeSectionTypeLabels[t] })) },
  { label: "Built-in blocks", options: SYSTEM.map((t) => ({ value: t, label: HomeSectionTypeLabels[t] })) },
  { label: "Coming soon", options: COMING_SOON.map((t) => ({ value: t, label: HomeSectionTypeLabels[t], disabled: true })) },
];

/** Drops empty values so optional config fields validate as absent */
const clean = (obj: Record<string, any>): Record<string, any> =>
  Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => [k, v && typeof v === "object" && !Array.isArray(v) ? clean(v) : v]),
  );

interface Props {
  open: boolean;
  section?: HomeLayoutSection;
  onClose: () => void;
  onSave: (payload: SectionPayload) => Promise<void>;
}

export const SectionDrawer = ({ open, section, onClose, onSave }: Props) => {
  const [form] = Form.useForm();
  const [themed, setThemed] = useState(false);
  const type: HomeSectionType | undefined = Form.useWatch("type", form);
  const { selectProps } = useSelect({ resource: "collections", optionLabel: "title", optionValue: "id", pagination: { pageSize: 100 } });

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(
      section
        ? { type: section.type, title: section.title, subtitle: section.subtitle, collectionId: section.collectionId, isActive: section.isActive, config: section.config, tabs: tabsOf(section) }
        : { isActive: true, config: {} },
    );
    setThemed(!!section?.config?.theme);
  }, [open, section]);

  const submit = async () => {
    const values = await form.validateFields();
    const schema = homeSectionConfigSchemas[values.type as keyof typeof homeSectionConfigSchemas];
    const raw = clean(values.config ?? {});
    if (!themed) delete raw.theme;
    const parsed = schema ? schema.safeParse(raw) : undefined;
    if (parsed && !parsed.success) {
      message.error(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      return;
    }
    const tabs = values.type === "TABBED_ROW" ? parseTabs(values.tabs) : undefined;
    if (tabs && "error" in tabs) {
      message.error(tabs.error);
      return;
    }
    await onSave({
      type: values.type,
      title: values.title || null,
      subtitle: values.subtitle || null,
      collectionId: values.collectionId ?? null,
      config: parsed?.success ? parsed.data : {},
      isActive: values.isActive,
      tabs: tabs?.tabs,
    });
  };

  const collectionMode = type ? SECTION_COLLECTION[type] : undefined;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={480}
      title={section ? "Edit section" : "Add section"}
      destroyOnClose
      extra={<Space><Button onClick={onClose}>Cancel</Button><Button type="primary" onClick={submit}>Save</Button></Space>}
    >
      <Form form={form} layout="vertical">
        <Form.Item label="Type" name="type" rules={[{ required: true }]}>
          <Select options={typeOptions} disabled={!!section} placeholder="Choose a section type" />
        </Form.Item>
        {type && !collectionMode && !EDITABLE.includes(type) && (
          <Alert type="info" showIcon style={{ marginBottom: 16 }} message="Built-in block: fills itself from store data, nothing to configure" />
        )}
        <Form.Item label="Title" name="title"><Input maxLength={80} /></Form.Item>
        <Form.Item label="Subtitle" name="subtitle"><Input maxLength={120} /></Form.Item>
        {collectionMode && (
          <Form.Item
            label="Collection"
            name="collectionId"
            rules={[{ required: collectionMode === "REQUIRED", message: "Pick a collection" }]}
            extra={collectionMode === "OPTIONAL" ? "Leave empty to use the whole store, or narrow to a collection" : undefined}
          >
            <Select {...selectProps} allowClear={collectionMode === "OPTIONAL"} showSearch optionFilterProp="label" placeholder="Select collection" />
          </Form.Item>
        )}
        {type === "PRODUCT_ROW" && <ProductRowFields />}
        {type === "TABBED_ROW" && <TabbedRowFields collectionProps={selectProps} />}
        {type === "PRICE_BAND_DEALS" && <PriceBandFields />}
        {type === "BRAND_CARD" && <BrandCardFields brandId={section?.config?.brandId} />}
        {type === "CATEGORY_DIRECTORY" && <CategoryDirectoryFields />}
        {type === "CAMPAIGN_CARD" && <CampaignCardFields themed={themed} onThemedChange={setThemed} />}
        <Form.Item label="Active" name="isActive" valuePropName="checked"><Switch /></Form.Item>
      </Form>
    </Drawer>
  );
};
