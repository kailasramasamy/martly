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
  Button,
  Input,
  Statistic,
  Row,
  Col,
  Empty,
  Alert,
  theme as antTheme,
} from "antd";
import {
  SmileOutlined,
  MehOutlined,
  FrownOutlined,
  SendOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  BulbOutlined,
} from "@ant-design/icons";
import { axiosInstance } from "../../providers/data-provider";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// ── Types ───────────────────────────────────────────

interface Store {
  id: string;
  name: string;
}

interface AskHighlight {
  label: string;
  value: string;
  change: string | null;
  direction: "up" | "down" | "neutral";
}

interface AskInsight {
  label: string;
  detail: string;
}

interface AskResult {
  headline: string;
  highlights: AskHighlight[];
  insights: AskInsight[];
  tip: string | null;
}

interface ChurnCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  totalOrders: number;
  totalSpent: number;
  avgOrderValue: number;
  lastOrderDate: string;
  firstOrderDate: string;
  daysSinceLastOrder: number;
  riskLevel: "active" | "at_risk" | "churning" | "churned";
  suggestedAction: string;
}

interface ChurnSummary {
  totalCustomers: number;
  active: number;
  atRisk: number;
  churning: number;
  churned: number;
}

interface ReviewSummary {
  overallSentiment: string | null;
  summary: string;
  positives: string[];
  negatives: string[];
  patterns: string[];
  recommendations: string[];
  meta: {
    reviewCount: number;
    storeRatingCount: number;
    avgProductRating: number | null;
    avgStoreRating: number | null;
    periodDays: number;
  };
}

// ── Helpers ─────────────────────────────────────────

const RISK_CONFIG: Record<string, { color: string; label: string }> = {
  active: { color: "green", label: "Active" },
  at_risk: { color: "orange", label: "At Risk" },
  churning: { color: "red", label: "Churning" },
  churned: { color: "default", label: "Churned" },
};

const SENTIMENT_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  positive: { color: "green", icon: <SmileOutlined /> },
  mixed: { color: "orange", icon: <MehOutlined /> },
  negative: { color: "red", icon: <FrownOutlined /> },
};

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

// ── Tab 1: Ask Your Store ───────────────────────────

