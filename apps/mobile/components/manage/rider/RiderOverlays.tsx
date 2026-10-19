import { FailDeliverySheet } from "./FailDeliverySheet";
import { StopSheet } from "./StopSheet";
import type { useRiderActions } from "./use-rider-actions";
import type { RiderOverlay } from "./types";

interface RiderOverlaysProps {
  overlay: RiderOverlay | null;
  actions: ReturnType<typeof useRiderActions>;
  onClose: () => void;
}

/** The stop details and couldn't-deliver sheets; `overlay` keeps only one open */
export function RiderOverlays({ overlay, actions, onClose }: RiderOverlaysProps) {
  const stop = overlay?.stop;
  const finish = async (done: Promise<boolean>) => {
    if (await done) onClose();
  };
  return (
    <>
      <StopSheet stop={overlay?.kind === "stop" ? overlay.stop : null} onClose={onClose} />
      <FailDeliverySheet
        visible={overlay?.kind === "fail"}
        customer={stop?.user.name ?? ""}
        running={actions.running}
        onClose={onClose}
        onConfirm={(reason, note) => overlay && finish(actions.fail(overlay.tripId, overlay.stop.id, reason, note))}
      />
    </>
  );
}
