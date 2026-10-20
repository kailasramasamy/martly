import type { ComponentType } from "react";
import type { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/auth-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { SignInPrompt } from "../SignInPrompt";

type PromptKey = keyof ReturnType<typeof useStrings<"account">>["signIn"];

/** withSignIn for account screens, with the prompt text read in the shopper's language at render time */
export function withAccountSignIn(Screen: ComponentType, icon: keyof typeof Ionicons.glyphMap, promptKey: PromptKey) {
  return function SignedInOnly() {
    const { isAuthenticated, isLoading } = useAuth();
    const t = useStrings("account");
    if (isLoading) return null;
    return isAuthenticated ? <Screen /> : <SignInPrompt icon={icon} {...t.signIn[promptKey]} />;
  };
}