function AskTab({ storeId }: { storeId: string }) {
  const { token } = antTheme.useToken();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);

  const ask = useCallback(async (q: string) => {
    if (!storeId || !q.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await axiosInstance.post("/customer-insights/ask", { storeId, question: q.trim() });
      const data = res?.data?.data;
      setResult(data ?? null);
    } catch {
      setResult({ headline: "Failed to get an answer. Please try again.", highlights: [], insights: [], tip: null });
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  const suggestedQuestions = [
    "How did I do last week?",
    "What's my best selling product?",
    "How are my customers doing?",
    "What payment methods do people prefer?",
    "How's my store rating?",
  ];

  const directionColor = (d: string) => d === "up" ? token.colorSuccess : d === "down" ? token.colorError : token.colorTextSecondary;
  const directionIcon = (d: string) => d === "up" ? <ArrowUpOutlined /> : d === "down" ? <ArrowDownOutlined /> : null;

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {suggestedQuestions.map((q) => (
          <Tag
            key={q}
            style={{ cursor: "pointer", padding: "4px 12px" }}
            color="processing"
            onClick={() => {
              setQuestion(q);
              ask(q);
            }}
          >
            {q}
          </Tag>
        ))}
      </div>

      <Space.Compact style={{ width: "100%" }}>
        <TextArea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask anything about your store..."
          autoSize={{ minRows: 1, maxRows: 3 }}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              ask(question);
            }
          }}
          style={{ flex: 1 }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={() => ask(question)}
          loading={loading}
          style={{ height: "auto" }}
        >
          Ask
        </Button>
      </Space.Compact>

      {loading && (
        <div style={{ textAlign: "center", padding: 32 }}>
          <Spin size="large" />
          <div style={{ marginTop: 12 }}>
            <Text type="secondary">Analyzing your store data...</Text>
          </div>
        </div>
      )}

      {result && !loading && (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          {/* Headline */}
          <Card size="small">
            <Text strong style={{ fontSize: 15 }}>{result.headline}</Text>
          </Card>

          {/* Highlight cards */}
          {result.highlights.length > 0 && (
            <Row gutter={[12, 12]}>
              {result.highlights.map((h, i) => (
                <Col span={Math.floor(24 / Math.min(result.highlights.length, 4))} key={i}>
                  <Card size="small">
                    <div style={{ marginBottom: 4 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>{h.label}</Text>
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <Text strong style={{ fontSize: 20 }}>{h.value}</Text>
                      {h.change && (
                        <Text style={{ fontSize: 12, color: directionColor(h.direction) }}>
                          {directionIcon(h.direction)} {h.change}
                        </Text>
                      )}
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          )}

          {/* Insights */}
          {result.insights.length > 0 && (
            <Card size="small" title={<Text strong style={{ fontSize: 13 }}>Key Insights</Text>}>
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                {result.insights.map((ins, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <Tag color="processing" style={{ flexShrink: 0, margin: 0 }}>{ins.label}</Tag>
                    <Text>{ins.detail}</Text>
                  </div>
                ))}
              </Space>
            </Card>
          )}

          {/* Tip */}
          {result.tip && (
            <Alert
              type="info"
              showIcon
              icon={<BulbOutlined />}
              message={<Text strong>Recommendation</Text>}
              description={result.tip}
            />
          )}
        </Space>
      )}
    </Space>
  );
}

// ── Tab 2: Churn Risk ───────────────────────────────

function ChurnRiskTab({ storeId }: { storeId: string }) {
  const [customers, setCustomers] = useState<ChurnCustomer[]>([]);
  const [summary, setSummary] = useState<ChurnSummary>({ totalCustomers: 0, active: 0, atRisk: 0, churning: 0, churned: 0 });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const fetch = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/customer-insights/churn-risk?storeId=${storeId}`);
      const data = res?.data?.data;
      setCustomers(data?.customers ?? []);
      setSummary(data?.summary ?? { totalCustomers: 0, active: 0, atRisk: 0, churning: 0, churned: 0 });
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { fetch(); }, [fetch]);

  const filtered = filter === "all" ? customers : customers.filter((c) => c.riskLevel === filter);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Row gutter={16}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Active" value={summary.active} valueStyle={{ color: "#16a34a" }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="At Risk" value={summary.atRisk} valueStyle={{ color: "#f59e0b" }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Churning" value={summary.churning} valueStyle={{ color: "#ef4444" }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Churned" value={summary.churned} valueStyle={{ color: "#94a3b8" }} />
          </Card>
        </Col>
      </Row>

      <Segmented
        options={[
          { label: `All (${summary.totalCustomers})`, value: "all" },
          { label: `At Risk (${summary.atRisk})`, value: "at_risk" },
          { label: `Churning (${summary.churning})`, value: "churning" },
          { label: `Churned (${summary.churned})`, value: "churned" },
        ]}
        value={filter}
        onChange={(v) => setFilter(v as string)}
      />

      <Table
        dataSource={filtered}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 20, showSizeChanger: false }}
        columns={[
          {
            title: "Customer",
            key: "customer",
            render: (_, r: ChurnCustomer) => (
              <div>
                <div>{r.name}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>{r.email || r.phone}</Text>
              </div>
            ),
          },
          {
            title: "Phone",
            dataIndex: "phone",
            key: "phone",
            width: 120,
            render: (v: string | null) => v || <Text type="secondary">-</Text>,
          },
          { title: "Orders", dataIndex: "totalOrders", key: "orders", width: 80, align: "right" as const },
          {
            title: "Total Spent",
            dataIndex: "totalSpent",
            key: "spent",
            width: 120,
            align: "right" as const,
            render: (v: number) => `\u20B9${v.toLocaleString("en-IN")}`,
          },
          {
            title: "Avg Order",
            dataIndex: "avgOrderValue",
            key: "aov",
            width: 100,
            align: "right" as const,
            render: (v: number) => `\u20B9${v.toLocaleString("en-IN")}`,
          },
          {
            title: "Last Order",
            dataIndex: "lastOrderDate",
            key: "lastOrder",
            width: 110,
            render: (v: string) => new Date(v).toLocaleDateString("en-IN"),
          },
          {
            title: "Days Inactive",
            dataIndex: "daysSinceLastOrder",
            key: "daysInactive",
            width: 110,
            align: "right" as const,
            sorter: (a: ChurnCustomer, b: ChurnCustomer) => a.daysSinceLastOrder - b.daysSinceLastOrder,
          },
          {
            title: "Risk",
            dataIndex: "riskLevel",
            key: "risk",
            width: 100,
            render: (v: string) => {
              const cfg = RISK_CONFIG[v];
              return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : v;
            },
          },
          {
            title: "Suggested Action",
            dataIndex: "suggestedAction",
            key: "action",
            ellipsis: true,
            width: 250,
            render: (v: string) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text>,
          },
        ]}
      />
    </Space>
  );
}

// ── Tab 3: Review Insights ──────────────────────────

function ReviewInsightsTab({ storeId }: { storeId: string }) {
  const { token } = antTheme.useToken();
  const [data, setData] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<string>("90");

  const generate = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setData(null);
    try {
      const res = await axiosInstance.get(`/customer-insights/review-summary?storeId=${storeId}&days=${period}`);
      setData(res?.data?.data ?? null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [storeId, period]);

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Space>
          <Segmented
            options={[
              { label: "30 days", value: "30" },
              { label: "60 days", value: "60" },
              { label: "90 days", value: "90" },
            ]}
            value={period}
            onChange={(v) => setPeriod(v as string)}
          />
        </Space>
        <Button type="primary" onClick={generate} loading={loading}>
          Generate Summary
        </Button>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 32 }}>
          <Spin size="large" />
          <div style={{ marginTop: 12 }}>
            <Text type="secondary">Analyzing reviews...</Text>
          </div>
        </div>
      )}

      {data && !loading && (
        <>
          {data.overallSentiment && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Text strong>Overall Sentiment:</Text>
              <Tag
                color={SENTIMENT_CONFIG[data.overallSentiment]?.color ?? "default"}
                icon={SENTIMENT_CONFIG[data.overallSentiment]?.icon}
                style={{ fontSize: 14, padding: "4px 12px" }}
              >
                {data.overallSentiment.charAt(0).toUpperCase() + data.overallSentiment.slice(1)}
              </Tag>
            </div>
          )}

          <Card size="small">
            <Paragraph style={{ marginBottom: 0 }}>{data.summary}</Paragraph>
          </Card>

          <Row gutter={[16, 16]}>
            {data.positives.length > 0 && (
              <Col span={12}>
                <Card
                  size="small"
                  title={<Text style={{ color: token.colorSuccess }}>Positives</Text>}
                  style={{ borderColor: token.colorSuccessBorder }}
                  styles={{ body: { background: token.colorSuccessBg } }}
                >
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {data.positives.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </Card>
              </Col>
            )}
            {data.negatives.length > 0 && (
              <Col span={12}>
                <Card
                  size="small"
                  title={<Text style={{ color: token.colorError }}>Negatives</Text>}
                  style={{ borderColor: token.colorErrorBorder }}
                  styles={{ body: { background: token.colorErrorBg } }}
                >
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {data.negatives.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                </Card>
              </Col>
            )}
            {data.patterns.length > 0 && (
              <Col span={12}>
                <Card
                  size="small"
                  title={<Text style={{ color: token.colorInfo }}>Patterns</Text>}
                  style={{ borderColor: token.colorInfoBorder }}
                  styles={{ body: { background: token.colorInfoBg } }}
                >
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {data.patterns.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                </Card>
              </Col>
            )}
            {data.recommendations.length > 0 && (
              <Col span={12}>
                <Card
                  size="small"
                  title={<Text style={{ color: token.colorPrimary }}>Recommendations</Text>}
                  style={{ borderColor: token.colorPrimaryBorder }}
                  styles={{ body: { background: token.colorPrimaryBg } }}
                >
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {data.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </Card>
              </Col>
            )}
          </Row>

          <Row gutter={16}>
            <Col span={6}>
              <Statistic title="Product Reviews" value={data.meta.reviewCount} />
            </Col>
            <Col span={6}>
              <Statistic title="Store Ratings" value={data.meta.storeRatingCount} />
            </Col>
            <Col span={6}>
              <Statistic
                title="Avg Product Rating"
                value={data.meta.avgProductRating ?? "-"}
                suffix={data.meta.avgProductRating ? "/5" : ""}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Avg Store Rating"
                value={data.meta.avgStoreRating ?? "-"}
                suffix={data.meta.avgStoreRating ? "/5" : ""}
              />
            </Col>
          </Row>
        </>
      )}

      {!data && !loading && (
        <Empty description="Click 'Generate Summary' to analyze reviews" />
      )}
    </Space>
  );
}

// ── Main Page ───────────────────────────────────────

export const CustomerInsightsPage = () => {
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
        <Title level={4} style={{ margin: 0 }}>Customer Insights</Title>
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
            key: "ask",
            label: "Ask Your Store",
            children: storeId ? <AskTab storeId={storeId} /> : <Empty description="Select a store" />,
          },
          {
            key: "churn",
            label: "Churn Risk",
            children: storeId ? <ChurnRiskTab storeId={storeId} /> : <Empty description="Select a store" />,
          },
          {
            key: "reviews",
            label: "Review Insights",
            children: storeId ? <ReviewInsightsTab storeId={storeId} /> : <Empty description="Select a store" />,
          },
        ]}
      />
    </div>
  );
};
