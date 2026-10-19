import { useState } from "react";
import { Link } from "react-router";
import { Button, Card, Space, Typography, message } from "antd";
import { HomeOutlined } from "@ant-design/icons";
import { axiosInstance } from "../../providers/data-provider";
import { sectionTitle } from "../../theme";

const { Text } = Typography;

/** Adds this collection to the home layout as a product row or campaign card */
export const ShowOnHomeCard = ({ collection }: { collection: { id: string; title: string; organizationId?: string | null } }) => {
  const [busy, setBusy] = useState(false);
  const params = collection.organizationId ? { organizationId: collection.organizationId } : undefined;

  const add = async (type: "PRODUCT_ROW" | "CAMPAIGN_CARD") => {
    setBusy(true);
    try {
      const layout = (await axiosInstance.get("/home-layout", { params })).data.data;
      if (layout.isDefault) await axiosInstance.post("/home-layout/customize", undefined, { params });
      await axiosInstance.post("/home-layout", { type, collectionId: collection.id, config: {}, isActive: true }, { params });
      message.success("Added to the home layout");
    } catch (e: any) {
      message.error(e?.response?.data?.error ?? "Could not add to the home layout");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={sectionTitle(<HomeOutlined />, "Show on Home")} size="small" style={{ marginTop: 16 }}>
      <Space wrap>
        <Button loading={busy} onClick={() => add("PRODUCT_ROW")}>Add as product row</Button>
        <Button loading={busy} onClick={() => add("CAMPAIGN_CARD")}>Add as campaign card</Button>
        <Text type="secondary"><Link to="/home-layout">Open Home layout</Link></Text>
      </Space>
    </Card>
  );
};
