import { useCallback, useState } from "react";
import { api } from "./api";
import { useAuth } from "./auth-context";
import { useToast } from "./toast-context";

export type PhoneChangeStep = "idle" | "number" | "code";

/**
 * Change your own phone: send a code to the new number, then save it once verified.
 * The phone doubles as an OTP login, so the API refuses unverified or already-used numbers.
 */
export function usePhoneChange() {
  const { refreshUser } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState<PhoneChangeStep>("idle");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      return true;
    } catch (e: unknown) {
      toast.show(e instanceof Error ? e.message : "Something went wrong", "error");
      return false;
    } finally {
      setBusy(false);
    }
  }, [toast]);

  const start = useCallback(() => { setPhone(""); setCode(""); setStep("number"); }, []);
  const cancel = useCallback(() => setStep("idle"), []);

  const sendCode = useCallback(async () => {
    if (await run(() => api.post("/api/v1/auth/phone/otp", { phone: phone.trim() }))) setStep("code");
  }, [run, phone]);

  const verify = useCallback(async () => {
    const ok = await run(async () => {
      await api.post("/api/v1/auth/phone/verify", { phone: phone.trim(), otp: code.trim() });
      await refreshUser();
    });
    if (!ok) return;
    toast.show("Phone number updated", "success");
    setStep("idle");
  }, [run, phone, code, refreshUser, toast]);

  return { step, phone, setPhone, code, setCode, busy, start, cancel, sendCode, verify };
}
