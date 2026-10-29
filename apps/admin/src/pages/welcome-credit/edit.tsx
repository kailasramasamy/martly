import { useEffect, useState } from "react";
import { Edit } from "@refinedev/antd";
import { Form, Spin, message } from "antd";
import { useParams } from "react-router";
import type { CreditCampaignRow } from "@martly/shared/types";
import { axiosInstance } from "../../providers/data-provider";
import { ReadableSection } from "../../components/ReadableSection";
import { CampaignForm, useCampaignSave } from "./form";

export const WelcomeCreditEdit = () => {
  const { id } = useParams();
  const [form] = Form.useForm();
  const [record, setRecord] = useState<CreditCampaignRow>();
  const { saving, save } = useCampaignSave(form, record);

  useEffect(() => {
    axiosInstance
      .get(`/credits/campaigns/${id}`)
      .then((res) => setRecord(res.data.data))
      .catch((err) => message.error(err.response?.data?.message ?? "Couldn't load the welcome credit"));
  }, [id]);

  return (
    <Edit title="Edit welcome credit" saveButtonProps={{ onClick: save, loading: saving, disabled: !record }}>
      <ReadableSection>
        {record ? <CampaignForm form={form} record={record} /> : <Spin />}
      </ReadableSection>
    </Edit>
  );
};
