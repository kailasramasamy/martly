import { api } from "./api";

/** Upload a local image (from expo-image-picker) and return its public URL */
export async function uploadImage(uri: string): Promise<string> {
  const filename = uri.split("/").pop() || "photo.jpg";
  const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";

  const formData = new FormData();
  formData.append("file", { uri, name: filename, type: mimeType } as unknown as Blob);

  const res = await api.upload<{ url: string }>("/api/v1/uploads", formData);
  return res.data.url;
}
