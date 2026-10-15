import { useState } from "react";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";

interface DeleteActionProps {
  label?: string;
  title: string;
  message: string;
  loading?: boolean;
  onConfirm: () => Promise<void> | void;
}

/** Danger button that asks for confirmation in a sheet before running a destructive action */
export function DeleteAction({ label = "Delete", title, message, loading, onConfirm }: DeleteActionProps) {
  const [open, setOpen] = useState(false);
  const confirm = async () => {
    await onConfirm();
    setOpen(false);
  };
  return (
    <>
      <Button label={label} variant="danger" icon="trash-outline" onPress={() => setOpen(true)} />
      <ConfirmDialog visible={open} title={title} message={message} confirmLabel={label} running={loading} onConfirm={confirm} onClose={() => setOpen(false)} />
    </>
  );
}
