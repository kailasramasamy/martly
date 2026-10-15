import { useCallback, useState, type ReactNode } from "react";
import { AudienceTypeLabels } from "@martly/shared/constants";
import { ManageStackScreen } from "../../ManageStackScreen";
import { Button } from "../../ui/Button";
import { api } from "../../../../lib/api";
import { useAction } from "../../../../lib/manage/use-action";
import { useToast } from "../../../../lib/toast-context";
import { ConfirmDialog } from "../../ui/ConfirmDialog";
import { ComposeSections } from "./ComposeSections";
import { NotificationPreview } from "./NotificationPreview";
import { SendProgress } from "./SendProgress";
import { EMPTY_COMPOSE, scheduledAtOf, toSendPayload, validateCompose, type Compose } from "./compose";

interface SendResult {
  campaignId: string;
  status: string;
  recipientCount?: number;
}

function useSendFlow(c: Compose, reset: () => void) {
  const toast = useToast();
  const { run, running } = useAction();
  const [errors, setErrors] = useState<ReturnType<typeof validateCompose>>({});
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState<{ campaignId: string; recipientCount: number } | null>(null);

  const review = () => {
    const found = validateCompose(c);
    setErrors(found);
    if (Object.keys(found).length === 0) setConfirming(true);
  };

  const send = async () => {
    const res = await run(() => api.post<SendResult>("/api/v1/notifications/admin/send", toSendPayload(c)));
    setConfirming(false);
    if (!res) return;
    if (res.data.status === "SENDING") {
      setProgress({ campaignId: res.data.campaignId, recipientCount: res.data.recipientCount ?? 0 });
      return;
    }
    toast.show("Campaign scheduled", "success");
    reset();
  };

  const finished = useCallback((status: string) => {
    toast.show(status === "SENT" ? "Campaign sent" : "Campaign failed to send", status === "SENT" ? "success" : "error");
    setProgress(null);
    if (status === "SENT") reset();
  }, [toast, reset]);

  return { errors, confirming, setConfirming, progress, review, send, finished, running };
}

export function SendTab({ tabs }: { tabs: ReactNode }) {
  const [c, setC] = useState<Compose>(EMPTY_COMPOSE);
  const reset = useCallback(() => setC(EMPTY_COMPOSE), []);
  const flow = useSendFlow(c, reset);
  const patch = (p: Partial<Compose>) => setC((prev) => ({ ...prev, ...p }));
  const scheduled = scheduledAtOf(c);
  const audience = AudienceTypeLabels[c.audienceType as keyof typeof AudienceTypeLabels];

  const actions = <Button label={c.schedule ? "Review and schedule" : "Review and send"} icon="paper-plane-outline" onPress={flow.review} disabled={flow.progress !== null} style={{ flex: 1 }} />;
  return (
    <ManageStackScreen title="Push notifications" actions={actions}>
      {tabs}
      {flow.progress ? <SendProgress campaignId={flow.progress.campaignId} recipientCount={flow.progress.recipientCount} onFinished={flow.finished} /> : null}
      <ComposeSections c={c} patch={patch} errors={flow.errors} />
      <ConfirmDialog
        visible={flow.confirming}
        title={scheduled ? "Schedule this campaign?" : "Send to customers now?"}
        message={`${audience}${scheduled ? `, ${new Date(scheduled).toLocaleString("en-IN")}` : ", immediately"}. This can't be recalled once sent.`}
        confirmLabel={scheduled ? "Schedule" : "Send now"}
        confirmVariant="primary"
        running={flow.running}
        onConfirm={flow.send}
        onClose={() => flow.setConfirming(false)}
      >
        <NotificationPreview title={c.title} body={c.body} imageUrl={c.imageUrl} />
      </ConfirmDialog>
    </ManageStackScreen>
  );
}
