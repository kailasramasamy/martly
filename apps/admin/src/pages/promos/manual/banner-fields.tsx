import { Cascader, Form, Input, Select, type FormInstance } from "antd";
import { useList } from "@refinedev/core";
import { BannerPlacementLabels } from "@martly/shared/constants";
import { absoluteName, BannerImageCard, fieldName, type BannerAiContext, type ListPrefix } from "../../banners/banner-shared";
import type { CascaderOption } from "../../banners/category-target";

const placementOptions = Object.entries(BannerPlacementLabels).map(([value, label]) => ({ value, label }));

interface Props {
  form: FormInstance;
  tree: CascaderOption[];
  /** What the AI paints from; defaults to the form's own title and target */
  context?: () => BannerAiContext;
  aiImages?: { used: number; total: number };
  prefix?: ListPrefix;
  /** Banner-level copy; left empty it follows the promotion's */
  withCopy?: boolean;
}

/** One banner of a promotion: where it shows, its picture, and who sees it */
export function PromoBannerFields({ form, tree, context, aiImages, prefix, withCopy }: Props) {
  const placement = Form.useWatch(absoluteName(prefix, "placement"), form);
  const { data: storesData } = useList({ resource: "stores", pagination: { pageSize: 200 } });
  const stores = (storesData?.data ?? []) as { id: string; name: string }[];

  return (
    <>
      <Form.Item name={fieldName(prefix, "placement")} label="Placement" rules={[{ required: true, message: "Pick a placement" }]}>
        <Select options={placementOptions} />
      </Form.Item>
      <BannerImageCard form={form} aiImages={aiImages} prefix={prefix} context={context} />
      {withCopy && (
        <>
          <Form.Item name={fieldName(prefix, "title")} label="Banner title" extra="Leave empty to use the promotion's title">
            <Input maxLength={60} />
          </Form.Item>
          <Form.Item name={fieldName(prefix, "subtitle")} label="Banner subtitle">
            <Input maxLength={90} />
          </Form.Item>
        </>
      )}
      <Form.Item name={fieldName(prefix, "storeId")} label="Store (optional)">
        <Select allowClear showSearch optionFilterProp="label" options={stores.map((s) => ({ value: s.id, label: s.name }))} placeholder="All stores" />
      </Form.Item>
      {placement === "CATEGORY_TOP" && (
        <Form.Item name={fieldName(prefix, "aislePath")} label="Aisle (optional)">
          <Cascader
            options={tree}
            changeOnSelect
            allowClear
            placeholder="Every aisle"
            showSearch={{ filter: (input, path) => path.some((opt) => String(opt.label).toLowerCase().includes(input.toLowerCase())) }}
          />
        </Form.Item>
      )}
    </>
  );
}
