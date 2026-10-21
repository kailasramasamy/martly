import { Create, useForm } from "@refinedev/antd";
import { Form } from "antd";
import type { BaseRecord, HttpError } from "@refinedev/core";
import { GlossaryFields } from "./fields";
import { toGlossaryPayload, type GlossaryFormValues } from "./payload";
import { ReadableSection } from "../../components/ReadableSection";

export const GlossaryCreate = () => {
  const { formProps, saveButtonProps } = useForm<BaseRecord, HttpError, GlossaryFormValues>({ resource: "list-glossary" });

  return (
    <Create saveButtonProps={saveButtonProps}>
      <ReadableSection>
        <Form
          {...formProps}
          layout="vertical"
          initialValues={{ isActive: true, phrases: [{ language: "ta" }] }}
          onFinish={(values) => formProps.onFinish?.(toGlossaryPayload(values))}
        >
          <GlossaryFields />
        </Form>
      </ReadableSection>
    </Create>
  );
};
