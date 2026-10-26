import { useState } from "react";
import { Upload, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { UploadFile, UploadProps } from "antd/es/upload";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:7001";
const TOKEN_KEY = "martly_admin_token";

/** POSTs an image to an API upload endpoint and returns the response's `data` */
export async function postImage<T>(path: string, file: Blob): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) throw new Error("Upload failed");
  return (await res.json()).data as T;
}

const plainUpload = async (file: Blob) => (await postImage<{ url: string }>("/api/v1/uploads", file)).url;
/** Store logos: the API trims the margins so a wide wordmark fills its plate */
export const logoUpload = async (file: Blob) => (await postImage<{ url: string }>("/api/v1/uploads?kind=logo", file)).url;

interface ImageUploadProps {
  value?: string;
  onChange?: (url: string) => void;
  /** Uploads the file and returns the image URL to keep; defaults to the plain image upload */
  upload?: (file: Blob) => Promise<string>;
}

export const ImageUpload = ({ value, onChange, upload = plainUpload }: ImageUploadProps) => {
  const [fileList, setFileList] = useState<UploadFile[]>(
    value ? [{ uid: "-1", name: "current", status: "done", url: value }] : [],
  );

  const customRequest: UploadProps["customRequest"] = async ({ file, onSuccess, onError }) => {
    try {
      const url = await upload(file as Blob);
      onChange?.(url);
      onSuccess?.(url);
    } catch (err) {
      message.error("Image upload failed");
      onError?.(err as Error);
    }
  };

  // A finished upload previews what was stored, which may differ from the picked file (e.g. a cleaned-up logo)
  const handleChange: UploadProps["onChange"] = ({ fileList: newFileList }) => {
    setFileList(newFileList.slice(-1).map((f) => (f.status === "done" && typeof f.response === "string" ? { ...f, url: f.response, thumbUrl: f.response } : f)));
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
