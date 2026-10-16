import type { ReactNode } from "react";
import { can, type Resource } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";
import { EmptyState } from "../ui/EmptyState";

interface AccessGateProps {
  resource: Resource;
  children: ReactNode;
}

/** Renders children only when the role may list the resource; wrapping keeps the inner screen's data hooks from firing for denied roles */
export function AccessGate({ resource, children }: AccessGateProps) {
  const { user } = useAuth();
  if (!user || !can(user, resource, "list")) {
    return <EmptyState icon="lock-closed-outline" title="No access" message="Your role doesn't have access to this section." />;
  }
  return <>{children}</>;
}
