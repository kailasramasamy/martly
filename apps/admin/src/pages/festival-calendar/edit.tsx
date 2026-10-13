import { Edit, useForm } from "@refinedev/antd";
import { Form, Row, Col } from "antd";
import { FestivalFields } from "./fields";
import { toFestivalDates, toFestivalPayload } from "./dates";

export const FestivalEdit = () => {
  const { formProps, saveButtonProps, queryResult } = useForm({ resource: "festival-events" });
  const record = queryResult?.data?.data as { startsAt?: string; endsAt?: string } | undefined;

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form
        {...formProps}
        layout="vertical"
        initialValues={{ ...formProps.initialValues, dates: toFestivalDates(record) }}
        onFinish={(values) => formProps.onFinish?.(toFestivalPayload(values))}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <FestivalFields />
          </Col>
        </Row>
      </Form>
    </Edit>
  );
};
