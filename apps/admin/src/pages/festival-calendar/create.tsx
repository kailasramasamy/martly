import { Create, useForm } from "@refinedev/antd";
import { Form, Row, Col } from "antd";
import { FestivalFields } from "./fields";
import { toFestivalPayload } from "./dates";

export const FestivalCreate = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "festival-events" });

  const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const slug = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    formProps.form?.setFieldsValue({ slug });
  };

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form
        {...formProps}
        layout="vertical"
        initialValues={{ isActive: true, kind: "OCCASION", leadDays: 7, regions: ["ALL"] }}
        onFinish={(values) => formProps.onFinish?.(toFestivalPayload(values))}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <FestivalFields onNameChange={onNameChange} />
          </Col>
        </Row>
      </Form>
    </Create>
  );
};
