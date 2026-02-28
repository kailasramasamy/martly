import { useCallback, useEffect, useState } from "react";
import { Card, Tag, Row, Col, Statistic, Typography, Spin, Descriptions, Button, Image, Space } from "antd";
import {
  ArrowLeftOutlined,
  TeamOutlined,
  EyeOutlined,
  PercentageOutlined,
} from "@ant-design/icons";
import { useParams, useNavigate } from "react-router";
import dayjs from "dayjs";

import { axiosInstance } from "../../../providers/data-provider";
import { BRAND, sectionTitle } from "../../../theme";
import {
  NOTIFICATION_TYPE_CONFIG,
  CAMPAIGN_STATUS_CONFIG,
  AUDIENCE_TYPE_CONFIG,
} from "../../../constants/tag-colors";

const { Title, Paragraph } = Typography;

interface Campaign {
  id: string;
  title: string;
  body: string;
  type: string;
  imageUrl: string | null;
  audienceType: string;
  audienceConfig: Record<string, unknown> | null;
  status: string;
  recipientCount: number;
  readCount: number;
  readRate: number;
  sentAt: string | null;
  sentByUser: { name: string; email: string } | null;
}

export const CampaignShow = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCampaign = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/notifications/admin/campaigns/${id}`);
      setCampaign(res.data?.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div style={{ padding: 24, color: "#64748b" }}>
        Campaign not found.
      </div>
    );
  }

  const typeCfg = NOTIFICATION_TYPE_CONFIG[campaign.type];
  const statusCfg = CAMPAIGN_STATUS_CONFIG[campaign.status];
  const audienceCfg = AUDIENCE_TYPE_CONFIG[campaign.audienceType];
  const readRateColor = campaign.readRate >= 50 ? BRAND.success : campaign.readRate >= 25 ? BRAND.warning : BRAND.error;

  const audienceConfigEntries = campaign.audienceConfig
    ? Object.entries(campaign.audienceConfig).filter(([, v]) => v != null && v !== "")
    : [];

  return (
    <div style={{ padding: "16px 24px 32px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <Space align="center" style={{ marginBottom: 20 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} />
        <Title level={4} style={{ margin: 0 }}>{campaign.title}</Title>
      </Space>

      {/* Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card styles={{ body: { padding: "20px 20px 16px" } }}>
            <Statistic
              title={<span style={{ fontSize: 13, fontWeight: 500, color: "#64748b", textTransform: "uppercase" }}>Recipients</span>}
              value={campaign.recipientCount}
              prefix={<TeamOutlined style={{ color: BRAND.primary }} />}
              valueStyle={{ fontSize: 28, fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card styles={{ body: { padding: "20px 20px 16px" } }}>
            <Statistic
              title={<span style={{ fontSize: 13, fontWeight: 500, color: "#64748b", textTransform: "uppercase" }}>Read</span>}
              value={campaign.readCount}
              prefix={<EyeOutlined style={{ color: BRAND.info }} />}
              valueStyle={{ fontSize: 28, fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card styles={{ body: { padding: "20px 20px 16px" } }}>
            <Statistic
              title={<span style={{ fontSize: 13, fontWeight: 500, color: "#64748b", textTransform: "uppercase" }}>Read Rate</span>}
              value={campaign.readRate}
              suffix="%"
              prefix={<PercentageOutlined style={{ color: readRateColor }} />}
              valueStyle={{ fontSize: 28, fontWeight: 700, color: readRateColor }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Campaign Content */}
        <Col xs={24} lg={14}>
          <Card title={sectionTitle(<EyeOutlined />, "Campaign Content")} size="small">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Title">{campaign.title}</Descriptions.Item>
              <Descriptions.Item label="Body">
                <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 14 }}>
                  {campaign.body}
                </pre>
              </Descriptions.Item>
              <Descriptions.Item label="Type">
                <Tag color={typeCfg?.color ?? "default"}>{typeCfg?.label ?? campaign.type}</Tag>
              </Descriptions.Item>
              {campaign.imageUrl && (
                <Descriptions.Item label="Image">
                  <Image
                    src={campaign.imageUrl}
                    width={200}
                    style={{ borderRadius: 6, objectFit: "cover" }}
                    preview
                  />
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </Col>

        {/* Campaign Info */}
        <Col xs={24} lg={10}>
          <Card title={sectionTitle(<TeamOutlined />, "Campaign Info")} size="small">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Audience Type">
                <Tag color={audienceCfg?.color ?? "default"}>{audienceCfg?.label ?? campaign.audienceType}</Tag>
              </Descriptions.Item>
              {audienceConfigEntries.length > 0 && (
                <Descriptions.Item label="Audience Config">
                  {audienceConfigEntries.map(([key, value]) => (
                    <div key={key}>
                      <span style={{ color: "#64748b" }}>{key}:</span>{" "}
                      <span style={{ fontWeight: 500 }}>{String(value)}</span>
                    </div>
                  ))}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Sent By">
                {campaign.sentByUser
                  ? `${campaign.sentByUser.name} (${campaign.sentByUser.email})`
                  : "--"}
              </Descriptions.Item>
              <Descriptions.Item label="Sent At">
                {campaign.sentAt
                  ? dayjs(campaign.sentAt).format("DD MMM YYYY, HH:mm")
                  : "--"}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusCfg?.color ?? "default"}>{statusCfg?.label ?? campaign.status}</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
