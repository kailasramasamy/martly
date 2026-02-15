import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useCustom, useOne, useApiUrl } from "@refinedev/core";
import { Tree, Table, InputNumber, Button, Steps, Card, message, Space, Checkbox, Typography, Row, Col } from "antd";
import type { DataNode } from "antd/es/tree";
import {
  AppstoreOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  ShoppingOutlined,
} from "@ant-design/icons";

import { sectionTitle } from "../../theme";

const { Title, Text } = Typography;

interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  children: CategoryTreeNode[];
}

interface Variant {
  id: string;
  name: string;
  sku: string | null;
  unitType: string;
  unitValue: string;
}

interface ProductWithVariants {
  id: string;
  name: string;
  description: string | null;
  category?: { id: string; name: string } | null;
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

function toTreeData(nodes: CategoryTreeNode[]): DataNode[] {
  return nodes.map((n) => ({
    key: n.id,
    title: n.name,
    children: n.children.length > 0 ? toTreeData(n.children) : undefined,
  }));
}

export const StoreOnboard = () => {
  const { id: storeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const apiUrl = useApiUrl();

  const [step, setStep] = useState(0);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Map<string, SelectedVariant>>(new Map());
  const [submitting, setSubmitting] = useState(false);

  const { data: storeData } = useOne({ resource: "stores", id: storeId! });
  const storeName = storeData?.data?.name ?? "Store";

  const { data: treeData } = useCustom<{ data: CategoryTreeNode[] }>({
    url: `${apiUrl}/categories/tree`,
    method: "get",
  });

  const { data: productsData } = useCustom<{ data: ProductWithVariants[] }>({
    url: `${apiUrl}/categories/${selectedCategoryId}/products`,
    method: "get",
    queryOptions: { enabled: !!selectedCategoryId },
    config: { query: { pageSize: 200 } },
  });

  const treeNodes = treeData?.data?.data ? toTreeData(treeData.data.data) : [];
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
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiUrl}/store-products/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          storeId,
          items: items.map((i) => ({ variantId: i.variantId, price: i.price, stock: i.stock })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed");
      message.success(`${json.data.created} variants added, ${json.data.skipped} skipped`);
      navigate(`/stores/show/${storeId}`);
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Failed to onboard products");
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
            <Card title={sectionTitle(<AppstoreOutlined />, "Categories")} size="small" style={{ height: "100%" }}>
              {treeNodes.length > 0 ? (
                <Tree
                  treeData={treeNodes}
                  defaultExpandAll
                  onSelect={(keys) => setSelectedCategoryId(keys[0] as string ?? null)}
                  selectedKeys={selectedCategoryId ? [selectedCategoryId] : []}
                />
              ) : (
                <Text type="secondary">No categories</Text>
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
                        checked={selected.has(variant.id)}
                        onChange={() => toggleVariant(variant, product)}
                      />
                      <span>{variant.name}</span>
                      <Text type="secondary">({variant.unitType} {variant.unitValue})</Text>
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
            <Table.Column title="Unit" render={(_, r: SelectedVariant) => `${r.unitType} ${r.unitValue}`} />
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
            <Table.Column title="Unit" render={(_, r: SelectedVariant) => `${r.unitType} ${r.unitValue}`} />
            <Table.Column title="Price" dataIndex="price" render={(v: number) => `$${v.toFixed(2)}`} />
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
