import { api } from "./api";

/** Multipart body for a local image picked with expo-image-picker */
function imageForm(uri: string): FormData {
  const filename = uri.split("/").pop() || "photo.jpg";
  const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";
  const formData = new FormData();
  formData.append("file", { uri, name: filename, type: mimeType } as unknown as Blob);
  return formData;
}

/** Upload a local image (from expo-image-picker) and return its public URL */
export async function uploadImage(uri: string): Promise<string> {
  const res = await api.upload<{ url: string }>("/api/v1/uploads", imageForm(uri));
  return res.data.url;
}

export interface BrandLogo {
  imageUrl: string;
  themeColor: string | null;
  themeColorSecondary: string | null;
  /** Removed by the API, already transparent, or kept as uploaded */
  background: "removed" | "transparent" | "kept";
}

/** Upload a brand logo: the API trims it, removes an opaque background when asked, and suggests brand colours from it */
export async function uploadBrandLogo(uri: string, removeBackground: boolean): Promise<BrandLogo> {
  const res = await api.upload<BrandLogo>(`/api/v1/brands/logo?removeBackground=${removeBackground}`, imageForm(uri));
  return res.data;
}
