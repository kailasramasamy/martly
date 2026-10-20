import { en } from "./en";
import { ta } from "./ta";

export type Namespace = keyof typeof en;
export type Strings<N extends Namespace> = (typeof en)[N];
export type Catalog = { [N in Namespace]: Strings<N> };

// Languages with a full UI catalog; the others (kn, te, hi) translate data only and keep the English UI
const catalogs: Partial<Record<string, Catalog>> = { ta };

let active: string | null = null;

/** Kept in step with LanguageProvider so plain helpers can read the shopper's language */
export function setActiveLanguage(lang: string | null) {
  active = lang;
}

export function activeLanguage(): string | null {
  return active;
}

export function stringsFor<N extends Namespace>(lang: string | null, ns: N): Strings<N> {
  return (lang ? catalogs[lang]?.[ns] : undefined) ?? en[ns];
}

/** UI strings for helpers that run during render (status labels, formatters); components use useStrings */
export function strings<N extends Namespace>(ns: N): Strings<N> {
  return stringsFor(active, ns);
}

export function activeLocale(): string {
  return active === "ta" ? "ta-IN" : "en-IN";
}
