import { useAuth } from "../../../lib/auth-context";
import { EmptyState } from "../../../components/manage/ui/EmptyState";
import { ProductForm } from "../../../components/manage/products/ProductForm";
import { can } from "@martly/shared/permissions";

export default function NewProductScreen() {
  const { user } = useAuth();
  if (!can(user?.role ?? "", "products", "create")) {
    return <EmptyState icon="lock-closed-outline" title="No access" message="Your role can't create products." />;
  }
  return <ProductForm />;
}
