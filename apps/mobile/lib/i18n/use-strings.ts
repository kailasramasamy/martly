import { useLanguage } from "../language-context";
import { stringsFor, type Namespace, type Strings } from "./index";

/** A namespace of UI strings in the shopper's language; re-renders when the language changes */
export function useStrings<N extends Namespace>(ns: N): Strings<N> {
  const { language } = useLanguage();
  return stringsFor(language, ns);
}
