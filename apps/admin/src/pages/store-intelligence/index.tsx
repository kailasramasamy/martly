import { useState, useEffect, useCallback } from "react";
import {
  Tabs,
  Table,
  Select,
  Segmented,
  Tag,
  Card,
  Space,
  Typography,
  Spin,
  Alert,
  Button,
  Input,
  Upload,
  Descriptions,
  Statistic,
  Row,
  Col,
  Empty,
  Tooltip,
} from "antd";
import {
  UploadOutlined,
  CopyOutlined,
  PlusOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
  FallOutlined,
  InboxOutlined,
  BugOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router";
import { axiosInstance } from "../../providers/data-provider";

const { Title, Text, Paragraph } = Typography;

// ── Types ───────────────────────────────────────────

interface Store {
  id: string;
  name: string;
}

interface DemandRow {
  storeProductId: string;
  productName: string;
  variantName: string;
  imageUrl: string | null;
  currentStock: number;
  avgDailyDemand: number;
  daysOfStockLeft: number;
  totalQuantitySold: number;
  totalOrders: number;
  lastOrderDate: string;
}

interface ReorderRow extends DemandRow {
  suggestedReorderQty: number;
  urgency: "critical" | "warning" | "info";
}

interface AnomalyRow {
  type: "demand_spike" | "demand_drop" | "stock_mismatch" | "dead_stock";
  severity: "high" | "medium" | "low";
  storeProductId: string;
  productName: string;
  variantName: string;
  message: string;
  details: Record<string, unknown>;
}

interface GeneratedDescription {
  name: string;
  brand: string | null;
  description: string;
  suggestedCategory: string;
  foodType: string | null;
  estimatedWeight: string | null;
}

// ── Helpers ─────────────────────────────────────────

function daysOfStockTag(days: number) {
  if (days === -1) return <Tag>No demand</Tag>;
  if (days <= 3) return <Tag color="red">{days.toFixed(1)}d</Tag>;
  if (days <= 7) return <Tag color="orange">{days.toFixed(1)}d</Tag>;
  return <Tag color="green">{days.toFixed(1)}d</Tag>;
}

const URGENCY_CONFIG = {
  critical: { color: "red", label: "Critical" },
  warning: { color: "orange", label: "Warning" },
  info: { color: "blue", label: "Info" },
};

const ANOMALY_TYPE_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  demand_spike: { color: "volcano", label: "Demand Spike", icon: <ThunderboltOutlined /> },
  demand_drop: { color: "blue", label: "Demand Drop", icon: <FallOutlined /> },
  stock_mismatch: { color: "red", label: "Stock Mismatch", icon: <BugOutlined /> },
  dead_stock: { color: "default", label: "Dead Stock", icon: <InboxOutlined /> },
};

const SEVERITY_CONFIG = {
  high: { color: "red", label: "High" },
  medium: { color: "orange", label: "Medium" },
  low: { color: "default", label: "Low" },
};

// ── Store Selector Hook ─────────────────────────────

