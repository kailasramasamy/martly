import { useState, useEffect } from "react";
import { Upload, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { UploadFile, UploadProps } from "antd/es/upload";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:7001";
const TOKEN_KEY = "martly_admin_token";

interface MultiImageUploadProps {
  value?: string[];
  onChange?: (urls: string[]) => void;
  max?: number;
}

export const MultiImageUpload = ({ value, onChange, max = 10 }: MultiImageUploadProps) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  useEffect(() => {
    if (value && value.length > 0) {
      const existing = fileList.filter((f) => f.status === "uploading");
      const fromValue = value.map((url, i) => ({
        uid: `existing-${i}`,
        name: url.split("/").pop() || `image-${i}`,
        status: "done" as const,
        url,
      }));
      setFileList([...fromValue, ...existing]);
    }
  // Only sync from value on mount or when value reference changes from outside
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      onSuccess?.({ url });
    } catch (err) {
      message.error("Image upload failed");
      onError?.(err as Error);
    }
  };

  const handleChange: UploadProps["onChange"] = ({ fileList: newFileList }) => {
    setFileList(newFileList);

    const urls = newFileList
      .filter((f) => f.status === "done")
      .map((f) => f.url || (f.response as { url?: string })?.url)
      .filter((u): u is string => !!u);

    onChange?.(urls);
  };

  return (
    <Upload
      listType="picture-card"
      fileList={fileList}
      customRequest={customRequest}
      onChange={handleChange}
      maxCount={max}
      accept="image/*"
      multiple
    >
      {fileList.length < max && (
        <div>
          <PlusOutlined />
          <div style={{ marginTop: 8 }}>Upload</div>
        </div>
      )}
    </Upload>
  );
};
