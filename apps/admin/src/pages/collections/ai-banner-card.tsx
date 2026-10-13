import { useState } from "react";
import { App, Button, Card, Image, Space, Tag, Tooltip, Typography } from "antd";
import { PictureOutlined, ReloadOutlined } from "@ant-design/icons";
import { isAxiosError } from "axios";
import { axiosInstance } from "../../providers/data-provider";
import { sectionTitle } from "../../theme";

interface AiBannerRecord {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  imageUrls: Record<string, string> | null;
  textInImage: boolean;
  translations: { ta?: { title?: string; subtitle?: string } } | null;
}

const LANG_LABELS: Record<string, string> = { en: "English", ta: "Tamil", art: "Artwork" };
const THUMB_WIDTH = 280;

function copyFor(record: AiBannerRecord, lang: string) {
  if (lang === "ta") return record.translations?.ta;
  return { title: record.title, subtitle: record.subtitle ?? undefined };
}

export const AiBannerCard = ({ record, onRegenerated }: { record: AiBannerRecord; onRegenerated: () => void }) => {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const images = record.imageUrls ?? (record.imageUrl ? { art: record.imageUrl } : {});

  const regenerate = async () => {
    setBusy(true);
    try {
      await axiosInstance.post(`/collections/${record.id}/regenerate-banner`, undefined, { timeout: 240000 });
      message.success("Banner regenerated");
      onRegenerated();
    } catch (err) {
      if (!isAxiosError(err)) throw err;
      message.error(err.response?.data?.message ?? "Banner regeneration failed");
    } finally {
      setBusy(false);
    }
  };

  const regenerateButton = (
    <Tooltip title="Redraws the banners from the saved title and subtitle; save edits first. Takes 1–3 minutes.">
      <Button size="small" icon={<ReloadOutlined />} loading={busy} onClick={regenerate}>Regenerate</Button>
    </Tooltip>
  );

  return (
    <Card title={sectionTitle(<PictureOutlined />, "AI Banner")} size="small" extra={regenerateButton}>
      <Space size={16} wrap align="start">
        {Object.entries(images).map(([lang, url]) => {
          const copy = copyFor(record, lang);
          return (
            <div key={lang} style={{ width: THUMB_WIDTH }}>
              <Image src={url} width={THUMB_WIDTH} style={{ borderRadius: 8 }} />
              <div style={{ marginTop: 6 }}>
                <Tag>{LANG_LABELS[lang] ?? lang}</Tag>
                {copy?.title && <Typography.Text strong>{copy.title}</Typography.Text>}
              </div>
              {copy?.subtitle && <Typography.Text type="secondary" style={{ fontSize: 12 }}>{copy.subtitle}</Typography.Text>}
            </div>
          );
        })}
      </Space>
      {!record.textInImage && (
        <Typography.Paragraph type="secondary" style={{ margin: "8px 0 0" }}>
          Text couldn't be proofread into the artwork, so the app draws it.
        </Typography.Paragraph>
      )}
    </Card>
  );
};
