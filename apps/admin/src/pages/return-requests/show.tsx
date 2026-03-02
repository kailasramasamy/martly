import { useState } from "react";
import { Show } from "@refinedev/antd";
import { useShow, useInvalidate } from "@refinedev/core";
import {
  Tag,
  Table,
  Card,
  Descriptions,
  Row,
  Col,
  Button,
  Space,
  Modal,
  InputNumber,
  Input,
  Image,
  message,
} from "antd";
import {
  FileTextOutlined,
  UserOutlined,
  ShopOutlined,
  PictureOutlined,
  ShoppingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import { axiosInstance } from "../../providers/data-provider";
import { RETURN_REQUEST_STATUS_CONFIG } from "../../constants/tag-colors";
import { sectionTitle } from "../../theme";

const { TextArea } = Input;

interface ReturnRequestItem {
  id: string;
  quantity: number;
  orderItem: {
    id: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    product?: { name?: string };
    variant?: { name?: string; unitValue?: string; unitType?: string };
  };
}

export const ReturnRequestShow = () => {
  const { query } = useShow({ resource: "return-requests" });
  const record = query?.data?.data;
  const invalidate = useInvalidate();

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approvedAmount, setApprovedAmount] = useState<number>(0);
  const [adminNote, setAdminNote] = useState("");
  const [resolving, setResolving] = useState(false);

  if (!record) return null;

  const statusCfg = RETURN_REQUEST_STATUS_CONFIG[record.status] ?? { color: "default", label: record.status };

  const openApproveModal = () => {
    setApprovedAmount(Number(record.requestedAmount));
    setAdminNote("");
    setApproveOpen(true);
  };

  const openRejectModal = () => {
    setAdminNote("");
    setRejectOpen(true);
  };

  const handleResolve = async (status: "APPROVED" | "REJECTED") => {
    setResolving(true);
    try {
      const body: any = { status };
      if (status === "APPROVED") {
        body.approvedAmount = approvedAmount;
        if (adminNote.trim()) body.adminNote = adminNote.trim();
      } else {
        body.adminNote = adminNote.trim();
      }
      await axiosInstance.patch(`/return-requests/${record.id}/resolve`, body);
      message.success(status === "APPROVED" ? "Return request approved" : "Return request rejected");
      setApproveOpen(false);
      setRejectOpen(false);
      invalidate({ resource: "return-requests", invalidates: ["detail", "list"], id: record.id });
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to resolve return request");
    } finally {
      setResolving(false);
    }
  };

  return (
    <Show>
      <Row gutter={[16, 16]}>
        {record.status === "PENDING" && (
          <Col xs={24}>
            <Card size="small">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Space>
                  <span style={{ color: "#64748b", fontSize: 14 }}>Status:</span>
                  <Tag color={statusCfg.color} style={{ fontSize: 14, padding: "2px 12px" }}>
                    {statusCfg.label}
                  </Tag>
                </Space>
                <Space>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={openApproveModal}
                    style={{ backgroundColor: "#16a34a", borderColor: "#16a34a" }}
                  >
                    Approve
                  </Button>
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={openRejectModal}
                  >
                    Reject
                  </Button>
                </Space>
              </div>
            </Card>
          </Col>
        )}

        <Col xs={24} lg={12}>
          <Card title={sectionTitle(<FileTextOutlined />, "Return Request Details")} size="small">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Order ID">
                <span style={{ fontFamily: "monospace" }}>{record.order?.id?.slice(0, 8)}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusCfg.color}>{statusCfg.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Reason">{record.reason}</Descriptions.Item>
              {record.description && (
                <Descriptions.Item label="Description">{record.description}</Descriptions.Item>
              )}
              <Descriptions.Item label="Requested Amount">
                {"\u20B9"}{Number(record.requestedAmount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </Descriptions.Item>
              {record.approvedAmount != null && (
                <Descriptions.Item label="Approved Amount">
                  {"\u20B9"}{Number(record.approvedAmount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </Descriptions.Item>
              )}
              {record.adminNote && (
                <Descriptions.Item label="Admin Note">{record.adminNote}</Descriptions.Item>
              )}
              <Descriptions.Item label="Created">
                {record.createdAt ? new Date(record.createdAt).toLocaleString() : "\u2014"}
              </Descriptions.Item>
              {record.resolvedAt && (
                <Descriptions.Item label="Resolved">
                  {new Date(record.resolvedAt).toLocaleString()}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title={sectionTitle(<UserOutlined />, "Customer & Store")} size="small">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Customer">
                {record.user?.name ?? "\u2014"}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {record.user?.email ?? "\u2014"}
              </Descriptions.Item>
              <Descriptions.Item label="Phone">
                {record.user?.phone ?? "\u2014"}
              </Descriptions.Item>
              <Descriptions.Item label="Store">
                {record.store?.name ?? "\u2014"}
              </Descriptions.Item>
              <Descriptions.Item label="Order Total">
                {record.order?.totalAmount
                  ? `\u20B9${Number(record.order.totalAmount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
                  : "\u2014"}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {record.images && record.images.length > 0 && (
          <Col xs={24}>
            <Card title={sectionTitle(<PictureOutlined />, "Photos")} size="small">
              <Image.PreviewGroup>
                <Space wrap>
                  {record.images.map((url: string, i: number) => (
                    <Image
                      key={i}
                      src={url}
                      width={120}
                      height={120}
                      style={{ objectFit: "cover", borderRadius: 8 }}
                    />
                  ))}
                </Space>
              </Image.PreviewGroup>
            </Card>
          </Col>
        )}

        <Col xs={24}>
          <Card title={sectionTitle(<ShoppingOutlined />, "Returned Items")} size="small">
            <Table<ReturnRequestItem>
              dataSource={record.items ?? []}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                {
                  title: "Product",
                  key: "product",
                  render: (_, item) => item.orderItem?.product?.name ?? "\u2014",
                },
                {
                  title: "Variant",
                  key: "variant",
                  render: (_, item) => {
                    if (!item.orderItem?.variant) return "\u2014";
                    const parts = [item.orderItem.variant.name];
                    if (item.orderItem.variant.unitValue && item.orderItem.variant.unitType) {
                      parts.push(`(${item.orderItem.variant.unitValue} ${item.orderItem.variant.unitType})`);
                    }
                    return parts.join(" ");
                  },
                },
                {
                  title: "Qty Returned",
                  dataIndex: "quantity",
                  key: "quantity",
                  width: 110,
                },
                {
                  title: "Unit Price",
                  key: "unitPrice",
                  width: 120,
                  render: (_, item) => `\u20B9${Number(item.orderItem?.unitPrice ?? 0).toFixed(0)}`,
                },
                {
                  title: "Line Total",
                  key: "lineTotal",
                  width: 120,
                  render: (_, item) => `\u20B9${(item.quantity * Number(item.orderItem?.unitPrice ?? 0)).toFixed(0)}`,
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title="Approve Return Request"
        open={approveOpen}
        onCancel={() => setApproveOpen(false)}
        onOk={() => handleResolve("APPROVED")}
        confirmLoading={resolving}
        okText="Approve & Refund"
        okButtonProps={{ style: { backgroundColor: "#16a34a", borderColor: "#16a34a" } }}
      >
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
            Refund Amount ({"\u20B9"})
          </label>
          <InputNumber
            value={approvedAmount}
            onChange={(v) => setApprovedAmount(v ?? 0)}
            min={0}
            max={Number(record.requestedAmount)}
            style={{ width: "100%" }}
            prefix={"\u20B9"}
          />
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            Requested: {"\u20B9"}{Number(record.requestedAmount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}. Adjust for partial refunds.
          </div>
        </div>
        <div>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
            Admin Note (optional)
          </label>
          <TextArea
            rows={3}
            placeholder="Reason for approval or partial refund..."
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        title="Reject Return Request"
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={() => handleResolve("REJECTED")}
        confirmLoading={resolving}
        okText="Reject"
        okButtonProps={{ danger: true, disabled: !adminNote.trim() }}
      >
        <div>
          <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
            Reason for Rejection (required)
          </label>
          <TextArea
            rows={3}
            placeholder="Explain why the return request is being rejected..."
            value={adminNote}
            onChange={(e) => setAdminNote(e.target.value)}
          />
        </div>
      </Modal>
    </Show>
  );
};
