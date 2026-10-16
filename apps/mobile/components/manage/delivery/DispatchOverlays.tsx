import { TabBottomDock } from "../../TabIcon";
import { OptionDropdown } from "../ui/OptionDropdown";
import { AssignRiderSheet } from "./AssignRiderSheet";
import { OrderActionSheet } from "./OrderActionSheet";
import { SelectionBar } from "./SelectionBar";
import type { MenuOrder } from "./types";

interface DispatchOverlaysProps {
  storeId: string | null;
  canDispatch: boolean;
  selected: Set<string>;
  onClearSelection: () => void;
  onDockHeight: (height: number) => void;
  assigning: boolean;
  onAssigning: (open: boolean) => void;
  onTripCreated: () => void;
  onManageRiders: () => void;
  menuOrder: MenuOrder | null;
  onMenuClose: () => void;
  onChanged: () => void;
  filterPicker: React.ComponentProps<typeof OptionDropdown>;
}

/** Everything floating over the delivery board: the selection bar above the tab bar and the board's sheets */
export function DispatchOverlays(props: DispatchOverlaysProps) {
  const { storeId, canDispatch, selected, onClearSelection, onDockHeight, assigning, onAssigning } = props;
  return (
    <>
      {canDispatch && selected.size > 0 && (
        <TabBottomDock onLayout={(e) => onDockHeight(e.nativeEvent.layout.height)}>
          <SelectionBar count={selected.size} onClear={onClearSelection} onAssign={() => onAssigning(true)} />
        </TabBottomDock>
      )}
      <OptionDropdown {...props.filterPicker} />
      <OrderActionSheet order={props.menuOrder} onClose={props.onMenuClose} onChanged={props.onChanged} onManageRiders={props.onManageRiders} />
      {storeId && (
        <AssignRiderSheet
          visible={assigning}
          storeId={storeId}
          orderIds={[...selected]}
          onClose={() => onAssigning(false)}
          onCreated={props.onTripCreated}
          onManageRiders={props.onManageRiders}
        />
      )}
    </>
  );
}
