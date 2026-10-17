import { useState } from "react";
import type { NamePath } from "antd/es/form/interface";
import { App, Button, Card, Form, Image, Input, Radio, Switch, Typography, type FormInstance } from "antd";
import { useGetIdentity } from "@refinedev/core";
import { isAxiosError } from "axios";
import { Link } from "react-router";
import { axiosInstance } from "../../providers/data-provider";
import { ImageUpload } from "../../components/ImageUpload";
import { useEntitlements } from "../../hooks/use-entitlements";
import { ImageGuidance } from "../brand-campaigns/creative-section";
import { errorMessage } from "../marketing/utils";

const GENERATE_TIMEOUT_MS = 120000;

type ImageMode = "upload" | "ai";

/** Org users' plan usage; the platform admin has no organisation and no limits */
export function useBannerEntitlements() {
  const { data: identity } = useGetIdentity<{ role: string }>();
  const isOrgUser = !!identity && identity.role !== "SUPER_ADMIN";
  return { isOrgUser, ...useEntitlements(isOrgUser) };
}

/** Shows a banner save failure; a full plan (402) links to the Marketing plan page */
export function useNotifyBannerError(fallback: string) {
  const { notification } = App.useApp();
  return (error: unknown) => {
    if (!isAxiosError(error)) throw error;
    notification.error({
      message: error.response?.data?.message ?? fallback,
      description: error.response?.status === 402 ? <Link to="/marketing-plan">Open Marketing plan</Link> : undefined,
    });
  };
}

export function useBannerSaveErrors() {
  return { errorNotification: false as const, onMutationError: useNotifyBannerError("Could not save the banner") };
}

/** What the AI paints from: the banner's copy and where it leads */
export interface BannerAiContext {
  title?: string;
  subtitle?: string;
  actionType?: string;
  actionTarget?: string;
  actionTargetPath?: string[];
}

/** A banner row inside a Form.List; its fields are addressed relative to the list item */
export interface ListPrefix { list: string; index: number }

export const fieldName = (prefix: ListPrefix | undefined, key: string): NamePath => (prefix ? [prefix.index, key] : key);
export const absoluteName = (prefix: ListPrefix | undefined, key: string): NamePath => (prefix ? [prefix.list, prefix.index, key] : key);

function GeneratedPreview({ value }: { value?: string }) {
  return value ? <Image src={value} width={240} style={{ aspectRatio: "3 / 2", objectFit: "cover", borderRadius: 8 }} /> : <Typography.Text type="secondary">No image yet</Typography.Text>;
}

const formContext = (form: FormInstance): BannerAiContext => form.getFieldsValue(["title", "subtitle", "actionType", "actionTarget", "actionTargetPath"]);

interface ImageProps { form: FormInstance; prefix?: ListPrefix; context?: () => BannerAiContext }

function AiImagePanel({ form, prefix, context }: ImageProps) {
  const { notification } = App.useApp();
  const [brief, setBrief] = useState("");
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    const { title, subtitle, actionType, actionTarget, actionTargetPath } = context ? context() : formContext(form);
    // Category targets live in the picker as a path until save; the deepest id is the target
    const target = actionType === "CATEGORY" ? actionTargetPath?.at(-1) ?? actionTarget : actionTarget;
    if (!title) {
      notification.warning({ message: "Enter the title first" });
      return;
    }
    setGenerating(true);
    try {
      const res = await axiosInstance.post("/banners/generate-image", { title, subtitle, brief: brief || undefined, actionType, actionTarget: target }, { timeout: GENERATE_TIMEOUT_MS });
      form.setFieldValue(absoluteName(prefix, "imageUrl"), res.data.data.imageUrl);
      form.setFieldValue(absoluteName(prefix, "textInImage"), res.data.data.textInImage);
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not generate the banner") });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Typography.Paragraph type="secondary">What should the picture show? (optional; leave empty to picture the banner's target category, product or collection)</Typography.Paragraph>
      <Input.TextArea rows={3} maxLength={400} value={brief} onChange={(e) => setBrief(e.target.value)} style={{ marginBottom: 12 }} />
      <Button type="primary" loading={generating} onClick={generate}>Generate</Button>
      {generating && <Typography.Text type="secondary" style={{ marginLeft: 12 }}>Designing your banner… up to a minute</Typography.Text>}
    </>
  );
}

/** Image card for banner forms: upload your own or have the AI paint it from the title */
export function BannerImageCard({ form, aiImages, prefix, context }: ImageProps & { aiImages?: { used: number; total: number } }) {
  const [mode, setMode] = useState<ImageMode>("upload");
  const imageUrl = Form.useWatch(absoluteName(prefix, "imageUrl"), form);
  return (
    <Card title="Image" size="small" style={{ marginBottom: 16 }}>
      <Radio.Group
        value={mode}
        onChange={(e) => setMode(e.target.value)}
        style={{ marginBottom: 12 }}
        options={[{ value: "upload", label: "Upload" }, { value: "ai", label: "Generate with AI" }]}
      />
      {mode === "upload" ? <ImageGuidance /> : <AiImagePanel form={form} prefix={prefix} context={context} />}
      {mode === "ai" && aiImages && <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>AI images: {aiImages.used}/{aiImages.total} this month</Typography.Paragraph>}
      <Form.Item name={fieldName(prefix, "imageUrl")} rules={[{ required: true, message: "Banner image is required" }]} getValueFromEvent={(url: string) => url} style={{ marginTop: 12 }}>
        {mode === "upload" ? <ImageUpload key={imageUrl ?? "empty"} /> : <GeneratedPreview />}
      </Form.Item>
      <Form.Item
        name={fieldName(prefix, "textInImage")}
        label="Title is in the image"
        valuePropName="checked"
        extra="Upload a 3:2 image. When the title is part of the artwork the app adds no text; otherwise it shows the title below the image."
      >
        <Switch />
      </Form.Item>
    </Card>
  );
}

export function BannerSlotsNote({ slots }: { slots?: { used: number; total: number | null } }) {
  if (!slots) return null;
  return <Typography.Text type="secondary">Banner slots: {slots.used}/{slots.total ?? "Unlimited"}</Typography.Text>;
}
