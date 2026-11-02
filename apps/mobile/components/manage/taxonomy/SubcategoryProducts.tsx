import { useRouter } from "expo-router";
import { HeaderAction } from "../HeaderAction";
import { ProductBrowser } from "../products/ProductBrowser";

interface SubcategoryProductsProps {
  id: string;
  name?: string;
  path?: string[];
  canWrite: boolean;
  canRank: boolean;
}

/** Leaf of the category drill-down: the products filed under one subcategory */
export function SubcategoryProducts({ id, name, path, canWrite, canRank }: SubcategoryProductsProps) {
  const router = useRouter();
  return (
    <ProductBrowser
      title={name ?? "Subcategory"}
      searchPlaceholder="Search in this subcategory"
      subcategoryId={id}
      context={path?.slice(0, -1).join(" › ")}
      headerRight={canWrite || canRank ? () => (
        <>
          {canRank && <HeaderAction icon="podium-outline" onPress={() => router.push(`/manage/categories/${id}/brand-ranking?level=subcategory`)} accessibilityLabel="Brand ranking" />}
          {canWrite && <HeaderAction icon="create-outline" onPress={() => router.push(`/manage/categories/${id}/edit?level=subcategory`)} accessibilityLabel="Edit" />}
        </>
      ) : undefined}
    />
  );
}
