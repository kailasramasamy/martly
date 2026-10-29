import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useToast } from "../../../lib/toast-context";
import { SectionCard } from "../ui/SectionCard";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { ListSkeleton } from "../ui/ListSkeleton";
import { ManageStackScreen } from "../ManageStackScreen";
import { numberText, parseNumber } from "./numbers";

interface DeliveryCharges { deliveryRadius: number; freeDeliveryThreshold: number | null; minOrderAmount: number | null }

function validate(radius: number | null, freeAbove: number | null, minOrder: number | null): string | null {
  if (radius === null || Number.isNaN(radius) || radius <= 0 || radius > 30) return "Delivery radius must be between 0 and 30 km";
  if (freeAbove !== null && (Number.isNaN(freeAbove) || freeAbove < 0)) return "Free delivery amount must be 0 or more";
  if (minOrder !== null && (Number.isNaN(minOrder) || minOrder < 0)) return "Minimum order must be 0 or more";
  return null;
}

/** The store's radius, free-delivery amount and minimum order, set beside its distance tiers */
export function ChargesForm({ storeId }: { storeId: string }) {
  const router = useRouter();
  const toast = useToast();
  const { run, running } = useAction();
  const [loaded, setLoaded] = useState(false);
  const [radius, setRadius] = useState("");
  const [freeAbove, setFreeAbove] = useState("");
  const [minOrder, setMinOrder] = useState("");

  useEffect(() => {
    run(() => api.get<DeliveryCharges>(`/api/v1/delivery-tiers/settings?storeId=${storeId}`)).then((res) => {
      if (!res) return;
      setRadius(numberText(res.data.deliveryRadius));
      setFreeAbove(numberText(res.data.freeDeliveryThreshold));
      setMinOrder(numberText(res.data.minOrderAmount));
      setLoaded(true);
    });
  }, [run, storeId]);

  const save = async () => {
    const [deliveryRadius, freeDeliveryThreshold, minOrderAmount] = [radius, freeAbove, minOrder].map(parseNumber);
    const problem = validate(deliveryRadius, freeDeliveryThreshold, minOrderAmount);
    if (problem) return toast.show(problem, "error");
    const body = { deliveryRadius, freeDeliveryThreshold, minOrderAmount };
    const done = await run(() => api.put(`/api/v1/delivery-tiers/settings?storeId=${storeId}`, body), "Delivery charges saved");
    if (done) router.back();
  };

  return (
    <ManageStackScreen
      title="Radius & order rules"
      actions={<Button label="Save changes" onPress={save} loading={running} disabled={!loaded} style={styles.flex} />}
    >
      {loaded ? (
        <SectionCard title="Delivery area and order rules">
          <TextField label="Delivery radius" required suffix="km" keyboardType="decimal-pad" hint="Addresses farther than this can't order delivery" value={radius} onChangeText={setRadius} />
          <TextField label="Free delivery above" prefix={"₹"} keyboardType="decimal-pad" placeholder="No free delivery" value={freeAbove} onChangeText={setFreeAbove} />
          <TextField label="Minimum order" prefix={"₹"} keyboardType="decimal-pad" placeholder="No minimum" value={minOrder} onChangeText={setMinOrder} />
        </SectionCard>
      ) : <ListSkeleton />}
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
