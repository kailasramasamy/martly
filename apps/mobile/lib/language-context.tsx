import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";

const SUPPORTED_CODES = ["ta", "kn", "te", "hi"] as const;
type LanguageCode = (typeof SUPPORTED_CODES)[number];

const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  ta: "Tamil (\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD)",
  kn: "Kannada (\u0C95\u0CA8\u0CCD\u0CA8\u0CA1)",
  te: "Telugu (\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41)",
  hi: "Hindi (\u0939\u093F\u0928\u094D\u0926\u0940)",
};

const STORAGE_KEY = "martly_language";

interface LanguageContextValue {
  language: LanguageCode | null;
  setLanguage: (lang: LanguageCode | null) => void;
  supportedLanguages: typeof LANGUAGE_LABELS;
  getLocalizedName: (item: { name: string; translations?: Record<string, { name?: string; description?: string }> | null }, field?: "name" | "description") => string;
  getLocalizedSubtitle: (item: { name: string; translations?: Record<string, { name?: string; description?: string }> | null }) => string | null;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: null,
  setLanguage: () => {},
  supportedLanguages: LANGUAGE_LABELS,
  getLocalizedName: (item) => item.name,
  getLocalizedSubtitle: () => null,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored && SUPPORTED_CODES.includes(stored as LanguageCode)) {
        setLanguageState(stored as LanguageCode);
      } else {
        // Auto-detect from device locale
        const locales = getLocales();
        const deviceLang = locales[0]?.languageCode;
        if (deviceLang && SUPPORTED_CODES.includes(deviceLang as LanguageCode)) {
          setLanguageState(deviceLang as LanguageCode);
        }
      }
      setLoaded(true);
    });
  }, []);

  const setLanguage = useCallback((lang: LanguageCode | null) => {
    setLanguageState(lang);
    if (lang) {
      AsyncStorage.setItem(STORAGE_KEY, lang);
    } else {
      AsyncStorage.removeItem(STORAGE_KEY);
    }
  }, []);

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

  if (!loaded) return null;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, supportedLanguages: LANGUAGE_LABELS, getLocalizedName, getLocalizedSubtitle }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
