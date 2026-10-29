import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useCustom, useOne, useApiUrl } from "@refinedev/core";
import { Tree, Table, InputNumber, Button, Steps, Card, message, Space, Checkbox, Typography, Row, Col, Switch, Tag } from "antd";
import type { DataNode } from "antd/es/tree";
import {
  AppstoreOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  ShoppingOutlined,
} from "@ant-design/icons";

import { sectionTitle } from "../../theme";
import { axiosInstance } from "../../providers/data-provider";

const { Text } = Typography;

interface SubcategoryNode { id: string; name: string; slug: string; }
interface CategoryNode { id: string; name: string; slug: string; subcategories: SubcategoryNode[]; }
interface DepartmentNode { id: string; name: string; slug: string; categories: CategoryNode[]; }

interface Variant {
  id: string;
  name: string;
  sku: string | null;
  unitType: string;
  unitValue: string;
  /** Already sold in this store */
  listed: boolean;
}

interface ProductWithVariants {
  id: string;
  name: string;
  description: string | null;
  subcategory?: { id: string; name: string } | null;
  variants: Variant[];
}

interface SelectedVariant {
  variantId: string;
  productName: string;
  variantName: string;
  unitType: string;
  unitValue: string;
  price: number;
  stock: number;
}

interface Coverage {
  available: number;
  listed: number;
  unlisted: number;
  unlistedBySubcategory: Record<string, number>;
}

const withCount = (name: string, n: number) => (n > 0 ? `${name} (${n})` : name);

/** Catalog tree labelled with unlisted sizes per node; with gapsOnly, branches with nothing to add are dropped */
function toTreeData(departments: DepartmentNode[], gaps: Record<string, number>, gapsOnly: boolean): DataNode[] {
  const keep = (n: number) => !gapsOnly || n > 0;
  return departments.map((d) => {
    const categories = d.categories.map((c) => {
      const subs = c.subcategories.map((s) => ({ key: s.id, name: s.name, n: gaps[s.id] ?? 0 })).filter((s) => keep(s.n));
      return { key: c.id, name: c.name, n: subs.reduce((t, s) => t + s.n, 0), subs };
    }).filter((c) => keep(c.n));
    const n = categories.reduce((t, c) => t + c.n, 0);
    const node: DataNode = {
      key: d.id, title: withCount(d.name, n),
      children: categories.map((c) => ({ key: c.key, title: withCount(c.name, c.n), children: c.subs.map((s) => ({ key: s.key, title: withCount(s.name, s.n) })) })),
    };
    return { node, n };
  }).filter((d) => keep(d.n)).map((d) => d.node);
}

