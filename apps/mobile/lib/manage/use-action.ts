import { useState, useCallback } from "react";
import { useToast } from "../toast-context";

/**
 * Wrap a mutation: tracks `running`, shows the API error as a toast and an optional success toast.
 * Resolves to the action's result, or undefined when it failed.
 */
export function useAction() {
  const toast = useToast();
  const [running, setRunning] = useState(false);

  const run = useCallback(async <R,>(fn: () => Promise<R>, successMessage?: string): Promise<R | undefined> => {
    setRunning(true);
    try {
      const result = await fn();
      if (successMessage) toast.show(successMessage, "success");
      return result;
    } catch (err) {
      toast.show(err instanceof Error ? err.message : "Something went wrong", "error");
      return undefined;
    } finally {
      setRunning(false);
    }
  }, [toast]);

  return { run, running };
}
