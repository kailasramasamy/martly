import { useState, useEffect } from "react";
import { List, useTable, EditButton, ShowButton, useSelect } from "@refinedev/antd";
import { Table, Form, Input, Space, Select, Tag, Typography, Badge, Tabs, Button, Cascader, Switch, App, Popconfirm } from "antd";
import type { HttpError, CrudFilter } from "@refinedev/core";
import { useGetIdentity, useList } from "@refinedev/core";
import { useNavigate, useSearchParams } from "react-router";
import { axiosInstance } from "../../providers/data-provider";
import { ShopOutlined, DeleteOutlined } from "@ant-design/icons";

import {
  FOOD_TYPE_CONFIG,
  PRODUCT_TYPE_CONFIG,
  STORAGE_TYPE_CONFIG,
  DISCOUNT_TYPE_CONFIG,
  ACTIVE_STATUS_CONFIG,
} from "../../constants/tag-colors";

const { Text } = Typography;

// --- Shared types ---

interface Variant {
  id: string;
  name: string;
  unitType?: string;
  unitValue?: number;
  mrp?: number;
  packType?: string;
  discountType?: string;
  discountValue?: number;
  discountStart?: string;
  discountEnd?: string;
}

interface StoreProductEntry {
  id: string;
  store: { id: string; name: string };
  variant: { id: string; name: string; unitType?: string; unitValue?: number; mrp?: number };
  price: number;
  stock: number;
  reservedStock: number;
  isActive: boolean;
  discountType?: string;
  discountValue?: number;
}

interface ProductRecord {
  id: string;
  name: string;
  imageUrl?: string;
  brand?: { name: string };
  foodType?: string;
  productType?: string;
  storageType?: string;
  category?: { name: string };
  organizationId?: string | null;
  organization?: { id: string; name: string } | null;
  variants?: Variant[];
  storeProducts?: StoreProductEntry[];
}

// --- Shared helpers ---

function isDiscountActive(v: Variant): boolean {
  if (!v.discountType || v.discountValue == null || v.discountValue <= 0) return false;
  const now = Date.now();
  if (v.discountStart && now < new Date(v.discountStart).getTime()) return false;
  if (v.discountEnd && now > new Date(v.discountEnd).getTime()) return false;
  return true;
}

function formatDiscount(v: Variant): string {
  if (v.discountType === "PERCENTAGE") return `${v.discountValue}% OFF`;
  return `₹${Number(v.discountValue).toFixed(2)} OFF`;
}

