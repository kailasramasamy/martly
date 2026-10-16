import { useEffect, useState } from "react";
import { Modal, Select, message, theme } from "antd";
import { isAxiosError } from "axios";
import { axiosInstance } from "../providers/data-provider";

interface RiderOption {
  id: string;
  name: string;
  phone: string | null;
}

interface RiderAssignModalProps {
  open: boolean;
  storeId: string | null;
  orderIds: string[];
  /** Send the orders out now instead of creating a trip to start later */
  start?: boolean;
  onClose: () => void;
  onDone: () => void;
}

/** Picks a rider for orders: creates a delivery trip, or with `start` sends them out on it straight away */
export function RiderAssignModal({ open, storeId, orderIds, start, onClose, onDone }: RiderAssignModalProps) {
  const { token } = theme.useToken();
  const [riders, setRiders] = useState<RiderOption[]>([]);
  const [riderId, setRiderId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const count = `${orderIds.length} order${orderIds.length === 1 ? "" : "s"}`;

  useEffect(() => {
    if (!open || !storeId) return;
    setRiderId(null);
    axiosInstance.get(`/delivery-trips/riders?storeId=${storeId}`).then((res) => setRiders(res?.data?.data ?? []));
  }, [open, storeId]);

  const submit = async () => {
    if (!riderId || !storeId) return;
    setSaving(true);
    try {
      await axiosInstance.post("/delivery-trips", { storeId, riderId, orderIds, start });
      message.success(start ? "Sent out for delivery" : "Trip created");
      onDone();
    } catch (err) {
      message.error((isAxiosError(err) && err.response?.data?.message) || "Failed to assign rider");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={start ? "Send out with rider" : "Create Delivery Trip"}
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText={start ? "Send out" : "Create Trip"}
      okButtonProps={{ disabled: !riderId, loading: saving }}
      destroyOnClose
    >
      <div style={{ marginBottom: 16, color: token.colorTextSecondary, fontSize: 13 }}>
        {start ? `Choose who delivers ${count}. ${orderIds.length === 1 ? "It goes" : "They go"} out for delivery right away.` : `Assign ${count} to a rider for delivery.`}
      </div>
      <Select
        placeholder="Choose a rider"
        value={riderId}
        onChange={setRiderId}
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
          No riders at this store. Add one from the Riders page first.
        </div>
      )}
    </Modal>
  );
}
