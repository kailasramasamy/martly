import { useState } from "react";
import { Link } from "react-router";
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
  Input,
  Image,
  Popconfirm,
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
import {
  ReturnMethod,
  ReturnMethodLabels,
  ReturnRemedy,
  ReturnRemedyLabels,
  RefundDestination,
} from "@martly/shared/constants";
import { ApproveModal, type ApproveBody } from "./ApproveModal";
import { sectionTitle } from "../../theme";
import { ReadableSection } from "../../components/ReadableSection";

const { TextArea } = Input;

const shortId = (id: string) => id.slice(0, 8).toUpperCase();
const fmtDate = (v: string) => new Date(v).toLocaleString();

interface ReturnRequestItem {
  id: string;
  quantity: number;
  restock: boolean;
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
  const [adminNote, setAdminNote] = useState("");
  const [resolving, setResolving] = useState(false);

  if (!record) return null;

  const refresh = () => invalidate({ resource: "return-requests", invalidates: ["detail", "list"], id: record.id });

  const statusCfg = RETURN_REQUEST_STATUS_CONFIG[record.status] ?? { color: "default", label: record.status };

  const openRejectModal = () => {
    setAdminNote("");
    setRejectOpen(true);
  };

  const handleResolve = async (status: "APPROVED" | "REJECTED", approval?: ApproveBody) => {
    setResolving(true);
    try {
      const body = status === "APPROVED" ? { status, ...approval } : { status, adminNote: adminNote.trim() };
      await axiosInstance.patch(`/return-requests/${record.id}/resolve`, body);
      message.success(status === "APPROVED" ? "Return request approved" : "Return request rejected");
      setApproveOpen(false);
      setRejectOpen(false);
      refresh();
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to resolve return request");
    } finally {
      setResolving(false);
    }
  };

  const handleReceive = async () => {
    try {
      await axiosInstance.patch(`/return-requests/${record.id}/receive`);
      message.success("Marked as received");
      refresh();
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to mark as received");
    }
  };

  const replacement = (record.replacementItems ?? []).find((r: any) => r.order?.status !== "CANCELLED");
  const canReceive = record.status === "IN_PROGRESS" && record.method !== ReturnMethod.KEEP && !record.receivedAt;

  const owesCash = record.refundTo === RefundDestination.CASH && record.remedy === ReturnRemedy.REFUND && record.approvedAmount != null;

  return (
    <Show>
      <ReadableSection>
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
                      onClick={() => setApproveOpen(true)}
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

          {canReceive && (
            <Col xs={24}>
              <Card size="small">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#64748b" }}>
                    Waiting for the item to come back.
                    {owesCash && (
                      <strong style={{ display: "block", color: "#b45309" }}>
                        Pay {"\u20B9"}{Number(record.approvedAmount).toLocaleString("en-IN", { maximumFractionDigits: 0 })} cash to the customer
                      </strong>
                    )}
                  </span>
                  <Popconfirm title="Mark this item as received?" onConfirm={handleReceive}>
                    <Button type="primary" icon={<CheckCircleOutlined />}>Mark received</Button>
                  </Popconfirm>
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
                {record.refundTo && record.remedy === ReturnRemedy.REFUND && (
                  <Descriptions.Item label="Refund to">{record.refundTo === RefundDestination.CASH ? "Cash" : "Wallet"}</Descriptions.Item>
                )}
                {record.remedy && (
                  <Descriptions.Item label="Outcome">{ReturnRemedyLabels[record.remedy as ReturnRemedy]}</Descriptions.Item>
                )}
                {record.method && (
                  <Descriptions.Item label="Return method">{ReturnMethodLabels[record.method as ReturnMethod]}</Descriptions.Item>
                )}
                {record.receivedAt && (
                  <Descriptions.Item label="Received">
                    {fmtDate(record.receivedAt)}
                    {" \u00B7 "}
                    {record.collectedOnOrderId ? `Rider collected it with order #${shortId(record.collectedOnOrderId)}` : "Dropped at store"}
                  </Descriptions.Item>
                )}
                {record.receiver && (
                  <Descriptions.Item label={record.collectedOnOrderId ? "Collected by" : "Received by"}>
                    {record.receiver.name || "Staff"}
                    {record.receiver.phone ? ` \u00B7 ${record.receiver.phone}` : ""}
                  </Descriptions.Item>
                )}
                {record.refundedAt && <Descriptions.Item label="Refunded">{fmtDate(record.refundedAt)}</Descriptions.Item>}
                {record.remedy === ReturnRemedy.REPLACE && replacement && (
                  <Descriptions.Item label="Replacement">
                    Replacement sent on order <Link to={`/orders/show/${replacement.orderId}`}>#{shortId(replacement.orderId)}</Link>
                  </Descriptions.Item>
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
                  {
                    title: "Restock",
                    key: "restock",
                    width: 90,
                    render: (_, item) => (item.restock ? "Yes" : "\u2014"),
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>

        {approveOpen && (
          <ApproveModal
            record={record}
            loading={resolving}
            onCancel={() => setApproveOpen(false)}
            onSubmit={(body) => handleResolve("APPROVED", body)}
          />
        )}

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
      </ReadableSection>
    </Show>
  );
};
