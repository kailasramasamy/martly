import type { ReactNode } from "react";
import {  } from "react-native";
import { Loader } from "../../Loader";
import { colors } from "../../../constants/theme";
import { EmptyState } from "../ui/EmptyState";

interface AsyncBodyProps {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: ReactNode;
}

/** Loading / error switch for the area under a period selector, so the selector itself stays mounted while data reloads */
export function AsyncBody({ loading, error, onRetry, children }: AsyncBodyProps) {
  if (loading) return <Loader style={{ marginTop: 40 }} size="large" />;
  if (error) return <EmptyState icon="cloud-offline-outline" title="Couldn't load" message={error} action={{ label: "Try again", onPress: onRetry }} />;
  return <>{children}</>;
}
