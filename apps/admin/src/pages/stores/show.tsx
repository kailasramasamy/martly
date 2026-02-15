import { Show } from "@refinedev/antd";
import { useShow, useOne } from "@refinedev/core";
import { Tag, Button, Card, Descriptions, Row, Col } from "antd";
import { useNavigate } from "react-router";
import { ShopOutlined, EnvironmentOutlined } from "@ant-design/icons";

import { STORE_STATUS_CONFIG } from "../../constants/tag-colors";
import { sectionTitle } from "../../theme";

export const StoreShow = () => {
  const { query } = useShow({ resource: "stores" });
  const record = query?.data?.data;
  const navigate = useNavigate();

  const { data: orgData } = useOne({
    resource: "organizations",
    id: record?.organizationId,
    queryOptions: { enabled: !!record?.organizationId },
  });

  if (!record) return null;

  const statusConfig = STORE_STATUS_CONFIG[record.status] ?? { color: "default", label: record.status };

  return (
    <Show>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={sectionTitle(<ShopOutlined />, "Store Details")} size="small">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Name">{record.name}</Descriptions.Item>
              <Descriptions.Item label="Slug">{record.slug}</Descriptions.Item>
              <Descriptions.Item label="Organization">
                {orgData?.data?.name ?? record.organizationId}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title={sectionTitle(<EnvironmentOutlined />, "Contact & Location")} size="small">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Address">{record.address}</Descriptions.Item>
              <Descriptions.Item label="Phone">{record.phone ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Created">
                {record.createdAt ? new Date(record.createdAt).toLocaleString() : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Last Updated">
                {record.updatedAt ? new Date(record.updatedAt).toLocaleString() : "—"}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24}>
          <Button type="primary" onClick={() => navigate(`/stores/show/${record.id}/onboard`)}>
            Onboard Products
          </Button>
        </Col>
      </Row>
    </Show>
  );
};
