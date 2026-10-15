import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { BottomSheet } from "../../search/BottomSheet";
import { Button } from "../ui/Button";
import { TextField } from "../ui/TextField";

interface ReplySheetProps {
  reviewId: string | null;
  initialBody: string;
  onClose: () => void;
  onSaved: () => void;
}

export function ReplySheet({ reviewId, initialBody, onClose, onSaved }: ReplySheetProps) {
  const { run, running } = useAction();
  const [body, setBody] = useState(initialBody);

  useEffect(() => {
    setBody(initialBody);
  }, [reviewId, initialBody]);

  const save = async () => {
    const done = await run(() => api.post(`/api/v1/reviews/${reviewId}/reply`, { body: body.trim() }), "Reply posted");
    if (!done) return;
    onSaved();
    onClose();
  };

  return (
    <BottomSheet
      visible={!!reviewId}
      title={initialBody ? "Edit reply" : "Reply to review"}
      onClose={onClose}
      footer={<Button label={initialBody ? "Update reply" : "Post reply"} onPress={save} loading={running} disabled={!body.trim()} />}
    >
      <TextField label="Reply" value={body} onChangeText={setBody} multiline maxLength={2000} placeholder="Write your response to this review" />
    </BottomSheet>
  );
}
