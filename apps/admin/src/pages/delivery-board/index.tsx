import { useEffect, useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import { Badge, Empty, Space, Spin, Tabs, Typography, theme } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { can, hasPermission, type PermissionSubject } from "@martly/shared/permissions";
import { axiosInstance } from "../../providers/data-provider";
import { sectionTitle } from "../../theme";
import { BoardHeader } from "./board-header";
import { PoolTable } from "./pool-table";
import { RosterModal } from "./roster-modal";
import { TripGroups } from "./trip-groups";
import { useDeliveryPlan } from "./use-delivery-plan";
import { usePlanActions } from "./use-plan-actions";
import { WaveSummary } from "./wave-summary";
import { waveKey } from "./types";
import type { DeliveryPlan, TripHandlers, Wave } from "./types";

type Actions = ReturnType<typeof usePlanActions>;

function useStores() {
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);

  useEffect(() => {
    axiosInstance.get("/stores?pageSize=100").then((res) => {
      const list = res?.data?.data ?? [];
      setStores(list);
      if (list.length > 0) setStoreId(list[0].id);
    });
  }, []);

  return { stores, storeId, setStoreId };
}

function WaveTabs({ plan, activeKey, onChange }: { plan: DeliveryPlan; activeKey: string | null; onChange: (key: string) => void }) {
  const { token } = theme.useToken();
  return (
    <Tabs
      activeKey={activeKey ?? undefined}
      onChange={onChange}
      items={plan.waves.map((w) => ({
        key: waveKey(w),
        label: <Space size={6}>{w.label}<Badge count={w.pool.length + w.trips.length} color={token.colorPrimary} showZero /></Space>,
      }))}
    />
  );
}

interface WavePanelProps {
  plan: DeliveryPlan;
  wave: Wave;
  date: string;
  actions: Actions;
  canDispatch: boolean;
  canEditRoster: boolean;
}

function WavePanel({ plan, wave, date, actions, canDispatch, canEditRoster }: WavePanelProps) {
  const [rosterOpen, setRosterOpen] = useState(false);
  const key = waveKey(wave);
  const suggestions = wave.trips.filter((t) => t.status === "PLANNED" && t.suggestedRiderId);
  const handlers: TripHandlers = {
    onAssign: (tripId, riderId) => actions.assign([{ tripId, riderId }], tripId),
    onStart: (id) => actions.patchTrip(id, "start", "Trip started"),
    onCancel: (id) => actions.patchTrip(id, "cancel", "Trip cancelled"),
    onMove: actions.moveOrder,
    onDeliver: actions.deliver,
    onFail: actions.failDelivery,
  };

  return (
    <>
      <WaveSummary
        wave={wave}
        canDispatch={canDispatch}
        busy={actions.busyId === key}
        suggestedCount={suggestions.length}
        overflow={actions.overflow[key] ?? 0}
        onPlan={() => actions.planWave(wave, key)}
        onAssignAll={() => actions.assign(suggestions.map((t) => ({ tripId: t.id, riderId: t.suggestedRiderId as string })), key)}
        onShowRiders={() => setRosterOpen(true)}
      />
      <TripGroups trips={wave.trips} riders={plan.riders} canDispatch={canDispatch} busyId={actions.busyId} handlers={handlers} />
      <div style={{ marginTop: 24 }}>
        <Typography.Title level={5}>{sectionTitle(<InboxOutlined />, `Unplanned orders (${wave.pool.length})`)}</Typography.Title>
        <PoolTable orders={wave.pool} />
      </div>
      {wave.kind === "SLOT" && (
        <RosterModal
          open={rosterOpen}
          wave={wave}
          allRiders={plan.riders}
          date={dayjs(date).format("ddd, DD MMM")}
          canEdit={canEditRoster}
          busyId={actions.busyId}
          onToggle={actions.setWorking}
          onClose={() => setRosterOpen(false)}
        />
      )}
    </>
  );
}

export const DeliveryBoard = () => {
  const { data: identity } = useGetIdentity<PermissionSubject>();
  const canDispatch = identity?.role === "SUPER_ADMIN" || hasPermission(identity?.permissions, "ORDERS_DISPATCH");
  const { stores, storeId, setStoreId } = useStores();
  const [date, setDate] = useState(dayjs());
  const dateStr = date.format("YYYY-MM-DD");
  const { plan, setPlan, loading, load, activeKey, setActiveKey, wave } = useDeliveryPlan(storeId, dateStr);
  const actions = usePlanActions({ storeId, date: dateStr, setPlan, reload: load });

  return (
    <div>
      <BoardHeader stores={stores} storeId={storeId} date={date} loading={loading} onStore={setStoreId} onDate={setDate} onReload={load} />
      <Spin spinning={loading && !plan}>
        {plan && plan.waves.length === 0 && <Empty description="No delivery slots for this day" />}
        {plan && plan.waves.length > 0 && <WaveTabs plan={plan} activeKey={activeKey} onChange={setActiveKey} />}
        {wave && plan && (
          <WavePanel
            plan={plan}
            wave={wave}
            date={dateStr}
            actions={actions}
            canDispatch={canDispatch}
            canEditRoster={can(identity, "delivery-fleet")}
          />
        )}
      </Spin>
    </div>
  );
};
