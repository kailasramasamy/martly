import { useState } from "react";
import { Form, Modal } from "antd";
import type { PromoBanner, PromoDetail } from "@martly/shared/types";
import { axiosInstance } from "../../providers/data-provider";
import { useNotifyBannerError } from "../banners/banner-shared";
import type { CascaderOption } from "../banners/category-target";
import { PromoBannerFields } from "./manual/banner-fields";
import { toBannerBody, toBannerFormValues, type BannerFormValues } from "./manual/banner-payload";

interface Props {
  promo: PromoDetail;
  /** The banner being edited; empty when adding */
  banner?: PromoBanner;
  tree: CascaderOption[];
  aiImages?: { used: number; total: number };
  onClose: () => void;
  onSaved: () => void;
}

const NEW_BANNER: Partial<BannerFormValues> = { textInImage: true };

export function PromoBannerModal({ promo, banner, tree, aiImages, onClose, onSaved }: Props) {
  const [form] = Form.useForm<BannerFormValues>();
  const [saving, setSaving] = useState(false);
  const notifyError = useNotifyBannerError("Could not save the banner");

  const context = () => ({
    title: form.getFieldValue("title") || promo.title || promo.brief,
    subtitle: form.getFieldValue("subtitle") || undefined,
    actionType: promo.actionType ?? undefined,
    actionTarget: promo.actionTarget ?? undefined,
  });

  const save = async (values: BannerFormValues) => {
    setSaving(true);
    try {
      const body = toBannerBody(values);
      if (banner) await axiosInstance.put(`/promos/${promo.id}/banners/${banner.id}`, body);
      else await axiosInstance.post(`/promos/${promo.id}/banners`, body);
      onSaved();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={banner ? "Edit banner" : "Add banner"} okText="Save" confirmLoading={saving} onOk={() => form.submit()} onCancel={onClose} width={640}>
      <Form form={form} layout="vertical" initialValues={banner ? toBannerFormValues(banner, tree) : NEW_BANNER} onFinish={save}>
        <PromoBannerFields form={form} tree={tree} context={context} aiImages={aiImages} withCopy />
      </Form>
    </Modal>
  );
}
