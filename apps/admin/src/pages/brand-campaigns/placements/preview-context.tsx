import { createContext, useContext, type ReactNode } from "react";

/** What a real campaign swaps into the schematic mockups; empty keeps them generic */
export interface PreviewBrand {
  logoUrl?: string | null;
  creativeUrl?: string | null;
  productImageUrl?: string | null;
  categoryName?: string | null;
  offLabel?: string | null;
  brandName?: string;
}

const EMPTY: PreviewBrand = {};
const PreviewContext = createContext<PreviewBrand>(EMPTY);

export function PreviewBrandProvider({ value, children }: { value: PreviewBrand; children: ReactNode }) {
  return <PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>;
}

export const usePreviewBrand = () => useContext(PreviewContext);
