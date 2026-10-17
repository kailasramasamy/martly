import { useEffect, useState } from "react";
import { Button, Card, Progress, Space, Typography } from "antd";
import { AppstoreAddOutlined } from "@ant-design/icons";
import { axiosInstance } from "../../providers/data-provider";

interface Coverage {
  available: number;
  listed: number;
  unlisted: number;
}

const fmt = (n: number) => n.toLocaleString("en-IN");

/** How much of the catalog the store sells, with a way in to the sizes it doesn't yet */
export function CatalogCoverageBar({ storeId, onAdd }: { storeId: string; onAdd: () => void }) {
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  useEffect(() => {
    void axiosInstance.get(`/stores/${storeId}/catalog-coverage`).then((res) => setCoverage(res.data.data));
  }, [storeId]);
  if (!coverage) return null;
  const percent = coverage.available ? Math.floor((coverage.listed / coverage.available) * 100) : 100;
  return (
    <Card size="small">
      <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
        <Space direction="vertical" size={0} style={{ minWidth: 260 }}>
          <Typography.Text strong>
            Lists {fmt(coverage.listed)} of {fmt(coverage.available)} catalog sizes
          </Typography.Text>
          <Typography.Text type="secondary">
            {coverage.unlisted ? `${fmt(coverage.unlisted)} not listed yet` : "Every catalog product is listed"}
          </Typography.Text>
          <Progress percent={percent} size="small" showInfo={false} style={{ marginTop: 4 }} />
        </Space>
        {coverage.unlisted > 0 && <Button type="primary" icon={<AppstoreAddOutlined />} onClick={onAdd}>Add unlisted products</Button>}
      </Space>
    </Card>
  );
}
