import { useMemo, useState } from "react";
import { useList, useOne, useGetIdentity } from "@refinedev/core";
import { Show } from "@refinedev/antd";
import { Input, Flex, Row, Col, Empty, Spin } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useParams, useSearchParams } from "react-router";
import { BrandHeader, type BrandRecord } from "./brand-parts";
import { PillRow, ProductCard, countPills, type BrandProduct } from "./brand-products";

/** A brand's products, narrowed by category and subcategory pills (kept in the URL so a filtered view can be shared) */
export const BrandShow = () => {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const categoryId = params.get("category");
  const subcategoryId = params.get("type");
  const [q, setQ] = useState("");
  const { data: identity } = useGetIdentity<{ stores?: { id: string }[] }>();
  // Members of one store see that store's state; owners see how many of their stores list each product
  const singleStoreId = identity?.stores?.length === 1 ? identity.stores[0].id : null;

  const { data: brandData } = useOne<BrandRecord>({ resource: "brands", id });
  const { data, isLoading } = useList<BrandProduct>({
    resource: "products",
    // The whole range in one go so the pills count everything; the largest brand has ~550 products
    pagination: { current: 1, pageSize: 1000 },
    filters: [
      { field: "brandId", operator: "eq", value: id },
      { field: "includeStoreProducts", operator: "eq", value: "true" },
    ],
  });

  const products = useMemo(() => [...(data?.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [data]);
  const matching = products.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));
  const categoryPills = countPills(matching.map((p) => p.subcategory?.category));
  const inCategory = matching.filter((p) => !categoryId || p.subcategory?.category.id === categoryId);
  const visible = inCategory.filter((p) => !subcategoryId || p.subcategory?.id === subcategoryId);

  const select = (category: string | null, type: string | null) => {
    const next = new URLSearchParams();
    if (category) next.set("category", category);
    if (type) next.set("type", type);
    setParams(next, { replace: true });
  };
  // Picking a type also picks its category, so the rows never disagree
  const selectType = (type: string | null) =>
    select(type ? products.find((p) => p.subcategory?.id === type)?.subcategory?.category.id ?? categoryId : categoryId, type);

  const brand = brandData?.data;
  return (
    <Show title={brand?.name ?? "Brand"} headerButtons={() => null}>
      {brand && <BrandHeader brand={brand} productCount={products.length} />}
      <Flex vertical gap={12} style={{ marginTop: 20 }}>
        <Input placeholder="Search products..." prefix={<SearchOutlined />} allowClear value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 360 }} />
        {categoryPills.length > 1 && (
          <PillRow pills={categoryPills} total={matching.length} selected={categoryId} onSelect={(c) => select(c, null)} />
        )}
        <PillRow pills={countPills(inCategory.map((p) => p.subcategory))} total={inCategory.length} selected={subcategoryId} onSelect={selectType} />
        {isLoading ? <Spin style={{ margin: 40 }} /> : visible.length === 0 ? <Empty description="No products" /> : (
          <Row gutter={[12, 12]}>
            {visible.map((p) => (
              <Col key={p.id} xs={12} sm={8} md={6} xl={4}>
                <ProductCard product={p} storeId={singleStoreId} />
              </Col>
            ))}
          </Row>
        )}
      </Flex>
    </Show>
  );
};
