import { useState } from "react";
import { App, Button, Card, Form, Image, Input, Radio, Switch, Typography, type FormInstance } from "antd";
import { axiosInstance } from "../../providers/data-provider";
import { ImageUpload } from "../../components/ImageUpload";
import { ImageGuidance } from "../brand-campaigns/creative-section";
import { errorMessage } from "../marketing/utils";

const GENERATE_TIMEOUT_MS = 120000;

type ImageMode = "upload" | "ai";

function GeneratedPreview({ value }: { value?: string }) {
  return value ? <Image src={value} width={240} style={{ aspectRatio: "3 / 2", objectFit: "cover", borderRadius: 8 }} /> : <Typography.Text type="secondary">No image yet</Typography.Text>;
}

function AiImagePanel({ form }: { form: FormInstance }) {
  const { notification } = App.useApp();
  const [brief, setBrief] = useState("");
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    const { title, subtitle, actionType, actionTarget, actionTargetPath } = form.getFieldsValue(["title", "subtitle", "actionType", "actionTarget", "actionTargetPath"]);
    // Category targets live in the picker as a path until save; the deepest id is the target
    const target = actionType === "CATEGORY" ? actionTargetPath?.at(-1) ?? actionTarget : actionTarget;
    if (!title) {
      notification.warning({ message: "Enter the title first" });
      return;
    }
    setGenerating(true);
    try {
      const res = await axiosInstance.post("/promos/generate-image", { title, subtitle, brief: brief || undefined, actionType, actionTarget: target }, { timeout: GENERATE_TIMEOUT_MS });
      form.setFieldsValue({ imageUrl: res.data.data.imageUrl, textInImage: res.data.data.textInImage });
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not generate the banner") });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <Typography.Paragraph type="secondary">What should the picture show? (optional; leave empty to picture the promotion's target category, product or collection)</Typography.Paragraph>
      <Input.TextArea rows={3} maxLength={400} value={brief} onChange={(e) => setBrief(e.target.value)} style={{ marginBottom: 12 }} />
      <Button type="primary" loading={generating} onClick={generate}>Generate</Button>
      {generating && <Typography.Text type="secondary" style={{ marginLeft: 12 }}>Designing your banner… up to a minute</Typography.Text>}
    </>
  );
}

/** Banner image for the promotion form: upload your own or have the AI paint it from the title and target */
export function BannerImageCard({ form, aiImages }: { form: FormInstance; aiImages?: { used: number; total: number } }) {
  const [mode, setMode] = useState<ImageMode>("upload");
  const imageUrl = Form.useWatch("imageUrl", form);
  return (
    <Card title="Banner image" size="small" style={{ marginBottom: 16 }}>
      <Radio.Group
        value={mode}
        onChange={(e) => setMode(e.target.value)}
        style={{ marginBottom: 12 }}
        options={[{ value: "upload", label: "Upload" }, { value: "ai", label: "Generate with AI" }]}
      />
      {mode === "upload" ? <ImageGuidance /> : <AiImagePanel form={form} />}
      {mode === "ai" && aiImages && <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>AI images: {aiImages.used}/{aiImages.total} this month</Typography.Paragraph>}
      <Form.Item name="imageUrl" rules={[{ required: true, message: "Banner image is required" }]} getValueFromEvent={(url: string) => url} style={{ marginTop: 12 }}>
        {mode === "upload" ? <ImageUpload key={imageUrl ?? "empty"} /> : <GeneratedPreview />}
      </Form.Item>
      <Form.Item
        name="textInImage"
        label="Title is in the image"
        valuePropName="checked"
        extra="Upload a 3:2 image. When the title is part of the artwork the app adds no text; otherwise it shows the title below the image."
      >
        <Switch />
      </Form.Item>
    </Card>
  );
}
