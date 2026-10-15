import { useEffect, useMemo, useState } from "react";
import { useSelect } from "@refinedev/antd";
import { Button, Card, Cascader, Col, Form, Input, InputNumber, Row, Select, Space } from "antd";
import type { ApproveCatalogDraftInput } from "@martly/shared/schemas";
import type { CatalogDraftDetail } from "@martly/shared/types";
import { axiosInstance } from "../../providers/data-provider";
import { buildCascaderOptions, findCategoryPath, FOOD_TYPES, UNIT_TYPES } from "../products/product-form-options";
import type { CascaderOption, DepartmentNode } from "../products/product-form-options";

const NEW_BRAND = "__new__";

interface FormValues {
  name: string;
  description: string;
  variantName: string;
  unitType: string;
  unitValue: number;
  foodType?: string;
  mrp: number;
  sellingPrice: number;
  stock: number;
  brand?: string;
  aisle?: string[];
}

function initialValues(draft: CatalogDraftDetail): FormValues {
  const label = draft.label;
  return {
    name: draft.name ?? label?.name ?? "",
    description: label?.description ?? "",
    variantName: draft.variantName ?? label?.variantName ?? "",
    unitType: label?.unitType ?? "PIECE",
    unitValue: label?.unitValue ?? 1,
    foodType: label?.foodType ?? undefined,
    mrp: draft.mrp,
    sellingPrice: draft.sellingPrice,
    stock: draft.stock,
    brand: draft.brand?.id ?? (label?.brand ? NEW_BRAND : undefined),
  };
}

function toPayload(values: FormValues, draft: CatalogDraftDetail): ApproveCatalogDraftInput {
  const { brand, aisle, ...rest } = values;
  const payload: ApproveCatalogDraftInput = { ...rest } as ApproveCatalogDraftInput;
  if (brand === NEW_BRAND && draft.label?.brand) payload.newBrandName = draft.label.brand;
  else if (brand) payload.brandId = brand;
  const subcategoryId = aisle?.[aisle.length - 1];
  if (subcategoryId) payload.subcategoryId = subcategoryId;
  return payload;
}

function useAisles(draft: CatalogDraftDetail) {
  const [tree, setTree] = useState<DepartmentNode[]>([]);
  useEffect(() => {
    void axiosInstance.get("/categories/tree").then((res) => setTree(res.data.data));
  }, []);
  const options: CascaderOption[] = useMemo(() => buildCascaderOptions(tree), [tree]);
  const pick = draft.subcategory ? findCategoryPath(tree, draft.subcategory.id) : null;
  return { options, pick };
}

function useBrandOptions(draft: CatalogDraftDetail) {
  const { selectProps } = useSelect({
    resource: "brands",
    optionLabel: "name",
    optionValue: "id",
    onSearch: (value) => [{ field: "q", operator: "contains", value }],
  });
  const extra: { value: string; label: string }[] = [];
  if (draft.label?.brand && !draft.brand) extra.push({ value: NEW_BRAND, label: `Create new brand: ${draft.label.brand}` });
  if (draft.brand) extra.push({ value: draft.brand.id, label: draft.brand.name });
  const found = (selectProps.options ?? []).filter((o) => !extra.some((e) => e.value === o.value));
  return { ...selectProps, options: [...extra, ...found] };
}

export function ApproveForm({ draft, busy, onApprove, discard }: {
  draft: CatalogDraftDetail;
  busy: string | null;
  onApprove: (payload: ApproveCatalogDraftInput) => void;
  discard: React.ReactNode;
}) {
  const [form] = Form.useForm<FormValues>();
  const { options, pick } = useAisles(draft);
  const brandProps = useBrandOptions(draft);

  useEffect(() => {
    if (pick) form.setFieldValue("aisle", pick);
  }, [pick, form]);

  return (
    <Card title="Review and publish">
      <Form<FormValues> form={form} layout="vertical" initialValues={initialValues(draft)} onFinish={(v) => onApprove(toPayload(v, draft))}>
        <Row gutter={16}>
          <Col xs={24} md={12}><Form.Item label="Name" name="name" rules={[{ required: true }]}><Input /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item label="Variant name" name="variantName" rules={[{ required: true }]}><Input /></Form.Item></Col>
          <Col xs={24}><Form.Item label="Description" name="description"><Input.TextArea rows={3} /></Form.Item></Col>
          <Col xs={24} md={12}>
            <Form.Item label="Brand" name="brand"><Select {...brandProps} allowClear showSearch filterOption={false} placeholder="Search brands" /></Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="Aisle" name="aisle">
              <Cascader options={options} placeholder="Department / Category / Subcategory" showSearch={{ filter: (input, path) => path.some((o) => String(o.label).toLowerCase().includes(input.toLowerCase())) }} />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}><Form.Item label="Unit type" name="unitType"><Select options={UNIT_TYPES.map((u) => ({ value: u, label: u }))} /></Form.Item></Col>
          <Col xs={12} md={6}><Form.Item label="Unit value" name="unitValue" rules={[{ required: true }]}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item label="Food type" name="foodType"><Select allowClear options={FOOD_TYPES} /></Form.Item></Col>
          <Col xs={8}><Form.Item label={"MRP (\u20B9)"} name="mrp" rules={[{ required: true }]}><InputNumber min={0} style={{ width: "100%" }} /></Form.Item></Col>
          <Col xs={8}>
            <Form.Item
              label={"Selling price (\u20B9)"}
              name="sellingPrice"
              dependencies={["mrp"]}
              rules={[
                { required: true },
                ({ getFieldValue }) => ({
                  validator: (_, value: number) => (value <= getFieldValue("mrp") ? Promise.resolve() : Promise.reject(new Error("Cannot exceed MRP"))),
                }),
              ]}
            >
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={8}><Form.Item label="Stock" name="stock" rules={[{ required: true }]}><InputNumber min={0} precision={0} style={{ width: "100%" }} /></Form.Item></Col>
        </Row>
        <Space>
          <Button type="primary" htmlType="submit" loading={busy === "approve"}>Approve and publish</Button>
          {discard}
        </Space>
      </Form>
    </Card>
  );
}
