import { Create, useForm } from "@refinedev/antd";
import { Card, Form } from "antd";
import { EnvironmentOutlined } from "@ant-design/icons";
import { sectionTitle } from "../../theme";
import { ReadableSection } from "../../components/ReadableSection";
import { TownFields } from "./fields";

export const TownCreate = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "towns" });

  const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const slug = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    formProps.form?.setFieldsValue({ slug });
  };

  return (
    <Create saveButtonProps={saveButtonProps}>
      <ReadableSection>
        <Form {...formProps} layout="vertical">
          <Card title={sectionTitle(<EnvironmentOutlined />, "Town Details")} size="small">
            <TownFields onNameChange={onNameChange} />
          </Card>
        </Form>
      </ReadableSection>
    </Create>
  );
};
