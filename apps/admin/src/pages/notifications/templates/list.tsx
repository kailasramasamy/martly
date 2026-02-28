import { useCallback, useEffect, useState } from "react";
import { Card, Table, Tag, Space, Input, Button, Typography, Popconfirm, message } from "antd";
import { EditOutlined, DeleteOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router";
import dayjs from "dayjs";

import { axiosInstance } from "../../../providers/data-provider";
import { NOTIFICATION_TYPE_CONFIG } from "../../../constants/tag-colors";

const { Title } = Typography;

interface Template {
  id: string;
  name: string;
  title: string;
  body: string;
  type: string;
  imageUrl: string | null;
  createdAt: string;
  creator: { name: string } | null;
}

export const TemplateList = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, pageSize };
      if (search) params.q = search;
      const res = await axiosInstance.get("/notifications/admin/templates", { params });
      setTemplates(res.data?.data ?? []);
      setTotal(res.data?.meta?.total ?? 0);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const handleDelete = async (id: string) => {
    try {
      await axiosInstance.delete(`/notifications/admin/templates/${id}`);
      message.success("Template deleted");
      fetchTemplates();
    } catch {
      message.error("Failed to delete template");
    }
  };

  return (
    <div style={{ padding: "16px 24px 32px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0 }}>Notification Templates</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate("/notifications/templates/create")}
        >
          Create Template
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }} styles={{ body: { padding: "12px 16px" } }}>
        <Input
          placeholder="Search templates..."
          prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
          allowClear
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 300 }}
        />
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={templates}
          rowKey="id"
          size="small"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `${t} templates`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          columns={[
            {
              title: "Name",
              dataIndex: "name",
              ellipsis: true,
              render: (name: string) => (
                <span style={{ fontWeight: 500 }}>{name}</span>
              ),
            },
            {
              title: "Title",
              dataIndex: "title",
              ellipsis: true,
            },
            {
              title: "Type",
              dataIndex: "type",
              width: 140,
              render: (v: string) => {
                const cfg = NOTIFICATION_TYPE_CONFIG[v];
                return <Tag color={cfg?.color ?? "default"}>{cfg?.label ?? v}</Tag>;
              },
            },
            {
              title: "Created",
              dataIndex: "createdAt",
              width: 150,
              render: (d: string) => (
                <span style={{ fontSize: 13 }}>{dayjs(d).format("DD MMM YYYY, HH:mm")}</span>
              ),
            },
            {
              title: "Actions",
              width: 100,
              align: "center" as const,
              render: (_: unknown, rec: Template) => (
                <Space>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => navigate(`/notifications/templates/edit/${rec.id}`)}
                  />
                  <Popconfirm
                    title="Delete template?"
                    description="This action cannot be undone."
                    onConfirm={() => handleDelete(rec.id)}
                    okText="Delete"
                    okButtonProps={{ danger: true }}
                  >
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};
