import { useState } from "react";
import { Upload, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { UploadFile, UploadProps } from "antd/es/upload";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:7001";
const TOKEN_KEY = "martly_admin_token";

interface ImageUploadProps {
  value?: string;
  onChange?: (url: string) => void;
}

export const ImageUpload = ({ value, onChange }: ImageUploadProps) => {
  const [fileList, setFileList] = useState<UploadFile[]>(
    value ? [{ uid: "-1", name: "current", status: "done", url: value }] : [],
  );

  const customRequest: UploadProps["customRequest"] = async (options) => {
    const { file, onSuccess, onError } = options;
    const formData = new FormData();
    formData.append("file", file as Blob);

    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`${API_URL}/api/v1/uploads`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const json = await res.json();
      const url = json.data.url as string;
      onChange?.(url);
      onSuccess?.(json);
    } catch (err) {
      message.error("Image upload failed");
      onError?.(err as Error);
    }
  };

  const handleChange: UploadProps["onChange"] = ({ fileList: newFileList }) => {
    setFileList(newFileList.slice(-1));
  };

  return (
    <Upload
      listType="picture-card"
      fileList={fileList}
      customRequest={customRequest}
      onChange={handleChange}
      maxCount={1}
      accept="image/*"
    >
      {fileList.length < 1 && (
        <div>
          <PlusOutlined />
          <div style={{ marginTop: 8 }}>Upload</div>
        </div>
      )}
    </Upload>
  );
};
