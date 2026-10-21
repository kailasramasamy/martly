import { Edit, useForm } from "@refinedev/antd";
import { Form } from "antd";
import type { BaseRecord, HttpError } from "@refinedev/core";
import { GlossaryFields } from "./fields";
import { toGlossaryPayload, type GlossaryFormValues } from "./payload";
import { ReadableSection } from "../../components/ReadableSection";

export const GlossaryEdit = () => {
  const { formProps, saveButtonProps } = useForm<BaseRecord, HttpError, GlossaryFormValues>({ resource: "list-glossary" });

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <ReadableSection>
        <Form
          {...formProps}
          layout="vertical"
          onFinish={(values) => formProps.onFinish?.(toGlossaryPayload(values))}
        >
          <GlossaryFields />
        </Form>
      </ReadableSection>
    </Edit>
  );
};
