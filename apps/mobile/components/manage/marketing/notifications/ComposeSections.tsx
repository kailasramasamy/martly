import { SectionCard } from "../../ui/SectionCard";
import { TextField } from "../../ui/TextField";
import { SelectField } from "../../ui/SelectField";
import { SwitchRow } from "../../ui/SwitchRow";
import { ImageField } from "../../ui/ImageField";
import { toDateKey } from "../../ui/dates";
import { useResource } from "../../../../lib/manage/use-resource";
import { OptionalDate } from "../common";
import { AudienceFields } from "./AudienceFields";
import { DeepLinkFields } from "./DeepLinkFields";
import { NotificationPreview } from "./NotificationPreview";
import type { Compose } from "./compose";
import { TYPE_OPTIONS, type Template } from "./types";

interface Props {
  c: Compose;
  patch: (p: Partial<Compose>) => void;
  errors: Partial<Record<keyof Compose, string>>;
}

function MessageSection({ c, patch, errors }: Props) {
  const templates = useResource<Template[]>("/api/v1/notifications/admin/templates?pageSize=100");
  const applyTemplate = (id: string) => {
    const t = templates.data?.find((x) => x.id === id);
    if (t) patch({ title: t.title, body: t.body, type: t.type, imageUrl: t.imageUrl });
  };
  return (
    <SectionCard title="Message">
      {templates.data && templates.data.length > 0 ? (
        <SelectField label="Start from a template" value={null} placeholder="Choose a template" options={templates.data.map((t) => ({ value: t.id, label: t.name, description: t.title }))} onChange={applyTemplate} />
      ) : null}
      <TextField label="Title" required value={c.title} onChangeText={(title) => patch({ title })} maxLength={200} error={errors.title} />
      <TextField label="Message" required value={c.body} onChangeText={(body) => patch({ body })} multiline maxLength={2000} error={errors.body} />
      <SelectField label="Type" value={c.type} options={TYPE_OPTIONS} onChange={(type) => patch({ type })} />
      <ImageField label="Image" value={c.imageUrl} onChange={(imageUrl) => patch({ imageUrl })} aspect={2} hint="Optional" />
    </SectionCard>
  );
}

export function ComposeSections({ c, patch, errors }: Props) {
  return (
    <>
      <MessageSection c={c} patch={patch} errors={errors} />
      <SectionCard title="Audience"><AudienceFields value={c} onChange={patch} errors={errors} /></SectionCard>
      <SectionCard title="Deep link"><DeepLinkFields value={c} onChange={patch} error={errors.deepLinkId} /></SectionCard>
      <SectionCard title="Timing">
        <SwitchRow label="Schedule for later" value={c.schedule} onValueChange={(schedule) => patch({ schedule })} />
        {c.schedule ? (
          <>
            <OptionalDate label="Date" value={c.scheduleDate} onChange={(scheduleDate) => patch({ scheduleDate })} error={errors.scheduleDate} minDate={toDateKey(new Date())} />
            <TextField label="Time (24-hour)" value={c.scheduleTime} onChangeText={(scheduleTime) => patch({ scheduleTime })} placeholder="10:00" keyboardType="numbers-and-punctuation" error={errors.scheduleTime} />
          </>
        ) : null}
      </SectionCard>
      <SectionCard title="Preview"><NotificationPreview title={c.title} body={c.body} imageUrl={c.imageUrl} /></SectionCard>
    </>
  );
}
