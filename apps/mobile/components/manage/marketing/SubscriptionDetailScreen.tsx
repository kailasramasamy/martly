import { useState } from "react";
import { ManageStackScreen } from "../ManageStackScreen";
import { Button } from "../ui/Button";
import { toDateKey } from "../ui/dates";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useResource } from "../../../lib/manage/use-resource";
import { OptionalDate, endOfDayIso } from "./common";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { DetailsCard, HistoryCards, ItemsCard } from "./SubscriptionSections";
import type { Subscription } from "./subscription-types";

type Dialog = "pause" | "cancel" | null;
type Update = (body: Record<string, unknown>, message: string) => Promise<boolean>;

interface ActionsProps {
  s: Subscription;
  editing: boolean;
  running: boolean;
  onSave: () => void;
  onDialog: (d: Dialog) => void;
  update: Update;
}

function SubscriptionActions({ s, editing, running, onSave, onDialog, update }: ActionsProps) {
  const flex = { flex: 1 };
  if (editing) return <Button label="Save quantities" onPress={onSave} loading={running} style={flex} />;
  return (
    <>
      <Button label="Cancel subscription" variant="danger" onPress={() => onDialog("cancel")} style={flex} />
      {s.status === "ACTIVE"
        ? <Button label="Pause" icon="pause-outline" variant="secondary" onPress={() => onDialog("pause")} style={flex} />
        : <Button label="Resume" icon="play-outline" onPress={() => update({ status: "ACTIVE" }, "Subscription resumed")} loading={running} style={flex} />}
    </>
  );
}

interface DialogsProps {
  dialog: Dialog;
  running: boolean;
  update: Update;
  onClose: () => void;
}

function SubscriptionDialogs({ dialog, running, update, onClose }: DialogsProps) {
  const [pauseUntil, setPauseUntil] = useState<string | null>(null);
  return (
    <>
      <ConfirmDialog
        visible={dialog === "cancel"}
        title="Cancel subscription?"
        message="This permanently cancels the subscription. The customer will need to create a new one."
        confirmLabel="Yes, cancel"
        running={running}
        onConfirm={() => update({ status: "CANCELLED" }, "Subscription cancelled")}
        onClose={onClose}
      />
      <ConfirmDialog
        visible={dialog === "pause"}
        title="Pause subscription"
        message="Deliveries are skipped until the subscription is resumed."
        confirmLabel="Pause"
        confirmVariant="primary"
        running={running}
        onConfirm={() => update({ status: "PAUSED", ...(pauseUntil ? { pausedUntil: endOfDayIso(pauseUntil) } : {}) }, "Subscription paused")}
        onClose={onClose}
      >
        <OptionalDate label="Resume automatically on (optional)" value={pauseUntil} onChange={setPauseUntil} placeholder="Pause until resumed" minDate={toDateKey(new Date())} />
      </ConfirmDialog>
    </>
  );
}

export function SubscriptionDetailScreen({ id }: { id: string }) {
  const { data: s, setData, loading, error, reload } = useResource<Subscription>(`/api/v1/subscriptions/admin/${id}`);
  const { run, running } = useAction();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [editing, setEditing] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const update: Update = async (body, message) => {
    const res = await run(() => api.put<Subscription>(`/api/v1/subscriptions/admin/${id}`, body), message);
    setDialog(null);
    if (res) setData(res.data);
    return !!res;
  };
  const saveQuantities = async () => {
    const items = Object.entries(quantities).map(([storeProductId, quantity]) => ({ storeProductId, quantity }));
    if (await update({ items }, "Quantities updated")) setEditing(false);
  };
  const startEditing = (sub: Subscription) => {
    setQuantities(Object.fromEntries(sub.items.map((i) => [i.storeProductId, i.quantity])));
    setEditing(true);
  };

  const actions = s && s.status !== "CANCELLED" ? <SubscriptionActions s={s} editing={editing} running={running} onSave={saveQuantities} onDialog={setDialog} update={update} /> : undefined;
  return (
    <ManageStackScreen title="Subscription" loading={loading} error={error} onRetry={reload} onRefresh={reload} actions={actions}>
      {s ? (
        <>
          <DetailsCard s={s} />
          <ItemsCard s={s} editing={editing} quantities={quantities} onQuantity={(spId, q) => setQuantities((prev) => ({ ...prev, [spId]: q }))} onEdit={() => startEditing(s)} onCancelEdit={() => setEditing(false)} />
          <HistoryCards s={s} />
        </>
      ) : null}
      <SubscriptionDialogs dialog={dialog} running={running} update={update} onClose={() => setDialog(null)} />
    </ManageStackScreen>
  );
}
