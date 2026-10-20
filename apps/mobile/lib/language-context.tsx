import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { reloadAsync } from "expo-updates";
import { setActiveLanguage } from "./i18n";
import { usesTamilFont } from "./i18n/fonts";

const SUPPORTED_CODES = ["ta", "kn", "te", "hi"] as const;
export type LanguageCode = (typeof SUPPORTED_CODES)[number];

const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  // Native script first, so a shopper who can't read English still finds their language
  ta: "\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD (Tamil)",
  kn: "\u0C95\u0CA8\u0CCD\u0CA8\u0CA1 (Kannada)",
  te: "\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41 (Telugu)",
  hi: "\u0939\u093F\u0928\u094D\u0926\u0940 (Hindi)",
};

const STORAGE_KEY = "martly_language";
// Stored when the shopper picks English, so a Tamil-locale phone doesn't auto-switch back on the next launch
const ENGLISH = "en";

const isSupported = (code: string | null | undefined): code is LanguageCode =>
  !!code && SUPPORTED_CODES.includes(code as LanguageCode);

/** The saved language, or the device's when nothing is saved; read before fonts load at launch */
export async function loadInitialLanguage(): Promise<LanguageCode | null> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored === ENGLISH) return null;
  if (isSupported(stored)) return stored;
  const deviceLang = getLocales()[0]?.languageCode;
  return isSupported(deviceLang) ? deviceLang : null;
}

interface LanguageContextValue {
  language: LanguageCode | null;
  setLanguage: (lang: LanguageCode | null) => Promise<void>;
  supportedLanguages: typeof LANGUAGE_LABELS;
  getLocalizedName: (item: { name: string; translations?: Record<string, { name?: string; description?: string }> | null }, field?: "name" | "description") => string;
  getLocalizedSubtitle: (item: { name: string; translations?: Record<string, { name?: string; description?: string }> | null }) => string | null;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: null,
  setLanguage: async () => {},
  supportedLanguages: LANGUAGE_LABELS,
  getLocalizedName: (item) => item.name,
  getLocalizedSubtitle: () => null,
});

export function LanguageProvider({ initialLanguage, children }: { initialLanguage: LanguageCode | null; children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode | null>(initialLanguage);
  // Synced during render so plain helpers calling strings() see the same language as their component
  setActiveLanguage(language);

  const setLanguage = useCallback(async (lang: LanguageCode | null) => {
    await AsyncStorage.setItem(STORAGE_KEY, lang ?? ENGLISH);
    // Fonts load once at launch, so a switch into or out of Tamil restarts the app to swap them
    if (usesTamilFont(lang) !== usesTamilFont(language)) {
      await reloadAsync();
      return;
    }
    setLanguageState(lang);
  }, [language]);

  const getLocalizedName = useCallback(
    (item: { name: string; translations?: Record<string, { name?: string; description?: string }> | null }, field: "name" | "description" = "name") => {
      if (!language || !item.translations?.[language]?.[field]) return item.name;
      return item.translations[language][field]!;
    },
    [language],
  );

  const getLocalizedSubtitle = useCallback(
    (item: { name: string; translations?: Record<string, { name?: string; description?: string }> | null }) => {
      if (!language || !item.translations?.[language]?.name) return null;
      return item.name; // English name as subtitle when showing translated name
    },
    [language],
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, supportedLanguages: LANGUAGE_LABELS, getLocalizedName, getLocalizedSubtitle }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
