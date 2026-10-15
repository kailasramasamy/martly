import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ManageStackScreen } from "../ManageStackScreen";
import { useStoreScope } from "../StoreScope";
import { EmptyState } from "../ui/EmptyState";
import { SectionCard } from "../ui/SectionCard";
import { manage } from "../ui/tokens";
import { AddOption } from "./AddOption";
import { QueueAction } from "./QueueAction";
import { useAddPermissions } from "./use-add-permissions";
import { useQueueCount } from "./use-queue-count";

/** Hub for adding a product: list one from the catalog, or create a new one with AI or by hand */
export function AddProductScreen() {
  const router = useRouter();
  const { storeId } = useStoreScope();
  const { canList, canSnap, canManual, canQueue } = useAddPermissions();
  const queueCount = useQueueCount(storeId, canQueue);

  if (!canList && !canSnap && !canManual) {
    return <EmptyState icon="lock-closed-outline" title="No access" message="Your role can't add products." />;
  }

  const queueAction = canQueue
    ? () => <QueueAction count={queueCount} onPress={() => router.push("/manage/catalog-drafts")} />
    : undefined;

  return (
    <ManageStackScreen title="Add product" headerRight={queueAction}>
      {canList && (
        <SectionCard title="Already in the catalog" flush>
          <AddOption
            icon="library-outline"
            title="Add from master catalog"
            description="Find the product, then set your price and stock for this store."
            onPress={() => router.push("/manage/store-products/new")}
          />
        </SectionCard>
      )}
      {(canSnap || canManual) && (
        <SectionCard title="Create a new product" flush>
          {canSnap && (
            <AddOption
              icon="sparkles"
              title="Easy add with AI"
              description="Take photos. AI reads the label, picks the brand and aisle, and cleans up the images."
              onPress={() => router.push("/manage/catalog-drafts/new")}
              featured
            />
          )}
          {canSnap && canManual && <View style={styles.rule} />}
          {canManual && (
            <AddOption
              icon="create-outline"
              title="Create manually"
              description="Fill in the name, brand, aisle, sizes and images yourself."
              onPress={() => router.push("/manage/products/new")}
            />
          )}
        </SectionCard>
      )}
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  rule: { height: 1, backgroundColor: manage.hairline, marginLeft: 70 },
});
