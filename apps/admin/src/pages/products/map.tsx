import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { useApiUrl } from "@refinedev/core";
import {
  Card, Table, InputNumber, Button, Checkbox, Typography, Row, Col,
  Space, Tag, App, Spin,
} from "antd";
import {
  ShopOutlined,
  DollarOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";

import { sectionTitle } from "../../theme";
import { axiosInstance } from "../../providers/data-provider";

const { Title, Text } = Typography;

interface Variant {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unitType: string;
  unitValue: string | number;
  mrp: number | null;
  packType: string | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  organizationId: string | null;
  variants: Variant[];
}

interface StoreRecord {
  id: string;
  name: string;
  address: string;
  status: string;
}

interface MappingRow {
  variantId: string;
  variantName: string;
  unit: string;
  mrp: number | null;
  price: number;
  stock: number;
}

export const ProductMap = () => {
  const { id: productId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const apiUrl = useApiUrl();
  const { message } = App.useApp();

  const [product, setProduct] = useState<Product | null>(null);
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState<Set<string>>(new Set());
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [productRes, storesRes] = await Promise.all([
        axiosInstance.get(`/products/${productId}`),
        axiosInstance.get("/stores", { params: { pageSize: 200 } }),
      ]);

      const prod: Product = productRes.data.data;
      const storeList: StoreRecord[] = storesRes.data.data;

      setProduct(prod);
      setStores(storeList.filter((s) => s.status === "ACTIVE"));

      // Pre-select all stores
      setSelectedStoreIds(new Set(storeList.filter((s) => s.status === "ACTIVE").map((s) => s.id)));

      // Initialize mappings from variants with MRP as default price
      setMappings(
        prod.variants.map((v) => ({
          variantId: v.id,
          variantName: v.name,
          unit: `${Number(v.unitValue)} ${v.unitType}`,
          mrp: v.mrp != null ? Number(v.mrp) : null,
          price: v.mrp != null ? Number(v.mrp) : 0,
          stock: 0,
        })),
      );
    } catch {
      message.error("Failed to load product data");
    } finally {
      setLoading(false);
    }
  }, [productId, message]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleStore = (storeId: string) => {
    setSelectedStoreIds((prev) => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
  };

  const toggleAllStores = (checked: boolean) => {
    if (checked) {
      setSelectedStoreIds(new Set(stores.map((s) => s.id)));
    } else {
      setSelectedStoreIds(new Set());
    }
  };

  const updateMapping = (variantId: string, field: "price" | "stock", value: number) => {
    setMappings((prev) =>
      prev.map((m) => (m.variantId === variantId ? { ...m, [field]: value } : m)),
    );
  };

  const handleSubmit = async () => {
    if (selectedStoreIds.size === 0) {
      message.warning("Select at least one store");
      return;
    }
    const invalidPrices = mappings.filter((m) => m.price <= 0);
    if (invalidPrices.length > 0) {
      message.error("All prices must be greater than 0");
      return;
    }

    setSubmitting(true);
    let totalCreated = 0;
    let totalSkipped = 0;

    try {
      for (const storeId of selectedStoreIds) {
        const res = await axiosInstance.post("/store-products/bulk", {
          storeId,
          items: mappings.map((m) => ({
            variantId: m.variantId,
            price: m.price,
            stock: m.stock,
          })),
        });
        totalCreated += res.data.data.created;
        totalSkipped += res.data.data.skipped;
      }
      message.success(`Mapped to ${selectedStoreIds.size} store(s): ${totalCreated} created, ${totalSkipped} already existed`);
      navigate("/products?tab=mapped");
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to map product";
      message.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!product) return null;

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/products/show/${productId}`)}>
          Back to Product
        </Button>
      </Space>

      <Title level={4} style={{ marginBottom: 24 }}>
        Map "{product.name}" to Stores
      </Title>

      <Row gutter={[16, 16]}>
        {/* Stores selection */}
        <Col xs={24} lg={8}>
          <Card
            title={sectionTitle(<ShopOutlined />, "Stores")}
            size="small"
            extra={
              <Checkbox
                checked={selectedStoreIds.size === stores.length && stores.length > 0}
                indeterminate={selectedStoreIds.size > 0 && selectedStoreIds.size < stores.length}
                onChange={(e) => toggleAllStores(e.target.checked)}
              >
                All
              </Checkbox>
            }
          >
            {stores.length === 0 ? (
              <Text type="secondary">No active stores</Text>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {stores.map((store) => (
                  <Checkbox
                    key={store.id}
                    checked={selectedStoreIds.has(store.id)}
                    onChange={() => toggleStore(store.id)}
                  >
                    <div>
                      <Text strong>{store.name}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>{store.address}</Text>
                    </div>
                  </Checkbox>
                ))}
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <Tag color="blue">{selectedStoreIds.size} of {stores.length} selected</Tag>
            </div>
          </Card>
        </Col>

        {/* Variants pricing */}
        <Col xs={24} lg={16}>
          <Card title={sectionTitle(<DollarOutlined />, "Variants & Pricing")} size="small">
            <Table dataSource={mappings} rowKey="variantId" pagination={false} size="small">
              <Table.Column title="Variant" dataIndex="variantName" />
              <Table.Column title="Unit" dataIndex="unit" width={100} />
              <Table.Column
                title="Master MRP"
                width={120}
                render={(_, row: MappingRow) =>
                  row.mrp != null ? (
                    <Text type="secondary">₹{row.mrp.toFixed(2)}</Text>
                  ) : (
                    <Text type="secondary">—</Text>
                  )
                }
              />
              <Table.Column
                title="Your Price"
                width={140}
                render={(_, row: MappingRow) => (
                  <InputNumber
                    min={0.01}
                    step={0.01}
                    value={row.price || undefined}
                    placeholder="Price"
                    style={{ width: "100%" }}
                    onChange={(v) => updateMapping(row.variantId, "price", v ?? 0)}
                    addonBefore="₹"
                  />
                )}
              />
              <Table.Column
                title="Stock"
                width={120}
                render={(_, row: MappingRow) => (
                  <InputNumber
                    min={0}
                    value={row.stock}
                    style={{ width: "100%" }}
                    onChange={(v) => updateMapping(row.variantId, "stock", v ?? 0)}
                  />
                )}
              />
            </Table>
          </Card>
        </Col>

        {/* Submit */}
        <Col xs={24}>
          <Space>
            <Button
              type="primary"
              size="large"
              loading={submitting}
              disabled={selectedStoreIds.size === 0}
              onClick={handleSubmit}
            >
              Map to {selectedStoreIds.size} Store{selectedStoreIds.size !== 1 ? "s" : ""}
            </Button>
            <Button size="large" onClick={() => navigate(`/products/show/${productId}`)}>
              Cancel
            </Button>
          </Space>
        </Col>
      </Row>
    </div>
  );
};
