import { useEffect, useState } from "react";
import { App, Card, Select, Typography } from "antd";
import { StarOutlined } from "@ant-design/icons";
import { axiosInstance } from "../../providers/data-provider";
import { errorMessage } from "../marketing/utils";
import { sectionTitle } from "../../theme";

const SEARCH_PAGE_SIZE = 20;

interface BrandRef { id: string; name: string; imageUrl: string | null }

/** SUPER_ADMIN picks the brands that lead search and category pages in this organisation's stores */
export function FeaturedBrandsCard({ organizationId }: { organizationId: string }) {
  const { notification } = App.useApp();
  const [featured, setFeatured] = useState<BrandRef[]>([]);
  const [options, setOptions] = useState<BrandRef[]>([]);
  const [loading, setLoading] = useState(false);
  const url = `/marketing/brand-ads/orgs/${organizationId}/featured`;

  useEffect(() => {
    axiosInstance.get(url)
      .then((res) => setFeatured(res.data.data))
      .catch((err) => notification.error({ message: errorMessage(err, "Could not load featured brands") }));
  }, [url, notification]);

  const search = async (q: string) => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/brands", { params: { q, pageSize: SEARCH_PAGE_SIZE } });
      setOptions(res.data.data);
    } finally {
      setLoading(false);
    }
  };

  const save = async (ids: string[]) => {
    try {
      const res = await axiosInstance.put(url, { brandIds: ids });
      setFeatured(res.data.data);
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not save featured brands") });
    }
  };

  const known = new Map([...featured, ...options].map((b) => [b.id, b]));
  return (
    <Card title={sectionTitle(<StarOutlined />, "Featured brands")} size="small" style={{ marginTop: 16 }}>
      <Typography.Paragraph type="secondary">
        Featured brands lead search and category pages in this organisation's stores, marked "Featured".
      </Typography.Paragraph>
      <Select
        mode="multiple"
        showSearch
        filterOption={false}
        loading={loading}
        placeholder="Search brands to feature"
        style={{ width: "100%" }}
        value={featured.map((b) => b.id)}
        options={[...known.values()].map((b) => ({ value: b.id, label: b.name }))}
        onSearch={(q) => void search(q)}
        onChange={(ids: string[]) => void save(ids)}
      />
    </Card>
  );
}
