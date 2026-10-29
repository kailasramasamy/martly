import { useState, useEffect, useRef } from "react";
import { Upload, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { UploadFile, UploadProps } from "antd/es/upload";
import { postImage } from "./ImageUpload";

interface MultiImageUploadProps {
  value?: string[];
  onChange?: (urls: string[]) => void;
  max?: number;
  /** Also takes images pasted anywhere on the page (one paste target per page) */
  acceptPaste?: boolean;
}

const uploadImage = async (file: Blob) => (await postImage<{ url: string }>("/api/v1/uploads", file)).url;

const doneUrls = (list: UploadFile[]) =>
  list
    .filter((f) => f.status === "done")
    .map((f) => f.url || (f.response as { url?: string })?.url)
    .filter((u): u is string => !!u);

export const MultiImageUpload = ({ value, onChange, max = 10, acceptPaste = false }: MultiImageUploadProps) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const listRef = useRef(fileList);

  const update = (next: UploadFile[]) => {
    listRef.current = next;
    setFileList(next);
    onChange?.(doneUrls(next));
  };

  useEffect(() => {
    if (value && value.length > 0) {
      const existing = fileList.filter((f) => f.status === "uploading");
      const fromValue = value.map((url, i) => ({
        uid: `existing-${i}`,
        name: url.split("/").pop() || `image-${i}`,
        status: "done" as const,
        url,
      }));
      listRef.current = [...fromValue, ...existing];
      setFileList(listRef.current);
    }
  // Only sync from value on mount or when value reference changes from outside
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!acceptPaste) return;
    const onPaste = async (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length === 0) return;
      e.preventDefault();
      const room = max - listRef.current.length;
      if (room <= 0) return void message.warning(`Up to ${max} images`);
      await Promise.all(files.slice(0, room).map(async (file) => {
        const uid = `paste-${crypto.randomUUID()}`;
        update([...listRef.current, { uid, name: file.name || "pasted image", status: "uploading" }]);
        try {
          const url = await uploadImage(file);
          update(listRef.current.map((f) => (f.uid === uid ? { ...f, status: "done", url, thumbUrl: url } : f)));
          message.success("Pasted image added");
        } catch {
          update(listRef.current.filter((f) => f.uid !== uid));
          message.error("Image upload failed");
        }
      }));
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [acceptPaste, max]);

  const customRequest: UploadProps["customRequest"] = async ({ file, onSuccess, onError }) => {
    try {
      onSuccess?.({ url: await uploadImage(file as Blob) });
    } catch (err) {
      message.error("Image upload failed");
      onError?.(err as Error);
    }
  };

  const handleChange: UploadProps["onChange"] = ({ fileList: newFileList }) => update(newFileList);

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
          <div style={{ marginTop: 8 }}>{acceptPaste ? "Upload or paste" : "Upload"}</div>
        </div>
      )}
    </Upload>
  );
};
