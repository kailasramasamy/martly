import { List, useTable, DateField } from "@refinedev/antd";
import { Table, Tag, Space, Button, Rate, Image } from "antd";
import { CheckOutlined, CloseOutlined } from "@ant-design/icons";
import { useCustomMutation, useInvalidate } from "@refinedev/core";

const STATUS_COLORS: Record<string, string> = { PENDING: "orange", APPROVED: "green", REJECTED: "red" };

export const ReviewList = () => {
  const { tableProps } = useTable({
    resource: "reviews/moderation",
    syncWithLocation: true,
  });
  const { mutate } = useCustomMutation();
  const invalidate = useInvalidate();

  const handleStatus = (id: string, status: string) => {
    mutate({
      url: `reviews/${id}/status`,
      method: "patch",
      values: { status },
    }, {
      onSuccess: () => invalidate({ resource: "reviews/moderation", invalidates: ["list"] }),
    });
  };

  return (
    <List resource="reviews" title="Review Moderation">
      <Table {...tableProps} rowKey="id" size="small">
        <Table.Column dataIndex={["product", "name"]} title="Product" render={(v: string, r: any) => (
          <Space>
            {r.product?.imageUrl && <Image src={r.product.imageUrl} width={32} height={32} style={{ borderRadius: 4, objectFit: "cover" }} preview={false} />}
            <span>{v}</span>
          </Space>
        )} />
        <Table.Column dataIndex={["user", "name"]} title="User" />
        <Table.Column dataIndex="rating" title="Rating" render={(v: number) => <Rate disabled value={v} style={{ fontSize: 14 }} />} />
        <Table.Column dataIndex="comment" title="Comment" ellipsis />
        <Table.Column dataIndex="isVerified" title="Verified" render={(v: boolean) =>
          v ? <Tag color="green">Verified</Tag> : <Tag>Unverified</Tag>
        } />
        <Table.Column dataIndex="status" title="Status" render={(v: string) =>
          <Tag color={STATUS_COLORS[v]}>{v}</Tag>
        } />
        <Table.Column dataIndex="createdAt" title="Date" render={(v: string) => <DateField value={v} format="DD MMM YYYY" />} />
        <Table.Column title="Actions" render={(_, r: any) => (
          <Space>
            {r.status !== "APPROVED" && (
              <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleStatus(r.id, "APPROVED")}>
                Approve
              </Button>
            )}
            {r.status !== "REJECTED" && (
              <Button size="small" danger icon={<CloseOutlined />} onClick={() => handleStatus(r.id, "REJECTED")}>
                Reject
              </Button>
            )}
          </Space>
        )} />
      </Table>
    </List>
  );
};
