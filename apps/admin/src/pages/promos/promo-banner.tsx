import { useState } from "react";
import { Button, Card, Col, Form, Image, Input, Modal, Row, Space, Statistic, Switch, Typography } from "antd";
import { EditOutlined, PictureOutlined, ThunderboltOutlined } from "@ant-design/icons";
import type { PromoDetail } from "@martly/shared/types";
import { sectionTitle } from "../../theme";
import { axiosInstance } from "../../providers/data-provider";
import { ImageUpload } from "../../components/ImageUpload";
import { usePromoEntitlements, useNotifyPromoError } from "./promo-access";

const GENERATE_TIMEOUT_MS = 120000;
const PREVIEW_WIDTH = 320;

interface Wording { title: string; subtitle?: string }

/** The banner as it stands: the live one, or an AI promotion's draft before launch */
function currentBanner(promo: PromoDetail) {
  if (promo.banner) return promo.banner;
  const copy = promo.copy?.en;
  const imageUrl = promo.images?.en ?? Object.values(promo.images ?? {})[0] ?? promo.imageUrl;
  return { imageUrl, title: copy?.title ?? promo.title ?? promo.brief, subtitle: copy?.subtitle ?? null, textInImage: promo.textInImage, views: 0, taps: 0, ctr: 0 };
}

function WordingModal({ initial, saving, onSave, onClose }: { initial: Wording; saving: boolean; onSave: (w: Wording) => void; onClose: () => void }) {
  const [form] = Form.useForm<Wording>();
  return (
    <Modal open title="Edit wording" okText="Save" confirmLoading={saving} onOk={() => form.submit()} onCancel={onClose}>
      <Form form={form} layout="vertical" initialValues={initial} onFinish={onSave}>
        <Form.Item name="title" label="Title" rules={[{ required: true, min: 2, whitespace: true, message: "Enter at least 2 characters" }]}>
          <Input maxLength={60} showCount />
        </Form.Item>
        <Form.Item name="subtitle" label="Subtitle">
          <Input maxLength={90} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}

/** The promotion's banner in the home carousel, with its results; changes take effect straight away */
export function PromoBanner({ promo, onChanged }: { promo: PromoDetail; onChanged: () => void }) {
  const [busy, setBusy] = useState<"upload" | "generate" | "wording" | null>(null);
  const [editing, setEditing] = useState(false);
  const [textInImage, setTextInImage] = useState(promo.banner?.textInImage ?? promo.textInImage);
  const { isOrgUser, entitlements, reload } = usePromoEntitlements();
  const notifyError = useNotifyPromoError("Could not update the banner");
  const banner = currentBanner(promo);
  const editable = promo.status === "READY" || promo.status === "LIVE";
  const aiLeft = entitlements ? entitlements.aiImages.total - entitlements.aiImages.used : null;

  const change = async (kind: NonNullable<typeof busy>, call: () => Promise<unknown>) => {
    setBusy(kind);
    try {
      await call();
      setEditing(false);
      onChanged();
      if (isOrgUser) void reload();
    } catch (err) {
      notifyError(err);
    } finally {
      setBusy(null);
    }
  };

  const base = `/promos/${promo.id}/banner`;
  const upload = (imageUrl: string) => change("upload", () => axiosInstance.put(base, { imageUrl, textInImage }));
  const generate = () => change("generate", () => axiosInstance.post(`${base}/generate`, undefined, { timeout: GENERATE_TIMEOUT_MS }));
  const saveWording = (w: Wording) => change("wording", () => axiosInstance.put(base, w));

  return (
    <Card title={sectionTitle(<PictureOutlined />, "Banner")} size="small" style={{ marginBottom: 16 }}>
      <Row gutter={24}>
        <Col xs={24} md={10}>
          {banner.imageUrl && <Image src={banner.imageUrl} width={PREVIEW_WIDTH} style={{ maxWidth: "100%", aspectRatio: "3 / 2", objectFit: "cover", borderRadius: 8 }} />}
        </Col>
        <Col xs={24} md={14}>
          <Typography.Title level={5} style={{ marginTop: 0 }}>{banner.title}</Typography.Title>
          {banner.subtitle && <Typography.Paragraph type="secondary">{banner.subtitle}</Typography.Paragraph>}
          {promo.banner && (
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}><Statistic title="Views" value={banner.views} /></Col>
              <Col span={8}><Statistic title="Taps" value={banner.taps} /></Col>
              <Col span={8}><Statistic title="Tap rate" value={banner.ctr} suffix="%" /></Col>
            </Row>
          )}
          {editable && (
            <Space direction="vertical" size={12}>
              <Space wrap>
                <Button icon={<ThunderboltOutlined />} loading={busy === "generate"} disabled={aiLeft === 0 || busy !== null} onClick={generate}>
                  Generate new with AI{aiLeft !== null && ` (${aiLeft} left)`}
                </Button>
                <Button icon={<EditOutlined />} disabled={busy !== null} onClick={() => setEditing(true)}>Edit wording</Button>
                {busy === "generate" && <Typography.Text type="secondary">Designing your banner… up to a minute</Typography.Text>}
              </Space>
              <Space align="start" wrap>
                <div>
                  <Typography.Text>Upload new image</Typography.Text>
                  <ImageUpload key={banner.imageUrl} onChange={upload} />
                </div>
                <div>
                  <Typography.Text>Title is in the image</Typography.Text>
                  <div><Switch checked={textInImage} onChange={setTextInImage} /></div>
                </div>
              </Space>
            </Space>
          )}
        </Col>
      </Row>
      {editing && <WordingModal initial={{ title: banner.title, subtitle: banner.subtitle ?? undefined }} saving={busy === "wording"} onSave={saveWording} onClose={() => setEditing(false)} />}
    </Card>
  );
}
