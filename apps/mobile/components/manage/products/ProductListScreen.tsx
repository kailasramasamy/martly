import { useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";
import { HeaderAction } from "../HeaderAction";
import { ProductBrowser } from "./ProductBrowser";

export function ProductListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const canCreate = can(user, "products", "create") || can(user, "catalog-drafts", "create") || can(user, "store-products", "create");

  return (
    <ProductBrowser
      title="Products"
      searchPlaceholder="Search products or brands"
      headerRight={canCreate ? () => <HeaderAction onPress={() => router.push("/manage/add-product")} accessibilityLabel="Add product" /> : undefined}
    />
  );
}
