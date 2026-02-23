import { useState } from "react";
import { useTable, useSelect, EditButton } from "@refinedev/antd";
import { useGetIdentity } from "@refinedev/core";
import {
  Table,
  Tag,
  Typography,
  Space,
  Button,
  Select,
  Modal,
  App,
  Switch,
  Row,
  Col,
  Card,
  Input,
} from "antd";
import { StarOutlined, PlusOutlined } from "@ant-design/icons";
import type { CrudFilter } from "@refinedev/core";
import { axiosInstance } from "../../providers/data-provider";
import { sectionTitle, BRAND } from "../../theme";

const { Text, Title } = Typography;

interface StoreProductRecord {
  id: string;
  store: { id: string; name: string };
  product: { id: string; name: string; imageUrl?: string; brand?: { name: string } };
  variant: { id: string; name: string; unitType?: string; unitValue?: number; mrp?: number };
  price: number;
  stock: number;
  reservedStock: number;
  isActive: boolean;
  isFeatured: boolean;
}

export const FeaturedProductsPage = () => {
  const { message } = App.useApp();
  const { data: identity } = useGetIdentity<{ role: string }>();
  const role = identity?.role;
  const isSuperAdmin = role === "SUPER_ADMIN";

  const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>();
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>();
  const [addModalOpen, setAddModalOpen] = useState(false);

  const { selectProps: orgSelectProps } = useSelect({
    resource: "organizations",
    optionLabel: "name",
    optionValue: "id",
    queryOptions: { enabled: isSuperAdmin },
  });

  const { selectProps: storeSelectProps } = useSelect({
    resource: "stores",
    optionLabel: "name",
    optionValue: "id",
    filters: selectedOrgId
      ? [{ field: "organizationId", operator: "eq", value: selectedOrgId }]
      : [],
  });

  // Featured products table
  const permanentFilters: CrudFilter[] = [
    { field: "isFeatured", operator: "eq", value: "true" },
    ...(selectedStoreId
      ? [{ field: "storeId", operator: "eq" as const, value: selectedStoreId }]
      : []),
    ...(selectedOrgId
      ? [{ field: "organizationId", operator: "eq" as const, value: selectedOrgId }]
      : []),
  ];

  const { tableProps, tableQuery } = useTable<StoreProductRecord>({
    resource: "store-products",
    syncWithLocation: false,
    pagination: { pageSize: 20 },
    filters: { permanent: permanentFilters },
  });

  const handleUnfeature = async (id: string) => {
    try {
      await axiosInstance.put(`/store-products/${id}`, { isFeatured: false });
      message.success("Removed from featured");
      tableQuery?.refetch();
    } catch {
      message.error("Failed to update");
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>Featured Products</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setAddModalOpen(true)}
        >
          Add Featured
        </Button>
      </div>

      {/* Filters */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {isSuperAdmin && (
          <Col xs={24} sm={12} lg={6}>
            <Select
              {...(orgSelectProps as object)}
              allowClear
              placeholder="Filter by organization"
              style={{ width: "100%" }}
              value={selectedOrgId}
              onChange={(val: string) => {
                setSelectedOrgId(val ?? undefined);
                setSelectedStoreId(undefined);
              }}
            />
          </Col>
        )}
        <Col xs={24} sm={12} lg={6}>
          <Select
            {...(storeSelectProps as object)}
            allowClear
            placeholder="Filter by store"
            style={{ width: "100%" }}
            value={selectedStoreId}
            onChange={(val: string) => setSelectedStoreId(val ?? undefined)}
          />
        </Col>
      </Row>

      {/* Featured products table */}
      <Card title={sectionTitle(<StarOutlined />, "Featured Products")}>
        <Table<StoreProductRecord>
          {...tableProps}
          rowKey="id"
          size="middle"
          columns={[
            {
              title: "",
              width: 48,
              render: (_, record) => (
                <img
                  src={record.product?.imageUrl || "https://placehold.co/36x36/f0f0f0/999?text=—"}
                  alt=""
                  style={{ width: 36, height: 36, borderRadius: 4, objectFit: "cover", display: "block" }}
                />
              ),
            },
            {
              title: "Product",
              key: "product",
              render: (_, record) => (
                <div>
                  <Text strong style={{ fontSize: 13 }}>{record.product?.name}</Text>
                  {record.product?.brand?.name && (
                    <Text type="secondary" style={{ fontSize: 12, display: "block" }}>
                      {record.product.brand.name}
                    </Text>
                  )}
                </div>
              ),
            },
            {
              title: "Variant",
              key: "variant",
              width: 180,
              render: (_, record) => {
                const v = record.variant;
                const unit = v?.unitValue != null && v?.unitType ? ` (${Number(v.unitValue)} ${v.unitType})` : "";
                return <Text>{v?.name}{unit}</Text>;
              },
            },
            {
              title: "Store",
              key: "store",
              width: 140,
              render: (_, record) => <Tag>{record.store?.name}</Tag>,
            },
            {
              title: "Price",
              key: "price",
              width: 100,
              render: (_, record) => <Text strong>₹{Number(record.price).toFixed(2)}</Text>,
            },
            {
              title: "Stock",
              key: "stock",
              width: 120,
              render: (_, record) => {
                const available = record.stock - (record.reservedStock ?? 0);
                const color = available <= 0 ? BRAND.error : available <= 5 ? BRAND.warning : BRAND.success;
                return (
                  <Tag color={color} style={{ minWidth: 50, textAlign: "center" }}>
                    {available} / {record.stock}
                  </Tag>
                );
              },
            },
            {
              title: "Listed",
              key: "isActive",
              width: 80,
              render: (_, record) =>
                record.isActive
                  ? <Tag color="green">Yes</Tag>
                  : <Tag color="red">No</Tag>,
            },
            {
              title: "",
              key: "actions",
              width: 140,
              render: (_, record) => (
                <Space size={4}>
                  <EditButton hideText size="small" recordItemId={record.id} resource="store-products" />
                  <Button
                    size="small"
                    danger
                    onClick={() => handleUnfeature(record.id)}
                  >
                    Unfeature
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {/* Add Featured Modal */}
      <AddFeaturedModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onDone={() => {
          tableQuery?.refetch();
          setAddModalOpen(false);
        }}
        storeId={selectedStoreId}
        organizationId={selectedOrgId}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  );
};

// ============================================================================
// Modal to add non-featured products as featured
// ============================================================================

function AddFeaturedModal({
  open,
  onClose,
  onDone,
  storeId,
  organizationId,
  isSuperAdmin,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  storeId?: string;
  organizationId?: string;
  isSuperAdmin: boolean;
}) {
  const { message } = App.useApp();
  const [search, setSearch] = useState("");
  const [modalStoreId, setModalStoreId] = useState<string | undefined>(storeId);
  const [modalOrgId, setModalOrgId] = useState<string | undefined>(organizationId);

  const { selectProps: orgSelectProps } = useSelect({
    resource: "organizations",
    optionLabel: "name",
    optionValue: "id",
    queryOptions: { enabled: isSuperAdmin && open },
  });

  const { selectProps: storeSelectProps } = useSelect({
    resource: "stores",
    optionLabel: "name",
    optionValue: "id",
    filters: modalOrgId
      ? [{ field: "organizationId", operator: "eq", value: modalOrgId }]
      : [],
    queryOptions: { enabled: open },
  });

  const permanentFilters: CrudFilter[] = [
    { field: "isFeatured", operator: "eq", value: "false" },
    ...(modalStoreId
      ? [{ field: "storeId", operator: "eq" as const, value: modalStoreId }]
      : []),
    ...(modalOrgId
      ? [{ field: "organizationId", operator: "eq" as const, value: modalOrgId }]
      : []),
    ...(search
      ? [{ field: "q", operator: "contains" as const, value: search }]
      : []),
  ];

  const { tableProps, tableQuery: modalTableQuery } = useTable<StoreProductRecord>({
    resource: "store-products",
    syncWithLocation: false,
    pagination: { pageSize: 10 },
    filters: { permanent: permanentFilters },
    queryOptions: { enabled: open },
  });

  const handleFeature = async (id: string) => {
    try {
      await axiosInstance.put(`/store-products/${id}`, { isFeatured: true });
      message.success("Marked as featured");
      modalTableQuery?.refetch();
    } catch {
      message.error("Failed to update");
    }
  };

  return (
    <Modal
      title="Add Featured Products"
      open={open}
      onCancel={onClose}
      width={900}
      footer={
        <Button onClick={onDone} type="primary">
          Done
        </Button>
      }
    >
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {isSuperAdmin && (
          <Col xs={24} sm={8}>
            <Select
              {...(orgSelectProps as object)}
              allowClear
              placeholder="Organization"
              style={{ width: "100%" }}
              value={modalOrgId}
              onChange={(val: string) => {
                setModalOrgId(val ?? undefined);
                setModalStoreId(undefined);
              }}
            />
          </Col>
        )}
        <Col xs={24} sm={isSuperAdmin ? 8 : 12}>
          <Select
            {...(storeSelectProps as object)}
            allowClear
            placeholder="Store"
            style={{ width: "100%" }}
            value={modalStoreId}
            onChange={(val: string) => setModalStoreId(val ?? undefined)}
          />
        </Col>
        <Col xs={24} sm={isSuperAdmin ? 8 : 12}>
          <Input.Search
            placeholder="Search products..."
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Col>
      </Row>

      <Table<StoreProductRecord>
        {...tableProps}
        rowKey="id"
        size="small"
        columns={[
          {
            title: "",
            width: 40,
            render: (_, record) => (
              <img
                src={record.product?.imageUrl || "https://placehold.co/32x32/f0f0f0/999?text=—"}
                alt=""
                style={{ width: 32, height: 32, borderRadius: 4, objectFit: "cover", display: "block" }}
              />
            ),
          },
          {
            title: "Product",
            key: "product",
            render: (_, record) => (
              <div>
                <Text strong style={{ fontSize: 13 }}>{record.product?.name}</Text>
                {record.product?.brand?.name && (
                  <Text type="secondary" style={{ fontSize: 11, display: "block" }}>
                    {record.product.brand.name}
                  </Text>
                )}
              </div>
            ),
          },
          {
            title: "Variant",
            key: "variant",
            width: 160,
            render: (_, record) => {
              const v = record.variant;
              const unit = v?.unitValue != null && v?.unitType ? ` (${Number(v.unitValue)} ${v.unitType})` : "";
              return <Text style={{ fontSize: 12 }}>{v?.name}{unit}</Text>;
            },
          },
          {
            title: "Store",
            key: "store",
            width: 120,
            render: (_, record) => <Tag style={{ fontSize: 11 }}>{record.store?.name}</Tag>,
          },
          {
            title: "Price",
            key: "price",
            width: 80,
            render: (_, record) => <Text>₹{Number(record.price).toFixed(2)}</Text>,
          },
          {
            title: "",
            key: "action",
            width: 100,
            render: (_, record) => (
              <Button
                type="primary"
                size="small"
                icon={<StarOutlined />}
                onClick={() => handleFeature(record.id)}
              >
                Feature
              </Button>
            ),
          },
        ]}
      />
    </Modal>
  );
}
