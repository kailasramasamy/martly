import { useState, useEffect } from "react";
import { Create, useForm } from "@refinedev/antd";
import { Form, Input, Select, InputNumber, Switch, DatePicker, Card, Row, Col, Cascader } from "antd";
import { BannerPlacementLabels, BannerActionTypeLabels } from "@martly/shared/constants";
import { ImageUpload } from "../../components/ImageUpload";
import { useList } from "@refinedev/core";
import { axiosInstance } from "../../providers/data-provider";

const placementOptions = Object.entries(BannerPlacementLabels).map(([value, label]) => ({ value, label }));
const actionTypeOptions = Object.entries(BannerActionTypeLabels).map(([value, label]) => ({ value, label }));

interface SubcategoryNode { id: string; name: string; }
interface CategoryNode { id: string; name: string; subcategories: SubcategoryNode[]; }
interface DepartmentNode { id: string; name: string; categories: CategoryNode[]; }

interface CascaderOption { value: string; label: string; children?: CascaderOption[]; }

function buildCascaderOptions(departments: DepartmentNode[]): CascaderOption[] {
  return departments.map((d) => ({
    value: d.id,
    label: d.name,
    children: d.categories.map((c) => ({
      value: c.id,
      label: c.name,
      children: c.subcategories.map((s) => ({ value: s.id, label: s.name })),
    })),
  }));
}

export const BannerCreate = () => {
  const { formProps, saveButtonProps, form } = useForm({ resource: "banners" });
  const actionType = Form.useWatch("actionType", form);
  const placement = Form.useWatch("placement", form);

  const [cascaderOptions, setCascaderOptions] = useState<CascaderOption[]>([]);
  useEffect(() => {
    axiosInstance.get("/categories/tree").then((res) => {
      setCascaderOptions(buildCascaderOptions(res.data.data));
    }).catch(() => {});
  }, []);

  const { data: collectionsData } = useList({ resource: "collections", pagination: { pageSize: 200 } });
  const { data: storesData } = useList({ resource: "stores", pagination: { pageSize: 200 } });

  const collections = collectionsData?.data ?? [];
  const stores = storesData?.data ?? [];

  // Transform categoryPath cascader to correct FK on submit
  const originalOnFinish = formProps.onFinish;
  const handleFinish = (values: Record<string, unknown>) => {
    const path = values.categoryPath as string[] | undefined;
    if (path?.length) {
      if (path.length === 1) values.departmentId = path[0];
      else if (path.length === 2) values.categoryId = path[1];
      else if (path.length === 3) values.subcategoryId = path[2];
    }
    delete values.categoryPath;
    originalOnFinish?.(values);
  };

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} onFinish={handleFinish} layout="vertical" initialValues={{ actionType: "NONE", isActive: true, sortOrder: 0 }}>
        <Row gutter={24}>
          <Col xs={24} lg={14}>
            <Card title="Banner Details" size="small">
              <Form.Item name="title" label="Title" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="subtitle" label="Subtitle">
                <Input />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="placement" label="Placement" rules={[{ required: true }]}>
                    <Select options={placementOptions} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="actionType" label="Action Type">
                    <Select options={actionTypeOptions} />
                  </Form.Item>
                </Col>
              </Row>

              {actionType === "CATEGORY" && (
                <Form.Item name="actionTarget" label="Target Category" rules={[{ required: true }]}>
                  <Cascader
                    options={cascaderOptions}
                    changeOnSelect
                    placeholder="Select a department, category, or subcategory"
                    showSearch={{
                      filter: (input, path) =>
                        path.some((opt) => String(opt.label).toLowerCase().includes(input.toLowerCase())),
                    }}
                    onChange={(path) => {
                      if (path?.length) form.setFieldValue("actionTarget", path[path.length - 1]);
                    }}
                  />
                </Form.Item>
              )}
              {actionType === "PRODUCT" && (
                <Form.Item name="actionTarget" label="Target Product ID" rules={[{ required: true }]}>
                  <Input placeholder="Product UUID" />
                </Form.Item>
              )}
              {actionType === "COLLECTION" && (
                <Form.Item name="actionTarget" label="Target Collection" rules={[{ required: true }]}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={collections.map((c: any) => ({ value: c.id, label: c.title }))}
                    placeholder="Select a collection"
                  />
                </Form.Item>
              )}
              {actionType === "SEARCH" && (
                <Form.Item name="actionTarget" label="Search Query" rules={[{ required: true }]}>
                  <Input placeholder="e.g. organic fruits" />
                </Form.Item>
              )}
              {actionType === "URL" && (
                <Form.Item name="actionTarget" label="URL" rules={[{ required: true, type: "url" }]}>
                  <Input placeholder="https://..." />
                </Form.Item>
              )}

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="sortOrder" label="Sort Order">
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="isActive" label="Active" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          <Col xs={24} lg={10}>
            <Card title="Image" size="small" style={{ marginBottom: 16 }}>
              <Form.Item
                name="imageUrl"
                rules={[{ required: true, message: "Banner image is required" }]}
                getValueFromEvent={(url: string) => url}
              >
                <ImageUpload />
              </Form.Item>
            </Card>

            <Card title="Targeting" size="small" style={{ marginBottom: 16 }}>
              <Form.Item name="storeId" label="Store (optional)">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={stores.map((s: any) => ({ value: s.id, label: s.name }))}
                  placeholder="All stores (org-wide)"
                />
              </Form.Item>
              {placement === "CATEGORY_TOP" && (
                <Form.Item name="categoryPath" label="Category (optional)">
                  <Cascader
                    options={cascaderOptions}
                    changeOnSelect
                    allowClear
                    placeholder="All categories (generic)"
                    showSearch={{
                      filter: (input, path) =>
                        path.some((opt) => String(opt.label).toLowerCase().includes(input.toLowerCase())),
                    }}
                  />
                </Form.Item>
              )}
            </Card>

            <Card title="Schedule" size="small">
              <Form.Item name="startsAt" label="Start Date">
                <DatePicker showTime style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="endsAt" label="End Date">
                <DatePicker showTime style={{ width: "100%" }} />
              </Form.Item>
            </Card>
          </Col>
        </Row>
      </Form>
    </Create>
  );
};
