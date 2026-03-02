import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Card,
  Table,
  Tabs,
  Select,
  DatePicker,
  Button,
  Tag,
  Space,
  Row,
  Col,
  Spin,
  message,
  Badge,
  Popconfirm,
  Modal,
  Progress,
  Collapse,
  theme as antTheme,
} from "antd";
import {
  LeftOutlined,
  RightOutlined,
  ThunderboltOutlined,
  CalendarOutlined,
  ShopOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  InboxOutlined,
  CheckCircleOutlined,
  CarOutlined,
  PhoneOutlined,
  UserOutlined,
  WarningOutlined,
  PlayCircleOutlined,
  StopOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

import { axiosInstance } from "../../providers/data-provider";
import { useOrderWebSocket } from "../../hooks/useOrderWebSocket";
import { ORDER_STATUS_CONFIG, TRIP_STATUS_CONFIG } from "../../constants/tag-colors";
import { DELIVERY_TRANSITIONS, PICKUP_TRANSITIONS, NEXT_ACTION } from "../../constants/order-transitions";
import { BRAND } from "../../theme";

/* ── Types ─────────────────────────────────────────────── */

interface BoardOrder {
  id: string;
  status: string;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  fulfillmentType: string;
  deliveryAddress: string | null;
  deliveryPincode: string | null;
  deliveryDistance: number | null;
  deliverySlotId: string | null;
  deliveryTripId: string | null;
  slotStartTime: string | null;
  slotEndTime: string | null;
  estimatedDeliveryAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
  items: { product: { name: string }; quantity: number }[];
  deliveryTrip: {
    id: string;
    status: string;
    rider: { id: string; name: string; phone: string | null };
  } | null;
}

interface SlotGroup {
  slotId: string;
  startTime: string;
  endTime: string;
  maxOrders: number;
  orders: BoardOrder[];
}

interface StatusCounts {
  total: number;
  pending: number;
  confirmed: number;
  preparing: number;
  ready: number;
  outForDelivery: number;
  delivered: number;
  cancelled: number;
}

interface BoardData {
  date: string;
  summary: {
    total: number;
    express: StatusCounts;
    scheduled: StatusCounts;
    pickup: StatusCounts;
  };
  express: BoardOrder[];
  scheduled: Record<string, SlotGroup>;
  pickup: BoardOrder[];
}

interface TripOrder {
  id: string;
  status: string;
  totalAmount: number;
  deliveryAddress: string | null;
  deliveryPincode: string | null;
  createdAt: string;
  user: { id: string; name: string };
  items: { product: { name: string }; quantity: number }[];
}

interface Trip {
  id: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  rider: { id: string; name: string; phone: string | null };
  orders: TripOrder[];
}

interface Rider {
  id: string;
  name: string;
  phone: string | null;
  email: string;
}

/* ── Helpers ───────────────────────────────────────────── */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function elapsedMinutes(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
}

function getNextStatus(order: BoardOrder): string | null {
  const isPickup = order.fulfillmentType === "PICKUP";
  const transitions = isPickup ? PICKUP_TRANSITIONS : DELIVERY_TRANSITIONS;
  const allowed = transitions[order.status] ?? [];
  return allowed.find((t) => t !== "CANCELLED") ?? null;
}

/* ── Main Component ────────────────────────────────────── */

export const DeliveryBoard = () => {
  const { token } = antTheme.useToken();
  const navigate = useNavigate();

  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [date, setDate] = useState(dayjs());
  const [data, setData] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("express");
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<string | null>(null);

  // Trip state
  const [trips, setTrips] = useState<Trip[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [createTripModalOpen, setCreateTripModalOpen] = useState(false);
  const [selectedRider, setSelectedRider] = useState<string | null>(null);
  const [creatingTrip, setCreatingTrip] = useState(false);
  const [tripActionLoading, setTripActionLoading] = useState<string | null>(null);

  // Fetch stores on mount
  useEffect(() => {
    axiosInstance.get("/stores?pageSize=100").then((res) => {
      const list = res?.data?.data ?? [];
      setStores(list);
      if (list.length > 0 && !storeId) {
        setStoreId(list[0].id);
      }
    });
  }, []);

  // Fetch riders when store changes
  useEffect(() => {
    if (!storeId) return;
    axiosInstance
      .get(`/delivery-trips/riders?storeId=${storeId}`)
      .then((res) => setRiders(res?.data?.data ?? []))
      .catch(() => setRiders([]));
  }, [storeId]);

  // Fetch board data
  const fetchBoard = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const dateStr = date.format("YYYY-MM-DD");
      const [boardRes, tripsRes] = await Promise.all([
        axiosInstance.get(`/orders/delivery-board?storeId=${storeId}&date=${dateStr}`),
        axiosInstance.get(`/delivery-trips?storeId=${storeId}&date=${dateStr}`),
      ]);
      setData(boardRes?.data?.data ?? null);
      setTrips(tripsRes?.data?.data ?? []);
    } catch {
      message.error("Failed to load delivery board");
    } finally {
      setLoading(false);
    }
  }, [storeId, date]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  // Real-time refresh
  useOrderWebSocket({
    onOrdersChanged: useCallback(() => {
      fetchBoard();
    }, [fetchBoard]),
  });

  // Clear selection on tab/date/store change
  useEffect(() => {
    setSelectedRowKeys([]);
    setActiveSlot(null);
  }, [activeTab, date, storeId]);

  /* ── Quick Action (single order) ─────────────────────── */

  const handleQuickAction = async (order: BoardOrder) => {
    const nextStatus = getNextStatus(order);
    if (!nextStatus) return;
    setUpdatingOrderId(order.id);
    try {
      await axiosInstance.patch(`/orders/${order.id}/status`, { status: nextStatus });
      message.success(`Order ${ORDER_STATUS_CONFIG[nextStatus]?.label ?? nextStatus}`);
      fetchBoard();
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to update order");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    setUpdatingOrderId(orderId);
    try {
      await axiosInstance.patch(`/orders/${orderId}/status`, { status: "CANCELLED" });
      message.success("Order cancelled");
      fetchBoard();
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to cancel order");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  /* ── Bulk Action ─────────────────────────────────────── */

  const handleBulkAction = async (targetStatus: string) => {
    if (selectedRowKeys.length === 0) return;
    setBulkUpdating(true);
    try {
      const res = await axiosInstance.post("/orders/bulk-status", {
        orderIds: selectedRowKeys,
        status: targetStatus,
      });
      const result = res?.data?.data;
      if (result?.updated > 0) {
        message.success(`${result.updated} order${result.updated > 1 ? "s" : ""} updated`);
      }
      if (result?.skipped > 0) {
        message.warning(`${result.skipped} order${result.skipped > 1 ? "s" : ""} skipped`);
      }
      setSelectedRowKeys([]);
      fetchBoard();
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Bulk update failed");
    } finally {
      setBulkUpdating(false);
    }
  };

  /* ── Trip Actions ────────────────────────────────────── */

  const handleCreateTrip = async () => {
    if (!selectedRider || selectedRowKeys.length === 0 || !storeId) return;
    setCreatingTrip(true);
    try {
      await axiosInstance.post("/delivery-trips", {
        storeId,
        riderId: selectedRider,
        orderIds: selectedRowKeys,
      });
      message.success("Trip created");
      setCreateTripModalOpen(false);
      setSelectedRider(null);
      setSelectedRowKeys([]);
      fetchBoard();
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to create trip");
    } finally {
      setCreatingTrip(false);
    }
  };

  const handleStartTrip = async (tripId: string) => {
    setTripActionLoading(tripId);
    try {
      await axiosInstance.patch(`/delivery-trips/${tripId}/start`);
      message.success("Trip started — orders are out for delivery");
      fetchBoard();
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to start trip");
    } finally {
      setTripActionLoading(null);
    }
  };

  const handleCancelTrip = async (tripId: string) => {
    setTripActionLoading(tripId);
    try {
      await axiosInstance.patch(`/delivery-trips/${tripId}/cancel`);
      message.success("Trip cancelled — orders returned to pool");
      fetchBoard();
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to cancel trip");
    } finally {
      setTripActionLoading(null);
    }
  };

  /* ── Compute valid bulk actions from selection ───────── */

  const allOrders = useMemo(() => {
    if (!data) return [];
    const scheduled = Object.values(data.scheduled).flatMap((s) => s.orders);
    return [...data.express, ...scheduled, ...data.pickup];
  }, [data]);

  const bulkActions = useMemo(() => {
    if (selectedRowKeys.length === 0) return [];
    const selectedOrders = allOrders.filter((o) => selectedRowKeys.includes(o.id));
    const nextStatuses = selectedOrders.map((o) => {
      const isPickup = o.fulfillmentType === "PICKUP";
      const transitions = isPickup ? PICKUP_TRANSITIONS : DELIVERY_TRANSITIONS;
      return new Set(transitions[o.status] ?? []);
    });
    if (nextStatuses.length === 0) return [];
    const common = [...nextStatuses[0]].filter((s) =>
      nextStatuses.every((set) => set.has(s)),
    );
    return common.filter((s) => s !== "CANCELLED");
  }, [selectedRowKeys, allOrders]);

  /* ── Express tab data splits ─────────────────────────── */

  const expressUnassigned = useMemo(
    () => (data?.express ?? []).filter((o) => o.status === "READY" && !o.deliveryTripId),
    [data],
  );

  const expressPipeline = useMemo(
    () =>
      (data?.express ?? []).filter(
        (o) => ["PENDING", "CONFIRMED", "PREPARING"].includes(o.status),
      ),
    [data],
  );

  const activeTrips = useMemo(
    () => trips.filter((t) => t.status === "CREATED" || t.status === "IN_PROGRESS"),
    [trips],
  );

  const completedTrips = useMemo(
    () => trips.filter((t) => t.status === "COMPLETED" || t.status === "CANCELLED"),
    [trips],
  );

  /* ── Unassigned orders grouped by pincode ────────────── */

  const unassignedByPincode = useMemo(() => {
    const groups: Record<string, BoardOrder[]> = {};
    for (const order of expressUnassigned) {
      const pin = order.deliveryPincode ?? "Unknown";
      if (!groups[pin]) groups[pin] = [];
      groups[pin].push(order);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [expressUnassigned]);

  /* ── Shared Table Columns ────────────────────────────── */

  const baseColumns = (showAddress: boolean) => [
    {
      title: "Order",
      dataIndex: "id",
      key: "id",
      width: 100,
      render: (id: string) => (
        <a
          onClick={() => navigate(`/orders/show/${id}`)}
          style={{ fontFamily: "monospace", fontSize: 12, cursor: "pointer" }}
        >
          {id.slice(0, 8)}
        </a>
      ),
    },
    {
      title: "Customer",
      key: "customer",
      width: 160,
      ellipsis: true,
      render: (_: unknown, rec: BoardOrder) => (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{rec.user?.name ?? "\u2014"}</div>
          <div style={{ fontSize: 11, color: token.colorTextQuaternary }}>{rec.user?.email}</div>
        </div>
      ),
    },
    ...(showAddress
      ? [
          {
            title: "Address",
            key: "address",
            ellipsis: true,
            render: (_: unknown, rec: BoardOrder) => (
              <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
                {rec.deliveryAddress ?? "\u2014"}
                {rec.deliveryPincode ? ` (${rec.deliveryPincode})` : ""}
              </span>
            ),
          },
        ]
      : []),
    {
      title: "Items",
      key: "items",
      width: 60,
      align: "center" as const,
      render: (_: unknown, rec: BoardOrder) => {
        const count = rec.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
        return <span style={{ fontVariantNumeric: "tabular-nums" }}>{count}</span>;
      },
    },
    {
      title: "Amount",
      dataIndex: "totalAmount",
      key: "amount",
      width: 90,
      align: "right" as const,
      render: (v: number) => (
        <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {"\u20B9"}{Number(v).toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      title: "Payment",
      key: "payment",
      width: 80,
      render: (_: unknown, rec: BoardOrder) => (
        <Tag color={rec.paymentMethod === "COD" ? "orange" : "blue"} style={{ fontSize: 11 }}>
          {rec.paymentMethod === "COD" ? "COD" : "Online"}
        </Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (status: string) => {
        const cfg = ORDER_STATUS_CONFIG[status];
        return <Tag color={cfg?.color ?? "default"}>{cfg?.label ?? status}</Tag>;
      },
    },
    {
      title: "Time",
      dataIndex: "createdAt",
      key: "time",
      width: 80,
      render: (v: string) => (
        <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{timeAgo(v)}</span>
      ),
    },
    {
      title: "Action",
      key: "action",
      width: 160,
      render: (_: unknown, rec: BoardOrder) => {
        const next = getNextStatus(rec);
        if (!next) return null;
        const action = NEXT_ACTION[next];
        if (!action) return null;
        const isPickup = rec.fulfillmentType === "PICKUP";
        const label = (isPickup && action.pickupLabel) || action.label;
        const canCancel = (isPickup ? PICKUP_TRANSITIONS : DELIVERY_TRANSITIONS)[rec.status]?.includes("CANCELLED");
        return (
          <Space size={4}>
            <Button
              type="primary"
              size="small"
              icon={action.icon}
              loading={updatingOrderId === rec.id}
              onClick={() => handleQuickAction(rec)}
              style={{ backgroundColor: action.color, borderColor: action.color, fontSize: 12 }}
            >
              {label}
            </Button>
            {canCancel && (
              <Popconfirm
                title="Cancel this order?"
                onConfirm={() => handleCancelOrder(rec.id)}
                okText="Yes"
                cancelText="No"
                okButtonProps={{ danger: true }}
              >
                <Button
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  loading={updatingOrderId === rec.id}
                />
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  const expressColumns = baseColumns(true);
  const pickupColumns = baseColumns(false);

  // Compact columns for pipeline table (no action column)
  const pipelineColumns = baseColumns(true).filter((c) => c.key !== "action");

  /* ── Row selection config ────────────────────────────── */

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys as string[]),
    getCheckboxProps: (rec: BoardOrder) => ({
      disabled: rec.status === "DELIVERED" || rec.status === "CANCELLED",
    }),
  };

  const unassignedRowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys as string[]),
  };

  /* ── KPI Cards ───────────────────────────────────────── */

  const kpiCards = [
    {
      label: "Total Orders",
      count: data?.summary.total ?? 0,
      color: BRAND.primary,
      sub: null as StatusCounts | null,
    },
    {
      label: "Express",
      count: data?.summary.express.total ?? 0,
      color: "#f59e0b",
      sub: data?.summary.express ?? null,
    },
    {
      label: "Scheduled",
      count: data?.summary.scheduled.total ?? 0,
      color: "#6366f1",
      sub: data?.summary.scheduled ?? null,
    },
    {
      label: "Pickups",
      count: data?.summary.pickup.total ?? 0,
      color: "#22c55e",
      sub: data?.summary.pickup ?? null,
    },
  ];

  function StatusMini({ counts }: { counts: StatusCounts | null }) {
    if (!counts) return null;
    const items = [
      { label: "Pending", value: counts.pending, color: "#f59e0b" },
      { label: "Preparing", value: counts.preparing, color: "#06b6d4" },
      { label: "Ready", value: counts.ready, color: "#6366f1" },
    ];
    const active = items.filter((i) => i.value > 0);
    if (active.length === 0) return null;
    return (
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        {active.map((i) => (
          <span key={i.label} style={{ fontSize: 11, color: i.color, fontWeight: 600 }}>
            {i.value} {i.label.toLowerCase()}
          </span>
        ))}
      </div>
    );
  }

  /* ── Trip Card Component ─────────────────────────────── */

  function TripCard({ trip }: { trip: Trip }) {
    const delivered = trip.orders.filter((o) => o.status === "DELIVERED").length;
    const cancelled = trip.orders.filter((o) => o.status === "CANCELLED").length;
    const total = trip.orders.length;
    const completed = delivered + cancelled;
    const pct = total > 0 ? Math.round((delivered / total) * 100) : 0;
    const isCreated = trip.status === "CREATED";
    const isInProgress = trip.status === "IN_PROGRESS";
    const isLoading = tripActionLoading === trip.id;
    const mins = trip.startedAt ? elapsedMinutes(trip.startedAt) : 0;
    const isStuck = isInProgress && mins >= 45 && delivered === 0;

    return (
      <Card
        size="small"
        style={{
          borderRadius: 8,
          border: `1px solid ${isStuck ? "#fbbf24" : token.colorBorderSecondary}`,
          background: isStuck ? "#fffbeb" : undefined,
        }}
        styles={{ body: { padding: 12 } }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <UserOutlined style={{ color: token.colorTextSecondary }} />
            <div>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{trip.rider.name}</span>
              {trip.rider.phone && (
                <span style={{ fontSize: 12, color: token.colorTextSecondary, marginLeft: 8 }}>
                  <PhoneOutlined style={{ fontSize: 10, marginRight: 2 }} />
                  {trip.rider.phone}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {isStuck && (
              <Tag color="warning" icon={<WarningOutlined />} style={{ marginRight: 0 }}>
                {mins}min, no deliveries
              </Tag>
            )}
            {isInProgress && !isStuck && (
              <span style={{ fontSize: 11, color: token.colorTextSecondary }}>{mins}min elapsed</span>
            )}
            <Tag color={TRIP_STATUS_CONFIG[trip.status]?.color ?? "default"}>
              {TRIP_STATUS_CONFIG[trip.status]?.label ?? trip.status}
            </Tag>
          </div>
        </div>

        {/* Progress bar */}
        {(isInProgress || trip.status === "COMPLETED") && (
          <Progress
            percent={pct}
            size="small"
            strokeColor={pct === 100 ? "#16a34a" : BRAND.primary}
            format={() => `${delivered}/${total}`}
            style={{ marginBottom: 8 }}
          />
        )}

        {/* Order list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {trip.orders.map((order) => {
            const statusCfg = ORDER_STATUS_CONFIG[order.status];
            const itemCount = order.items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
            return (
              <div
                key={order.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 8px",
                  borderRadius: 6,
                  background: token.colorFillQuaternary,
                  fontSize: 12,
                }}
              >
                <a
                  onClick={() => navigate(`/orders/show/${order.id}`)}
                  style={{ fontFamily: "monospace", cursor: "pointer", flexShrink: 0 }}
                >
                  {order.id.slice(0, 8)}
                </a>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: token.colorTextSecondary }}>
                  {order.user?.name}
                  {order.deliveryPincode ? ` \u2022 ${order.deliveryPincode}` : ""}
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{itemCount} items</span>
                <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                  {"\u20B9"}{Number(order.totalAmount).toLocaleString("en-IN")}
                </span>
                <Tag color={statusCfg?.color ?? "default"} style={{ fontSize: 11, margin: 0 }}>
                  {statusCfg?.label ?? order.status}
                </Tag>
                {/* Individual order action for in-progress trips */}
                {isInProgress && order.status === "OUT_FOR_DELIVERY" && (
                  <Button
                    type="primary"
                    size="small"
                    icon={<CheckCircleOutlined />}
                    loading={updatingOrderId === order.id}
                    onClick={() => {
                      setUpdatingOrderId(order.id);
                      axiosInstance
                        .patch(`/orders/${order.id}/status`, { status: "DELIVERED" })
                        .then(() => {
                          message.success("Order delivered");
                          fetchBoard();
                        })
                        .catch((err: any) => message.error(err?.response?.data?.message ?? "Failed"))
                        .finally(() => setUpdatingOrderId(null));
                    }}
                    style={{ backgroundColor: "#22c55e", borderColor: "#22c55e", fontSize: 11 }}
                  >
                    Delivered
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
          {isCreated && (
            <>
              <Button
                type="primary"
                size="small"
                icon={<PlayCircleOutlined />}
                loading={isLoading}
                onClick={() => handleStartTrip(trip.id)}
                style={{ backgroundColor: "#8b5cf6", borderColor: "#8b5cf6" }}
              >
                Start Trip
              </Button>
              <Popconfirm
                title="Cancel this trip? Orders will return to unassigned pool."
                onConfirm={() => handleCancelTrip(trip.id)}
                okText="Yes"
                cancelText="No"
                okButtonProps={{ danger: true }}
              >
                <Button size="small" danger icon={<StopOutlined />} loading={isLoading}>
                  Cancel Trip
                </Button>
              </Popconfirm>
            </>
          )}
          {isInProgress && (
            <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
              {delivered}/{total} delivered
              {cancelled > 0 ? ` \u2022 ${cancelled} cancelled` : ""}
            </span>
          )}
        </div>
      </Card>
    );
  }

  /* ── Scheduled Tab Content ───────────────────────────── */

  const scheduledSlots = useMemo(() => {
    if (!data?.scheduled) return [];
    return Object.entries(data.scheduled)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, slot]) => ({ key, ...slot }));
  }, [data]);

  const slotStats = useMemo(() => {
    const stats: Record<string, { total: number; delivered: number }> = {};
    for (const slot of scheduledSlots) {
      const delivered = slot.orders.filter((o) => o.status === "DELIVERED").length;
      stats[slot.key] = { total: slot.orders.length, delivered };
    }
    return stats;
  }, [scheduledSlots]);

  const filteredScheduledOrders = useMemo(() => {
    if (!activeSlot) return scheduledSlots.flatMap((s) => s.orders);
    const slot = scheduledSlots.find((s) => s.key === activeSlot);
    return slot?.orders ?? [];
  }, [scheduledSlots, activeSlot]);

  const scheduledUnassigned = useMemo(
    () => filteredScheduledOrders.filter((o) => o.status === "READY" && !o.deliveryTripId),
    [filteredScheduledOrders],
  );

  // Check if all selected orders are READY + unassigned (for create trip button)
  const canCreateTrip = useMemo(() => {
    if (selectedRowKeys.length === 0) return false;
    if (activeTab === "express") {
      return selectedRowKeys.every((id) => expressUnassigned.some((o) => o.id === id));
    }
    if (activeTab === "scheduled") {
      return selectedRowKeys.every((id) => scheduledUnassigned.some((o) => o.id === id));
    }
    return false;
  }, [activeTab, selectedRowKeys, expressUnassigned, scheduledUnassigned]);

  const isToday = date.isSame(dayjs(), "day");

  /* ── Express Tab Content ─────────────────────────────── */

  const renderExpressTab = () => (
    <div style={{ padding: 0 }}>
      {/* Section 1: Unassigned Orders */}
      <div style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
        <div style={{ padding: "12px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ThunderboltOutlined style={{ color: "#f59e0b" }} />
            <span style={{ fontWeight: 600, fontSize: 14, color: token.colorText }}>
              Unassigned
            </span>
            <Badge count={expressUnassigned.length} style={{ backgroundColor: "#f59e0b" }} size="small" />
          </div>
          {canCreateTrip && riders.length > 0 && (
            <Button
              type="primary"
              size="small"
              icon={<CarOutlined />}
              onClick={() => setCreateTripModalOpen(true)}
            >
              Create Trip ({selectedRowKeys.length})
            </Button>
          )}
        </div>

        {expressUnassigned.length > 0 ? (
          unassignedByPincode.length > 1 ? (
            // Group by pincode
            <div>
              {unassignedByPincode.map(([pincode, orders]) => (
                <div key={pincode}>
                  <div style={{ padding: "4px 16px", background: token.colorFillQuaternary, fontSize: 12, fontWeight: 600, color: token.colorTextSecondary }}>
                    Pincode: {pincode} ({orders.length})
                  </div>
                  <Table
                    dataSource={orders}
                    columns={expressColumns}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    showHeader={pincode === unassignedByPincode[0][0]}
                    rowSelection={unassignedRowSelection}
                  />
                </div>
              ))}
            </div>
          ) : (
            <Table
              dataSource={expressUnassigned}
              columns={expressColumns}
              rowKey="id"
              size="small"
              pagination={false}
              rowSelection={unassignedRowSelection}
            />
          )
        ) : (
          <div style={{ padding: 24, textAlign: "center" }}>
            <InboxOutlined style={{ fontSize: 24, color: token.colorTextQuaternary }} />
            <div style={{ marginTop: 4, fontSize: 13, color: token.colorTextSecondary }}>
              No unassigned READY orders
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Active Trips */}
      {activeTrips.length > 0 && (
        <div style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
          <div style={{ padding: "12px 16px 8px", display: "flex", alignItems: "center", gap: 8 }}>
            <CarOutlined style={{ color: "#8b5cf6" }} />
            <span style={{ fontWeight: 600, fontSize: 14, color: token.colorText }}>
              Active Trips
            </span>
            <Badge count={activeTrips.length} style={{ backgroundColor: "#8b5cf6" }} size="small" />
          </div>
          <div style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
            {activeTrips.map((trip) => (
              <TripCard key={trip.id} trip={trip} />
            ))}
          </div>
        </div>
      )}

      {/* Section 3: Pipeline */}
      {expressPipeline.length > 0 && (
        <div style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
          <div style={{ padding: "12px 16px 8px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: token.colorText }}>
              Pipeline
            </span>
            <Badge count={expressPipeline.length} style={{ backgroundColor: "#64748b" }} size="small" />
            <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
              Not yet ready for trips
            </span>
          </div>
          <Table
            dataSource={expressPipeline}
            columns={pipelineColumns}
            rowKey="id"
            size="small"
            pagination={false}
          />
        </div>
      )}

      {/* Section 4: Completed Trips */}
      {completedTrips.length > 0 && (
        <div style={{ padding: "8px 16px 12px" }}>
          <Collapse
            ghost
            items={[
              {
                key: "completed",
                label: (
                  <span style={{ fontSize: 13, fontWeight: 600, color: token.colorTextSecondary }}>
                    Completed Trips ({completedTrips.length})
                  </span>
                ),
                children: (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {completedTrips.map((trip) => {
                      const delivered = trip.orders.filter((o) => o.status === "DELIVERED").length;
                      const total = trip.orders.length;
                      const statusCfg = TRIP_STATUS_CONFIG[trip.status];
                      return (
                        <div
                          key={trip.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "8px 12px",
                            borderRadius: 6,
                            background: token.colorFillQuaternary,
                            fontSize: 13,
                          }}
                        >
                          <UserOutlined style={{ color: token.colorTextSecondary }} />
                          <span style={{ fontWeight: 500 }}>{trip.rider.name}</span>
                          <Tag color={statusCfg?.color ?? "default"} style={{ margin: 0 }}>
                            {statusCfg?.label ?? trip.status}
                          </Tag>
                          <span style={{ color: token.colorTextSecondary, fontVariantNumeric: "tabular-nums" }}>
                            {delivered}/{total} delivered
                          </span>
                          <span style={{ fontSize: 12, color: token.colorTextQuaternary, marginLeft: "auto" }}>
                            {timeAgo(trip.createdAt)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* Empty state when no express orders at all */}
      {expressUnassigned.length === 0 && activeTrips.length === 0 && expressPipeline.length === 0 && completedTrips.length === 0 && (
        <div style={{ padding: 40, textAlign: "center" }}>
          <InboxOutlined style={{ fontSize: 32, color: token.colorTextQuaternary }} />
          <div style={{ marginTop: 8, color: token.colorTextSecondary }}>
            No express orders {isToday ? "today" : "on this date"}
          </div>
        </div>
      )}
    </div>
  );

  /* ── Render ──────────────────────────────────────────── */

  return (
    <div style={{ padding: "0 0 32px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: token.colorText, letterSpacing: -0.3 }}>
          Delivery Board
        </h2>
        <Space size={8} wrap>
          <Select
            placeholder="Select store"
            value={storeId}
            onChange={setStoreId}
            style={{ minWidth: 200 }}
            options={stores.map((s) => ({ label: s.name, value: s.id }))}
            suffixIcon={<ShopOutlined />}
          />
          <Button
            icon={<LeftOutlined />}
            size="middle"
            onClick={() => setDate((d) => d.subtract(1, "day"))}
          />
          <DatePicker
            value={date}
            onChange={(d) => d && setDate(d)}
            allowClear={false}
            format="ddd, DD MMM"
            style={{ width: 150 }}
          />
          <Button
            icon={<RightOutlined />}
            size="middle"
            onClick={() => setDate((d) => d.add(1, "day"))}
          />
          {!isToday && (
            <Button onClick={() => setDate(dayjs())} size="middle">
              Today
            </Button>
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchBoard}
            loading={loading}
          />
        </Space>
      </div>

      <Spin spinning={loading && !data}>
        {/* KPI Cards */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          {kpiCards.map((kpi) => (
            <Col xs={12} sm={6} key={kpi.label}>
              <Card
                style={{
                  borderRadius: 8,
                  overflow: "hidden",
                  position: "relative",
                  border: `1px solid ${token.colorBorderSecondary}`,
                }}
                styles={{ body: { padding: "16px 16px 12px" } }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: kpi.color,
                  }}
                />
                <div style={{ fontSize: 12, color: token.colorTextSecondary, fontWeight: 500, textTransform: "uppercase", letterSpacing: 0.3 }}>
                  {kpi.label}
                </div>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 800,
                    color: token.colorText,
                    lineHeight: 1.2,
                    fontVariantNumeric: "tabular-nums",
                    marginTop: 2,
                  }}
                >
                  {kpi.count}
                </div>
                <StatusMini counts={kpi.sub} />
              </Card>
            </Col>
          ))}
        </Row>

        {/* Bulk Action Bar (for non-express tabs) */}
        {selectedRowKeys.length > 0 && !canCreateTrip && activeTab !== "express" && (
          <Card
            size="small"
            style={{
              marginBottom: 12,
              borderColor: BRAND.primary,
              background: `${BRAND.primary}08`,
              borderRadius: 8,
            }}
            styles={{ body: { padding: "8px 16px" } }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <Badge
                count={selectedRowKeys.length}
                style={{ backgroundColor: BRAND.primary }}
              />
              <span style={{ fontWeight: 600, fontSize: 13, color: token.colorText }}>
                {selectedRowKeys.length} order{selectedRowKeys.length > 1 ? "s" : ""} selected
              </span>
              <div style={{ flex: 1 }} />
              {bulkActions.map((status) => {
                const action = NEXT_ACTION[status];
                if (!action) return null;
                return (
                  <Button
                    key={status}
                    type="primary"
                    size="small"
                    icon={action.icon}
                    loading={bulkUpdating}
                    onClick={() => handleBulkAction(status)}
                    style={{ backgroundColor: action.color, borderColor: action.color }}
                  >
                    {action.label}
                  </Button>
                );
              })}
              <Button size="small" onClick={() => setSelectedRowKeys([])}>
                Clear
              </Button>
            </div>
          </Card>
        )}

        {/* Tabs */}
        <Card styles={{ body: { padding: 0 } }} style={{ borderRadius: 8 }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            style={{ margin: 0 }}
            tabBarStyle={{ padding: "0 16px", marginBottom: 0 }}
            items={[
              {
                key: "express",
                label: (
                  <Space size={6}>
                    <ThunderboltOutlined style={{ color: "#f59e0b" }} />
                    Express
                    <Badge
                      count={data?.summary.express.total ?? 0}
                      style={{ backgroundColor: "#f59e0b" }}
                      size="small"
                    />
                  </Space>
                ),
                children: renderExpressTab(),
              },
              {
                key: "scheduled",
                label: (
                  <Space size={6}>
                    <CalendarOutlined style={{ color: "#6366f1" }} />
                    Scheduled
                    <Badge
                      count={data?.summary.scheduled.total ?? 0}
                      style={{ backgroundColor: "#6366f1" }}
                      size="small"
                    />
                  </Space>
                ),
                children: (
                  <div>
                    {/* Slot pill navigation */}
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        padding: "12px 16px",
                        overflowX: "auto",
                        borderBottom: `1px solid ${token.colorBorderSecondary}`,
                      }}
                    >
                      {/* "All" pill */}
                      <div
                        onClick={() => { setActiveSlot(null); setSelectedRowKeys([]); }}
                        style={{
                          flexShrink: 0,
                          cursor: "pointer",
                          padding: "8px 16px",
                          borderRadius: 8,
                          border: `1.5px solid ${activeSlot === null ? BRAND.primary : token.colorBorderSecondary}`,
                          background: activeSlot === null ? `${BRAND.primary}0a` : token.colorBgContainer,
                          transition: "all 0.15s",
                          textAlign: "center",
                          minWidth: 56,
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600, color: activeSlot === null ? BRAND.primary : token.colorText }}>
                          All
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: activeSlot === null ? BRAND.primary : token.colorText, lineHeight: 1.3, fontVariantNumeric: "tabular-nums" }}>
                          {data?.summary.scheduled.total ?? 0}
                        </div>
                      </div>

                      {scheduledSlots.map((slot) => {
                        const stats = slotStats[slot.key] ?? { total: 0, delivered: 0 };
                        const isSelected = activeSlot === slot.key;
                        const isEmpty = stats.total === 0;
                        const allDelivered = stats.total > 0 && stats.delivered === stats.total;
                        const atCapacity = stats.total >= slot.maxOrders;

                        return (
                          <div
                            key={slot.key}
                            onClick={() => { setActiveSlot(slot.key); setSelectedRowKeys([]); }}
                            style={{
                              flexShrink: 0,
                              cursor: "pointer",
                              padding: "8px 14px",
                              borderRadius: 8,
                              border: `1.5px solid ${isSelected ? BRAND.primary : allDelivered ? "#16a34a" : token.colorBorderSecondary}`,
                              background: isSelected
                                ? `${BRAND.primary}0a`
                                : allDelivered
                                  ? "#f0fdf4"
                                  : token.colorBgContainer,
                              opacity: isEmpty ? 0.5 : 1,
                              transition: "all 0.15s",
                              textAlign: "center",
                              minWidth: 80,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 2 }}>
                              <span style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: isSelected ? BRAND.primary : token.colorText,
                              }}>
                                {slot.startTime}{"\u2013"}{slot.endTime}
                              </span>
                              {allDelivered && (
                                <CheckCircleOutlined style={{ color: "#16a34a", fontSize: 12 }} />
                              )}
                            </div>
                            {stats.total > 0 && (
                              <>
                                <div style={{
                                  fontSize: 11,
                                  color: atCapacity ? "#ef4444" : token.colorTextSecondary,
                                  fontWeight: atCapacity ? 600 : 400,
                                  fontVariantNumeric: "tabular-nums",
                                }}>
                                  {stats.total}/{slot.maxOrders} orders
                                </div>
                                <div style={{
                                  fontSize: 11,
                                  color: allDelivered ? "#16a34a" : token.colorTextQuaternary,
                                  fontVariantNumeric: "tabular-nums",
                                  marginTop: 1,
                                }}>
                                  {stats.delivered}/{stats.total} delivered
                                </div>
                              </>
                            )}
                            {isEmpty && (
                              <div style={{ fontSize: 11, color: token.colorTextQuaternary }}>
                                0/{slot.maxOrders}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Unassigned READY orders */}
                    {scheduledUnassigned.length > 0 && (
                      <div style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                        <div style={{ padding: "12px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <CalendarOutlined style={{ color: "#6366f1" }} />
                            <span style={{ fontWeight: 600, fontSize: 14, color: token.colorText }}>
                              Ready for Trip
                            </span>
                            <Badge count={scheduledUnassigned.length} style={{ backgroundColor: "#6366f1" }} size="small" />
                          </div>
                          {canCreateTrip && riders.length > 0 && (
                            <Button
                              type="primary"
                              size="small"
                              icon={<CarOutlined />}
                              onClick={() => setCreateTripModalOpen(true)}
                            >
                              Create Trip ({selectedRowKeys.length})
                            </Button>
                          )}
                        </div>
                        <Table
                          dataSource={scheduledUnassigned}
                          columns={expressColumns}
                          rowKey="id"
                          size="small"
                          pagination={false}
                          rowSelection={unassignedRowSelection}
                        />
                      </div>
                    )}

                    {/* Active trips for scheduled orders */}
                    {activeTrips.length > 0 && (
                      <div style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                        <div style={{ padding: "12px 16px 8px", display: "flex", alignItems: "center", gap: 8 }}>
                          <CarOutlined style={{ color: "#8b5cf6" }} />
                          <span style={{ fontWeight: 600, fontSize: 14, color: token.colorText }}>
                            Active Trips
                          </span>
                          <Badge count={activeTrips.length} style={{ backgroundColor: "#8b5cf6" }} size="small" />
                        </div>
                        <div style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                          {activeTrips.map((trip) => (
                            <TripCard key={trip.id} trip={trip} />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pipeline: non-READY orders */}
                    {filteredScheduledOrders.filter((o) => !["READY", "DELIVERED", "CANCELLED", "OUT_FOR_DELIVERY"].includes(o.status)).length > 0 && (
                      <div style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                        <div style={{ padding: "12px 16px 8px", display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: token.colorText }}>Pipeline</span>
                          <Badge
                            count={filteredScheduledOrders.filter((o) => !["READY", "DELIVERED", "CANCELLED", "OUT_FOR_DELIVERY"].includes(o.status)).length}
                            style={{ backgroundColor: "#64748b" }}
                            size="small"
                          />
                        </div>
                        <Table
                          dataSource={filteredScheduledOrders.filter((o) => !["READY", "DELIVERED", "CANCELLED", "OUT_FOR_DELIVERY"].includes(o.status))}
                          columns={pipelineColumns}
                          rowKey="id"
                          size="small"
                          pagination={false}
                        />
                      </div>
                    )}

                    {/* Remaining orders (assigned to trips / out for delivery / delivered) */}
                    {filteredScheduledOrders.filter((o) => (o.deliveryTripId && o.status === "READY") || ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"].includes(o.status)).length > 0 && (
                      <div>
                        <Table
                          dataSource={filteredScheduledOrders.filter((o) => (o.deliveryTripId && o.status === "READY") || ["OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"].includes(o.status))}
                          columns={expressColumns}
                          rowKey="id"
                          size="small"
                          pagination={false}
                        />
                      </div>
                    )}

                    {/* Empty state */}
                    {filteredScheduledOrders.length === 0 && (
                      <div style={{ padding: 40, textAlign: "center" }}>
                        <InboxOutlined style={{ fontSize: 32, color: token.colorTextQuaternary }} />
                        <div style={{ marginTop: 8, color: token.colorTextSecondary }}>
                          {activeSlot
                            ? "No orders in this time slot"
                            : `No scheduled orders ${isToday ? "today" : "on this date"}`}
                        </div>
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: "pickup",
                label: (
                  <Space size={6}>
                    <ShopOutlined style={{ color: "#22c55e" }} />
                    Pickups
                    <Badge
                      count={data?.summary.pickup.total ?? 0}
                      style={{ backgroundColor: "#22c55e" }}
                      size="small"
                    />
                  </Space>
                ),
                children: (
                  <Table
                    dataSource={data?.pickup ?? []}
                    columns={pickupColumns}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    rowSelection={rowSelection}
                    locale={{
                      emptyText: (
                        <div style={{ padding: 40, textAlign: "center" }}>
                          <InboxOutlined style={{ fontSize: 32, color: token.colorTextQuaternary }} />
                          <div style={{ marginTop: 8, color: token.colorTextSecondary }}>
                            No pickup orders {isToday ? "today" : "on this date"}
                          </div>
                        </div>
                      ),
                    }}
                  />
                ),
              },
            ]}
          />
        </Card>
      </Spin>

      {/* Create Trip Modal */}
      <Modal
        title="Create Delivery Trip"
        open={createTripModalOpen}
        onCancel={() => { setCreateTripModalOpen(false); setSelectedRider(null); }}
        onOk={handleCreateTrip}
        okText="Create Trip"
        okButtonProps={{ disabled: !selectedRider, loading: creatingTrip }}
        destroyOnClose
      >
        <div style={{ marginBottom: 16, color: token.colorTextSecondary, fontSize: 13 }}>
          Assign <strong>{selectedRowKeys.length}</strong> order{selectedRowKeys.length > 1 ? "s" : ""} to a rider for delivery.
        </div>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>Select Rider</div>
        <Select
          placeholder="Choose a rider"
          value={selectedRider}
          onChange={setSelectedRider}
          style={{ width: "100%" }}
          options={riders.map((r) => ({
            label: (
              <span>
                {r.name}
                {r.phone && <span style={{ color: token.colorTextSecondary, marginLeft: 8 }}>{r.phone}</span>}
              </span>
            ),
            value: r.id,
          }))}
        />
        {riders.length === 0 && (
          <div style={{ marginTop: 8, color: token.colorTextSecondary, fontSize: 12 }}>
            No staff assigned to this store. Add staff via the Stores page first.
          </div>
        )}
      </Modal>
    </div>
  );
};