function useStores() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosInstance
      .get("/stores?pageSize=100")
      .then((res) => setStores(res?.data?.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { stores, loading };
}

// ── Tab 1: Demand Forecast ──────────────────────────

function DemandForecastTab({ storeId }: { storeId: string }) {
  const [data, setData] = useState<DemandRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<string>("30");

  const fetch = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/store-intelligence/demand-forecast?storeId=${storeId}&days=${period}`);
      setData(res?.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [storeId, period]);

  useEffect(() => { fetch(); }, [fetch]);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Text type="secondary">{data.length} products with order history</Text>
        <Segmented
          options={[
            { label: "7d", value: "7" },
            { label: "14d", value: "14" },
            { label: "30d", value: "30" },
            { label: "90d", value: "90" },
          ]}
          value={period}
          onChange={(v) => setPeriod(v as string)}
        />
      </div>
      <Table
        dataSource={data}
        rowKey="storeProductId"
        loading={loading}
        size="small"
        pagination={{ pageSize: 20, showSizeChanger: false }}
        columns={[
          {
            title: "Product",
            key: "product",
            render: (_, r: DemandRow) => (
              <Space>
                {r.imageUrl && (
                  <img src={r.imageUrl} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: "cover" }} />
                )}
                <div>
                  <div>{r.productName}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{r.variantName}</Text>
                </div>
              </Space>
            ),
          },
          { title: "Stock", dataIndex: "currentStock", key: "stock", width: 80, align: "right" as const },
          {
            title: "Avg Daily",
            dataIndex: "avgDailyDemand",
            key: "avg",
            width: 100,
            align: "right" as const,
            render: (v: number) => `${v}/day`,
          },
          {
            title: "Days Left",
            dataIndex: "daysOfStockLeft",
            key: "daysLeft",
            width: 100,
            align: "center" as const,
            render: (v: number) => daysOfStockTag(v),
            sorter: (a: DemandRow, b: DemandRow) => {
              const av = a.daysOfStockLeft === -1 ? Infinity : a.daysOfStockLeft;
              const bv = b.daysOfStockLeft === -1 ? Infinity : b.daysOfStockLeft;
              return av - bv;
            },
            defaultSortOrder: "ascend" as const,
          },
          { title: "Total Sold", dataIndex: "totalQuantitySold", key: "sold", width: 100, align: "right" as const },
          { title: "Orders", dataIndex: "totalOrders", key: "orders", width: 80, align: "right" as const },
          {
            title: "Last Order",
            dataIndex: "lastOrderDate",
            key: "lastOrder",
            width: 120,
            render: (v: string) => new Date(v).toLocaleDateString("en-IN"),
          },
        ]}
      />
    </Space>
  );
}

// ── Tab 2: Reorder Suggestions ──────────────────────

function ReorderSuggestionsTab({ storeId }: { storeId: string }) {
  const [data, setData] = useState<ReorderRow[]>([]);
  const [meta, setMeta] = useState<{ criticalCount: number; warningCount: number }>({ criticalCount: 0, warningCount: 0 });
  const [loading, setLoading] = useState(false);
  const [threshold, setThreshold] = useState<string>("7");

  const fetch = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/store-intelligence/reorder-suggestions?storeId=${storeId}&threshold=${threshold}`);
      setData(res?.data?.data ?? []);
      setMeta(res?.data?.meta ?? { criticalCount: 0, warningCount: 0 });
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [storeId, threshold]);

  useEffect(() => { fetch(); }, [fetch]);

  const infoCount = data.filter((d) => d.urgency === "info").length;

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Row gutter={16}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Critical"
              value={meta.criticalCount}
              valueStyle={{ color: "#ef4444" }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Warning"
              value={meta.warningCount}
              valueStyle={{ color: "#f59e0b" }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Info"
              value={infoCount}
              valueStyle={{ color: "#3b82f6" }}
              prefix={<InfoCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <div style={{ display: "flex", alignItems: "center", height: "100%", paddingTop: 8 }}>
            <Space>
              <Text>Threshold:</Text>
              <Segmented
                options={[
                  { label: "3d", value: "3" },
                  { label: "5d", value: "5" },
                  { label: "7d", value: "7" },
                  { label: "14d", value: "14" },
                ]}
                value={threshold}
                onChange={(v) => setThreshold(v as string)}
              />
            </Space>
          </div>
        </Col>
      </Row>
      <Table
        dataSource={data}
        rowKey="storeProductId"
        loading={loading}
        size="small"
        pagination={{ pageSize: 20, showSizeChanger: false }}
        rowClassName={(r: ReorderRow) =>
          r.urgency === "critical" ? "row-critical" : r.urgency === "warning" ? "row-warning" : ""
        }
        columns={[
          {
            title: "Urgency",
            dataIndex: "urgency",
            key: "urgency",
            width: 90,
            render: (v: "critical" | "warning" | "info") => (
              <Tag color={URGENCY_CONFIG[v].color}>{URGENCY_CONFIG[v].label}</Tag>
            ),
          },
          {
            title: "Product",
            key: "product",
            render: (_, r: ReorderRow) => (
              <div>
                <div>{r.productName}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>{r.variantName}</Text>
              </div>
            ),
          },
          { title: "Stock", dataIndex: "currentStock", key: "stock", width: 80, align: "right" as const },
          {
            title: "Days Left",
            dataIndex: "daysOfStockLeft",
            key: "daysLeft",
            width: 100,
            align: "center" as const,
            render: (v: number) => daysOfStockTag(v),
          },
          {
            title: "Avg Daily",
            dataIndex: "avgDailyDemand",
            key: "avg",
            width: 100,
            align: "right" as const,
            render: (v: number) => `${v}/day`,
          },
          {
            title: "Suggested Reorder",
            dataIndex: "suggestedReorderQty",
            key: "reorder",
            width: 140,
            align: "right" as const,
            render: (v: number) => <Text strong>{v} units</Text>,
          },
        ]}
      />
    </Space>
  );
}

// ── Tab 3: Anomalies ────────────────────────────────

function AnomaliesTab({ storeId }: { storeId: string }) {
  const [data, setData] = useState<AnomalyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<string>("30");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/store-intelligence/anomalies?storeId=${storeId}&days=${period}`);
      setData(res?.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [storeId, period]);

  useEffect(() => { fetch(); }, [fetch]);

  const filteredData = typeFilter ? data.filter((d) => d.type === typeFilter) : data;

  const typeCounts = data.reduce(
    (acc, d) => {
      acc[d.type] = (acc[d.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <Space wrap>
          <Tag
            style={{ cursor: "pointer" }}
            color={typeFilter === null ? "processing" : "default"}
            onClick={() => setTypeFilter(null)}
          >
            All ({data.length})
          </Tag>
          {Object.entries(ANOMALY_TYPE_CONFIG).map(([key, cfg]) => (
            <Tag
              key={key}
              style={{ cursor: "pointer" }}
              color={typeFilter === key ? cfg.color : "default"}
              icon={cfg.icon}
              onClick={() => setTypeFilter(typeFilter === key ? null : key)}
            >
              {cfg.label} ({typeCounts[key] || 0})
            </Tag>
          ))}
        </Space>
        <Segmented
          options={[
            { label: "7d", value: "7" },
            { label: "14d", value: "14" },
            { label: "30d", value: "30" },
          ]}
          value={period}
          onChange={(v) => setPeriod(v as string)}
        />
      </div>
      {filteredData.length === 0 && !loading ? (
        <Empty description="No anomalies detected" />
      ) : (
        <Table
          dataSource={filteredData}
          rowKey={(r, i) => `${r.storeProductId}-${r.type}-${i}`}
          loading={loading}
          size="small"
          pagination={{ pageSize: 20, showSizeChanger: false }}
          expandable={{
            expandedRowRender: (r: AnomalyRow) => (
              <Descriptions size="small" column={3}>
                {Object.entries(r.details).map(([k, v]) => (
                  <Descriptions.Item key={k} label={k}>
                    {String(v)}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            ),
          }}
          columns={[
            {
              title: "Type",
              dataIndex: "type",
              key: "type",
              width: 140,
              render: (v: string) => {
                const cfg = ANOMALY_TYPE_CONFIG[v];
                return cfg ? <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag> : v;
              },
            },
            {
              title: "Severity",
              dataIndex: "severity",
              key: "severity",
              width: 90,
              render: (v: "high" | "medium" | "low") => (
                <Tag color={SEVERITY_CONFIG[v].color}>{SEVERITY_CONFIG[v].label}</Tag>
              ),
            },
            {
              title: "Product",
              key: "product",
              render: (_, r: AnomalyRow) => (
                <div>
                  <div>{r.productName}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>{r.variantName}</Text>
                </div>
              ),
            },
            {
              title: "Details",
              dataIndex: "message",
              key: "message",
              ellipsis: true,
            },
          ]}
        />
      )}
    </Space>
  );
}

// ── Tab 4: AI Product Description ───────────────────

function AIDescriptionTab() {
  const navigate = useNavigate();
  const [imageUrl, setImageUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GeneratedDescription | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async (url: string) => {
    if (!url) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await axiosInstance.post("/store-intelligence/generate-description", { imageUrl: url });
      setResult(res?.data?.data ?? null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate description";
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = () => {
    if (!result) return;
    const text = `Name: ${result.name}\nBrand: ${result.brand ?? "N/A"}\nDescription: ${result.description}\nCategory: ${result.suggestedCategory}\nFood Type: ${result.foodType ?? "N/A"}\nWeight: ${result.estimatedWeight ?? "N/A"}`;
    navigator.clipboard.writeText(text);
  };

  const useForNewProduct = () => {
    if (!result) return;
    const params = new URLSearchParams();
    params.set("name", result.name);
    if (result.description) params.set("description", result.description);
    if (result.foodType) params.set("foodType", result.foodType);
    navigate(`/products/create?${params.toString()}`);
  };

  const FOOD_TYPE_COLORS: Record<string, string> = {
    VEG: "green",
    NON_VEG: "red",
    VEGAN: "lime",
  };

  return (
    <Space direction="vertical" size={24} style={{ width: "100%", maxWidth: 700 }}>
      <Card title="Generate from Image URL" size="small">
        <Space.Compact style={{ width: "100%" }}>
          <Input
            placeholder="Paste product image URL..."
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            onPressEnter={() => generate(imageUrl)}
          />
          <Button type="primary" onClick={() => generate(imageUrl)} loading={generating}>
            Generate
          </Button>
        </Space.Compact>
      </Card>

      <Card title="Or Upload Image" size="small">
        <Upload.Dragger
          accept="image/*"
          showUploadList={false}
          customRequest={async ({ file, onSuccess, onError }) => {
            try {
              const formData = new FormData();
              formData.append("file", file as Blob);
              const uploadRes = await axiosInstance.post("/uploads/image", formData, {
                headers: { "Content-Type": "multipart/form-data" },
              });
              const uploadedUrl = uploadRes?.data?.data?.url;
              if (uploadedUrl) {
                setImageUrl(uploadedUrl);
                generate(uploadedUrl);
              }
              onSuccess?.(uploadRes.data);
            } catch (err: unknown) {
              onError?.(err instanceof Error ? err : new Error("Upload failed"));
            }
          }}
        >
          <p className="ant-upload-drag-icon"><UploadOutlined style={{ fontSize: 32, color: "#0d9488" }} /></p>
          <p className="ant-upload-text">Click or drag a product image</p>
          <p className="ant-upload-hint">Supports JPG, PNG. Image will be uploaded then analyzed.</p>
        </Upload.Dragger>
      </Card>

      {generating && (
        <div style={{ textAlign: "center", padding: 32 }}>
          <Spin size="large" />
          <div style={{ marginTop: 12 }}>
            <Text type="secondary">Analyzing product image...</Text>
          </div>
        </div>
      )}

      {error && <Alert type="error" message={error} showIcon />}

      {result && !generating && (
        <Card
          title="Generated Product Info"
          size="small"
          extra={
            <Space>
              <Tooltip title="Copy to clipboard">
                <Button icon={<CopyOutlined />} size="small" onClick={copyToClipboard} />
              </Tooltip>
              <Button type="primary" icon={<PlusOutlined />} size="small" onClick={useForNewProduct}>
                Use for New Product
              </Button>
            </Space>
          }
        >
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Name">
              <Text strong>{result.name}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Brand">{result.brand ?? <Text type="secondary">N/A</Text>}</Descriptions.Item>
            <Descriptions.Item label="Description">
              <Paragraph style={{ marginBottom: 0 }}>{result.description}</Paragraph>
            </Descriptions.Item>
            <Descriptions.Item label="Category">
              <Tag color="processing">{result.suggestedCategory}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Food Type">
              {result.foodType ? (
                <Tag color={FOOD_TYPE_COLORS[result.foodType] ?? "default"}>{result.foodType}</Tag>
              ) : (
                <Text type="secondary">N/A</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Estimated Weight">{result.estimatedWeight ?? <Text type="secondary">N/A</Text>}</Descriptions.Item>
          </Descriptions>

          {imageUrl && (
            <div style={{ marginTop: 16, textAlign: "center" }}>
              <img src={imageUrl} alt="Product" style={{ maxWidth: 200, maxHeight: 200, borderRadius: 8, objectFit: "contain" }} />
            </div>
          )}
        </Card>
      )}
    </Space>
  );
}

// ── Main Page ───────────────────────────────────────

export const StoreIntelligencePage = () => {
  const { stores, loading: storesLoading } = useStores();
  const [storeId, setStoreId] = useState<string>("");

  useEffect(() => {
    if (stores.length > 0 && !storeId) {
      setStoreId(stores[0].id);
    }
  }, [stores, storeId]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>Store Intelligence</Title>
        <Space>
          <Text>Store:</Text>
          <Select
            value={storeId || undefined}
            onChange={setStoreId}
            loading={storesLoading}
            placeholder="Select store"
            style={{ width: 240 }}
            options={stores.map((s) => ({ label: s.name, value: s.id }))}
          />
        </Space>
      </div>

      <Tabs
        items={[
          {
            key: "forecast",
            label: "Demand Forecast",
            children: storeId ? <DemandForecastTab storeId={storeId} /> : <Empty description="Select a store" />,
          },
          {
            key: "reorder",
            label: "Reorder Suggestions",
            children: storeId ? <ReorderSuggestionsTab storeId={storeId} /> : <Empty description="Select a store" />,
          },
          {
            key: "anomalies",
            label: "Anomalies",
            children: storeId ? <AnomaliesTab storeId={storeId} /> : <Empty description="Select a store" />,
          },
          {
            key: "ai-description",
            label: "AI Product Description",
            children: <AIDescriptionTab />,
          },
        ]}
      />
    </div>
  );
};
