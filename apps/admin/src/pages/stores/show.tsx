import { Show } from "@refinedev/antd";
import { useShow } from "@refinedev/core";
import { Typography, Tag } from "antd";

const { Title, Text } = Typography;

export const StoreShow = () => {
  const { query } = useShow({ resource: "stores" });
  const record = query?.data?.data;

  if (!record) return null;

  const statusColor =
    record.status === "ACTIVE" ? "green" : record.status === "PENDING" ? "orange" : "red";

  return (
    <Show>
      <Title level={5}>Name</Title>
      <Text>{record.name}</Text>

      <Title level={5}>Slug</Title>
      <Text>{record.slug}</Text>

      <Title level={5}>Organization ID</Title>
      <Text>{record.organizationId}</Text>

      <Title level={5}>Address</Title>
      <Text>{record.address}</Text>

      <Title level={5}>Phone</Title>
      <Text>{record.phone ?? "—"}</Text>

      <Title level={5}>Status</Title>
      <Tag color={statusColor}>{record.status}</Tag>
    </Show>
  );
};
