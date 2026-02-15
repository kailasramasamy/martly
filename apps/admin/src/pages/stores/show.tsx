import { Show } from "@refinedev/antd";
import { useShow, useOne } from "@refinedev/core";
import { Typography, Tag, Button } from "antd";
import { useNavigate } from "react-router";

const { Title, Text } = Typography;

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

  const statusColor =
    record.status === "ACTIVE" ? "green" : record.status === "PENDING" ? "orange" : "red";

  return (
    <Show>
      <Title level={5}>Organization</Title>
      <Text>{orgData?.data?.name ?? record.organizationId}</Text>

      <Title level={5}>Name</Title>
      <Text>{record.name}</Text>

      <Title level={5}>Slug</Title>
      <Text>{record.slug}</Text>

      <Title level={5}>Address</Title>
      <Text>{record.address}</Text>

      <Title level={5}>Phone</Title>
      <Text>{record.phone ?? "—"}</Text>

      <Title level={5}>Status</Title>
      <Tag color={statusColor}>{record.status}</Tag>

      <div style={{ marginTop: 24 }}>
        <Button type="primary" onClick={() => navigate(`/stores/show/${record.id}/onboard`)}>
          Onboard Products
        </Button>
      </div>
    </Show>
  );
};
