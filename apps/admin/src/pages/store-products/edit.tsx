import { Edit, useForm } from "@refinedev/antd";
import { useGetIdentity } from "@refinedev/core";
import { canChangeStoreProductField, type PermissionSubject } from "@martly/shared/permissions";
import { Form, InputNumber, Switch, Card, Row, Col, Descriptions, Select, DatePicker, Tag } from "antd";
import { InfoCircleOutlined, DollarOutlined, TagOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

import { sectionTitle } from "../../theme";
import { DISCOUNT_TYPE_OPTIONS } from "../../constants/tag-colors";
import { ReadableSection } from "../../components/ReadableSection";
import { OfferCard, offerInitialValues, offerPayload } from "../../components/OfferFields";

export const StoreProductEdit = () => {
  const { formProps, saveButtonProps, query } = useForm({
    resource: "store-products",
  });

  const record = query?.data?.data as {
    store?: { name: string };
    product?: { name: string };
    stock?: number;
    reservedStock?: number;
    availableStock?: number;
  } | undefined;

  const discountType = Form.useWatch("discountType", formProps.form);
  // Only offer what the API accepts from this member; the rest shows disabled
  const { data: identity } = useGetIdentity<PermissionSubject>();
  const may = (field: string) => !!identity && canChangeStoreProductField(identity, field);
  const canPrice = may("price");
  const canStock = may("stock");

  // Convert date strings to dayjs for DatePicker
  const originalOnFinish = formProps.onFinish;
  const enhancedFormProps = {
    ...formProps,
    initialValues: {
      ...formProps.initialValues,
      discountStart: formProps.initialValues?.discountStart ? dayjs(formProps.initialValues.discountStart) : null,
      discountEnd: formProps.initialValues?.discountEnd ? dayjs(formProps.initialValues.discountEnd) : null,
      ...offerInitialValues(formProps.initialValues ?? {}),
      offerStart: formProps.initialValues?.offerStart ? dayjs(formProps.initialValues.offerStart) : null,
      offerEnd: formProps.initialValues?.offerEnd ? dayjs(formProps.initialValues.offerEnd) : null,
    },
    onFinish: (values: Record<string, unknown>) => {
      return originalOnFinish?.({
        ...(canPrice && {
          price: values.price != null ? Number(values.price) : undefined,
          memberPrice: values.memberPrice != null ? Number(values.memberPrice) : null,
          discountType: values.discountType || null,
          discountValue: values.discountValue != null ? Number(values.discountValue) : null,
          discountStart: values.discountStart ? (values.discountStart as dayjs.Dayjs).toISOString() : null,
          discountEnd: values.discountEnd ? (values.discountEnd as dayjs.Dayjs).toISOString() : null,
          ...offerPayload(values),
        }),
        ...(canStock && { stock: values.stock != null ? Number(values.stock) : undefined }),
        ...(may("isActive") && { isActive: values.isActive }),
        ...(may("isFeatured") && { isFeatured: values.isFeatured }),
      });
    },
  };

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <ReadableSection>
        <Form {...enhancedFormProps} layout="vertical">
          <Row gutter={[16, 16]}>
            {(record?.store || record?.product) && (
              <Col xs={24}>
                <Card title={sectionTitle(<InfoCircleOutlined />, "Product Info")} size="small" style={{ marginBottom: 16 }}>
                  <Descriptions column={{ xs: 1, sm: 2, md: 4 }} size="small" bordered>
                    {record?.store && (
                      <Descriptions.Item label="Store">{record.store.name}</Descriptions.Item>
                    )}
                    {record?.product && (
                      <Descriptions.Item label="Product">{record.product.name}</Descriptions.Item>
                    )}
                    {record?.stock != null && (() => {
                      const total = record.stock ?? 0;
                      const reserved = record.reservedStock ?? 0;
                      const available = record.availableStock ?? (total - reserved);
                      return (
                        <>
                          <Descriptions.Item label="Available Stock">
                            <span style={{ fontWeight: 600 }}>{available}</span>
                            <span style={{ color: "#999", marginLeft: 4 }}>/ {total}</span>
                            {" "}
                            {available <= 0 ? <Tag color="red">Out of stock</Tag>
                              : available <= 5 ? <Tag color="orange">Low stock</Tag>
                              : <Tag color="green">In stock</Tag>}
                          </Descriptions.Item>
                          <Descriptions.Item label="Reserved">
                            {reserved > 0 ? <span>{reserved} unit{reserved !== 1 ? "s" : ""} in active orders</span> : <span style={{ color: "#999" }}>None</span>}
                          </Descriptions.Item>
                        </>
                      );
                    })()}
                  </Descriptions>
                </Card>
              </Col>
            )}

            <Col xs={24} lg={12}>
              <Card title={sectionTitle(<DollarOutlined />, "Pricing & Stock")} size="small">
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item label="Price" name="price" rules={[{ required: true }]}>
                      <InputNumber min={0.01} step={0.01} style={{ width: "100%" }} disabled={!canPrice} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label="Member Price" name="memberPrice" extra="Special price for membership subscribers. Leave empty for no member pricing.">
                      <InputNumber min={0.01} step={0.01} style={{ width: "100%" }} placeholder="Optional" disabled={!canPrice} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label="Total Stock (on-hand)" name="stock" rules={[{ required: true }]} extra="Physical inventory count. Available stock is computed as total minus reserved.">
                      <InputNumber min={0} step={1} style={{ width: "100%" }} disabled={!canStock} />
                    </Form.Item>
                  </Col>
                  <Col xs={12}>
                    <Form.Item label="Active" name="isActive" valuePropName="checked">
                      <Switch disabled={!may("isActive")} />
                    </Form.Item>
                  </Col>
                  <Col xs={12}>
                    <Form.Item label="Featured" name="isFeatured" valuePropName="checked">
                      <Switch disabled={!may("isFeatured")} />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card title={sectionTitle(<TagOutlined />, "Discount")} size="small">
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item label="Discount Type" name="discountType">
                      <Select options={DISCOUNT_TYPE_OPTIONS} allowClear placeholder="No discount" disabled={!canPrice} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label="Discount Value" name="discountValue">
                      <InputNumber
                        min={0}
                        step={discountType === "PERCENTAGE" ? 1 : 0.01}
                        max={discountType === "PERCENTAGE" ? 100 : undefined}
                        style={{ width: "100%" }}
                        placeholder={discountType === "PERCENTAGE" ? "e.g. 10" : "e.g. 15.00"}
                        addonAfter={discountType === "PERCENTAGE" ? "%" : "₹"}
                        disabled={!canPrice}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label="Start Date" name="discountStart">
                      <DatePicker showTime style={{ width: "100%" }} disabled={!canPrice} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label="End Date" name="discountEnd">
                      <DatePicker showTime style={{ width: "100%" }} disabled={!canPrice} />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <OfferCard disabled={!canPrice} />
            </Col>
          </Row>
        </Form>
      </ReadableSection>
    </Edit>
  );
};
