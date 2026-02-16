import { useState } from "react";
import { Card, List, Button, Typography, Space, message } from "antd";
import { BankOutlined, ShopOutlined } from "@ant-design/icons";
import { getPendingOrgs, selectOrganization } from "../providers/auth-provider";

const { Title, Text } = Typography;

export const SelectOrgPage = () => {
  const orgs = getPendingOrgs();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelect = async (orgId: string) => {
    setLoading(orgId);
    try {
      await selectOrganization(orgId);
      window.location.href = "/";
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to select organization");
      setLoading(null);
    }
  };

  if (orgs.length === 0) {
    window.location.href = "/login";
    return null;
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", background: "#f5f5f5" }}>
      <Card style={{ width: 480, maxWidth: "90vw" }}>
        <Space direction="vertical" size="large" style={{ width: "100%", textAlign: "center" }}>
          <ShopOutlined style={{ fontSize: 48, color: "#0d9488" }} />
          <Title level={3} style={{ margin: 0 }}>Select Organization</Title>
          <Text type="secondary">You belong to multiple organizations. Choose one to continue.</Text>
          <List
            dataSource={orgs}
            renderItem={(org) => (
              <List.Item
                key={org.id}
                actions={[
                  <Button
                    type="primary"
                    loading={loading === org.id}
                    disabled={loading !== null && loading !== org.id}
                    onClick={() => handleSelect(org.id)}
                  >
                    Select
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<BankOutlined style={{ fontSize: 24, color: "#0d9488" }} />}
                  title={org.name}
                  description={org.slug}
                />
              </List.Item>
            )}
          />
        </Space>
      </Card>
    </div>
  );
};
