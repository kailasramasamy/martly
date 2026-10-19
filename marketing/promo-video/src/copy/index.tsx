import { createContext, useContext, type ReactNode } from "react";
import { en, type Copy } from "./en";
import { ta } from "./ta";

export type { Copy, Line } from "./en";
export type Lang = "en" | "ta";

const COPIES: Record<Lang, Copy> = { en, ta };
const CopyContext = createContext<Copy>(en);

export const CopyProvider = ({ lang, children }: { lang: Lang; children: ReactNode }) => (
  <CopyContext.Provider value={COPIES[lang]}>{children}</CopyContext.Provider>
);

export const useCopy = () => useContext(CopyContext);
