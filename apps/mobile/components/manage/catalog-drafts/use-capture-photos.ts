import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
import * as ImagePicker from "expo-image-picker";
import { uploadImage } from "../../../lib/upload";
import { useToast } from "../../../lib/toast-context";

export const MAX_PHOTOS = 8;

export interface CapturePhoto {
  key: number;
  uri: string;
  /** Public URL once uploaded */
  url: string | null;
  state: "uploading" | "done" | "error";
}

// Uploads one photo, marking it done with its public URL or failed (tap to retry) on the thumbnail
function usePhotoUpload(setPhotos: Dispatch<SetStateAction<CapturePhoto[]>>) {
  const toast = useToast();
  const patch = useCallback((key: number, next: Partial<CapturePhoto>) => {
    setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, ...next } : p)));
  }, [setPhotos]);

  return useCallback(async (key: number, uri: string) => {
    patch(key, { state: "uploading" });
    try {
      patch(key, { url: await uploadImage(uri), state: "done" });
    } catch (err) {
      patch(key, { state: "error" });
      toast.show(err instanceof Error ? err.message : "Upload failed", "error");
    }
  }, [patch, toast]);
}

/** Photos for one product: each uploads as soon as it is taken so Submit never waits on the network */
export function useCapturePhotos() {
  const toast = useToast();
  const [photos, setPhotos] = useState<CapturePhoto[]>([]);
  const nextKey = useRef(0);
  const upload = usePhotoUpload(setPhotos);

  const add = useCallback((uris: string[]) => {
    const room = MAX_PHOTOS - photos.length;
    const added = uris.slice(0, room).map((uri) => ({ key: nextKey.current++, uri, url: null, state: "uploading" as const }));
    setPhotos((prev) => [...prev, ...added]);
    added.forEach((p) => upload(p.key, p.uri));
  }, [photos.length, upload]);

  const takePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      toast.show("Camera permission is required", "error");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (!result.canceled) add(result.assets.map((a) => a.uri));
  }, [add, toast]);

  const pickFromGallery = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], quality: 0.7, allowsMultipleSelection: true, selectionLimit: MAX_PHOTOS - photos.length,
      // Gallery photos can be HEIC; the label reader and image tools need JPEG
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (!result.canceled) add(result.assets.map((a) => a.uri));
  }, [add, photos.length]);

  const remove = useCallback((key: number) => setPhotos((prev) => prev.filter((p) => p.key !== key)), []);
  const retry = useCallback((key: number) => {
    const photo = photos.find((p) => p.key === key);
    if (photo) upload(key, photo.uri);
  }, [photos, upload]);
  const reset = useCallback(() => setPhotos([]), []);

  const uploading = photos.some((p) => p.state === "uploading");
  const urls = photos.map((p) => p.url).filter((u): u is string => !!u);
  const ready = urls.length > 0 && !uploading && photos.every((p) => p.state === "done");

  return { photos, urls, ready, uploading, takePhoto, pickFromGallery, remove, retry, reset };
}
