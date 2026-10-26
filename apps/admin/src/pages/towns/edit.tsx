import { Edit, useForm } from "@refinedev/antd";
import { Card, Form } from "antd";
import { EnvironmentOutlined } from "@ant-design/icons";
import { sectionTitle } from "../../theme";
import { ReadableSection } from "../../components/ReadableSection";
import { TownFields } from "./fields";

export const TownEdit = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "towns" });

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <ReadableSection>
        <Form {...formProps} layout="vertical">
          <Card title={sectionTitle(<EnvironmentOutlined />, "Town Details")} size="small">
            <TownFields />
          </Card>
        </Form>
      </ReadableSection>
    </Edit>
  );
};
