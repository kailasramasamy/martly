import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { useApiUrl, useGetIdentity } from "@refinedev/core";
import {
  Card, Table, InputNumber, Button, Checkbox, Typography, Row, Col,
  Space, Tag, App, Spin, Popconfirm, Switch,
} from "antd";
import {
  ShopOutlined,
  DollarOutlined,
  ArrowLeftOutlined,
  DeleteOutlined,
  LinkOutlined,
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

interface ExistingMapping {
  id: string;
  storeId: string;
  storeName: string;
  variantId: string;
  variantName: string;
  unit: string;
  price: number;
  stock: number;
  reservedStock: number;
  isActive: boolean;
}

export const ProductMap = () => {
  const { id: productId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const apiUrl = useApiUrl();
  const { message } = App.useApp();
  const { data: identity } = useGetIdentity<{ role: string }>();
  const role = identity?.role;
  const canMapUnmap = role === "SUPER_ADMIN" || role === "ORG_ADMIN";

  const [product, setProduct] = useState<Product | null>(null);
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState<Set<string>>(new Set());
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [selectedVariantIds, setSelectedVariantIds] = useState<Set<string>>(new Set());
  const [existingMappings, setExistingMappings] = useState<ExistingMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [productRes, storesRes, existingRes] = await Promise.all([
        axiosInstance.get(`/products/${productId}`),
        axiosInstance.get("/stores", { params: { pageSize: 200 } }),
        axiosInstance.get("/store-products", { params: { productId, pageSize: 200 } }),
      ]);

      const prod: Product = productRes.data.data;
      const storeList: StoreRecord[] = storesRes.data.data;
      const existingSPs: {
        id: string;
        storeId: string;
        store: { id: string; name: string };
        variant: { id: string; name: string; unitType?: string; unitValue?: number };
        price: number;
        stock: number;
        reservedStock: number;
        isActive: boolean;
      }[] = existingRes.data.data;

      setProduct(prod);
      const activeStores = storeList.filter((s) => s.status === "ACTIVE");
      setStores(activeStores);

      // Build existing mappings list
      const existing: ExistingMapping[] = existingSPs.map((sp) => ({
        id: sp.id,
        storeId: sp.storeId,
        storeName: sp.store.name,
        variantId: sp.variant.id,
        variantName: sp.variant.name,
        unit: sp.variant.unitValue != null && sp.variant.unitType
          ? `${Number(sp.variant.unitValue)} ${sp.variant.unitType}` : "",
        price: Number(sp.price),
        stock: sp.stock,
        reservedStock: sp.reservedStock,
        isActive: sp.isActive,
      }));
      setExistingMappings(existing);

      // Build set of already-mapped store+variant combos
      const mappedCombos = new Set(existing.map((e) => `${e.storeId}:${e.variantId}`));

      // Pre-select stores that don't have ALL variants mapped yet
      const unmappedStoreIds = activeStores
        .filter((s) => prod.variants.some((v) => !mappedCombos.has(`${s.id}:${v.id}`)))
        .map((s) => s.id);
      setSelectedStoreIds(new Set(unmappedStoreIds.length > 0 ? unmappedStoreIds : activeStores.map((s) => s.id)));

      // Initialize variant mappings — pre-deselect fully mapped variants
      const variantMappings = prod.variants.map((v) => ({
        variantId: v.id,
        variantName: v.name,
        unit: `${Number(v.unitValue)} ${v.unitType}`,
        mrp: v.mrp != null ? Number(v.mrp) : null,
        price: v.mrp != null ? Number(v.mrp) : 0,
        stock: 0,
      }));
      setMappings(variantMappings);

      const unmappedVariantIds = variantMappings
        .filter((m) => activeStores.some((s) => !mappedCombos.has(`${s.id}:${m.variantId}`)))
        .map((m) => m.variantId);
      setSelectedVariantIds(new Set(unmappedVariantIds.length > 0 ? unmappedVariantIds : variantMappings.map((m) => m.variantId)));
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

  // Count how many stores each variant is already mapped to
  const variantMappedStoreCount = (variantId: string) =>
    existingMappings.filter((e) => e.variantId === variantId).length;

  const handleSubmit = async () => {
    if (selectedStoreIds.size === 0) {
      message.warning("Select at least one store");
      return;
    }
    if (selectedVariantIds.size === 0) {
      message.warning("Select at least one variant");
      return;
    }
    const selectedMappings = mappings.filter((m) => selectedVariantIds.has(m.variantId));
    const invalidPrices = selectedMappings.filter((m) => m.price <= 0);
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
          items: selectedMappings.map((m) => ({
            variantId: m.variantId,
            price: m.price,
            stock: m.stock,
          })),
        });
        totalCreated += res.data.data.created;
        totalSkipped += res.data.data.skipped;
      }
      message.success(`Mapped to ${selectedStoreIds.size} store(s): ${totalCreated} created, ${totalSkipped} already existed`);
      if (totalCreated > 0) {
        loadData(); // Refresh to show new mappings
      }
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to map product";
      message.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnmap = async (mapping: ExistingMapping) => {
    try {
      await axiosInstance.delete(`/store-products/${mapping.id}`);
      message.success(`Unmapped ${mapping.variantName} from ${mapping.storeName}`);
      loadData();
    } catch {
      message.error("Failed to unmap product");
    }
  };

  const handleInlineUpdate = async (mapping: ExistingMapping, field: "stock" | "isActive", value: number | boolean) => {
    try {
      await axiosInstance.put(`/store-products/${mapping.id}`, { [field]: value });
      setExistingMappings((prev) =>
        prev.map((m) => (m.id === mapping.id ? { ...m, [field]: value } : m)),
      );
      message.success(field === "isActive"
        ? (value ? "Product listed" : "Product unlisted")
        : "Stock updated");
    } catch {
      message.error("Failed to update");
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
        {canMapUnmap ? `Map "${product.name}" to Stores` : `Manage "${product.name}"`}
      </Title>

      <Row gutter={[16, 16]}>
        {/* Existing Mappings */}
        {existingMappings.length > 0 && (
          <Col xs={24}>
            <Card title={sectionTitle(<LinkOutlined />, "Existing Mappings")} size="small">
              <Table
                dataSource={existingMappings}
                rowKey="id"
                pagination={false}
                size="small"
              >
                <Table.Column
                  title="Store"
                  dataIndex="storeName"
                  width={160}
                  render={(name: string) => <Tag>{name}</Tag>}
                />
                <Table.Column title="Variant" dataIndex="variantName" />
                <Table.Column title="Unit" dataIndex="unit" width={100} />
                <Table.Column
                  title="Price"
                  width={100}
                  render={(_: unknown, row: ExistingMapping) => (
                    <Text>₹{row.price.toFixed(2)}</Text>
                  )}
                />
                <Table.Column
                  title="Stock"
                  width={canMapUnmap ? 100 : 140}
                  render={(_: unknown, row: ExistingMapping) => {
                    if (!canMapUnmap) {
                      return (
                        <InputNumber
                          size="small"
                          min={0}
                          value={row.stock}
                          style={{ width: "100%" }}
                          onChange={(v) => {
                            if (v != null) handleInlineUpdate(row, "stock", v);
                          }}
                        />
                      );
                    }
                    const available = row.stock - row.reservedStock;
                    return (
                      <Space size={4}>
                        <Text>{available}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>/ {row.stock}</Text>
                      </Space>
                    );
                  }}
                />
                {!canMapUnmap && (
                  <Table.Column
                    title="Listed"
                    width={100}
                    render={(_: unknown, row: ExistingMapping) => (
                      <Switch
                        size="small"
                        checked={row.isActive}
                        checkedChildren="Listed"
                        unCheckedChildren="Unlisted"
                        onChange={(checked) => handleInlineUpdate(row, "isActive", checked)}
                      />
                    )}
                  />
                )}
                {canMapUnmap && (
                  <Table.Column
                    title=""
                    width={80}
                    render={(_: unknown, row: ExistingMapping) => (
                      <Popconfirm
                        title="Unmap this variant?"
                        description={row.reservedStock > 0
                          ? `${row.reservedStock} unit(s) reserved in active orders.`
                          : undefined}
                        onConfirm={() => handleUnmap(row)}
                        okText="Unmap"
                        okButtonProps={{ danger: true }}
                      >
                        <Button danger size="small" icon={<DeleteOutlined />}>
                          Unmap
                        </Button>
                      </Popconfirm>
                    )}
                  />
                )}
              </Table>
            </Card>
          </Col>
        )}

        {/* Map new — only for ORG_ADMIN / SUPER_ADMIN */}
        {canMapUnmap && (
          <>
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
                <Table
                  dataSource={mappings}
                  rowKey="variantId"
                  pagination={false}
                  size="small"
                  rowSelection={{
                    selectedRowKeys: Array.from(selectedVariantIds),
                    onChange: (keys) => setSelectedVariantIds(new Set(keys as string[])),
                  }}
                >
                  <Table.Column
                    title="Variant"
                    render={(_: unknown, row: MappingRow) => {
                      const count = variantMappedStoreCount(row.variantId);
                      return (
                        <Space>
                          <Text>{row.variantName}</Text>
                          {count > 0 && (
                            <Tag color="green" style={{ fontSize: 11 }}>
                              {count} store{count !== 1 ? "s" : ""}
                            </Tag>
                          )}
                        </Space>
                      );
                    }}
                  />
                  <Table.Column title="Unit" dataIndex="unit" width={100} />
                  <Table.Column
                    title="MRP"
                    width={120}
                    render={(_: unknown, row: MappingRow) =>
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
                    render={(_: unknown, row: MappingRow) => (
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
                    render={(_: unknown, row: MappingRow) => (
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
                  disabled={selectedStoreIds.size === 0 || selectedVariantIds.size === 0}
                  onClick={handleSubmit}
                >
                  Map to {selectedStoreIds.size} Store{selectedStoreIds.size !== 1 ? "s" : ""}
                </Button>
                <Button size="large" onClick={() => navigate(`/products/show/${productId}`)}>
                  Cancel
                </Button>
              </Space>
            </Col>
          </>
        )}

        {/* STORE_MANAGER: just a back button if no existing mappings */}
        {!canMapUnmap && existingMappings.length === 0 && (
          <Col xs={24}>
            <Text type="secondary">No products mapped to your store yet.</Text>
          </Col>
        )}
      </Row>
    </div>
  );
};
