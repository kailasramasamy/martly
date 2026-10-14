import { useState } from "react";
import { App, Button, Tooltip, Upload } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { isAxiosError } from "axios";
import { axiosInstance } from "../../providers/data-provider";

interface Props {
  /** API path that takes the image as multipart `file`, e.g. `/collections/:id/hero/image` */
  path: string;
  hint: string;
  onReplaced: () => void;
}

/** Swaps one piece of generated art for an uploaded image; the API crops and fits it like generated art. */
export const ReplaceImageButton = ({ path, hint, onReplaced }: Props) => {
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    setBusy(true);
    try {
      await axiosInstance.put(path, form, { timeout: 60000 });
      message.success("Image replaced");
      onReplaced();
    } catch (err) {
      if (!isAxiosError(err)) throw err;
      message.error(err.response?.data?.message ?? "Couldn't replace the image");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Upload
      accept="image/png,image/jpeg,image/webp"
      showUploadList={false}
      beforeUpload={(file) => {
        void upload(file);
        return false;
      }}
    >
      <Tooltip title={hint}>
        <Button size="small" icon={<UploadOutlined />} loading={busy}>Replace</Button>
      </Tooltip>
    </Upload>
  );
};
