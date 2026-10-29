import { useState } from "react";
import { App, Button, Card, Input, Select, Space, Typography } from "antd";
import type { FormInstance } from "antd";
import { RobotOutlined } from "@ant-design/icons";
import { useSelect } from "@refinedev/antd";
import { useGetIdentity } from "@refinedev/core";
import { isAxiosError } from "axios";
import { axiosInstance } from "../../providers/data-provider";
import { sectionTitle } from "../../theme";

export interface DraftProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  subcategory: string | null;
}

interface Draft {
  title: string;
  subtitle: string;
  titleTa: string;
  subtitleTa: string;
  slug: string;
  artDirection: string;
  organizationId: string;
  products: DraftProduct[];
}

/**
 * A brief the AI curator turns into a draft: English and Tamil copy, in-stock products across the right aisles and the
 * banner's art direction, filled into the create form for the admin to edit. Text only, so it uses no image credits.
 */
export const AiBuilderCard = ({ form, onDrafted }: { form: FormInstance; onDrafted: (products: DraftProduct[]) => void }) => {
  const { message } = App.useApp();
  const { data: identity } = useGetIdentity<{ role: string }>();
  const isSuperAdmin = identity?.role === "SUPER_ADMIN";
  // Only Super Admin picks an organization (and may list them); others draft for their own
  const { selectProps: orgSelectProps } = useSelect({
    resource: "organizations", optionLabel: "name", optionValue: "id", queryOptions: { enabled: isSuperAdmin },
  });
  const [brief, setBrief] = useState("");
  const [organizationId, setOrganizationId] = useState<string>();
  const [busy, setBusy] = useState(false);

  const draft = async () => {
    setBusy(true);
    try {
      const res = await axiosInstance.post<{ data: Draft }>("/collections/ai-draft", {
        brief, kind: form.getFieldValue("kind"), organizationId,
      }, { timeout: 120000 });
      const { products, ...copy } = res.data.data;
      onDrafted(products);
      form.setFieldsValue({ ...copy, productIds: products.map((p) => p.id) });
      message.success(`Drafted "${copy.title}" with ${products.length} products; check and edit before saving`);
    } catch (err) {
      if (!isAxiosError(err)) throw err;
      message.error(err.response?.data?.message ?? "The draft failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={sectionTitle(<RobotOutlined />, "Build a collection for me")} size="small" style={{ marginBottom: 16 }}>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
        Describe the collection. We pick in-stock products across the right aisles and write the title and subtitle in
        English and Tamil. Drafting is free; the banner is drawn when you save.
      </Typography.Paragraph>
      <Space direction="vertical" style={{ width: "100%" }}>
        {isSuperAdmin && (
          <Select
            options={orgSelectProps.options} loading={orgSelectProps.loading} showSearch optionFilterProp="label"
            value={organizationId} onChange={setOrganizationId} placeholder="Organization whose stores it draws from" style={{ width: "100%" }}
          />
        )}
        <Input.TextArea
          value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={300} autoSize={{ minRows: 2, maxRows: 4 }}
          placeholder="e.g. Rainy-evening snacks and hot drinks, or Everything for a South Indian breakfast"
        />
        <Button type="primary" icon={<RobotOutlined />} loading={busy} disabled={brief.trim().length < 3 || (isSuperAdmin && !organizationId)} onClick={draft}>
          Draft it
        </Button>
      </Space>
    </Card>
  );
};
