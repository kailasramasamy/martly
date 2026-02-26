import { useState, useEffect, useCallback } from "react";
import { Table, Card, Input, Tag, Button, Space, Modal, Form, InputNumber, message, Typography, Descriptions, Spin } from "antd";
import { StarOutlined, SearchOutlined, EditOutlined } from "@ant-design/icons";
import { axiosInstance } from "../../providers/data-provider";
import { LOYALTY_TRANSACTION_TYPE_CONFIG } from "../../constants/tag-colors";

const { Text } = Typography;

interface LoyaltyBalance {
  id: string;
  userId: string;
  points: number;
  totalEarned: number;
  totalRedeemed: number;
  user: { id: string; name: string; email: string; phone: string | null };
}

interface LoyaltyTransaction {
  id: string;
  type: string;
  points: number;
  balanceAfter: number;
  description: string | null;
  orderId: string | null;
  createdAt: string;
}

export const LoyaltyCustomers = () => {
  const [balances, setBalances] = useState<LoyaltyBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [adjustModal, setAdjustModal] = useState<LoyaltyBalance | null>(null);
  const [detailModal, setDetailModal] = useState<LoyaltyBalance | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [adjustForm] = Form.useForm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (search.trim()) params.set("q", search.trim());
      const res = await axiosInstance.get(`/loyalty/customers?${params}`);
      setBalances(res.data.data);
      setTotal(res.data.meta?.total ?? 0);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openDetail = async (record: LoyaltyBalance) => {
    setDetailModal(record);
    setLoadingDetail(true);
    try {
      const res = await axiosInstance.get(`/loyalty/customers/${record.userId}`);
      setTransactions(res.data.data.transactions ?? []);
    } catch {
      setTransactions([]);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAdjust = async () => {
    if (!adjustModal) return;
    const values = await adjustForm.validateFields();
    setAdjusting(true);
    try {
      await axiosInstance.post("/loyalty/adjust", {
        userId: adjustModal.userId,
        points: values.points,
        description: values.description,
      });
      message.success("Points adjusted successfully");
      setAdjustModal(null);
      adjustForm.resetFields();
      fetchData();
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to adjust points");
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>
          <Space>
            <StarOutlined style={{ color: "#d97706" }} />
            Customer Loyalty Points
          </Space>
        </h2>
      </div>

      <Card size="small">
        <div style={{ marginBottom: 16 }}>
          <Input
            placeholder="Search by name or email..."
            prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ maxWidth: 320 }}
            allowClear
          />
        </div>

        <Table<LoyaltyBalance>
          dataSource={balances}
          loading={loading}
          rowKey="id"
          size="small"
          pagination={{
            current: page,
            total,
            pageSize: 20,
            onChange: setPage,
            showTotal: (t) => `${t} customers`,
          }}
          columns={[
            {
              title: "Customer",
              key: "customer",
              render: (_, r) => (
                <div>
                  <Text strong>{r.user.name}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>{r.user.email}</Text>
                </div>
              ),
            },
            {
              title: "Points Balance",
              dataIndex: "points",
              key: "points",
              sorter: (a, b) => a.points - b.points,
              render: (v: number) => (
                <Tag color="gold" style={{ fontSize: 14, padding: "2px 10px" }}>
                  <StarOutlined /> {v}
                </Tag>
              ),
            },
            {
              title: "Total Earned",
              dataIndex: "totalEarned",
              key: "totalEarned",
              render: (v: number) => <Text type="success">+{v}</Text>,
            },
            {
              title: "Total Redeemed",
              dataIndex: "totalRedeemed",
              key: "totalRedeemed",
              render: (v: number) => <Text type="secondary">{v > 0 ? `-${v}` : "0"}</Text>,
            },
            {
              title: "Actions",
              key: "actions",
              width: 180,
              render: (_, r) => (
                <Space>
                  <Button size="small" onClick={() => openDetail(r)}>
                    View
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setAdjustModal(r);
                      adjustForm.resetFields();
                    }}
                  >
                    Adjust
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title={detailModal ? `${detailModal.user.name} — Loyalty History` : ""}
        open={detailModal !== null}
        onCancel={() => setDetailModal(null)}
        footer={null}
        width={700}
      >
        {detailModal && (
          <Descriptions size="small" column={3} bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Points">{detailModal.points}</Descriptions.Item>
            <Descriptions.Item label="Total Earned">{detailModal.totalEarned}</Descriptions.Item>
            <Descriptions.Item label="Total Redeemed">{detailModal.totalRedeemed}</Descriptions.Item>
          </Descriptions>
        )}
        {loadingDetail ? (
          <div style={{ textAlign: "center", padding: 32 }}><Spin /></div>
        ) : (
          <Table<LoyaltyTransaction>
            dataSource={transactions}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 10 }}
            columns={[
              {
                title: "Type",
                dataIndex: "type",
                key: "type",
                width: 120,
                render: (t: string) => {
                  const cfg = LOYALTY_TRANSACTION_TYPE_CONFIG[t] ?? { color: "default", label: t };
                  return <Tag color={cfg.color}>{cfg.label}</Tag>;
                },
              },
              {
                title: "Points",
                dataIndex: "points",
                key: "points",
                width: 100,
                render: (v: number) => (
                  <Text style={{ color: v > 0 ? "#d97706" : "#6366f1", fontWeight: 600 }}>
                    {v > 0 ? `+${v}` : v}
                  </Text>
                ),
              },
              {
                title: "Balance After",
                dataIndex: "balanceAfter",
                key: "balanceAfter",
                width: 110,
              },
              {
                title: "Description",
                dataIndex: "description",
                key: "description",
                ellipsis: true,
              },
              {
                title: "Date",
                dataIndex: "createdAt",
                key: "createdAt",
                width: 160,
                render: (v: string) => new Date(v).toLocaleString(),
              },
            ]}
          />
        )}
      </Modal>

      {/* Adjust Modal */}
      <Modal
        title={adjustModal ? `Adjust Points — ${adjustModal.user.name}` : ""}
        open={adjustModal !== null}
        onCancel={() => setAdjustModal(null)}
        onOk={handleAdjust}
        confirmLoading={adjusting}
        okText="Apply Adjustment"
      >
        {adjustModal && (
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">
              Current balance: <Text strong>{adjustModal.points} points</Text>
            </Text>
          </div>
        )}
        <Form form={adjustForm} layout="vertical">
          <Form.Item
            name="points"
            label="Points to add/subtract"
            rules={[{ required: true, message: "Enter the number of points" }]}
            extra="Use a positive number to credit points, negative to deduct"
          >
            <InputNumber style={{ width: "100%" }} placeholder="e.g. 50 or -20" />
          </Form.Item>
          <Form.Item
            name="description"
            label="Reason"
            rules={[{ required: true, message: "Please provide a reason" }]}
          >
            <Input.TextArea rows={2} placeholder="e.g. Bonus for referral, correction for duplicate entry" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
