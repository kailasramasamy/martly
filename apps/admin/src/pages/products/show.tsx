import { Show } from "@refinedev/antd";
import { useShow } from "@refinedev/core";
import { Typography, Image } from "antd";

const { Title, Text } = Typography;

export const ProductShow = () => {
  const { query } = useShow({ resource: "products" });
  const record = query?.data?.data;

  if (!record) return null;

  return (
    <Show>
      <Title level={5}>Name</Title>
      <Text>{record.name}</Text>

      <Title level={5}>Description</Title>
      <Text>{record.description ?? "—"}</Text>

      <Title level={5}>SKU</Title>
      <Text>{record.sku ?? "—"}</Text>

      <Title level={5}>Image</Title>
      {record.imageUrl ? <Image width={200} src={record.imageUrl} /> : <Text>—</Text>}
    </Show>
  );
};
