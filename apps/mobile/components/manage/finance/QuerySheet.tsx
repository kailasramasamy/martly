import { useState } from "react";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { TextField } from "../ui/TextField";

interface QuerySheetProps {
  entryId: string;
  visible: boolean;
  onClose: () => void;
}

/** Sends a question about one entry to Martly's finance team as a support ticket */
export function QuerySheet({ entryId, visible, onClose }: QuerySheetProps) {
  const [message, setMessage] = useState("");
  const { run, running } = useAction();
  const send = async () => {
    const sent = await run(() => api.post(`/api/v1/ledger/entries/${entryId}/query`, { message }), "Query sent. Martly will get back to you.");
    if (sent) {
      setMessage("");
      onClose();
    }
  };
  return (
    <ConfirmDialog
      visible={visible}
      title="Raise a query"
      message="Tell Martly what looks wrong with this entry. The entry details are attached."
      confirmLabel="Send"
      confirmVariant="primary"
      running={running}
      onConfirm={send}
      onClose={onClose}
    >
      <TextField label="Your question" value={message} onChangeText={setMessage} multiline maxLength={1000} required />
    </ConfirmDialog>
  );
}
