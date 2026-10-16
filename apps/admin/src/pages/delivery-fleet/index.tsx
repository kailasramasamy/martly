import { useCallback, useEffect, useState } from "react";
import { Space, message } from "antd";
import { axiosInstance } from "../../providers/data-provider";
import { StoreSelect } from "../../components/StoreSelect";
import { RosterGrid } from "./roster-grid";
import { SettingsForm } from "./settings-form";
import { SlotRosterModal } from "./slot-roster-modal";
import type { RosterData, SlotWindow } from "./types";

export const DeliveryFleet = () => {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [roster, setRoster] = useState<RosterData>({ riders: [], slots: [] });
  const [editing, setEditing] = useState<{ window: SlotWindow; day: number } | null>(null);

  const loadRoster = useCallback(async () => {
    if (!storeId) return;
    try {
      const res = await axiosInstance.get(`/delivery-plan/roster?storeId=${storeId}`);
      setRoster(res.data.data);
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to load roster");
    }
  }, [storeId]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Riders &amp; trips</h2>
        <StoreSelect value={storeId} onChange={setStoreId} style={{ minWidth: 220 }} />
      </div>
      {storeId && (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <SettingsForm storeId={storeId} />
          <RosterGrid slots={roster.slots} riders={roster.riders} onEdit={(window, day) => setEditing({ window, day })} />
          <SlotRosterModal
            storeId={storeId}
            window={editing?.window ?? null}
            initialDay={editing?.day ?? 1}
            riders={roster.riders}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              loadRoster();
            }}
          />
        </Space>
      )}
    </div>
  );
};
