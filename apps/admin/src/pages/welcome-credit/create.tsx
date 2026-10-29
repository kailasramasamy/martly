import { Create } from "@refinedev/antd";
import { Form } from "antd";
import { ReadableSection } from "../../components/ReadableSection";
import { CampaignForm, useCampaignSave } from "./form";

export const WelcomeCreditCreate = () => {
  const [form] = Form.useForm();
  const { saving, save } = useCampaignSave(form);

  return (
    <Create title="New welcome credit" saveButtonProps={{ onClick: save, loading: saving }}>
      <ReadableSection>
        <CampaignForm form={form} />
      </ReadableSection>
    </Create>
  );
};
