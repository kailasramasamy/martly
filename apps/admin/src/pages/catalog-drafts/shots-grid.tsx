import { Card, Col, Collapse, Empty, Image, Row, Space, Tag, Typography } from "antd";
import type { CatalogDraftShot } from "@martly/shared/types";

const { Text } = Typography;

const SOURCE_LABEL: Record<string, string> = { openai: "Retouched", plain: "Plain", photoroom: "Photoroom" };
const VERDICT: Record<string, { color: string; label: string }> = {
  pass: { color: "green", label: "Matches" },
  minor_only: { color: "gold", label: "Minor differences" },
  fail: { color: "red", label: "Mismatch" },
};

function ShotImage({ src, caption }: { src: string | null; caption: string }) {
  return (
    <Space direction="vertical" size={4} style={{ width: "100%", textAlign: "center" }}>
      {src ? <Image src={src} style={{ aspectRatio: "1 / 1", objectFit: "contain", width: "100%" }} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Not processed yet" />}
      <Text type="secondary">{caption}</Text>
    </Space>
  );
}

function ShotCard({ shot }: { shot: CatalogDraftShot }) {
  const verdict = shot.verdict ? VERDICT[shot.verdict] : null;
  return (
    <Card
      size="small"
      title={`Photo ${shot.index + 1}${shot.role ? ` (${shot.role})` : ""}`}
      extra={
        <Space>
          {shot.source && <Tag>{SOURCE_LABEL[shot.source] ?? shot.source}</Tag>}
          {verdict && <Tag color={verdict.color}>{verdict.label}</Tag>}
        </Space>
      }
    >
      <Row gutter={8}>
        <Col span={12}><ShotImage src={shot.original} caption="Original" /></Col>
        <Col span={12}><ShotImage src={shot.processed} caption="Listing image" /></Col>
      </Row>
      {shot.differences.length > 0 && (
        <Collapse
          ghost
          size="small"
          items={[{ key: "diff", label: `Differences (${shot.differences.length})`, children: <ul style={{ margin: 0, paddingLeft: 20 }}>{shot.differences.map((d) => <li key={d}>{d}</li>)}</ul> }]}
        />
      )}
    </Card>
  );
}

export function ShotsGrid({ shots }: { shots: CatalogDraftShot[] }) {
  return (
    <Row gutter={[16, 16]}>
      {shots.map((shot) => (
        <Col key={shot.index} xs={24} xl={12}><ShotCard shot={shot} /></Col>
      ))}
    </Row>
  );
}
