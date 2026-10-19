import { Form, Input, Radio, Typography } from "antd";
import { BANNER_IMAGE_REQUIREMENTS } from "@martly/shared/constants";
import { ImageUpload } from "../../components/ImageUpload";

export type CreativeMode = "upload" | "ai";

/** The bullet list of what an uploaded banner image must meet */
export function ImageGuidance() {
  return (
    <ul style={{ margin: "4px 0 12px", paddingLeft: 18, fontSize: 12, color: "rgba(128,128,128,1)" }}>
      {BANNER_IMAGE_REQUIREMENTS.guidance.map((g) => <li key={g}>{g}</li>)}
    </ul>
  );
}

const PosterHint = () => <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>Tall 2:3 poster, text in the image</Typography.Paragraph>;

interface CreativeSectionProps {
  mode: CreativeMode;
  onModeChange: (mode: CreativeMode) => void;
  disabled?: boolean;
  /** Tall 2:3 poster instead of the landscape banner */
  portrait?: boolean;
}

export function CreativeSection({ mode, onModeChange, disabled, portrait }: CreativeSectionProps) {
  return (
    <>
      <Radio.Group
        value={mode}
        onChange={(e) => onModeChange(e.target.value)}
        style={{ marginBottom: 12 }}
        options={[{ value: "upload", label: "Upload image" }, { value: "ai", label: "Generate with AI" }]}
      />
      {mode === "upload" ? (
        <>
          {portrait ? <PosterHint /> : <ImageGuidance />}
          <Form.Item name="imageUrl" getValueFromEvent={(url: string) => url} rules={[{ required: true, message: portrait ? "Upload a poster image" : "Upload a banner image" }]}>
            <ImageUpload />
          </Form.Item>
        </>
      ) : (
        <Form.Item name="brief" label="What should the picture show?" rules={[{ required: true, whitespace: true, message: `Describe the ${portrait ? "poster" : "banner"}` }]}>
          <Input.TextArea rows={3} maxLength={600} showCount disabled={disabled} />
        </Form.Item>
      )}
      {mode === "ai" && <Typography.Text type="secondary">Save first, then press Generate {portrait ? "poster" : "banner"} on the campaign page.</Typography.Text>}
    </>
  );
}
