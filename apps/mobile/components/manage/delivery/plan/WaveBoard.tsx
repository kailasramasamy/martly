import { PlanButtons } from "./PlanButtons";
import { PoolSection, TripSections } from "./TripSections";
import { WaveSummary } from "./WaveSummary";
import { EmptyState } from "../../ui/EmptyState";
import type { TripHandlers } from "./TripPlanCard";
import type { PlanSheets } from "./use-plan-sheets";
import type { PlanWave } from "./types";
import { orderCount } from "./format";

interface WaveBoardProps {
  wave: PlanWave;
  canDispatch: boolean;
  handlers: TripHandlers;
  sheets: PlanSheets;
}

/** Everything for the selected wave: summary and plan buttons, trips by stage, then unplanned orders */
export function WaveBoard({ wave, canDispatch, handlers, sheets }: WaveBoardProps) {
  return (
    <>
      <WaveSummary wave={wave} onRiders={sheets.openRoster}>
        {canDispatch && <PlanButtons wave={wave} actions={handlers.actions} />}
      </WaveSummary>
      {orderCount(wave) === 0 && <EmptyState icon="bag-check-outline" title="No orders in this wave" message="Orders booked for this window show up here." />}
      <TripSections trips={wave.trips} handlers={handlers} />
      <PoolSection pool={wave.pool} onOpen={(stop) => sheets.openStop(stop, null)} />
    </>
  );
}
