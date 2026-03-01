import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import {
  Card,
  Tag,
  Descriptions,
  Timeline,
  Input,
  Button,
  Space,
  Select,
  Typography,
  Spin,
  message,
  theme,
} from "antd";
import {
  UserOutlined,
  RobotOutlined,
  CustomerServiceOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import { axiosInstance } from "../../providers/data-provider";
import { TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG } from "../../constants/tag-colors";

const { TextArea } = Input;
const { Text, Title } = Typography;

interface TicketMessage {
  role: string;
  content: string;
  timestamp: string;
}

interface TicketData {
  id: string;
  subject: string;
  status: string;
  priority: string;
  messages: TicketMessage[];
  createdAt: string;
  user: { id: string; name: string; email: string; phone: string | null };
  store: { id: string; name: string } | null;
  order: {
    id: string;
    status: string;
    totalAmount: string;
    paymentStatus: string;
    createdAt: string;
  } | null;
}

export const SupportTicketShow = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const isDark = token.colorBgContainer !== "#ffffff";
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [newStatus, setNewStatus] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const fetchTicket = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`/support/tickets/${id}`);
      setTicket(res.data?.data);
    } catch {
      message.error("Failed to load ticket");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  const handleSave = async () => {
    if (!reply.trim() && !newStatus) return;
    setSaving(true);
    try {
      await axiosInstance.patch(`/support/tickets/${id}`, {
        ...(reply.trim() ? { reply: reply.trim() } : {}),
        ...(newStatus ? { status: newStatus } : {}),
      });
      message.success("Ticket updated");
      setReply("");
      setNewStatus(undefined);
      fetchTicket();
    } catch {
      message.error("Failed to update ticket");
    } finally {
      setSaving(false);
    }
  };

  const roleIcon = (role: string) => {
    if (role === "user") return <UserOutlined style={{ color: "#3b82f6" }} />;
    if (role === "assistant") return <RobotOutlined style={{ color: "#0d9488" }} />;
    return <CustomerServiceOutlined style={{ color: "#f59e0b" }} />;
  };

  const roleColor = (role: string) => {
    if (role === "user") return isDark ? "#60a5fa" : "#3b82f6";
    if (role === "assistant") return isDark ? "#2dd4bf" : "#0d9488";
    return isDark ? "#fbbf24" : "#f59e0b";
  };

  const bubbleBg = (role: string) => {
    if (role === "admin") return isDark ? "rgba(251, 191, 36, 0.1)" : "#fef3c7";
    if (role === "user") return isDark ? "rgba(96, 165, 250, 0.1)" : "#eff6ff";
    return isDark ? "rgba(45, 212, 191, 0.1)" : "#f0fdfa";
  };

  const roleLabel = (role: string) => {
    if (role === "user") return "Customer";
    if (role === "assistant") return "AI Support";
    return "Admin";
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!ticket) {
    return <div>Ticket not found</div>;
  }

  const ticketMessages = ticket.messages || [];
  const statusCfg = TICKET_STATUS_CONFIG[ticket.status] || { color: "default", label: ticket.status };
  const priorityCfg = TICKET_PRIORITY_CONFIG[ticket.priority] || { color: "default", label: ticket.priority };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/support-tickets")}
        >
          Back
        </Button>
        <Title level={4} style={{ margin: 0 }}>Support Ticket</Title>
      </Space>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="Subject">
            <Text strong>{ticket.subject}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={statusCfg.color}>{statusCfg.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Customer">
            {ticket.user?.name} ({ticket.user?.email || ticket.user?.phone})
          </Descriptions.Item>
          <Descriptions.Item label="Priority">
            <Tag color={priorityCfg.color}>{priorityCfg.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Store">
            {ticket.store?.name || "\u2014"}
          </Descriptions.Item>
          <Descriptions.Item label="Created">
            {new Date(ticket.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Descriptions.Item>
          {ticket.order && (
            <Descriptions.Item label="Order">
              #{ticket.order.id.slice(0, 8)} \u2014 {ticket.order.status} \u2014 {"\u20B9"}
              {Number(ticket.order.totalAmount).toLocaleString("en-IN")}
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      <Card title="Conversation" size="small" style={{ marginBottom: 16 }}>
        {ticketMessages.length === 0 ? (
          <Text type="secondary">No messages yet</Text>
        ) : (
          <Timeline
            items={ticketMessages.map((msg, i) => ({
              key: i,
              dot: roleIcon(msg.role),
              children: (
                <div>
                  <div style={{ marginBottom: 4 }}>
                    <Text strong style={{ color: roleColor(msg.role), fontSize: 12 }}>
                      {roleLabel(msg.role)}
                    </Text>
                    {msg.timestamp && (
                      <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                        {new Date(msg.timestamp).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    )}
                  </div>
                  <div
                    style={{
                      backgroundColor: bubbleBg(msg.role),
                      borderRadius: 8,
                      padding: "8px 12px",
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: token.colorText,
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ),
            }))}
          />
        )}
      </Card>

      {ticket.status !== "CLOSED" && (
        <Card title="Admin Reply" size="small">
          <TextArea
            rows={3}
            placeholder="Type your reply to the customer..."
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <Space>
            <Select
              placeholder="Update Status"
              allowClear
              value={newStatus}
              onChange={setNewStatus}
              style={{ width: 160 }}
              options={[
                { label: "Resolved", value: "RESOLVED" },
                { label: "Closed", value: "CLOSED" },
              ]}
            />
            <Button
              type="primary"
              onClick={handleSave}
              loading={saving}
              disabled={!reply.trim() && !newStatus}
            >
              {reply.trim() && newStatus
                ? "Reply & Update"
                : reply.trim()
                  ? "Send Reply"
                  : "Update Status"}
            </Button>
          </Space>
        </Card>
      )}
    </div>
  );
};
