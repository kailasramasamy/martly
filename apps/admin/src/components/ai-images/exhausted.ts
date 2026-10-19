import { isAxiosError, type AxiosError } from "axios";

/** True when the API refused a generation because the organisation has too few AI images (HTTP 402, error AI_IMAGES_EXHAUSTED) */
export const isAiImagesExhausted = (err: unknown): err is AxiosError<{ error: string; message: string }> =>
  isAxiosError(err) && err.response?.status === 402 && err.response.data?.error === "AI_IMAGES_EXHAUSTED";
