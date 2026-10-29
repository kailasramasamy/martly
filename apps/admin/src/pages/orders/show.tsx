import { useState, useCallback } from "react";
import { Show } from "@refinedev/antd";
import { useShow, useInvalidate, useGetIdentity } from "@refinedev/core";
import { useOrderWebSocket } from "../../hooks/useOrderWebSocket";
import { Tag, Table, Card, Descriptions, Row, Col, Button, Space, Select, Input, message } from "antd";
import { axiosInstance } from "../../providers/data-provider";
import {
  FileTextOutlined,
  CreditCardOutlined,
  ShoppingOutlined,
  DollarOutlined,
  StarOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";

import { ORDER_STATUS_CONFIG, PAYMENT_STATUS_CONFIG, FULFILLMENT_TYPE_CONFIG, RETURN_REQUEST_STATUS_CONFIG } from "../../constants/tag-colors";
import { canUndoDelivery, permittedNextStatuses } from "@martly/shared/order-flow";
import { hasPermission } from "@martly/shared/permissions";
import { CANCEL_ORDER, ReasonConfirmButton, UNDO_DELIVERY } from "../../components/ReasonConfirmButton";
import { ConfirmFinalStep } from "../../components/ConfirmFinalStep";
import { RiderAssignModal } from "../../components/RiderAssignModal";
import { NEXT_ACTION } from "../../constants/order-transitions";
import { ItemFlags, RefusedSummaryRow, ReturnOutcome, type FlaggedItem } from "./item-flags";
import { sectionTitle } from "../../theme";
import { ReadableSection } from "../../components/ReadableSection";

interface OrderItem extends FlaggedItem {
  id: string;
  productId: string;
  product?: { name?: string };
  variant?: { name?: string; unitValue?: string; unitType?: string };
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  freeQuantity: number;
}

export const OrderShow = () => {
  const { query } = useShow({ resource: "orders" });
  const record = query?.data?.data;
  const invalidate = useInvalidate();
  const { data: identity } = useGetIdentity<{ role: string; permissions?: string[] }>();
  const [updating, setUpdating] = useState(false);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<string | null>(null);
  const [paymentNote, setPaymentNote] = useState("");
  const [pickingRider, setPickingRider] = useState(false);

  // Real-time updates via WebSocket
  const recordId = record?.id as string | undefined;
  useOrderWebSocket({
    orderId: recordId,
    enabled: !!record,
    onOrderUpdated: useCallback(() => {
      invalidate({ resource: "orders", invalidates: ["detail", "list"], id: recordId });
    }, [invalidate, recordId]),
    onOrdersChanged: useCallback(() => {
      invalidate({ resource: "orders", invalidates: ["detail"], id: recordId });
    }, [invalidate, recordId]),
  });

  if (!record) return null;

  const isPickup = record.fulfillmentType === "PICKUP";
  const statusConfig = ORDER_STATUS_CONFIG[record.status] ?? { color: "default", label: record.status };
  const paymentConfig = PAYMENT_STATUS_CONFIG[record.paymentStatus] ?? { color: "default", label: record.paymentStatus };
  const fulfillmentConfig = FULFILLMENT_TYPE_CONFIG[record.fulfillmentType] ?? FULFILLMENT_TYPE_CONFIG.DELIVERY;
  const transitions = permittedNextStatuses(identity, record.status, record.fulfillmentType);
  const canSetPayment = identity?.role === "SUPER_ADMIN" || hasPermission(identity?.permissions, "FINANCE_MANAGE");
  const forwardTransition = transitions.find((t) => t !== "CANCELLED");
  const canCancel = transitions.includes("CANCELLED");
  const canDispatch = identity?.role === "SUPER_ADMIN" || hasPermission(identity?.permissions, "ORDERS_DISPATCH");
  // Sent out before riders were required: still on the road with nobody assigned
  const riderless = canDispatch && record.status === "OUT_FOR_DELIVERY" && !record.deliveryTripId;
  const forwardLabel = forwardTransition === "OUT_FOR_DELIVERY"
    ? "Send out with rider"
    : forwardTransition && ((isPickup && NEXT_ACTION[forwardTransition]?.pickupLabel) || NEXT_ACTION[forwardTransition]?.label);

  const handleStatusChange = async (newStatus: string, note?: string) => {
    setUpdating(true);
    try {
      await axiosInstance.patch(`/orders/${record.id}/status`, { status: newStatus, note });
      message.success(`Order ${ORDER_STATUS_CONFIG[newStatus]?.label ?? newStatus}`);
      invalidate({ resource: "orders", invalidates: ["detail", "list"], id: record.id });
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const handleUndoDelivery = async (reason: string) => {
    setUpdating(true);
    try {
      await axiosInstance.post(`/orders/${record.id}/undo-delivery`, { reason });
      message.success("Delivery undone");
      invalidate({ resource: "orders", invalidates: ["detail", "list"], id: record.id });
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to undo delivery");
    } finally {
      setUpdating(false);
    }
  };

  const handlePaymentStatusChange = async () => {
    if (!selectedPaymentStatus) return;
    setUpdatingPayment(true);
    try {
      await axiosInstance.patch(`/orders/${record.id}/payment-status`, {
        paymentStatus: selectedPaymentStatus,
        ...(paymentNote.trim() ? { note: paymentNote.trim() } : {}),
      });
      message.success(`Payment status updated to ${PAYMENT_STATUS_CONFIG[selectedPaymentStatus]?.label ?? selectedPaymentStatus}`);
      invalidate({ resource: "orders", invalidates: ["detail", "list"], id: record.id });
      setSelectedPaymentStatus(null);
      setPaymentNote("");
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to update payment status");
    } finally {
      setUpdatingPayment(false);
    }
  };

  return (
    <Show>
      <ReadableSection>
        <Row gutter={[16, 16]}>
          {/* Status Actions */}
          {transitions.length > 0 && (
            <Col xs={24}>
              <Card size="small">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Space>
                    <span style={{ color: "#64748b", fontSize: 14 }}>Current:</span>
                    <Tag color={statusConfig.color} style={{ fontSize: 14, padding: "2px 12px" }}>
                      {statusConfig.label}
                    </Tag>
                  </Space>
                  <Space>
                    {forwardTransition && (
                      <ConfirmFinalStep
                        status={forwardTransition}
                        label={forwardLabel || ""}
                        order={{
                          id: String(record.id),
                          totalAmount: record.totalAmount,
                          paymentMethod: record.paymentMethod,
                          paymentStatus: record.paymentStatus,
                          walletAmountUsed: record.walletAmountUsed,
                          loyaltyPointsUsed: record.loyaltyPointsUsed,
                        }}
                        onConfirm={() => (forwardTransition === "OUT_FOR_DELIVERY" ? setPickingRider(true) : handleStatusChange(forwardTransition))}
                      >
                        {(onClick) => (
                          <Button
                            type="primary"
                            icon={NEXT_ACTION[forwardTransition]?.icon}
                            loading={updating}
                            onClick={onClick}
                            style={{ backgroundColor: NEXT_ACTION[forwardTransition]?.color, borderColor: NEXT_ACTION[forwardTransition]?.color }}
                          >
                            {forwardLabel}
                          </Button>
                        )}
                      </ConfirmFinalStep>
                    )}
                    {riderless && <Button icon={NEXT_ACTION.OUT_FOR_DELIVERY?.icon} onClick={() => setPickingRider(true)}>Assign rider</Button>}
                    {canCancel && (
                      <ReasonConfirmButton preset={CANCEL_ORDER} loading={updating} onConfirm={(reason) => handleStatusChange("CANCELLED", reason)} />
                    )}
                  </Space>
                </div>
              </Card>
            </Col>
          )}

          {/* Undo a delivery marked by mistake (within 2 hours) */}
          {canUndoDelivery(identity, { status: record.status, statusLogs: record.statusLogs ?? [] }) && (
            <Col xs={24}>
              <Card size="small">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Space>
                    <Tag color={statusConfig.color} style={{ fontSize: 14, padding: "2px 12px" }}>{statusConfig.label}</Tag>
                    <span style={{ color: "#64748b", fontSize: 13 }}>Marked by mistake? You can undo it for 2 hours.</span>
                  </Space>
                  <ReasonConfirmButton preset={UNDO_DELIVERY} loading={updating} onConfirm={handleUndoDelivery} />
                </div>
              </Card>
            </Col>
          )}

          {/* Payment Status Actions */}
          {canSetPayment && record.paymentStatus !== "REFUNDED" && (
            <Col xs={24}>
              <Card size="small">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <Space wrap>
                    <DollarOutlined style={{ color: "#64748b", fontSize: 16 }} />
                    <span style={{ color: "#64748b", fontSize: 14 }}>Payment:</span>
                    <Tag color={paymentConfig.color} style={{ fontSize: 14, padding: "2px 12px" }}>
                      {paymentConfig.label}
                    </Tag>
                    {record.paymentMethod === "COD" && record.paymentStatus === "PENDING" && (
                      <Tag color="warning" style={{ fontSize: 12 }}>COD — Not yet collected</Tag>
                    )}
                  </Space>
                  <Space wrap>
                    <Select
                      placeholder="Change status"
                      value={selectedPaymentStatus}
                      onChange={setSelectedPaymentStatus}
                      style={{ width: 150 }}
                      options={[
                        { label: "Pending", value: "PENDING" },
                        { label: "Paid", value: "PAID" },
                        { label: "Failed", value: "FAILED" },
                      ].filter((o) => o.value !== record.paymentStatus)}
                    />
                    <Input
                      placeholder="Note (optional)"
                      value={paymentNote}
                      onChange={(e) => setPaymentNote(e.target.value)}
                      style={{ width: 200 }}
                    />
                    <Button
                      type="primary"
                      icon={<DollarOutlined />}
                      loading={updatingPayment}
                      disabled={!selectedPaymentStatus}
                      onClick={handlePaymentStatusChange}
                      style={
                        selectedPaymentStatus === "PAID"
                          ? { backgroundColor: "#22c55e", borderColor: "#22c55e" }
                          : selectedPaymentStatus === "FAILED"
                          ? { backgroundColor: "#ef4444", borderColor: "#ef4444" }
                          : {}
                      }
                    >
                      {record.paymentMethod === "COD" && selectedPaymentStatus === "PAID"
                        ? "Mark Collected"
                        : "Update Payment"}
                    </Button>
                  </Space>
                </div>
              </Card>
            </Col>
          )}

          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<FileTextOutlined />, "Order Summary")} size="small">
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Order ID">{record.id}</Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Fulfillment">
                  <Tag color={fulfillmentConfig.color}>{fulfillmentConfig.label}</Tag>
                </Descriptions.Item>
                {record.scheduledDate && record.slotStartTime && (
                  <Descriptions.Item label="Scheduled Slot">
                    <Tag color="purple" icon={<ClockCircleOutlined />}>
                      {new Date(record.scheduledDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                      {" "}
                      {record.slotStartTime} – {record.slotEndTime}
                    </Tag>
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Total Amount">₹{Number(record.totalAmount).toFixed(0)}</Descriptions.Item>
                {record.couponCode && (
                  <Descriptions.Item label="Coupon">
                    <Tag color="green">{record.couponCode}</Tag> −₹{Number(record.couponDiscount ?? 0).toFixed(0)}
                  </Descriptions.Item>
                )}
                {record.deliveryFee && Number(record.deliveryFee) > 0 && (
                  <Descriptions.Item label="Delivery Fee">₹{Number(record.deliveryFee).toFixed(0)}</Descriptions.Item>
                )}
                {record.loyaltyPointsUsed != null && record.loyaltyPointsUsed > 0 && (
                  <Descriptions.Item label="Loyalty Points Used">
                    <Tag color="gold"><StarOutlined /> {record.loyaltyPointsUsed} pts (−₹{record.loyaltyPointsUsed})</Tag>
                  </Descriptions.Item>
                )}
                {record.loyaltyPointsEarned != null && record.loyaltyPointsEarned > 0 && (
                  <Descriptions.Item label="Loyalty Points Earned">
                    <Tag color="green"><StarOutlined /> +{record.loyaltyPointsEarned} pts</Tag>
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Created">
                  {record.createdAt ? new Date(record.createdAt).toLocaleString() : "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Last Updated">
                  {record.updatedAt ? new Date(record.updatedAt).toLocaleString() : "—"}
                </Descriptions.Item>
                <Descriptions.Item label="Return Request">
                  {record.returnRequest ? (
                    <Space>
                      <Tag color={RETURN_REQUEST_STATUS_CONFIG[record.returnRequest.status]?.color ?? "default"}>
                        {RETURN_REQUEST_STATUS_CONFIG[record.returnRequest.status]?.label ?? record.returnRequest.status}
                      </Tag>
                      <ReturnOutcome request={record.returnRequest} />
                      <Button type="link" size="small" onClick={() => window.location.href = `/return-requests/show/${record.returnRequest.id}`}>
                        View Details
                      </Button>
                    </Space>
                  ) : "\u2014"}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<CreditCardOutlined />, "Payment & Delivery")} size="small">
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Payment Method">
                  <Tag color={record.paymentMethod === "COD" ? "orange" : "blue"}>
                    {record.paymentMethod === "COD" ? "Cash on Delivery" : "Online"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Payment Status">
                  <Tag color={paymentConfig.color}>{paymentConfig.label}</Tag>
                </Descriptions.Item>
                {record.razorpayPaymentId && (
                  <Descriptions.Item label="Razorpay Payment ID">
                    {record.razorpayPaymentId}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label={isPickup ? "Pickup Location" : "Delivery Address"}>
                  {record.deliveryAddress ?? "—"}
                </Descriptions.Item>
                {record.deliveryNotes && (
                  <Descriptions.Item label={isPickup ? "Pickup Notes" : "Delivery Notes"}>
                    {record.deliveryNotes}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          </Col>

          <Col xs={24}>
            <Card title={sectionTitle(<ShoppingOutlined />, "Items")} size="small">
              <Table<OrderItem>
                dataSource={record.items ?? []}
                rowKey="id"
                pagination={false}
                size="small"
                columns={[
                  {
                    title: "Product",
                    key: "product",
                    render: (_, item) => <>{item.product?.name ?? item.productId}<ItemFlags item={item} /></>,
                  },
                  {
                    title: "Variant",
                    key: "variant",
                    render: (_, item) => {
                      return item.variant?.name ?? "—";
                    },
                  },
                  {
                    title: "Qty",
                    dataIndex: "quantity",
                    key: "quantity",
                    width: 130,
                    render: (v: number, item: OrderItem) => (
                      <>{v}{item.freeQuantity > 0 && <Tag color="teal" style={{ marginInlineStart: 6 }}>{item.freeQuantity} free</Tag>}</>
                    ),
                  },
                  {
                    title: "Unit Price",
                    dataIndex: "unitPrice",
                    key: "unitPrice",
                    width: 120,
                    render: (v: number) => `₹${Number(v).toFixed(0)}`,
                  },
                  {
                    title: "Total",
                    dataIndex: "totalPrice",
                    key: "totalPrice",
                    width: 120,
                    render: (v: number) => `₹${Number(v).toFixed(0)}`,
                  },
                ]}
                summary={() => {
                  const itemsSubtotal = (record.items ?? []).reduce((sum: number, i: OrderItem) => sum + Number(i.totalPrice), 0);
                  const couponDiscount = Number(record.couponDiscount ?? 0);
                  const deliveryFee = Number(record.deliveryFee ?? 0);
                  return (
                    <>
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={3} />
                        <Table.Summary.Cell index={1}>Items Subtotal</Table.Summary.Cell>
                        <Table.Summary.Cell index={2}>₹{itemsSubtotal.toFixed(0)}</Table.Summary.Cell>
                      </Table.Summary.Row>
                      {couponDiscount > 0 && (
                        <Table.Summary.Row>
                          <Table.Summary.Cell index={0} colSpan={3} />
                          <Table.Summary.Cell index={1}>
                            <span style={{ color: "#22c55e" }}>Coupon ({record.couponCode})</span>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={2}>
                            <span style={{ color: "#22c55e" }}>−₹{couponDiscount.toFixed(0)}</span>
                          </Table.Summary.Cell>
                        </Table.Summary.Row>
                      )}
                      {deliveryFee > 0 && (
                        <Table.Summary.Row>
                          <Table.Summary.Cell index={0} colSpan={3} />
                          <Table.Summary.Cell index={1}>Delivery Fee</Table.Summary.Cell>
                          <Table.Summary.Cell index={2}>₹{deliveryFee.toFixed(0)}</Table.Summary.Cell>
                        </Table.Summary.Row>
                      )}
                      {record.walletAmountUsed && Number(record.walletAmountUsed) > 0 && (
                        <Table.Summary.Row>
                          <Table.Summary.Cell index={0} colSpan={3} />
                          <Table.Summary.Cell index={1}>
                            <span style={{ color: "#22c55e" }}>Wallet</span>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={2}>
                            <span style={{ color: "#22c55e" }}>−₹{Number(record.walletAmountUsed).toFixed(0)}</span>
                          </Table.Summary.Cell>
                        </Table.Summary.Row>
                      )}
                      <RefusedSummaryRow amount={Number(record.refusedAmount)} />
                      {record.loyaltyPointsUsed != null && record.loyaltyPointsUsed > 0 && (
                        <Table.Summary.Row>
                          <Table.Summary.Cell index={0} colSpan={3} />
                          <Table.Summary.Cell index={1}>
                            <span style={{ color: "#d97706" }}>Loyalty ({record.loyaltyPointsUsed} pts)</span>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={2}>
                            <span style={{ color: "#d97706" }}>−₹{record.loyaltyPointsUsed}</span>
                          </Table.Summary.Cell>
                        </Table.Summary.Row>
                      )}
                      <Table.Summary.Row>
                        <Table.Summary.Cell index={0} colSpan={3} />
                        <Table.Summary.Cell index={1}><strong>Order Total</strong></Table.Summary.Cell>
                        <Table.Summary.Cell index={2}><strong>₹{Number(record.totalAmount).toFixed(0)}</strong></Table.Summary.Cell>
                      </Table.Summary.Row>
                    </>
                  );
                }}
              />
            </Card>
          </Col>

          {/* Status Timeline */}
          {record.statusLogs && record.statusLogs.length > 0 && (
            <Col xs={24}>
              <Card title={sectionTitle(<FileTextOutlined />, "Status History")} size="small">
                <Table
                  dataSource={record.statusLogs}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  columns={[
                    {
                      title: "Status",
                      dataIndex: "status",
                      key: "status",
                      width: 180,
                      render: (s: string) => {
                        const cfg = ORDER_STATUS_CONFIG[s] ?? { color: "default", label: s };
                        return <Tag color={cfg.color}>{cfg.label}</Tag>;
                      },
                    },
                    {
                      title: "Note",
                      dataIndex: "note",
                      key: "note",
                      render: (v: string | null) => v ?? "—",
                    },
                    {
                      title: "Time",
                      dataIndex: "createdAt",
                      key: "createdAt",
                      width: 200,
                      render: (v: string) => new Date(v).toLocaleString(),
                    },
                  ]}
                />
              </Card>
            </Col>
          )}
        </Row>
        <RiderAssignModal
          open={pickingRider}
          storeId={record.storeId}
          orderIds={[String(record.id)]}
          start
          onClose={() => setPickingRider(false)}
          onDone={() => {
            setPickingRider(false);
            invalidate({ resource: "orders", invalidates: ["detail", "list"], id: record.id });
          }}
        />
      </ReadableSection>
    </Show>
  );
};
