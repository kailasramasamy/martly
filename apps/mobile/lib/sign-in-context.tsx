import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AuthGate } from "../components/AuthGate";
import { useAuth } from "./auth-context";
import { strings } from "./i18n";

interface Prompt {
  title: string;
  subtitle: string;
}

type RequireSignIn = (then: () => void, prompt?: Partial<Prompt>) => void;

const SignInContext = createContext<RequireSignIn | null>(null);

/** One sign-in sheet for the whole shop: guests browse freely and sign in only when an action needs an account */
export function SignInProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const pending = useRef<(() => void) | null>(null);

  const requireSignIn = useCallback<RequireSignIn>((then, custom) => {
    if (isAuthenticated) return then();
    pending.current = then;
    const t = strings("auth");
    setPrompt({ title: t.gate.defaultTitle, subtitle: t.gate.defaultSubtitle, ...custom });
  }, [isAuthenticated]);

  const [signedIn, setSignedIn] = useState(false);

  // Run the waiting action only once the whole app sees the new session (and a new customer has given their name)
  useEffect(() => {
    if (!signedIn || !isAuthenticated) return;
    setSignedIn(false);
    const then = pending.current;
    pending.current = null;
    then?.();
  }, [signedIn, isAuthenticated]);

  const finish = () => {
    setPrompt(null);
    setSignedIn(true);
  };

  return (
    <SignInContext.Provider value={requireSignIn}>
      {children}
      <AuthGate
        visible={!!prompt}
        title={prompt?.title}
        subtitle={prompt?.subtitle}
        onAuthenticated={finish}
        onDismiss={() => { pending.current = null; setPrompt(null); }}
      />
    </SignInContext.Provider>
  );
}

/** Runs `then` straight away when signed in; otherwise asks the guest to sign in first, then runs it */
export function useRequireSignIn(): RequireSignIn {
  const ctx = useContext(SignInContext);
  if (!ctx) throw new Error("useRequireSignIn must be used inside SignInProvider");
  return ctx;
}
