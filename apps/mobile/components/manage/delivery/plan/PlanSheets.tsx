import type { DeliveryFailureReason } from "@martly/shared/constants";
import { OptionSheet, type SelectOption } from "../../ui/OptionSheet";
import { FailDeliverySheet } from "../../rider/FailDeliverySheet";
import { OrderActionSheet } from "../OrderActionSheet";
import { RosterSheet } from "./RosterSheet";
import { isUnstarted } from "./format";
import type { PlanSheets as Sheets } from "./use-plan-sheets";
import type { PlanActions } from "./use-plan-actions";
import type { DeliveryPlan, PlanWave } from "./types";

interface PlanOverlaysProps {
  plan: DeliveryPlan;
  wave: PlanWave;
  sheets: Sheets;
  actions: PlanActions;
  canEditRoster: boolean;
  onChanged: () => void;
  onManageRiders: () => void;
}

const BACK_TO_POOL = "__pool__";

function riderOptions(plan: DeliveryPlan, wave: PlanWave): SelectOption[] {
  return plan.riders.map((r) => {
    const load = wave.trips.filter((t) => t.riderId === r.id).length;
    return { value: r.id, label: r.name, description: `${load} trip${load === 1 ? "" : "s"} in this wave` };
  });
}

/** The wave planner's sheets; `sheets` keeps at most one of them (or the order menu) open */
export function PlanOverlays({ plan, wave, sheets, actions, canEditRoster, onChanged, onManageRiders }: PlanOverlaysProps) {
  const { sheet } = sheets;
  const riderTrip = sheet?.kind === "rider" ? wave.trips.find((t) => t.id === sheet.tripId) : undefined;
  const moveFrom = sheet?.kind === "move" ? wave.trips.find((t) => t.id === sheet.tripId) : undefined;
  const targets: SelectOption[] = wave.trips
    .filter((t) => isUnstarted(t) && t.id !== moveFrom?.id)
    .map((t) => ({ value: t.id, label: t.areaLabel ?? "Trip", description: `${t.stops.length} stops · ${t.rider?.name ?? "no rider yet"}` }));

  const pickRider = async (riderId: string) => {
    sheets.closeSheet();
    if (riderTrip) await actions.assign([{ tripId: riderTrip.id, riderId }], "Rider assigned");
  };
  const pickTarget = async (value: string) => {
    sheets.closeSheet();
    if (moveFrom && sheet?.kind === "move") await actions.move(moveFrom.id, sheet.orderId, value === BACK_TO_POOL ? null : value);
  };

  const failing = sheet?.kind === "fail" ? sheet : null;
  const confirmFail = async (reason: DeliveryFailureReason, note: string | undefined) => {
    if (!failing) return;
    sheets.closeSheet();
    await actions.fail(failing.tripId, failing.orderId, reason, note);
  };

  return (
    <>
      <FailDeliverySheet visible={!!failing} customer={failing?.customer ?? ""} running={actions.running} onClose={sheets.closeSheet} onConfirm={confirmFail} />
      <OptionSheet
        visible={!!riderTrip}
        title="Choose rider"
        options={riderOptions(plan, wave)}
        value={riderTrip?.riderId ?? riderTrip?.suggestedRiderId ?? null}
        onPick={pickRider}
        onClose={sheets.closeSheet}
      />
      <OptionSheet
        visible={!!moveFrom}
        title="Move order to"
        options={[...targets, { value: BACK_TO_POOL, label: "Back to unplanned" }]}
        value={null}
        onPick={pickTarget}
        onClose={sheets.closeSheet}
      />
      <RosterSheet wave={sheet?.kind === "roster" ? wave : null} date={plan.date} riders={plan.riders} canEdit={canEditRoster} onClose={sheets.closeSheet} onChanged={onChanged} />
      <OrderActionSheet order={sheets.menuOrder} onClose={sheets.closeMenu} onChanged={onChanged} onManageRiders={onManageRiders} />
    </>
  );
}
