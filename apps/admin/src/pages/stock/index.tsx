import { useEffect, useState, useMemo } from "react";
import { useGetIdentity } from "@refinedev/core";
import { useTable, useSelect } from "@refinedev/antd";
import { Link } from "react-router";
import {
  Row,
  Col,
  Card,
  Statistic,
  Spin,
  Typography,
  Select,
  Table,
  Tag,
  Segmented,
} from "antd";
import {
  InboxOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  EditOutlined,
  BarChartOutlined,
} from "@ant-design/icons";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import axios from "axios";

import { BRAND, CHART_COLORS, sectionTitle } from "../../theme";

const { Title } = Typography;

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:7001";
const TOKEN_KEY = "martly_admin_token";

interface StoreSummary {
  storeId: string;
  storeName: string;
  totalSKUs: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
}

interface RecentChange {
  storeProductId: string;
  productName: string;
  storeName: string;
  stock: number;
  reservedStock: number;
  availableStock: number;
  updatedAt: string;
}

interface StockSummaryData {
  totals: { totalSKUs: number; inStock: number; lowStock: number; outOfStock: number };
  byStore: StoreSummary[];
  recentChanges: RecentChange[];
}

type StockFilter = "all" | "in_stock" | "low_stock" | "out_of_stock";

export const StockPage = () => {
  const { data: identity } = useGetIdentity<{ role: string }>();
  const isSuperAdmin = identity?.role === "SUPER_ADMIN";

  const [summary, setSummary] = useState<StockSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStoreId, setSelectedStoreId] = useState<string | undefined>();
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>();
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");

  // Organization dropdown (SUPER_ADMIN only)
  const { selectProps: orgSelectProps } = useSelect({
    resource: "organizations",
    optionLabel: "name",
    optionValue: "id",
    queryOptions: { enabled: isSuperAdmin },
  });

  // Store dropdown — scoped to selected org when one is chosen
  const { selectProps: storeSelectProps } = useSelect({
    resource: "stores",
    optionLabel: "name",
    optionValue: "id",
    filters: selectedOrgId
      ? [{ field: "organizationId", operator: "eq", value: selectedOrgId }]
      : [],
  });

  // Fetch summary data
  useEffect(() => {
    setLoading(true);
    const token = localStorage.getItem(TOKEN_KEY);
    const params: Record<string, string> = {};
    if (selectedStoreId) params.storeId = selectedStoreId;
    if (selectedOrgId) params.organizationId = selectedOrgId;

    axios
      .get(`${API_URL}/api/v1/stock/summary`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      })
      .then((res) => setSummary(res.data.data))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [selectedStoreId, selectedOrgId]);

  // Store-products table — respects org/store/stockStatus filters
  const { tableProps } = useTable({
    resource: "store-products",
    syncWithLocation: false,
    pagination: { pageSize: 10 },
    filters: {
      permanent: [
        ...(stockFilter !== "all"
          ? [{ field: "stockStatus", operator: "eq" as const, value: stockFilter }]
          : []),
        ...(selectedStoreId
          ? [{ field: "storeId", operator: "eq" as const, value: selectedStoreId }]
          : []),
        ...(selectedOrgId
          ? [{ field: "organizationId", operator: "eq" as const, value: selectedOrgId }]
          : []),
      ],
    },
  });

  // Chart data — "All Stores" aggregate bar + per-store bars
  const chartData = useMemo(() => {
    const byStore = summary?.byStore ?? [];
    if (byStore.length === 0) return [];

    const truncName = (n: string) => (n.length > 15 ? n.slice(0, 15) + "..." : n);
    const perStore = byStore.map((s) => ({
      name: truncName(s.storeName),
      Available: s.inStock + s.lowStock,
      "Out of Stock": s.outOfStock,
    }));

    // Only add aggregate when there are multiple stores
    if (byStore.length <= 1) return perStore;

    const totals = summary!.totals;
    return [
      {
        name: "All Stores",
        Available: totals.inStock + totals.lowStock,
        "Out of Stock": totals.outOfStock,
      },
      ...perStore,
    ];
  }, [summary]);

  if (loading && !summary) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>Stock Management</Title>

      {/* Filters — hierarchical: Organization → Store */}
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

      {/* Summary Cards */}
      {summary && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card style={{ borderLeft: `4px solid ${BRAND.primary}` }}>
                <Statistic
                  title="Total SKUs"
                  value={summary.totals.totalSKUs}
                  prefix={<InboxOutlined style={{ color: BRAND.primary }} />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card style={{ borderLeft: `4px solid ${BRAND.success}` }}>
                <Statistic
                  title="In Stock"
                  value={summary.totals.inStock}
                  prefix={<CheckCircleOutlined style={{ color: BRAND.success }} />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card style={{ borderLeft: `4px solid ${BRAND.warning}` }}>
                <Statistic
                  title="Low Stock"
                  value={summary.totals.lowStock}
                  prefix={<WarningOutlined style={{ color: BRAND.warning }} />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card style={{ borderLeft: `4px solid ${BRAND.error}` }}>
                <Statistic
                  title="Out of Stock"
                  value={summary.totals.outOfStock}
                  prefix={<CloseCircleOutlined style={{ color: BRAND.error }} />}
                />
              </Card>
            </Col>
          </Row>

          {/* Per-store bar chart */}
          {chartData.length > 0 && (
            <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
              <Col span={24}>
                <Card title={sectionTitle(<BarChartOutlined />, "Stock by Store")}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Available" stackId="stock" fill={BRAND.success} />
                      <Bar dataKey="Out of Stock" stackId="stock" fill={BRAND.error} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </Col>
            </Row>
          )}
        </>
      )}

      {/* Stock Table */}
      <Card
        title={sectionTitle(<InboxOutlined />, "Store Products")}
        extra={
          <Segmented
            options={[
              { label: "All", value: "all" },
              { label: "In Stock", value: "in_stock" },
              { label: "Low Stock", value: "low_stock" },
              { label: "Out of Stock", value: "out_of_stock" },
            ]}
            value={stockFilter}
            onChange={(val) => setStockFilter(val as StockFilter)}
          />
        }
      >
        <Table
          {...tableProps}
          rowKey="id"
          columns={[
            {
              title: "Product",
              dataIndex: ["product", "name"],
              render: (_: unknown, record: Record<string, unknown>) => {
                const product = record.product as { name: string } | undefined;
                const variant = record.variant as { name?: string } | undefined;
                const variantName = variant?.name;
                return variantName
                  ? `${product?.name} — ${variantName}`
                  : product?.name ?? "—";
              },
            },
            {
              title: "Store",
              dataIndex: ["store", "name"],
            },
            {
              title: "Stock",
              dataIndex: "stock",
              width: 100,
              align: "right" as const,
            },
            {
              title: "Reserved",
              dataIndex: "reservedStock",
              width: 100,
              align: "right" as const,
            },
            {
              title: "Available",
              key: "available",
              width: 120,
              align: "right" as const,
              render: (_: unknown, record: Record<string, unknown>) => {
                const available =
                  (record.availableStock as number) ??
                  (record.stock as number) - (record.reservedStock as number);
                let color = BRAND.success;
                let label = "In Stock";
                if (available <= 0) {
                  color = BRAND.error;
                  label = "OOS";
                } else if (available <= 5) {
                  color = BRAND.warning;
                  label = "Low";
                }
                return (
                  <Tag color={color} style={{ minWidth: 60, textAlign: "center" }}>
                    {available} ({label})
                  </Tag>
                );
              },
            },
            {
              title: "",
              key: "actions",
              width: 50,
              render: (_: unknown, record: Record<string, unknown>) => (
                <Link to={`/store-products/edit/${record.id}`}>
                  <EditOutlined />
                </Link>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};