export const StoreOnboard = () => {
  const { id: storeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const apiUrl = useApiUrl();

  const [step, setStep] = useState(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Map<string, SelectedVariant>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [unlistedOnly, setUnlistedOnly] = useState(true);

  const { data: storeData } = useOne({ resource: "stores", id: storeId! });
  const storeName = storeData?.data?.name ?? "Store";

  const { data: treeData } = useCustom<{ data: DepartmentNode[] }>({
    url: `${apiUrl}/categories/tree`,
    method: "get",
  });

  const { data: coverageData } = useCustom<{ data: Coverage }>({
    url: `${apiUrl}/stores/${storeId}/catalog-coverage`,
    method: "get",
  });
  const coverage = coverageData?.data?.data;

  const { data: productsData } = useCustom<{ data: ProductWithVariants[] }>({
    url: `${apiUrl}/categories/${selectedCategoryId}/products`,
    method: "get",
    queryOptions: { enabled: !!selectedCategoryId },
    config: { query: { pageSize: 200, storeId, unlistedOnly } },
  });

  const treeNodes = treeData?.data?.data ? toTreeData(treeData.data.data, coverage?.unlistedBySubcategory ?? {}, unlistedOnly) : [];
  const products = productsData?.data?.data ?? [];

  const toggleVariant = (variant: Variant, product: ProductWithVariants) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(variant.id)) {
        next.delete(variant.id);
      } else {
        next.set(variant.id, {
          variantId: variant.id,
          productName: product.name,
          variantName: variant.name,
          unitType: variant.unitType,
          unitValue: variant.unitValue,
          price: 0,
          stock: 0,
        });
      }
      return next;
    });
  };

  const updatePrice = (variantId: string, price: number) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const item = next.get(variantId);
      if (item) next.set(variantId, { ...item, price });
      return next;
    });
  };

  const updateStock = (variantId: string, stock: number) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const item = next.get(variantId);
      if (item) next.set(variantId, { ...item, stock });
      return next;
    });
  };

  const handleSubmit = async () => {
    const items = Array.from(selected.values());
    if (items.some((i) => i.price <= 0)) {
      message.error("All prices must be greater than 0");
      return;
    }

    setSubmitting(true);
    try {
      const { data: json } = await axiosInstance.post("/store-products/bulk", {
        storeId,
        items: items.map((i) => ({ variantId: i.variantId, price: i.price, stock: i.stock })),
      });
      message.success(`${json.data.created} variants added, ${json.data.skipped} skipped`);
      navigate(`/stores/show/${storeId}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      message.error(msg ?? "Failed to onboard products");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedItems = Array.from(selected.values());

  return (
    <Card title={sectionTitle(<ShoppingOutlined />, `Onboard Products — ${storeName}`)}>
      <Steps current={step} style={{ marginBottom: 24 }} items={[
        { title: "Browse Catalog" },
        { title: "Set Prices" },
        { title: "Review & Submit" },
      ]} />

      {step === 0 && (
        <Row gutter={16}>
          <Col xs={24} md={8} lg={6}>
            <Card
              title={sectionTitle(<AppstoreOutlined />, "Categories")}
              size="small"
              style={{ height: "100%" }}
              extra={<Space size={6}><Switch size="small" checked={unlistedOnly} onChange={setUnlistedOnly} /><Text>Only unlisted</Text></Space>}
            >
              {coverage && (
                <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
                  {coverage.listed.toLocaleString("en-IN")} of {coverage.available.toLocaleString("en-IN")} sizes listed · {coverage.unlisted.toLocaleString("en-IN")} to add
                </Text>
              )}
              {treeNodes.length > 0 ? (
                <Tree
                  key={String(unlistedOnly)}
                  treeData={treeNodes}
                  defaultExpandAll={unlistedOnly}
                  onSelect={(keys) => setSelectedCategoryId(keys[0] as string ?? null)}
                  selectedKeys={selectedCategoryId ? [selectedCategoryId] : []}
                />
              ) : (
                <Text type="secondary">{unlistedOnly ? "Every catalog product is already listed" : "No categories"}</Text>
              )}
            </Card>
          </Col>
          <Col xs={24} md={16} lg={18}>
            <Card
              title={selectedCategoryId ? "Products" : "Select a category"}
              size="small"
              extra={selected.size > 0 ? <Text type="secondary">{selected.size} selected</Text> : null}
            >
              {products.map((product) => (
                <Card key={product.id} size="small" style={{ marginBottom: 8 }} title={product.name}>
                  {product.variants.map((variant) => (
                    <div key={variant.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <Checkbox
                        checked={variant.listed || selected.has(variant.id)}
                        disabled={variant.listed}
                        onChange={() => toggleVariant(variant, product)}
                      />
                      <span>{variant.name}</span>
                      {variant.listed && <Tag color="green">Listed</Tag>}
                      {variant.sku && <Text type="secondary">SKU: {variant.sku}</Text>}
                    </div>
                  ))}
                </Card>
              ))}
              {selectedCategoryId && products.length === 0 && <Text type="secondary">No products in this category</Text>}
              {!selectedCategoryId && <Text type="secondary">Choose a category from the left to browse products</Text>}
            </Card>
          </Col>
        </Row>
      )}

      {step === 1 && (
        <Card title={sectionTitle(<DollarOutlined />, "Set Prices & Stock")} size="small">
          <Table dataSource={selectedItems} rowKey="variantId" pagination={false}>
            <Table.Column title="Product" dataIndex="productName" />
            <Table.Column title="Variant" dataIndex="variantName" />
            <Table.Column
              title="Price"
              render={(_, r: SelectedVariant) => (
                <InputNumber min={0.01} step={0.01} value={r.price || undefined} placeholder="Price" onChange={(v) => updatePrice(r.variantId, v ?? 0)} />
              )}
            />
            <Table.Column
              title="Stock"
              render={(_, r: SelectedVariant) => (
                <InputNumber min={0} value={r.stock} onChange={(v) => updateStock(r.variantId, v ?? 0)} />
              )}
            />
          </Table>
        </Card>
      )}

      {step === 2 && (
        <Card title={sectionTitle(<CheckCircleOutlined />, "Review")} size="small">
          <Table dataSource={selectedItems} rowKey="variantId" pagination={false} size="small">
            <Table.Column title="Product" dataIndex="productName" />
            <Table.Column title="Variant" dataIndex="variantName" />
            <Table.Column title="Price" dataIndex="price" render={(v: number) => `\u20B9${v.toFixed(2)}`} />
            <Table.Column title="Stock" dataIndex="stock" />
          </Table>
          <Text style={{ marginTop: 16, display: "block" }}>Total: {selectedItems.length} variants to assign</Text>
        </Card>
      )}

      <Space style={{ marginTop: 24 }}>
        {step > 0 && <Button onClick={() => setStep(step - 1)}>Back</Button>}
        {step < 2 && (
          <Button type="primary" disabled={selected.size === 0} onClick={() => setStep(step + 1)}>
            Next
          </Button>
        )}
        {step === 2 && (
          <Button type="primary" loading={submitting} onClick={handleSubmit}>
            Submit ({selectedItems.length} variants)
          </Button>
        )}
      </Space>
    </Card>
  );
};