function formatDateShort(d: string): string {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function foodTypeDot(foodType: string) {
  const c = FOOD_TYPE_CONFIG[foodType];
  if (!c) return null;
  const color = c.color === "green" || c.color === "lime" ? "#0a8f08" : c.color === "red" ? "#b71c1c" : "#e67e22";
  return (
    <span style={{ width: 14, height: 14, borderRadius: 2, border: `1.5px solid ${color}`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
    </span>
  );
}

// --- Category tree helpers ---

interface CategoryTreeNode {
  id: string;
  name: string;
  children: CategoryTreeNode[];
}

interface CascaderOption {
  value: string;
  label: string;
  children?: CascaderOption[];
}

function aggregateCounts(
  nodes: CategoryTreeNode[],
  directCounts: Record<string, number>,
): Record<string, number> {
  const result: Record<string, number> = {};
  function walk(node: CategoryTreeNode): number {
    let total = directCounts[node.id] ?? 0;
    for (const child of node.children) total += walk(child);
    result[node.id] = total;
    return total;
  }
  for (const n of nodes) walk(n);
  return result;
}

function treeToCascaderOptions(
  nodes: CategoryTreeNode[],
  counts: Record<string, number>,
): CascaderOption[] {
  return nodes
    .filter((n) => (counts[n.id] ?? 0) > 0 || n.children.length > 0)
    .map((n) => {
      const count = counts[n.id] ?? 0;
      const childOpts = n.children.length > 0 ? treeToCascaderOptions(n.children, counts) : undefined;
      return {
        value: n.id,
        label: count > 0 ? `${n.name} (${count})` : n.name,
        children: childOpts && childOpts.length > 0 ? childOpts : undefined,
      };
    });
}

// ============================================================================
// Products table — reused for all 4 tabs
// ============================================================================

const ProductsTableTab = ({
  role,
  catalogFilter,
  scope,
  hasStoreProducts,
  includeStoreProducts,
  showCatalogBadge,
  showMapButton,
  showOrgColumn,
}: {
  role?: string;
  catalogFilter?: string;
  scope?: string;
  hasStoreProducts?: boolean;
  includeStoreProducts?: boolean;
  showCatalogBadge?: boolean;
  showMapButton?: boolean;
  showOrgColumn?: boolean;
}) => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const permanentFilters: CrudFilter[] = [];
  if (catalogFilter) permanentFilters.push({ field: "catalogType", operator: "eq", value: catalogFilter });
  if (scope) permanentFilters.push({ field: "scope", operator: "eq", value: scope });
  if (hasStoreProducts) permanentFilters.push({ field: "hasStoreProducts", operator: "eq", value: "true" });
  if (includeStoreProducts) permanentFilters.push({ field: "includeStoreProducts", operator: "eq", value: "true" });

  const { tableProps, searchFormProps, tableQuery } = useTable<
    ProductRecord,
    HttpError,
    { q: string; categoryPath: string[]; productType: string; organizationId: string }
  >({
    resource: "products",
    syncWithLocation: false,
    filters: { permanent: permanentFilters },
    onSearch: (values) => [
      { field: "q", operator: "contains", value: values.q },
      { field: "categoryId", operator: "eq", value: values.categoryPath?.slice(-1)[0] },
      { field: "productType", operator: "eq", value: values.productType },
      { field: "organizationId", operator: "eq", value: values.organizationId },
    ],
  });

  // Fetch facets and category tree
  const [facets, setFacets] = useState<{
    categories: { id: string; name: string; count: number }[];
    productTypes: { type: string; count: number }[];
  } | null>(null);
  const [categoryTree, setCategoryTree] = useState<CategoryTreeNode[]>([]);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (catalogFilter) params.catalogType = catalogFilter;
    Promise.all([
      axiosInstance.get("/products/facets", { params }),
      axiosInstance.get("/categories/tree"),
    ]).then(([facetsRes, treeRes]) => {
      setFacets(facetsRes.data.data);
      setCategoryTree(treeRes.data.data);
    }).catch(() => {});
  }, [catalogFilter]);

  const directCountMap: Record<string, number> = {};
  for (const c of facets?.categories ?? []) directCountMap[c.id] = c.count;
  const aggregatedCounts = categoryTree.length > 0 ? aggregateCounts(categoryTree, directCountMap) : directCountMap;
  const cascaderOptions = treeToCascaderOptions(categoryTree, aggregatedCounts);

  const productTypeOptions = (facets?.productTypes ?? []).map((t) => ({
    label: `${PRODUCT_TYPE_CONFIG[t.type]?.label ?? t.type} (${t.count})`,
    value: t.type,
  }));

  const { selectProps: orgSelectProps } = useSelect({
    resource: "organizations",
    optionLabel: "name",
    optionValue: "id",
    queryOptions: { enabled: showOrgColumn === true },
  });

  // Variant-only columns (for tabs without store-product data)
  const variantColumns = [
    { title: "Variant", dataIndex: "name", key: "name", width: 160 },
    {
      title: "Unit", key: "unit", width: 100,
      render: (_: unknown, v: Variant) =>
        !v.unitValue || !v.unitType ? "—" : `${Number(v.unitValue)} ${v.unitType}`,
    },
    {
      title: "MRP", key: "mrp", width: 100,
      render: (_: unknown, v: Variant) =>
        v.mrp != null ? `₹${Number(v.mrp).toFixed(2)}` : "—",
    },
    {
      title: "Pack", dataIndex: "packType", key: "packType", width: 100,
      render: (v: string) => v ?? "—",
    },
    {
      title: "Discount", key: "discount", width: 140,
      render: (_: unknown, v: Variant) => {
        if (!v.discountType || v.discountValue == null) return "—";
        const active = isDiscountActive(v);
        const config = DISCOUNT_TYPE_CONFIG[v.discountType];
        return (
          <Space size={4}>
            <Tag color={active ? "red" : "default"}>{formatDiscount(v)}</Tag>
            {config && <Tag color={active ? config.color : "default"} style={{ fontSize: 11 }}>{config.label}</Tag>}
          </Space>
        );
      },
    },
    {
      title: "Period", key: "period", width: 160,
      render: (_: unknown, v: Variant) => {
        if (!v.discountStart && !v.discountEnd) return "—";
        const start = v.discountStart ? formatDateShort(v.discountStart) : "—";
        const end = v.discountEnd ? formatDateShort(v.discountEnd) : "∞";
        return <Text type="secondary" style={{ fontSize: 12 }}>{start} → {end}</Text>;
      },
    },
  ];

  // Store-product columns (for Mapped / Store Products tabs)
  const storeProductColumns = [
    {
      title: "Variant", key: "variant", width: 180,
      render: (_: unknown, sp: StoreProductEntry) => {
        const v = sp.variant;
        const unit = v.unitValue != null && v.unitType ? ` (${Number(v.unitValue)} ${v.unitType})` : "";
        return <Text>{v.name}{unit}</Text>;
      },
    },
    {
      title: "Store", key: "store", width: 140,
      render: (_: unknown, sp: StoreProductEntry) => <Tag>{sp.store.name}</Tag>,
    },
    {
      title: "MRP", key: "mrp", width: 100,
      render: (_: unknown, sp: StoreProductEntry) =>
        sp.variant.mrp != null ? <Text type="secondary">₹{Number(sp.variant.mrp).toFixed(2)}</Text> : "—",
    },
    {
      title: "Price", key: "price", width: 100,
      render: (_: unknown, sp: StoreProductEntry) => <Text strong>₹{Number(sp.price).toFixed(2)}</Text>,
    },
    {
      title: "Stock", key: "stock", width: 100,
      render: (_: unknown, sp: StoreProductEntry) => {
        const available = sp.stock - (sp.reservedStock ?? 0);
        return (
          <Space size={4}>
            <Text strong>{available}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>/ {sp.stock}</Text>
          </Space>
        );
      },
    },
    {
      title: "Listed", key: "isActive", width: 90,
      render: (_: unknown, sp: StoreProductEntry) => {
        const canToggle = role === "STORE_MANAGER" || role === "ORG_ADMIN" || role === "SUPER_ADMIN";
        if (!canToggle) {
          const config = ACTIVE_STATUS_CONFIG[String(sp.isActive)];
          return <Tag color={config?.color ?? "default"}>{config?.label ?? String(sp.isActive)}</Tag>;
        }
        return (
          <Switch
            size="small"
            checked={sp.isActive}
            checkedChildren="Listed"
            unCheckedChildren="Unlisted"
            onChange={async (checked) => {
              try {
                await axiosInstance.put(`/store-products/${sp.id}`, { isActive: checked });
                sp.isActive = checked;
                message.success(checked ? "Product listed" : "Product unlisted");
                tableQuery?.refetch();
              } catch {
                message.error("Failed to update listing");
              }
            }}
          />
        );
      },
    },
    {
      title: "", key: "actions", width: 100,
      render: (_: unknown, sp: StoreProductEntry) => {
        const canDelete = role === "SUPER_ADMIN" || role === "ORG_ADMIN";
        return (
          <Space size={4}>
            <EditButton hideText size="small" recordItemId={sp.id} resource="store-products" />
            {canDelete && (
              <Popconfirm
                title="Unmap from store?"
                description={sp.reservedStock > 0 ? `${sp.reservedStock} unit(s) reserved in active orders.` : undefined}
                onConfirm={async () => {
                  try {
                    await axiosInstance.delete(`/store-products/${sp.id}`);
                    message.success("Product unmapped from store");
                    tableQuery?.refetch();
                  } catch {
                    message.error("Failed to unmap product");
                  }
                }}
                okText="Unmap"
                okButtonProps={{ danger: true }}
              >
                <Button danger size="small" icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  // Choose expandable content based on whether we have store-product data
  const renderExpandedRow = (record: ProductRecord) => {
    if (includeStoreProducts && record.storeProducts && record.storeProducts.length > 0) {
      return (
        <Table<StoreProductEntry>
          dataSource={record.storeProducts}
          columns={storeProductColumns}
          rowKey="id"
          pagination={false}
          size="small"
        />
      );
    }
    if (record.variants && record.variants.length > 0) {
      return (
        <Table<Variant>
          dataSource={record.variants}
          columns={variantColumns}
          rowKey="id"
          pagination={false}
          size="small"
        />
      );
    }
    return <Text type="secondary">No variants</Text>;
  };

  const isExpandable = (record: ProductRecord) => {
    if (includeStoreProducts) return (record.storeProducts?.length ?? 0) > 0;
    return (record.variants?.length ?? 0) > 0;
  };

  return (
    <>
      <Form {...searchFormProps} layout="inline" style={{ marginBottom: 16, gap: 8, display: "flex", flexWrap: "wrap" }}>
        <Form.Item name="q" noStyle>
          <Input.Search placeholder="Search products..." allowClear onSearch={searchFormProps.form?.submit} style={{ width: 280 }} />
        </Form.Item>
        <Form.Item name="categoryPath" noStyle>
          <Cascader
            options={cascaderOptions}
            changeOnSelect
            allowClear
            placeholder="Category"
            style={{ width: 260 }}
            onChange={() => searchFormProps.form?.submit()}
            showSearch={{ filter: (input, path) => path.some((opt) => String(opt.label).toLowerCase().includes(input.toLowerCase())) }}
          />
        </Form.Item>
        <Form.Item name="productType" noStyle>
          <Select options={productTypeOptions} allowClear placeholder="Product type" style={{ width: 200 }} onChange={() => searchFormProps.form?.submit()} />
        </Form.Item>
        {showOrgColumn && (
          <Form.Item name="organizationId" noStyle>
            <Select {...orgSelectProps} allowClear placeholder="Organization" style={{ width: 200 }} onChange={() => searchFormProps.form?.submit()} />
          </Form.Item>
        )}
      </Form>

      <Table<ProductRecord>
        {...tableProps}
        rowKey="id"
        size="middle"
        expandable={{
          expandedRowKeys: expandedKeys,
          onExpandedRowsChange: (keys) => setExpandedKeys(keys as string[]),
          expandedRowRender: renderExpandedRow,
          rowExpandable: isExpandable,
        }}
      >
        <Table.Column
          title=""
          width={48}
          render={(_, record: ProductRecord) => (
            <img
              src={record.imageUrl || "https://placehold.co/36x36/f0f0f0/999?text=—"}
              alt=""
              style={{ width: 36, height: 36, borderRadius: 4, objectFit: "cover", display: "block" }}
            />
          )}
        />

        <Table.Column
          title="Product"
          render={(_, record: ProductRecord) => (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {record.foodType && foodTypeDot(record.foodType)}
                <Text strong style={{ fontSize: 13 }}>{record.name}</Text>
              </div>
              {record.brand?.name && (
                <Text type="secondary" style={{ fontSize: 12, marginTop: 2, display: "block" }}>{record.brand.name}</Text>
              )}
            </div>
          )}
        />

        {showCatalogBadge && (
          <Table.Column
            title="Catalog"
            width={100}
            render={(_, record: ProductRecord) =>
              record.organizationId == null
                ? <Tag color="blue">Master</Tag>
                : <Tag color="green">Org</Tag>
            }
          />
        )}

        {showOrgColumn && (
          <Table.Column
            title="Organization"
            width={150}
            render={(_, record: ProductRecord) =>
              record.organization
                ? <Text>{record.organization.name}</Text>
                : <Text type="secondary">—</Text>
            }
          />
        )}

        <Table.Column
          title="Category"
          width={140}
          render={(_, record: ProductRecord) =>
            record.category?.name ? <Tag>{record.category.name}</Tag> : <Text type="secondary">—</Text>
          }
        />

        <Table.Column
          title="Type"
          width={180}
          render={(_, record: ProductRecord) => (
            <Space size={4} wrap>
              {record.productType && (() => {
                const c = PRODUCT_TYPE_CONFIG[record.productType];
                return c ? <Tag color={c.color}>{c.label}</Tag> : <Tag>{record.productType}</Tag>;
              })()}
              {record.storageType && (() => {
                const c = STORAGE_TYPE_CONFIG[record.storageType];
                return c ? <Tag color={c.color} style={{ fontSize: 11 }}>{c.label}</Tag> : null;
              })()}
            </Space>
          )}
        />

        {includeStoreProducts ? (
          <>
          <Table.Column
            title="Stores"
            width={160}
            render={(_, record: ProductRecord) => {
              const sps = record.storeProducts ?? [];
              if (sps.length === 0) return <Text type="secondary">—</Text>;
              const storeNames = [...new Set(sps.map((sp) => sp.store.name))];
              return (
                <div>
                  <Tag color="blue">{storeNames.length} store{storeNames.length > 1 ? "s" : ""}</Tag>
                  <a
                    style={{ fontSize: 12, display: "block", marginTop: 2 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedKeys((prev) =>
                        prev.includes(record.id) ? prev.filter((k) => k !== record.id) : [...prev, record.id],
                      );
                    }}
                  >
                    {sps.length} assignment{sps.length > 1 ? "s" : ""}
                  </a>
                </div>
              );
            }}
          />
          <Table.Column
            title="Stock"
            width={100}
            render={(_, record: ProductRecord) => {
              const sps = record.storeProducts ?? [];
              if (sps.length === 0) return <Text type="secondary">—</Text>;
              const totalAvailable = sps.reduce((sum, sp) => sum + sp.stock - (sp.reservedStock ?? 0), 0);
              const totalStock = sps.reduce((sum, sp) => sum + sp.stock, 0);
              const color = totalAvailable <= 0 ? "red" : totalAvailable <= 5 ? "orange" : "green";
              return (
                <Space size={4}>
                  <Tag color={color}>{totalAvailable}</Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>/ {totalStock}</Text>
                </Space>
              );
            }}
          />
          </>
        ) : (
          <Table.Column
            title="Variants"
            width={200}
            render={(_, record: ProductRecord) => {
              const variants = record.variants ?? [];
              if (variants.length === 0) return <Text type="secondary">—</Text>;
              const v = variants[0];
              const unit = v.unitValue != null && v.unitType ? `${Number(v.unitValue)} ${v.unitType}` : null;
              const mrp = v.mrp != null ? `₹${Number(v.mrp).toFixed(2)}` : null;
              return (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    {unit && <Text style={{ fontSize: 13 }}>{unit}</Text>}
                    {unit && mrp && <Text type="secondary">·</Text>}
                    {mrp && <Text style={{ fontSize: 13 }}>{mrp}</Text>}
                  </div>
                  {variants.length > 1 && (
                    <a
                      style={{ fontSize: 12 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedKeys((prev) =>
                          prev.includes(record.id) ? prev.filter((k) => k !== record.id) : [...prev, record.id],
                        );
                      }}
                    >
                      +{variants.length - 1} more variant{variants.length > 2 ? "s" : ""}
                    </a>
                  )}
                </div>
              );
            }}
          />
        )}

        <Table.Column
          title="Discount"
          width={160}
          render={(_, record: ProductRecord) => {
            const variants = record.variants ?? [];
            const active = variants.filter(isDiscountActive);
            if (active.length === 0) return <Text type="secondary">—</Text>;
            if (active.length === 1) {
              return <Badge status="processing" color="red" text={<Text style={{ fontSize: 12 }}>{formatDiscount(active[0])}</Text>} />;
            }
            return <Badge status="processing" color="red" text={<Text style={{ fontSize: 12 }}>{active.length} active sales</Text>} />;
          }}
        />

        <Table.Column
          title=""
          width={showMapButton ? 120 : 80}
          render={(_, record: ProductRecord) => {
            const canEdit =
              role === "SUPER_ADMIN"
                ? record.organizationId == null
                : role === "ORG_ADMIN"
                  ? record.organizationId != null
                  : false;
            return (
              <Space size={4}>
                <ShowButton hideText size="small" recordItemId={record.id} />
                {canEdit && <EditButton hideText size="small" recordItemId={record.id} />}
                {showMapButton && role === "ORG_ADMIN" && (
                  <Button
                    type="primary"
                    size="small"
                    icon={<ShopOutlined />}
                    onClick={() => navigate(`/products/${record.id}/map`)}
                  >
                    Map
                  </Button>
                )}
              </Space>
            );
          }}
        />
      </Table>
    </>
  );
};

// ============================================================================
// Main export — Products page with tabs
// ============================================================================

function TabLabel({ label, count }: { label: string; count?: number }) {
  return (
    <span>
      {label}
      {count != null && (
        <Badge
          count={count}
          overflowCount={9999}
          style={{ marginLeft: 8, backgroundColor: count > 0 ? "#1677ff" : "#d9d9d9" }}
          showZero
        />
      )}
    </span>
  );
}

export const ProductList = () => {
  const { data: identity } = useGetIdentity<{ role: string }>();
  const role = identity?.role;
  const isOrgUser = role === "ORG_ADMIN" || role === "STORE_MANAGER" || role === "STAFF";

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "all";

  // Count queries — all use products API now
  const { data: allCount } = useList({
    resource: "products",
    pagination: { current: 1, pageSize: 1 },
    filters: isOrgUser ? [{ field: "scope", operator: "eq", value: "org-relevant" }] : [],
  });

  const { data: mappedCount } = useList({
    resource: "products",
    pagination: { current: 1, pageSize: 1 },
    filters: [
      { field: "catalogType", operator: "eq", value: "master" },
      { field: "hasStoreProducts", operator: "eq", value: "true" },
    ],
    queryOptions: { enabled: isOrgUser },
  });

  const { data: storeCount } = useList({
    resource: "products",
    pagination: { current: 1, pageSize: 1 },
    filters: [{ field: "catalogType", operator: "eq", value: "org" }],
  });

  const isSuperAdmin = role === "SUPER_ADMIN";

  const { data: masterCount } = useList({
    resource: "products",
    pagination: { current: 1, pageSize: 1 },
    filters: [{ field: "catalogType", operator: "eq", value: "master" }],
  });

  const items = [
    {
      key: "all",
      label: <TabLabel label="All Products" count={allCount?.total} />,
      children: (
        <ProductsTableTab
          role={role}
          scope={isOrgUser ? "org-relevant" : undefined}
          includeStoreProducts={isOrgUser}
          showCatalogBadge={isOrgUser || isSuperAdmin}
          showOrgColumn={isSuperAdmin}
        />
      ),
    },
    ...(isOrgUser
      ? [{
          key: "mapped",
          label: <TabLabel label="Mapped Products" count={mappedCount?.total} />,
          children: (
            <ProductsTableTab
              role={role}
              catalogFilter="master"
              hasStoreProducts
              includeStoreProducts
            />
          ),
        }]
      : []),
    {
      key: "store",
      label: <TabLabel label="Store Products" count={storeCount?.total} />,
      children: (
        <ProductsTableTab
          role={role}
          catalogFilter="org"
          includeStoreProducts
          showMapButton={isOrgUser}
          showOrgColumn={isSuperAdmin}
        />
      ),
    },
    {
      key: "master",
      label: <TabLabel label="Master Catalog" count={masterCount?.total} />,
      children: (
        <ProductsTableTab
          role={role}
          catalogFilter="master"
          showMapButton={isOrgUser}
        />
      ),
    },
  ];

  return (
    <List>
      <Tabs
        destroyInactiveTabPane
        items={items}
        activeKey={activeTab}
        onChange={(key) => setSearchParams({ tab: key })}
      />
    </List>
  );
};
